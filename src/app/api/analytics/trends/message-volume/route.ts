/**
 * GET /api/analytics/trends/message-volume?range=7d|30d|90d
 * Daily outbound message count (MessageEvent direction=outbound). Real DB-backed.
 * Owner/admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { parseTrendRange, getTrendDays } from '@/lib/analytics/date-ranges';

export async function GET(request: NextRequest) {
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

  const range = parseTrendRange(request.nextUrl.searchParams.get('range'));
  const days = getTrendDays(range);
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  const db = getScopedDb(ctx);

  try {
    const events = await db.messageEvent.findMany({
      where: {
        direction: 'outbound',
        createdAt: { gte: start, lte: end },
      },
      select: { createdAt: true },
    });

    const byDate = new Map<string, number>();
    for (const e of events) {
      const d = e.createdAt.toISOString().slice(0, 10);
      byDate.set(d, (byDate.get(d) ?? 0) + 1);
    }

    const sortedDates = [...byDate.keys()].sort();
    const daily = sortedDates.map((date) => ({
      date,
      count: byDate.get(date) ?? 0,
    }));

    return NextResponse.json({
      range,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      daily,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load message volume trend', message },
      { status: 500 }
    );
  }
}
