/**
 * POST /api/ops/bookings/[id]/mark-paid
 * Mark a booking as paid (for cash/check payments outside Stripe).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
// NOTE: No notification imports — mark-paid is an internal accounting action.
// It must NEVER trigger notifyClientBookingReceived, notifySitterAssigned,
// or syncConversationLifecycleWithBookingWorkflow.

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = getScopedDb(ctx);

  try {
    const booking = await db.booking.findFirst({
      where: { id },
      select: { id: true, paymentStatus: true, status: true, totalPrice: true, clientId: true, sitterId: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.paymentStatus === 'paid') {
      return NextResponse.json({ success: true, message: 'Already paid' });
    }

    // Mark-paid is an internal accounting action. Only update paymentStatus.
    // Do NOT change booking status — changing pending→confirmed on old bookings
    // triggers the automation engine which sends "BOOKING RECEIVED" and sitter
    // assignment messages to clients for months-old completed visits.
    await db.booking.update({
      where: { id },
      data: { paymentStatus: 'paid' },
    });

    // Create LedgerEntry for financial audit trail (cash/check payments)
    if (booking.totalPrice && booking.totalPrice > 0) {
      await (db as any).ledgerEntry.create({
        data: {
          orgId: ctx.orgId,
          entryType: 'charge',
          source: 'internal',
          bookingId: id,
          clientId: booking.clientId,
          sitterId: booking.sitterId,
          amountCents: Math.round(booking.totalPrice * 100),
          currency: 'usd',
          status: 'succeeded',
          occurredAt: new Date(),
        },
      }).catch((e: any) => {
        console.error('[mark-paid] Failed to create LedgerEntry:', e?.message);
      });
    }

    // Send receipt notification to client (non-blocking)
    if (booking.clientId) {
      void import('@/lib/automation-queue').then(({ enqueueAutomation }) => {
        enqueueAutomation(
          'paymentReminder',
          'client',
          { orgId: ctx.orgId, bookingId: id, clientId: booking.clientId },
          `payment-received-${id}`
        );
      }).catch(() => {});
    }

    // Event log
    void import('@/lib/log-event').then(({ logEvent }) => {
      logEvent({
        orgId: ctx.orgId,
        action: 'booking.marked_paid',
        bookingId: id,
        status: 'success',
        metadata: { previousStatus: booking.status, actorUserId: ctx.userId },
      });
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to mark as paid', message },
      { status: 500 }
    );
  }
}
