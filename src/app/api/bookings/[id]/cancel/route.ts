import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { calculateRefund } from '@/lib/cancellation-engine';
import { logEvent } from '@/lib/log-event';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin', 'client']);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const db = getScopedDb(ctx);
    const body = await request.json().catch(() => ({}));

    const booking = await db.booking.findFirst({
      where: { id },
    }) as any;

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    // Client can only cancel their own bookings
    if (ctx.role === 'client' && booking.clientId !== ctx.clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cancellableStatuses = ['pending_payment', 'confirmed', 'deposit_held', 'in_progress'];
    if (!cancellableStatuses.includes(booking.status)) {
      return NextResponse.json({
        error: `Cannot cancel a booking with status "${booking.status}"`,
      }, { status: 400 });
    }

    // Calculate refund
    const refundResult = calculateRefund({
      totalPrice: booking.totalPrice,
      depositAmount: booking.depositAmount,
      startAt: booking.startAt,
      holiday: booking.holiday,
    });

    // Determine payment status
    const paymentStatusAfter =
      refundResult.refundAmount > 0 && refundResult.refundPercent >= 100 ? 'refund_full' :
      refundResult.refundAmount > 0 ? 'refund_partial' :
      'refund_none';

    // Execute cancellation in transaction
    await db.$transaction(async (tx: any) => {
      // Update booking
      await tx.booking.update({
        where: { id },
        data: {
          status: 'cancelled',
          paymentStatus: ['unpaid', 'expired'].includes(booking.paymentStatus) ? booking.paymentStatus : paymentStatusAfter,
          cancelledAt: new Date(),
          cancelledBy: ctx.userId || 'system',
          cancellationReason: body.reason || refundResult.reason,
          dispatchStatus: 'held',
        },
      });

      // Create status history
      await (tx.bookingStatusHistory as any).create({
        data: {
          bookingId: id,
          fromStatus: booking.status,
          toStatus: 'cancelled',
          changedBy: ctx.userId || 'system',
          reason: body.reason || refundResult.reason,
        },
      });

      // Cancel pending offers for this booking
      if (booking.sitterId) {
        await tx.offerEvent.updateMany({
          where: { bookingId: id, status: 'sent' },
          data: { status: 'expired' },
        });
      }
    });

    // Process Stripe refund (outside transaction — non-blocking)
    if (refundResult.refundAmount > 0 && booking.stripePaymentIntentId) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-03-31.basil' as any });

        const refund = await stripe.refunds.create({
          payment_intent: booking.stripePaymentIntentId,
          amount: Math.round(refundResult.refundAmount * 100),
          metadata: { bookingId: id, reason: refundResult.reason },
        });

        // Record refund
        await (db as any).stripeRefund.create({
          data: {
            orgId: ctx.orgId,
            bookingId: id,
            stripeRefundId: refund.id,
            paymentIntentId: booking.stripePaymentIntentId,
            amount: refundResult.refundAmount,
            status: refund.status || 'succeeded',
          },
        });

        // Ledger entry
        await (db as any).ledgerEntry.create({
          data: {
            orgId: ctx.orgId,
            bookingId: id,
            type: 'refund',
            amount: -refundResult.refundAmount,
            description: `Cancellation refund: ${refundResult.description}`,
          },
        });
      } catch (stripeError) {
        console.error('[cancel] Stripe refund failed:', stripeError);
        // Booking is already cancelled — refund can be processed manually
      }
    }

    // Remove calendar event if sitter was assigned
    if (booking.sitterId) {
      try {
        const { enqueueCalendarSync } = await import('@/lib/calendar-queue');
        await enqueueCalendarSync({ type: 'delete', bookingId: id, sitterId: booking.sitterId, orgId: ctx.orgId });
      } catch { /* non-blocking */ }
    }

    // Log event
    await logEvent({
      orgId: ctx.orgId,
      action: 'booking.cancelled',
      bookingId: id,
      status: 'success',
      metadata: {
        cancelledBy: ctx.role,
        refundAmount: refundResult.refundAmount,
        refundPercent: refundResult.refundPercent,
        reason: refundResult.reason,
      },
    });

    // Notify sitter if assigned
    if (booking.sitterId) {
      void import('@/lib/notifications/triggers').then(({ notifySitterBookingCancelled }) => {
        notifySitterBookingCancelled({
          orgId: ctx.orgId,
          bookingId: id,
          sitterId: booking.sitterId,
          clientName: `${booking.firstName} ${booking.lastName}`.trim(),
          service: booking.service,
          startAt: booking.startAt,
        });
      }).catch(() => {});
    }

    // Notify client of cancellation
    if (booking.clientId) {
      const refundDesc = refundResult.refundAmount > 0
        ? `A $${refundResult.refundAmount.toFixed(2)} refund (${refundResult.refundPercent}%) is being processed.`
        : undefined;
      void import('@/lib/notifications/triggers').then(({ notifyClientBookingCancelled }) => {
        notifyClientBookingCancelled({
          orgId: ctx.orgId,
          bookingId: id,
          clientId: booking.clientId,
          service: booking.service,
          startAt: booking.startAt,
          refundDescription: refundDesc,
        });
      }).catch(() => {});
    }

    // Sync conversation lifecycle
    try {
      const { syncConversationLifecycleWithBookingWorkflow } = await import('@/lib/messaging/conversation-service');
      await syncConversationLifecycleWithBookingWorkflow({
        orgId: ctx.orgId,
        bookingId: id,
        clientId: booking.clientId,
        phone: booking.phone,
        firstName: booking.firstName,
        lastName: booking.lastName,
        bookingStatus: 'cancelled',
        sitterId: booking.sitterId,
        serviceWindowStart: booking.startAt,
        serviceWindowEnd: booking.endAt,
      });
    } catch (syncError) {
      console.error('[cancel] lifecycle sync failed (non-blocking):', syncError);
    }

    return NextResponse.json({
      success: true,
      refundAmount: refundResult.refundAmount,
      refundPercent: refundResult.refundPercent,
      description: refundResult.description,
    });
  } catch (error: unknown) {
    console.error('[cancel] ERROR:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to cancel booking', message }, { status: 500 });
  }
}
