/**
 * GET /api/ops/payment-analytics
 * Returns payment collection totals, outstanding balance, and failed payment count.
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Paid totals
    const [todayPaid, weekPaid, monthPaid] = await Promise.all([
      db.stripeCharge.aggregate({
        where: { orgId: ctx.orgId, status: 'succeeded', createdAt: { gte: todayStart } },
        _sum: { amount: true },
        _count: true,
      }),
      db.stripeCharge.aggregate({
        where: { orgId: ctx.orgId, status: 'succeeded', createdAt: { gte: weekStart } },
        _sum: { amount: true },
        _count: true,
      }),
      db.stripeCharge.aggregate({
        where: { orgId: ctx.orgId, status: 'succeeded', createdAt: { gte: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // Outstanding (unpaid confirmed/completed bookings)
    const outstanding = await db.booking.aggregate({
      where: {
        orgId: ctx.orgId,
        paymentStatus: 'unpaid',
        status: { in: ['confirmed', 'completed'] },
      },
      _sum: { totalPrice: true },
      _count: true,
    });

    // Failed payments (last 30 days)
    const failedCount = await db.stripeCharge.count({
      where: {
        orgId: ctx.orgId,
        status: 'failed',
        createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    return NextResponse.json({
      collected: {
        today: { amount: (todayPaid._sum.amount || 0) / 100, count: todayPaid._count },
        week: { amount: (weekPaid._sum.amount || 0) / 100, count: weekPaid._count },
        month: { amount: (monthPaid._sum.amount || 0) / 100, count: monthPaid._count },
      },
      outstanding: {
        amount: outstanding._sum.totalPrice || 0,
        count: outstanding._count,
      },
      failedPayments: failedCount,
    }, {
      headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
