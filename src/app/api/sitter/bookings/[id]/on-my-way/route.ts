import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { enqueueAutomation } from '@/lib/automation-queue';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (ctx.role !== 'sitter' || !ctx.sitterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id: bookingId } = await params;
    const db = getScopedDb(ctx);

    const booking = await db.booking.findFirst({
      where: { id: bookingId, sitterId: ctx.sitterId },
      select: { id: true, status: true, startAt: true, clientId: true, orgId: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'Booking is not confirmed' }, { status: 400 });
    }

    // Only allow "on my way" within 2 hours of the visit start
    const now = new Date();
    const startAt = new Date(booking.startAt);
    const twoHoursBefore = new Date(startAt.getTime() - 2 * 60 * 60 * 1000);
    if (now < twoHoursBefore) {
      return NextResponse.json({ error: 'Too early to send on-my-way notification' }, { status: 400 });
    }

    if (!booking.clientId) {
      return NextResponse.json({ error: 'No client linked to this booking' }, { status: 400 });
    }

    await enqueueAutomation(
      'onMyWay',
      'client',
      {
        orgId: ctx.orgId,
        bookingId: booking.id,
        clientId: booking.clientId,
        sitterId: ctx.sitterId,
      },
      `on-my-way-${booking.id}-${ctx.sitterId}`
    );

    return NextResponse.json({ data: { sent: true } });
  } catch (error: any) {
    console.error('[on-my-way] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
