/**
 * GET /api/sitter/route-history?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns route history with stop counts and estimated mileage for tax purposes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

// Rough mileage estimate: average 5 miles between pet care stops in a local area
const AVG_MILES_BETWEEN_STOPS = 5;
const IRS_MILEAGE_RATE_2026 = 0.70; // 2026 IRS standard mileage rate (estimated)

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');
  const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = toStr ? new Date(toStr) : new Date();
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  try {
    const db = getScopedDb(ctx);

    // Get all completed bookings in range
    const bookings = await db.booking.findMany({
      where: {
        orgId: ctx.orgId,
        sitterId: ctx.sitterId,
        status: 'completed',
        startAt: { gte: from, lte: to },
        address: { not: null },
      },
      orderBy: { startAt: 'asc' },
      select: { id: true, startAt: true, address: true, service: true },
    });

    // Group by date
    const dayMap: Record<string, { date: string; stops: number; bookingIds: string[] }> = {};
    for (const b of bookings) {
      const dateKey = new Date(b.startAt).toISOString().slice(0, 10);
      if (!dayMap[dateKey]) dayMap[dateKey] = { date: dateKey, stops: 0, bookingIds: [] };
      dayMap[dateKey].stops++;
      dayMap[dateKey].bookingIds.push(b.id);
    }

    const days = Object.values(dayMap).sort((a, b) => b.date.localeCompare(a.date));

    // Calculate mileage estimates
    const totalStops = days.reduce((sum, d) => sum + d.stops, 0);
    // Estimated miles: (stops - 1) per day * avg miles, plus round trip home
    const totalEstimatedMiles = days.reduce((sum, d) => {
      if (d.stops <= 1) return sum + AVG_MILES_BETWEEN_STOPS * 2; // Round trip for 1 stop
      return sum + (d.stops - 1) * AVG_MILES_BETWEEN_STOPS + AVG_MILES_BETWEEN_STOPS * 2; // Between stops + home roundtrip
    }, 0);
    const taxDeduction = totalEstimatedMiles * IRS_MILEAGE_RATE_2026;

    return NextResponse.json({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      totalDays: days.length,
      totalStops,
      mileage: {
        estimatedMiles: Math.round(totalEstimatedMiles),
        avgMilesPerDay: days.length > 0 ? Math.round(totalEstimatedMiles / days.length) : 0,
        irsRate: IRS_MILEAGE_RATE_2026,
        estimatedDeduction: Math.round(taxDeduction * 100) / 100,
        note: 'Mileage is estimated based on average distance between stops. Track actual mileage for tax filing.',
      },
      days,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load route history' }, { status: 500 });
  }
}
