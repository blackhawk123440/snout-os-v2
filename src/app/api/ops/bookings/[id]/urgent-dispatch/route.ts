import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { logEvent } from '@/lib/log-event';

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
    const booking = await db.booking.findFirst({
      where: { id },
      select: { id: true, service: true, firstName: true, lastName: true, startAt: true, sitterId: true },
    });
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    // Get available sitters (active, not on time off today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sitters = await db.sitter.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });

    const timeOffs = await db.sitterTimeOff.findMany({
      where: { startsAt: { lte: tomorrow }, endsAt: { gte: today } },
      select: { sitterId: true },
    });
    const offSitterIds = new Set(timeOffs.map((t: any) => t.sitterId));
    const available = sitters.filter((s: any) => !offSitterIds.has(s.id) && s.id !== booking.sitterId);

    // Create urgent offer events with 30-min expiry
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    let offersCreated = 0;

    for (const sitter of available.slice(0, 10)) {
      try {
        await db.offerEvent.create({
          data: {
            orgId: ctx.orgId,
            sitterId: sitter.id,
            bookingId: id,
            offeredAt: new Date(),
            expiresAt,
            status: 'sent',
            source: 'dashboard',
          },
        });
        offersCreated++;
      } catch { /* skip duplicates */ }
    }

    await logEvent({
      orgId: ctx.orgId,
      action: 'booking.urgent_dispatch',
      bookingId: id,
      status: 'success',
      metadata: { offersCreated, expiresIn: '30min' },
    });

    return NextResponse.json({
      success: true,
      offersCreated,
      expiresAt: expiresAt.toISOString(),
      availableSitters: available.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}
