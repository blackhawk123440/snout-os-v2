/**
 * GET /api/payments
 * Owner/Admin: payments from StripeCharge + StripeRefund.
 * Filters: status, date range (default last 30 days).
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

  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';

    const days = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : timeRange === '1y' ? 365 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const db = getScopedDb(ctx);
    const where: Record<string, unknown> = {
      createdAt: { gte: since },
    };
    if (status !== 'all') {
      if (status === 'paid') where.status = 'succeeded';
      else if (status === 'failed') where.status = 'failed';
      else if (status === 'pending') where.status = 'pending';
      else if (status === 'refunded') where.refunded = true;
    }
    if (search) {
      where.OR = [
        { customerEmail: { contains: search } },
        { customerName: { contains: search } },
        { id: { contains: search } },
        { bookingId: { contains: search } },
      ];
    }

    const charges = await db.stripeCharge.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const payments = charges.map((c: any) => ({
      id: c.id,
      amount: c.amount / 100,
      status: c.status === 'succeeded' ? 'succeeded' : c.refunded ? 'refunded' : c.status,
      created: c.createdAt,
      customerEmail: c.customerEmail,
      customerName: c.customerName,
      description: c.description,
      paymentMethod: c.paymentMethod,
      currency: c.currency,
      lastError: c.lastError,
      bookingId: c.bookingId,
    }));

    const succeeded = charges.filter((c: any) => c.status === 'succeeded');
    const failed = charges.filter((c: any) => c.status === 'failed');
    const refunded = charges.filter((c: any) => c.refunded);

    const totalCollected = succeeded.reduce((s: number, c: any) => s + (c.amount - (c.amountRefunded || 0)), 0) / 100;
    const failedAmount = failed.reduce((s: number, c: any) => s + c.amount, 0) / 100;
    const refundedAmount = refunded.reduce((s: number, c: any) => s + (c.amountRefunded || 0), 0) / 100;

    const prevSince = new Date(since);
    prevSince.setDate(prevSince.getDate() - days);
    const prevCharges = await db.stripeCharge.findMany({
      where: {
        status: 'succeeded',
        createdAt: { gte: prevSince, lt: since },
      },
    });
    const previousTotal = prevCharges.reduce((s: number, c: any) => s + (c.amount - (c.amountRefunded || 0)), 0) / 100;
    const periodComparison = previousTotal > 0 ? ((totalCollected - previousTotal) / previousTotal) * 100 : 0;

    return NextResponse.json({
      payments,
      kpis: {
        totalCollected,
        pendingCount: charges.filter((c: any) => c.status === 'pending').length,
        pendingAmount: charges.filter((c: any) => c.status === 'pending').reduce((s: number, c: any) => s + c.amount, 0) / 100,
        failedCount: failed.length,
        failedAmount,
        refundedAmount,
      },
      comparison: {
        previousPeriodTotal: previousTotal,
        periodComparison,
        isPositive: periodComparison >= 0,
      },
    });
  } catch (error: unknown) {
    console.error('[Payments API] Failed to load payments:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load payments', message }, { status: 500 });
  }
}
