/**
 * GET /api/client/quick-rebook
 *
 * Returns smart booking suggestions based on the authenticated client's
 * booking history: most common service, preferred sitter, typical day/time.
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.clientId) {
    return NextResponse.json({ error: 'Client profile missing on session' }, { status: 403 });
  }

  try {
    const db = getScopedDb(ctx);

    // Fetch the last 10 completed bookings for this client
    const bookings = await (db as any).booking.findMany({
      where: {
        clientId: ctx.clientId,
        status: 'completed',
      },
      orderBy: { startAt: 'desc' },
      take: 10,
      select: {
        id: true,
        service: true,
        sitterId: true,
        startAt: true,
        sitter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (bookings.length === 0) {
      return NextResponse.json({
        lastBooking: null,
        suggestedService: null,
        suggestedSitter: null,
        suggestedDay: null,
        suggestedTime: null,
        bookingCount: 0,
        canQuickRebook: false,
      });
    }

    // --- Analyze patterns ---

    // Most common service
    const serviceCounts: Record<string, number> = {};
    for (const b of bookings) {
      if (b.service) {
        serviceCounts[b.service] = (serviceCounts[b.service] || 0) + 1;
      }
    }
    const suggestedService = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Most frequent sitter (by count)
    const sitterCounts: Record<string, { count: number; name: string }> = {};
    for (const b of bookings) {
      if (b.sitterId && b.sitter) {
        const name = [b.sitter.firstName, b.sitter.lastName].filter(Boolean).join(' ') || 'Unknown';
        if (!sitterCounts[b.sitterId]) {
          sitterCounts[b.sitterId] = { count: 0, name };
        }
        sitterCounts[b.sitterId].count += 1;
      }
    }
    const topSitterEntry = Object.entries(sitterCounts)
      .sort((a, b) => b[1].count - a[1].count)[0];
    const suggestedSitter = topSitterEntry
      ? { id: topSitterEntry[0], name: topSitterEntry[1].name }
      : null;

    // Most common day of week
    const dayCounts: Record<number, number> = {};
    for (const b of bookings) {
      const day = new Date(b.startAt).getDay();
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
    const topDay = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])[0];
    const suggestedDay = topDay ? DAY_NAMES[Number(topDay[0])] : null;

    // Most common time (rounded to the hour)
    const timeCounts: Record<string, number> = {};
    for (const b of bookings) {
      const d = new Date(b.startAt);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const timeKey = `${hh}:${mm}`;
      timeCounts[timeKey] = (timeCounts[timeKey] || 0) + 1;
    }
    const topTime = Object.entries(timeCounts)
      .sort((a, b) => b[1] - a[1])[0];
    const suggestedTime = topTime ? topTime[0] : null;

    // Build last booking reference
    const last = bookings[0];
    const lastSitterName = last.sitter
      ? [last.sitter.firstName, last.sitter.lastName].filter(Boolean).join(' ') || 'Unknown'
      : null;

    const lastBooking = {
      id: last.id,
      service: last.service,
      sitterId: last.sitterId,
      sitterName: lastSitterName,
    };

    return NextResponse.json({
      lastBooking,
      suggestedService,
      suggestedSitter,
      suggestedDay,
      suggestedTime,
      bookingCount: bookings.length,
      canQuickRebook: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load quick rebook suggestions', message },
      { status: 500 },
    );
  }
}
