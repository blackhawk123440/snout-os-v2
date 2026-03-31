import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { stripe } from '@/lib/stripe';
import { logEvent } from '@/lib/log-event';

const RefundSchema = z.object({
  amount: z.number().min(0.01).optional(), // partial refund amount in dollars; full if omitted
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bookingId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = RefundSchema.safeParse(body);
    const requestedAmount = parsed.success ? parsed.data.amount : undefined;

    const db = getScopedDb(ctx);
    const booking = await db.booking.findFirst({
      where: { id: bookingId },
      select: { id: true, totalPrice: true, paymentStatus: true },
    });
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    // Find the Stripe charge
    const charge = await db.stripeCharge.findFirst({
      where: { bookingId, status: 'succeeded' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, amount: true, paymentIntentId: true },
    });
    if (!charge || !charge.paymentIntentId) {
      return NextResponse.json({ error: 'No Stripe payment found for this booking' }, { status: 400 });
    }

    const maxRefundDollars = charge.amount / 100;
    const refundDollars = requestedAmount ? Math.min(requestedAmount, maxRefundDollars) : maxRefundDollars;
    const refundCents = Math.round(refundDollars * 100);

    if (refundCents <= 0) {
      return NextResponse.json({ error: 'Invalid refund amount' }, { status: 400 });
    }

    // Process refund via Stripe
    const refund = await stripe.refunds.create({
      payment_intent: charge.paymentIntentId,
      amount: refundCents,
      reason: 'requested_by_customer',
    });

    // Record in DB
    await db.stripeRefund.create({
      data: {
        id: refund.id,
        chargeId: charge.id,
        amount: refundCents,
        currency: 'usd',
        reason: 'requested_by_customer',
        status: refund.status || 'succeeded',
        paymentIntentId: charge.paymentIntentId,
        createdAt: new Date(),
      },
    });

    // Ledger entry
    await db.ledgerEntry.create({
      data: {
        orgId: ctx.orgId,
        entryType: 'refund',
        source: 'stripe',
        stripeId: refund.id,
        bookingId,
        amountCents: refundCents,
        status: 'succeeded',
        occurredAt: new Date(),
      },
    });

    // Update booking payment status
    const isFullRefund = refundCents >= charge.amount;
    await db.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: isFullRefund ? 'refunded' : 'partial_refund' },
    });

    // If sitter was already paid, reverse their proportional share via Stripe
    let sitterPayoutReversal: {
      reversed: boolean;
      reversalAmount?: number;
      transferReversalId?: string;
      error?: string;
    } | null = null;

    // Find payout for this booking (any status that had a transfer)
    const existingPayout = await db.payoutTransfer.findFirst({
      where: { orgId: ctx.orgId, bookingId, stripeTransferId: { not: null } },
      select: { id: true, sitterId: true, amount: true, amountReversed: true, stripeTransferId: true, status: true },
    });

    if (existingPayout && existingPayout.stripeTransferId) {
      const remainingReversible = existingPayout.amount - (existingPayout.amountReversed ?? 0);

      // Idempotency: skip if nothing left to reverse
      if (remainingReversible <= 0) {
        sitterPayoutReversal = {
          reversed: true,
          reversalAmount: existingPayout.amountReversed / 100,
          error: 'Fully reversed — no remaining amount to reverse',
        };
      } else {
        // Calculate proportional reversal capped at remaining reversible amount
        // If booking was $100, sitter got $80 (80%), refund is $50 → reverse $40 from sitter
        const payoutRatio = charge.amount > 0 ? existingPayout.amount / charge.amount : 0;
        const proportionalCents = isFullRefund
          ? remainingReversible // full refund: reverse whatever remains
          : Math.round(refundCents * payoutRatio);
        // Cap at what's actually left to reverse
        const reversalCents = Math.min(proportionalCents, remainingReversible);

        if (reversalCents > 0) {
          try {
            const reversal = await stripe.transfers.createReversal(
              existingPayout.stripeTransferId,
              {
                amount: reversalCents,
                description: `Reversal for refund ${refund.id} on booking ${bookingId}`,
                metadata: {
                  refundId: refund.id,
                  bookingId,
                  orgId: ctx.orgId,
                },
              }
            );

            // Atomically update amountReversed and status
            const newAmountReversed = (existingPayout.amountReversed ?? 0) + reversalCents;
            const newStatus = newAmountReversed >= existingPayout.amount ? 'reversed' : 'partial_reversal';
            await db.payoutTransfer.update({
              where: { id: existingPayout.id },
              data: {
                amountReversed: newAmountReversed,
                status: newStatus,
                lastError: `Reversed $${(reversalCents / 100).toFixed(2)} via ${reversal.id} (total reversed: $${(newAmountReversed / 100).toFixed(2)} of $${(existingPayout.amount / 100).toFixed(2)})`,
              },
            });

            // Ledger entry for reversal (idempotent via stripeId unique constraint)
            const { upsertLedgerEntry } = await import('@/lib/finance/ledger');
            await upsertLedgerEntry(db, {
              orgId: ctx.orgId,
              entryType: 'payout_reversal' as any,
              source: 'stripe',
              stripeId: reversal.id,
              sitterId: existingPayout.sitterId,
              bookingId,
              amountCents: reversalCents,
              status: 'succeeded',
              occurredAt: new Date(),
            });

            // Update SitterEarning — prevent going below zero
            const earning = await db.sitterEarning.findFirst({
              where: { orgId: ctx.orgId, sitterId: existingPayout.sitterId, bookingId },
              select: { netAmount: true },
            });
            if (earning) {
              const decrementAmount = Math.min(reversalCents / 100, Math.max(0, earning.netAmount));
              if (decrementAmount > 0) {
                await db.sitterEarning.updateMany({
                  where: { orgId: ctx.orgId, sitterId: existingPayout.sitterId, bookingId },
                  data: { netAmount: { decrement: decrementAmount } },
                });
              }
            }

            // Adjust PayrollLineItem — read current value, cap decrement, single atomic write
            const payrollLine = await db.payrollLineItem.findFirst({
              where: { payoutTransferId: existingPayout.id },
              select: { id: true, payrollRunId: true, netAmount: true },
            });
            if (payrollLine) {
              const lineDecrement = Math.min(reversalCents / 100, Math.max(0, payrollLine.netAmount));
              if (lineDecrement > 0) {
                await db.payrollLineItem.update({
                  where: { id: payrollLine.id },
                  data: {
                    netAmount: { decrement: lineDecrement },
                    adjustments: { decrement: lineDecrement },
                    notes: `Reversed $${(reversalCents / 100).toFixed(2)} due to refund ${refund.id} (cumulative reversed: $${(newAmountReversed / 100).toFixed(2)})`,
                  },
                });
                await db.payrollRun.update({
                  where: { id: payrollLine.payrollRunId },
                  data: { totalAmount: { decrement: lineDecrement } },
                }).catch(() => {});
              }
            }

            sitterPayoutReversal = {
              reversed: true,
              reversalAmount: reversalCents / 100,
              transferReversalId: reversal.id,
            };

            await logEvent({
              orgId: ctx.orgId,
              action: 'payout.reversed',
              bookingId,
              status: 'success',
              metadata: {
                refundId: refund.id,
                payoutTransferId: existingPayout.id,
                sitterId: existingPayout.sitterId,
                reversalCents,
                newAmountReversed,
                remainingAfter: existingPayout.amount - newAmountReversed,
                transferReversalId: reversal.id,
                payrollLineAdjusted: !!payrollLine,
              },
            }).catch(() => {});
          } catch (reversalError) {
            // Transfer reversal failed — log and continue (refund already processed)
            const reversalMsg = reversalError instanceof Error ? reversalError.message : String(reversalError);
            sitterPayoutReversal = { reversed: false, error: reversalMsg };
            await logEvent({
              orgId: ctx.orgId,
              action: 'payout.reversal_failed',
              bookingId,
              status: 'failed',
              metadata: {
                refundId: refund.id,
                payoutTransferId: existingPayout.id,
                sitterId: existingPayout.sitterId,
                reversalCents,
                error: reversalMsg,
              },
            }).catch(() => {});
          }
        }
      }
    }

    await logEvent({
      orgId: ctx.orgId,
      action: 'payment.refunded',
      bookingId,
      status: 'success',
      metadata: { refundId: refund.id, amount: refundDollars, full: isFullRefund, sitterPayoutReversal },
    });

    return NextResponse.json({
      success: true,
      sitterPayoutReversal,
      refundId: refund.id,
      amount: refundDollars,
      full: isFullRefund,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Refund failed', message }, { status: 500 });
  }
}
