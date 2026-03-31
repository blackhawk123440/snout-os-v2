/**
 * GET /api/analytics/trends/revenue?range=7d|30d|90d
 * Daily revenue series.
 * Reads from DailyOrgStats for historical data, falls back to live StripeCharge for today.
 * Owner/admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const db = getScopedDb(ctx);

  try {
    // Historical data from pre-aggregated DailyOrgStats
    const stats = await (prisma as any).dailyOrgStats.findMany({
      where: {
        orgId: ctx.orgId,
        date: { gte: start, lte: end },
      },
      select: { date: true, revenueTotal: true },
      orderBy: { date: 'asc' },
    });

    const byDate = new Map<string, number>();
    for (const s of stats) {
      const d = (s.date as Date).toISOString().slice(0, 10);
      byDate.set(d, s.revenueTotal);
    }

    // Real-time fallback for today (stats may not be computed yet)
    if (!byDate.has(todayStr)) {
      const todayStart = new Date(todayStr + 'T00:00:00.000Z');
      const todayEnd = new Date(todayStr + 'T23:59:59.999Z');
      const charges = await db.stripeCharge.findMany({
        where: {
          status: 'succeeded',
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        select: { amount: true },
      });
      const todayRevenue = charges.reduce((s: number, c: any) => s + (c.amount || 0), 0) / 100;
      if (todayRevenue > 0) byDate.set(todayStr, todayRevenue);
    }

    const sortedDates = [...byDate.keys()].sort();
    const daily = sortedDates.map((date) => ({
      date,
      amount: Math.round((byDate.get(date) ?? 0) * 100) / 100,
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
      { error: 'Failed to load revenue trend', message },
      { status: 500 }
    );
  }
}
