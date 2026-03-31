/**
 * GET /api/ops/payout-analytics
 * Payout analytics for owners: total paid, by sitter, commission earned.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30'; // days
    const days = parseInt(range, 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const db = getScopedDb(ctx);

    // Total paid out
    const totalPaid = await db.payoutTransfer.aggregate({
      where: { orgId: ctx.orgId, status: 'paid', createdAt: { gte: since } },
      _sum: { amount: true },
      _count: true,
    });

    // Failed payouts
    const totalFailed = await db.payoutTransfer.aggregate({
      where: { orgId: ctx.orgId, status: 'failed', createdAt: { gte: since } },
      _sum: { amount: true },
      _count: true,
    });

    // Pending payouts
    const totalPending = await db.payoutTransfer.aggregate({
      where: { orgId: ctx.orgId, status: 'pending' },
      _sum: { amount: true },
      _count: true,
    });

    // By sitter
    const bySitter = await db.payoutTransfer.groupBy({
      by: ['sitterId'],
      where: { orgId: ctx.orgId, status: 'paid', createdAt: { gte: since } },
      _sum: { amount: true },
      _count: true,
    });

    // Enrich with sitter names
    const sitterIds = bySitter.map((s: any) => s.sitterId);
    const sitters = sitterIds.length > 0
      ? await db.sitter.findMany({
          where: { id: { in: sitterIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const sitterMap = new Map(sitters.map((s: any) => [s.id, `${s.firstName || ''} ${s.lastName || ''}`.trim()]));

    // Commission earned (platform fee = gross - net)
    const earningsAgg = await db.sitterEarning.aggregate({
      where: { orgId: ctx.orgId, createdAt: { gte: since } },
      _sum: { amountGross: true, platformFee: true, netAmount: true },
    });

    return NextResponse.json({
      range: days,
      paid: {
        amount: (totalPaid._sum.amount || 0) / 100,
        count: totalPaid._count,
      },
      failed: {
        amount: (totalFailed._sum.amount || 0) / 100,
        count: totalFailed._count,
      },
      pending: {
        amount: (totalPending._sum.amount || 0) / 100,
        count: totalPending._count,
      },
      commissionEarned: earningsAgg._sum.platformFee || 0,
      grossRevenue: earningsAgg._sum.amountGross || 0,
      netToSitters: earningsAgg._sum.netAmount || 0,
      bySitter: bySitter.map((s: any) => ({
        sitterId: s.sitterId,
        name: sitterMap.get(s.sitterId) || 'Unknown',
        amount: (s._sum.amount || 0) / 100,
        count: s._count,
      })),
    }, {
      headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
