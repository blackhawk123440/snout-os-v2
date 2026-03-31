import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { calculateRefund } from '@/lib/cancellation-engine';

export async function GET(
  _request: NextRequest,
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
    const booking = await db.booking.findFirst({
      where: { id },
      select: {
        id: true, status: true, totalPrice: true, startAt: true,
        paymentStatus: true, holiday: true, depositAmount: true,
        clientId: true,
      },
    });

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    // Client can only preview their own bookings
    if (ctx.role === 'client' && booking.clientId !== ctx.clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cancellableStatuses = ['pending_payment', 'confirmed', 'deposit_held'];
    if (!cancellableStatuses.includes(booking.status)) {
      return NextResponse.json({
        canCancel: false,
        reason: `Cannot cancel a booking with status "${booking.status}"`,
      });
    }

    // No payment collected
    if (['unpaid', 'expired'].includes(booking.paymentStatus)) {
      return NextResponse.json({
        bookingId: booking.id,
        currentStatus: booking.status,
        canCancel: true,
        refundPercent: 0,
        refundAmount: 0,
        depositKept: 0,
        description: 'No payment was collected. The booking will be cancelled with no charge.',
      });
    }

    const result = calculateRefund({
      totalPrice: booking.totalPrice,
      depositAmount: booking.depositAmount,
      startAt: booking.startAt,
      holiday: booking.holiday,
    });

    return NextResponse.json({
      bookingId: booking.id,
      currentStatus: booking.status,
      canCancel: true,
      ...result,
    });
  } catch (error: unknown) {
    console.error('[cancel-preview] ERROR:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to preview cancellation', message }, { status: 500 });
  }
}
