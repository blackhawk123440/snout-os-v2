/**
 * GET /api/ops/schedule-grid?date=YYYY-MM-DD&view=week|day
 * Staff scheduling grid for owner/admin operations dashboard.
 * Returns sitter rows x day columns with bookings, hours, and team totals.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  const view = searchParams.get('view') === 'day' ? 'day' : 'week';

  // Parse week start date (default today)
  const now = new Date();
  let weekStart: Date;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    weekStart = new Date(dateParam + 'T00:00:00');
  } else {
    weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const numDays = view === 'day' ? 1 : 7;
  const rangeEnd = new Date(weekStart);
  rangeEnd.setDate(rangeEnd.getDate() + numDays);

  // Build array of date strings for columns
  const dayColumns: string[] = [];
  for (let i = 0; i < numDays; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dayColumns.push(d.toISOString().slice(0, 10));
  }

  const db = getScopedDb(ctx);

  try {
    // Fetch sitters and bookings in parallel
    const [sitters, bookings, timeOffs] = await Promise.all([
      db.sitter.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
        orderBy: { firstName: 'asc' },
      }),
      db.booking.findMany({
        where: {
          startAt: { gte: weekStart, lt: rangeEnd },
          status: { not: 'cancelled' },
          sitterId: { not: null },
        },
        select: {
          id: true,
          service: true,
          startAt: true,
          endAt: true,
          firstName: true,
          lastName: true,
          status: true,
          sitterId: true,
        },
        orderBy: { startAt: 'asc' },
      }),
      db.sitterTimeOff.findMany({
        where: {
          startsAt: { lt: rangeEnd },
          endsAt: { gt: weekStart },
        },
        select: {
          sitterId: true,
          startsAt: true,
          endsAt: true,
        },
      }),
    ]);

    // Index time-off by sitter for quick lookup
    const timeOffBySitter = new Map<string, Array<{ startsAt: Date; endsAt: Date }>>();
    for (const to of timeOffs) {
      const list = timeOffBySitter.get(to.sitterId) || [];
      list.push({ startsAt: to.startsAt, endsAt: to.endsAt });
      timeOffBySitter.set(to.sitterId, list);
    }

    // Index bookings by sitterId + date string
    const bookingIndex = new Map<string, typeof bookings>();
    for (const b of bookings) {
      if (!b.sitterId) continue;
      const dateStr = b.startAt.toISOString().slice(0, 10);
      const key = `${b.sitterId}:${dateStr}`;
      const list = bookingIndex.get(key) || [];
      list.push(b);
      bookingIndex.set(key, list);
    }

    // Build per-day totals accumulators
    const totalBookingsPerDay = new Map<string, number>();
    const activeSittersPerDay = new Map<string, Set<string>>();
    for (const date of dayColumns) {
      totalBookingsPerDay.set(date, 0);
      activeSittersPerDay.set(date, new Set());
    }

    // Build sitter rows
    const sitterRows = sitters.map((sitter) => {
      const sitterTimeOffs = timeOffBySitter.get(sitter.id) || [];

      const days = dayColumns.map((date) => {
        const key = `${sitter.id}:${date}`;
        const dayBookings = bookingIndex.get(key) || [];

        // Calculate total hours from booking durations
        const totalHours = dayBookings.reduce((sum, b) => {
          const durationMs = new Date(b.endAt).getTime() - new Date(b.startAt).getTime();
          return sum + durationMs / (1000 * 60 * 60);
        }, 0);

        // Check availability: sitter is unavailable if any time-off covers this date
        const dayStart = new Date(date + 'T00:00:00');
        const dayEnd = new Date(date + 'T23:59:59');
        const onTimeOff = sitterTimeOffs.some(
          (to) => to.startsAt <= dayEnd && to.endsAt >= dayStart
        );

        // Update totals
        totalBookingsPerDay.set(date, (totalBookingsPerDay.get(date) || 0) + dayBookings.length);
        if (dayBookings.length > 0) {
          activeSittersPerDay.get(date)!.add(sitter.id);
        }

        return {
          date,
          bookings: dayBookings.map((b) => ({
            id: b.id,
            service: b.service,
            startAt: b.startAt.toISOString(),
            endAt: b.endAt.toISOString(),
            clientName: `${b.firstName || ''} ${b.lastName || ''}`.trim(),
            status: b.status,
          })),
          bookingCount: dayBookings.length,
          totalHours: Math.round(totalHours * 100) / 100,
          available: !onTimeOff,
        };
      });

      return {
        id: sitter.id,
        firstName: sitter.firstName,
        lastName: sitter.lastName,
        days,
      };
    });

    const totals = {
      days: dayColumns.map((date) => ({
        date,
        totalBookings: totalBookingsPerDay.get(date) || 0,
        activeSitters: activeSittersPerDay.get(date)?.size || 0,
      })),
    };

    return NextResponse.json({
      weekStart: weekStart.toISOString().slice(0, 10),
      sitters: sitterRows,
      totals,
    }, {
      headers: { 'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=15' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load schedule grid', message },
      { status: 500 }
    );
  }
}
