/**
 * GET /api/ops/sitters/[id]/route?date=YYYY-MM-DD
 * Owner views a sitter's route for a given day.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sitterId } = await context.params;
  const dateStr = request.nextUrl.searchParams.get('date');
  const date = dateStr ? new Date(dateStr) : new Date();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  try {
    const db = getScopedDb(ctx);

    const sitter = await db.sitter.findUnique({
      where: { id: sitterId },
      select: { firstName: true, lastName: true },
    });
    if (!sitter) return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });

    const bookings = await db.booking.findMany({
      where: {
        orgId: ctx.orgId,
        sitterId,
        status: { in: ['pending', 'confirmed', 'in_progress', 'completed'] },
        startAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { startAt: 'asc' },
      select: {
        id: true, firstName: true, lastName: true, address: true,
        pickupAddress: true, service: true, startAt: true, endAt: true,
        status: true, pets: { select: { name: true, species: true } },
      },
    });

    const stops = bookings.map((b, i) => ({
      stopNumber: i + 1,
      bookingId: b.id,
      clientName: `${b.firstName || ''} ${b.lastName || ''}`.trim(),
      address: b.service === 'Pet Taxi' ? b.pickupAddress : b.address,
      service: b.service,
      startAt: b.startAt instanceof Date ? b.startAt.toISOString() : b.startAt,
      endAt: b.endAt instanceof Date ? b.endAt.toISOString() : b.endAt,
      status: b.status,
      pets: b.pets?.map((p: any) => p.name || p.species).join(', ') || '',
    }));

    return NextResponse.json({
      sitter: { id: sitterId, name: `${sitter.firstName} ${sitter.lastName}` },
      date: dayStart.toISOString().slice(0, 10),
      stopCount: stops.length,
      stops,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load route' }, { status: 500 });
  }
}
