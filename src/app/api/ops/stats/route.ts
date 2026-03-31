/**
 * GET /api/ops/stats?range=7d|30d
 * Owner stats: bookings created, visits completed, revenue, messages sent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';

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

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '7d';
  const days = range === '30d' ? 30 : 7;

  const since = new Date();
  since.setDate(since.getDate() - days);
  const prevSince = new Date(since);
  prevSince.setDate(prevSince.getDate() - days);

  const db = getScopedDb(ctx);

  try {
    const [
      bookingsCreated,
      visitsCompleted,
      revenueCents,
      messagesSent,
      prevBookingsCreated,
      prevVisitsCompleted,
      prevRevenueCents,
      prevMessagesSent,
    ] = await Promise.all([
      db.booking.count({
        where: { createdAt: { gte: since } },
      }),
      db.booking.count({
        where: {
          status: 'completed',
          updatedAt: { gte: since },
        },
      }),
      db.stripeCharge.aggregate({
        where: {
          status: 'succeeded',
          createdAt: { gte: since },
        },
        _sum: { amount: true },
      }),
      db.messageEvent.count({
        where: {
          direction: 'outbound',
          createdAt: { gte: since },
        },
      }),
      db.booking.count({
        where: {
          createdAt: { gte: prevSince, lt: since },
        },
      }),
      db.booking.count({
        where: {
          status: 'completed',
          updatedAt: { gte: prevSince, lt: since },
        },
      }),
      db.stripeCharge.aggregate({
        where: {
          status: 'succeeded',
          createdAt: { gte: prevSince, lt: since },
        },
        _sum: { amount: true },
      }),
      db.messageEvent.count({
        where: {
          direction: 'outbound',
          createdAt: { gte: prevSince, lt: since },
        },
      }),
    ]);

    const revenue = (revenueCents._sum?.amount ?? 0) / 100;
    const prevRevenue = (prevRevenueCents._sum?.amount ?? 0) / 100;

    const trend = (current: number, prev: number) =>
      prev > 0 ? Math.round(((current - prev) / prev) * 100) : current > 0 ? 100 : 0;

    return NextResponse.json({
      range: days,
      bookingsCreated,
      visitsCompleted,
      revenue,
      messagesSent,
      trends: {
        bookingsCreated: trend(bookingsCreated, prevBookingsCreated),
        visitsCompleted: trend(visitsCompleted, prevVisitsCompleted),
        revenue: trend(revenue, prevRevenue),
        messagesSent: trend(messagesSent, prevMessagesSent),
      },
    }, {
      headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load stats', message }, { status: 500 });
  }
}
