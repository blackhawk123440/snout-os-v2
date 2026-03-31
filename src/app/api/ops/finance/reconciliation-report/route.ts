/**
 * GET /api/ops/finance/reconciliation-report
 * Ensures every dollar in from clients maps to dollars out to sitters + platform fee.
 * Returns a reconciliation summary showing any discrepancies.
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
    const range = parseInt(searchParams.get('range') || '30', 10);
    const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

    const db = getScopedDb(ctx);

    // Money IN: total collected from clients via Stripe
    const clientCharges = await db.stripeCharge.aggregate({
      where: { orgId: ctx.orgId, status: 'succeeded', createdAt: { gte: since } },
      _sum: { amount: true, amountRefunded: true },
      _count: true,
    });
    const totalIn = (clientCharges._sum.amount || 0) / 100;
    const totalRefunded = (clientCharges._sum.amountRefunded || 0) / 100;
    const netIn = totalIn - totalRefunded;

    // Money OUT: total paid to sitters via Stripe Connect (net of reversals)
    const sitterPayouts = await db.payoutTransfer.aggregate({
      where: { orgId: ctx.orgId, status: 'paid', createdAt: { gte: since } },
      _sum: { amount: true, amountReversed: true },
      _count: true,
    });
    const totalOutGross = (sitterPayouts._sum.amount || 0) / 100;
    const totalReversed = (sitterPayouts._sum.amountReversed || 0) / 100;
    const totalOut = totalOutGross - totalReversed;

    // Reversed payouts (fully reversed)
    const reversedPayouts = await db.payoutTransfer.aggregate({
      where: { orgId: ctx.orgId, status: { in: ['reversed', 'partial_reversal'] }, createdAt: { gte: since } },
      _sum: { amountReversed: true },
      _count: true,
    });
    const totalReversedFromReversed = (reversedPayouts._sum.amountReversed || 0) / 100;

    // Platform fee: from SitterEarning records
    const earnings = await db.sitterEarning.aggregate({
      where: { orgId: ctx.orgId, createdAt: { gte: since } },
      _sum: { amountGross: true, platformFee: true, netAmount: true },
    });
    const platformFee = earnings._sum.platformFee || 0;
    const earningsGross = earnings._sum.amountGross || 0;
    const earningsNet = earnings._sum.netAmount || 0;

    // Pending payouts (not yet transferred)
    const pendingPayouts = await db.payoutTransfer.aggregate({
      where: { orgId: ctx.orgId, status: 'pending', createdAt: { gte: since } },
      _sum: { amount: true },
      _count: true,
    });
    const totalPending = (pendingPayouts._sum.amount || 0) / 100;

    // Failed payouts
    const failedPayouts = await db.payoutTransfer.aggregate({
      where: { orgId: ctx.orgId, status: 'failed', createdAt: { gte: since } },
      _sum: { amount: true },
      _count: true,
    });
    const totalFailed = (failedPayouts._sum.amount || 0) / 100;

    // Reconciliation check: netIn should ≈ totalOut + platformFee + totalPending + totalFailed
    const accounted = totalOut + platformFee + totalPending + totalFailed;
    const discrepancy = Math.round((netIn - accounted) * 100) / 100;
    const balanced = Math.abs(discrepancy) < 0.01; // Within 1 cent tolerance

    return NextResponse.json({
      range,
      moneyIn: {
        totalCollected: totalIn,
        totalRefunded,
        netCollected: netIn,
        chargeCount: clientCharges._count,
      },
      moneyOut: {
        totalPaidToSitters: totalOut,
        totalReversedFromSitters: totalReversed + totalReversedFromReversed,
        platformFeeEarned: platformFee,
        pendingPayouts: totalPending,
        failedPayouts: totalFailed,
        payoutCount: sitterPayouts._count,
        pendingCount: pendingPayouts._count,
        failedCount: failedPayouts._count,
        reversedCount: reversedPayouts._count,
      },
      reconciliation: {
        balanced,
        discrepancy,
        formula: 'netCollected - (paidToSitters + platformFee + pending + failed)',
        note: balanced ? 'All funds accounted for' : `Discrepancy of $${discrepancy.toFixed(2)} — may indicate untracked manual payments or timing differences`,
      },
      earnings: {
        gross: earningsGross,
        platformFee,
        netToSitters: earningsNet,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
