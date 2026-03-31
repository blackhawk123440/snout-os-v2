/**
 * GET /api/analytics/trends/payout-volume?range=7d|30d|90d
 * Daily payout volume (PayoutTransfer status=paid). Real DB-backed. Amount in dollars.
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
    const transfers = await db.payoutTransfer.findMany({
      where: {
        status: 'paid',
        createdAt: { gte: start, lte: end },
      },
      select: { amount: true, createdAt: true },
    });

    const byDate = new Map<string, number>();
    for (const t of transfers) {
      const d = t.createdAt.toISOString().slice(0, 10);
      byDate.set(d, (byDate.get(d) ?? 0) + t.amount);
    }

    const sortedDates = [...byDate.keys()].sort();
    const daily = sortedDates.map((date) => ({
      date,
      amount: Math.round(((byDate.get(date) ?? 0) / 100) * 100) / 100,
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
      { error: 'Failed to load payout volume trend', message },
      { status: 500 }
    );
  }
}
