import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

/**
 * GET /api/ops/reports/kpis?range=30
 * Returns operational KPIs for the Reports tab.
 * All revenue numbers are NET (after refunds).
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getScopedDb(ctx);
  const range = parseInt(request.nextUrl.searchParams.get('range') || '30', 10);
  const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);
  const prevSince = new Date(since.getTime() - range * 24 * 60 * 60 * 1000);

  try {
    const [
      currentCharges,
      prevCharges,
      currentBookings,
      prevBookings,
      cancelledBookings,
      prevCancelledBookings,
      activeClients,
      prevActiveClients,
      activeSitters,
      prevActiveSitters,
      failedPayments,
      prevFailedPayments,
      automationFailures,
      currentPayouts,
      prevPayouts,
    ] = await Promise.all([
      // Revenue (net)
      db.stripeCharge.aggregate({
        where: { status: 'succeeded', createdAt: { gte: since } },
        _sum: { amount: true, amountRefunded: true },
      }),
      db.stripeCharge.aggregate({
        where: { status: 'succeeded', createdAt: { gte: prevSince, lt: since } },
        _sum: { amount: true, amountRefunded: true },
      }),
      // Bookings
      db.booking.count({ where: { createdAt: { gte: since } } }),
      db.booking.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
      // Cancellations
      db.booking.count({ where: { status: 'cancelled', createdAt: { gte: since } } }),
      db.booking.count({ where: { status: 'cancelled', createdAt: { gte: prevSince, lt: since } } }),
      // Active clients (with a booking in period)
      db.booking.findMany({
        where: { createdAt: { gte: since } },
        select: { clientId: true },
        distinct: ['clientId'],
      }),
      db.booking.findMany({
        where: { createdAt: { gte: prevSince, lt: since } },
        select: { clientId: true },
        distinct: ['clientId'],
      }),
      // Active sitters
      db.sitter.count({ where: { deletedAt: null } }),
      db.sitter.count({ where: { deletedAt: null } }), // sitter count doesn't change by period
      // Failed payments
      db.stripeCharge.count({ where: { status: 'failed', createdAt: { gte: since } } }),
      db.stripeCharge.count({ where: { status: 'failed', createdAt: { gte: prevSince, lt: since } } }),
      // Automation failures
      db.queueJobRecord.count({ where: { status: { in: ['FAILED', 'DEAD_LETTERED'] }, createdAt: { gte: since } } }),
      // Payout volume
      db.payoutTransfer.aggregate({
        where: { status: 'paid', createdAt: { gte: since } },
        _sum: { amount: true, amountReversed: true },
      }),
      db.payoutTransfer.aggregate({
        where: { status: 'paid', createdAt: { gte: prevSince, lt: since } },
        _sum: { amount: true, amountReversed: true },
      }),
    ]);

    function delta(current: number, previous: number): number | null {
      if (previous === 0) return current > 0 ? 100 : null;
      return Math.round(((current - previous) / previous) * 100);
    }

    const curRevenue = ((currentCharges._sum.amount || 0) - (currentCharges._sum.amountRefunded || 0)) / 100;
    const prevRevenue = ((prevCharges._sum.amount || 0) - (prevCharges._sum.amountRefunded || 0)) / 100;

    const curPayoutVol = ((currentPayouts._sum.amount || 0) - (currentPayouts._sum.amountReversed || 0)) / 100;
    const prevPayoutVol = ((prevPayouts._sum.amount || 0) - (prevPayouts._sum.amountReversed || 0)) / 100;

    const curCancelRate = currentBookings > 0 ? (cancelledBookings / currentBookings) * 100 : 0;
    const prevCancelRate = prevBookings > 0 ? (prevCancelledBookings / prevBookings) * 100 : 0;

    const avgBookingValue = currentBookings > 0 ? curRevenue / currentBookings : 0;
    const prevAvgBookingValue = prevBookings > 0 ? prevRevenue / prevBookings : 0;

    // Repeat booking rate: clients with >1 booking in period / total active clients
    const clientBookingCounts = new Map<string, number>();
    const allBookings = await db.booking.findMany({
      where: { createdAt: { gte: since } },
      select: { clientId: true },
    });
    for (const b of allBookings) {
      if (b.clientId) {
        clientBookingCounts.set(b.clientId, (clientBookingCounts.get(b.clientId) || 0) + 1);
      }
    }
    const repeaters = Array.from(clientBookingCounts.values()).filter((c) => c > 1).length;
    const repeatRate = clientBookingCounts.size > 0 ? (repeaters / clientBookingCounts.size) * 100 : 0;

    return NextResponse.json({
      revenue: { value: curRevenue, deltaPercent: delta(curRevenue, prevRevenue) },
      bookings: { value: currentBookings, deltaPercent: delta(currentBookings, prevBookings) },
      activeClients: { value: activeClients.length, deltaPercent: delta(activeClients.length, prevActiveClients.length) },
      activeSitters: { value: activeSitters, deltaPercent: null },
      cancellationRate: { value: curCancelRate, deltaPercent: delta(curCancelRate, prevCancelRate) },
      failedPaymentCount: { value: failedPayments, deltaPercent: delta(failedPayments, prevFailedPayments) },
      automationFailureCount: { value: automationFailures, deltaPercent: null },
      payoutVolume: { value: curPayoutVol, deltaPercent: delta(curPayoutVol, prevPayoutVol) },
      averageBookingValue: { value: avgBookingValue, deltaPercent: delta(avgBookingValue, prevAvgBookingValue) },
      repeatBookingRate: { value: repeatRate, deltaPercent: null },
      messageResponseLag: await (async () => {
        try {
          const links = await db.messageResponseLink.findMany({
            where: {
              createdAt: { gte: since },
              excluded: false,
            },
            select: { responseMinutes: true },
            take: 500,
          });
          if (links.length > 0) {
            const sorted = links.map((l: any) => l.responseMinutes).sort((a: number, b: number) => a - b);
            const mid = Math.floor(sorted.length / 2);
            const median = sorted.length % 2 === 0
              ? (sorted[mid - 1]! + sorted[mid]!) / 2
              : sorted[mid]!;
            return { value: median };
          }
          return { value: null };
        } catch {
          // MessageResponseLink model may not exist in all environments
          return { value: null };
        }
      })(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
