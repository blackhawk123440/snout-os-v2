/**
 * Sitter Auto-Payout
 *
 * Triggered when a booking is completed AND paid.
 * Transfers the sitter's commission to their Stripe Connect account.
 * Handles the case where sitter hasn't connected Stripe yet
 * by creating a pending payout that's processed on connect.
 */

import { getScopedDb } from '@/lib/tenancy';
import { logEvent } from '@/lib/log-event';

export async function processSitterPayout(params: {
  orgId: string;
  bookingId: string;
  sitterId: string;
  correlationId?: string;
}): Promise<{ success: boolean; transferId?: string; amount?: number; error?: string }> {
  const { orgId, bookingId, sitterId, correlationId } = params;
  const db = getScopedDb({ orgId });

  // 1. Load booking and sitter
  const booking = await db.booking.findFirst({ where: { id: bookingId } }) as any;
  if (!booking) return { success: false, error: 'Booking not found' };
  if (booking.paymentStatus !== 'paid' && booking.paymentStatus !== 'deposit_paid') {
    return { success: false, error: `Booking payment status is ${booking.paymentStatus}, not paid` };
  }
  if (booking.status !== 'completed') return { success: false, error: 'Booking not completed' };

  const sitter = await db.sitter.findFirst({ where: { id: sitterId } }) as any;
  if (!sitter) return { success: false, error: 'Sitter not found' };

  // 2. Check if payout already exists (idempotency)
  const existingPayout = await (db as any).payoutTransfer.findFirst({
    where: { bookingId, sitterId, status: { in: ['completed', 'pending'] } },
  });
  if (existingPayout) {
    return { success: true, transferId: existingPayout.stripeTransferId, amount: existingPayout.amount / 100 };
  }

  // 3. Calculate sitter's share
  const commissionPct = sitter.commissionPercentage ?? 80;
  const sitterAmountDollars = booking.totalPrice * (commissionPct / 100);
  const sitterAmountCents = Math.round(sitterAmountDollars * 100);

  if (sitterAmountCents <= 0) {
    return { success: false, error: 'Calculated payout is $0' };
  }

  // 4. Check Stripe Connect account
  const stripeAccount = await (db as any).sitterStripeAccount.findFirst({
    where: { sitterId },
    select: { stripeAccountId: true, payoutsEnabled: true },
  });

  if (!stripeAccount?.stripeAccountId) {
    // Create pending payout — will be processed when sitter connects Stripe
    await (db.payoutTransfer as any).create({
      data: {
        bookingId,
        sitterId,
        amount: sitterAmountCents,
        currency: 'usd',
        status: 'pending',
        stripeTransferId: null,
        lastError: 'Sitter has no Stripe account. Payout held until connected.',
      },
    });

    await logEvent({
      orgId, action: 'payout.held', bookingId,
      status: 'success',
      metadata: { sitterId, amount: sitterAmountDollars, reason: 'no_stripe_account', correlationId },
    });

    return { success: false, error: 'Sitter has no Stripe account. Payout held.' };
  }

  // 5. Create Stripe Transfer
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-03-31.basil' as any });

    const transfer = await stripe.transfers.create({
      amount: sitterAmountCents,
      currency: 'usd',
      destination: stripeAccount.stripeAccountId,
      transfer_group: bookingId,
      metadata: { bookingId, sitterId, orgId },
    });

    // 6. Record payout
    await (db.payoutTransfer as any).create({
      data: {
        bookingId,
        sitterId,
        amount: sitterAmountCents,
        currency: 'usd',
        status: 'completed',
        stripeTransferId: transfer.id,
      },
    });

    // 7. Record earning
    await (db.sitterEarning as any).create({
      data: {
        sitterId,
        bookingId,
        amount: sitterAmountDollars,
        type: 'booking_commission',
      },
    });

    // 8. Ledger entry
    await (db.ledgerEntry as any).create({
      data: {
        type: 'sitter_payout',
        amount: -sitterAmountDollars,
        bookingId,
        description: `Sitter payout: $${sitterAmountDollars.toFixed(2)} for booking ${bookingId}`,
      },
    });

    await logEvent({
      orgId, action: 'payout.completed', bookingId,
      status: 'success',
      metadata: { sitterId, amount: sitterAmountDollars, transferId: transfer.id, correlationId },
    });

    return { success: true, transferId: transfer.id, amount: sitterAmountDollars };
  } catch (error: any) {
    // Record failed payout
    await (db.payoutTransfer as any).create({
      data: {
        bookingId,
        sitterId,
        amount: sitterAmountCents,
        currency: 'usd',
        status: 'failed',
        stripeTransferId: null,
        lastError: error.message,
      },
    });

    await logEvent({
      orgId, action: 'payout.failed', bookingId,
      status: 'failed',
      metadata: { sitterId, amount: sitterAmountDollars, error: error.message, correlationId },
    });

    return { success: false, error: error.message };
  }
}
