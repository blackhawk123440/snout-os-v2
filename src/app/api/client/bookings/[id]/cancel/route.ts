import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';
import { logEvent } from '@/lib/log-event';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const db = getScopedDb(ctx);

    const booking = await db.$transaction(async (tx) => {
      const found = await tx.booking.findFirst({
        where: { id, clientId: ctx.clientId },
        select: {
          id: true, status: true, startAt: true, sitterId: true,
          firstName: true, lastName: true, service: true, paymentStatus: true,
        },
      });

      if (!found) return null;

      if (!['pending', 'confirmed'].includes(found.status)) {
        return { error: `Cannot cancel a booking that is ${found.status}`, status: 400 as const };
      }

      if (new Date(found.startAt).getTime() < Date.now()) {
        return { error: 'Cannot cancel a booking that has already started', status: 400 as const };
      }

      await tx.booking.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: found.status,
          toStatus: 'cancelled',
          changedBy: ctx.userId ?? null,
          reason: 'client_cancelled',
        },
      });

      return found;
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if ('error' in booking) {
      return NextResponse.json({ error: booking.error }, { status: booking.status });
    }

    // Notify sitter + owner
    if (booking.sitterId) {
      void import('@/lib/notifications/triggers').then(({ notifySitterBookingCancelled }) => {
        notifySitterBookingCancelled({
          orgId: ctx.orgId,
          bookingId: id,
          sitterId: booking.sitterId!,
          clientName: `${booking.firstName} ${booking.lastName}`.trim(),
          service: booking.service,
          startAt: booking.startAt,
        });
      }).catch(() => {});
    }

    // Process refund if booking was prepaid
    if (booking.paymentStatus === 'paid') {
      try {
        const charge = await db.stripeCharge.findFirst({
          where: { bookingId: id, status: 'succeeded' },
          select: { id: true, paymentIntentId: true, amount: true },
          orderBy: { createdAt: 'desc' },
        });
        if (charge?.paymentIntentId) {
          const { stripe } = await import('@/lib/stripe');
          const refund = await stripe.refunds.create({
            payment_intent: charge.paymentIntentId,
          });
          await db.booking.update({
            where: { id },
            data: { paymentStatus: 'refunded' },
          });
          await logEvent({
            orgId: ctx.orgId,
            action: 'payment.refunded',
            bookingId: id,
            status: 'success',
            metadata: { refundId: refund.id, amount: charge.amount, trigger: 'client_cancel' },
          });
        }
      } catch (refundError) {
        console.error('[cancel] refund failed (non-blocking):', refundError);
      }
    }

    await logEvent({
      orgId: ctx.orgId,
      action: 'booking.cancelled_by_client',
      bookingId: id,
      status: 'success',
    });

    // Notify owner that client cancelled
    void import('@/lib/notifications/triggers').then(({ notifyOwnerClientCancelled, notifyClientBookingCancelled }) => {
      notifyOwnerClientCancelled({
        orgId: ctx.orgId,
        bookingId: id,
        clientName: `${booking.firstName} ${booking.lastName}`.trim(),
        service: booking.service,
        startAt: booking.startAt,
      });
      // Confirm cancellation to client
      if (ctx.clientId) {
        notifyClientBookingCancelled({
          orgId: ctx.orgId,
          bookingId: id,
          clientId: ctx.clientId,
          service: booking.service,
          startAt: booking.startAt,
        });
      }
    }).catch(() => {});

    // Sync conversation lifecycle
    try {
      const { syncConversationLifecycleWithBookingWorkflow } = await import('@/lib/messaging/conversation-service');
      await syncConversationLifecycleWithBookingWorkflow({
        orgId: ctx.orgId,
        bookingId: id,
        clientId: ctx.clientId,
        bookingStatus: 'cancelled',
        sitterId: booking.sitterId,
        serviceWindowStart: booking.startAt,
      });
    } catch (syncError) {
      console.error('[client-cancel] lifecycle sync failed (non-blocking):', syncError);
    }

    const isWithin24h = new Date(booking.startAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;

    return NextResponse.json({ success: true, within24h: isWithin24h });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to cancel', message }, { status: 500 });
  }
}
