import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';

export async function POST(
  _request: NextRequest,
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

  const { id } = await params;
  const db = getScopedDb(ctx);

  try {
    const schedule = await db.recurringSchedule.findFirst({
      where: { id },
      select: { id: true, clientId: true, service: true, invoicingMode: true },
    });
    if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });

    // Find completed, unpaid bookings for this schedule
    const unpaidBookings = await db.booking.findMany({
      where: {
        recurringScheduleId: id,
        status: 'completed',
        paymentStatus: { not: 'paid' },
      },
      select: { id: true, totalPrice: true, startAt: true },
      orderBy: { startAt: 'asc' },
    });

    if (unpaidBookings.length === 0) {
      return NextResponse.json({ message: 'No unpaid completed bookings to invoice', total: 0, count: 0 });
    }

    const total = unpaidBookings.reduce((s: number, b: any) => s + (b.totalPrice || 0), 0);

    // Generate payment link for the total
    try {
      const { sendBookingLinkMessage } = await import('@/lib/messaging/payment-tip-send');
      // Use the first booking to generate the payment link (amount = total)
      const firstBooking = await db.booking.findUnique({
        where: { id: unpaidBookings[0].id },
        include: { client: true },
      });
      if (firstBooking) {
        // Update the first booking's totalPrice to the batch total temporarily for link generation
        await db.booking.update({
          where: { id: firstBooking.id },
          data: { totalPrice: total },
        });

        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        await sendBookingLinkMessage({
          orgId: ctx.orgId,
          bookingId: firstBooking.id,
          templateType: 'payment_link',
          baseUrl,
          actor: { role: 'system' },
          dedupeWindowMs: 0,
          forceResend: true,
        });

        // Restore original price
        await db.booking.update({
          where: { id: firstBooking.id },
          data: { totalPrice: unpaidBookings[0].totalPrice },
        });
      }
    } catch (e) {
      console.error('[generate-invoice] Payment link send failed:', e);
    }

    return NextResponse.json({
      total: Math.round(total * 100) / 100,
      count: unpaidBookings.length,
      bookingIds: unpaidBookings.map((b: any) => b.id),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to generate invoice', message }, { status: 500 });
  }
}
