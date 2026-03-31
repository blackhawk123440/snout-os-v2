/**
 * GET /api/analytics/kpis?range=7d|30d|90d|mtd
 * Canonical owner analytics KPIs. All values from real DB.
 * Owner/admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import {
  parseRange,
  getCurrentPeriod,
  getPreviousPeriod,
  startOfToday,
  lastDays,
  trendPercent,
  trendDirection,
} from '@/lib/analytics/date-ranges';

export type KpiWithTrend = {
  value: number;
  previousValue?: number;
  deltaPercent?: number | null;
  trend?: 'up' | 'down' | 'neutral';
};

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

  const range = parseRange(request.nextUrl.searchParams.get('range'));
  const { start: periodStart, end: periodEnd } = getCurrentPeriod(range);
  const { start: prevStart, end: prevEnd } = getPreviousPeriod(range, periodStart);

  const todayStart = startOfToday();
  const { start: weekStart } = lastDays(7);
  const { start: monthStart } = lastDays(30);

  const db = getScopedDb(ctx);

  try {
    // ---- Revenue: StripeCharge succeeded (cents -> dollars) ----
    const [
      revenueTodayCents,
      revenueWeekCents,
      revenueMonthCents,
      revenuePeriodCents,
      revenuePrevCents,
      bookingsToday,
      bookingsWeek,
      bookingsMonth,
      bookingsPeriod,
      bookingsPrev,
      completedPeriod,
      completedPrev,
      cancelledPeriod,
      cancelledPrev,
    ] = await Promise.all([
      db.stripeCharge.aggregate({
        where: {
          status: 'succeeded',
          createdAt: { gte: todayStart },
        },
        _sum: { amount: true, amountRefunded: true },
      }),
      db.stripeCharge.aggregate({
        where: {
          status: 'succeeded',
          createdAt: { gte: weekStart },
        },
        _sum: { amount: true, amountRefunded: true },
      }),
      db.stripeCharge.aggregate({
        where: {
          status: 'succeeded',
          createdAt: { gte: monthStart },
        },
        _sum: { amount: true, amountRefunded: true },
      }),
      db.stripeCharge.aggregate({
        where: {
          status: 'succeeded',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { amount: true, amountRefunded: true },
      }),
      db.stripeCharge.aggregate({
        where: {
          status: 'succeeded',
          createdAt: { gte: prevStart, lte: prevEnd },
        },
        _sum: { amount: true, amountRefunded: true },
      }),
      db.booking.count({
        where: { createdAt: { gte: todayStart } },
      }),
      db.booking.count({
        where: { createdAt: { gte: weekStart } },
      }),
      db.booking.count({
        where: { createdAt: { gte: monthStart } },
      }),
      db.booking.count({
        where: { createdAt: { gte: periodStart, lte: periodEnd } },
      }),
      db.booking.count({
        where: { createdAt: { gte: prevStart, lte: prevEnd } },
      }),
      db.booking.count({
        where: {
          status: 'completed',
          updatedAt: { gte: periodStart, lte: periodEnd },
        },
      }),
      db.booking.count({
        where: {
          status: 'completed',
          updatedAt: { gte: prevStart, lte: prevEnd },
        },
      }),
      db.booking.count({
        where: {
          status: 'cancelled',
          updatedAt: { gte: periodStart, lte: periodEnd },
        },
      }),
      db.booking.count({
        where: {
          status: 'cancelled',
          updatedAt: { gte: prevStart, lte: prevEnd },
        },
      }),
    ]);

    const revenueToday = ((revenueTodayCents._sum?.amount ?? 0) - (revenueTodayCents._sum?.amountRefunded ?? 0)) / 100;
    const revenueWeek = ((revenueWeekCents._sum?.amount ?? 0) - (revenueWeekCents._sum?.amountRefunded ?? 0)) / 100;
    const revenueMonth = ((revenueMonthCents._sum?.amount ?? 0) - (revenueMonthCents._sum?.amountRefunded ?? 0)) / 100;
    const revenuePeriod = ((revenuePeriodCents._sum?.amount ?? 0) - (revenuePeriodCents._sum?.amountRefunded ?? 0)) / 100;
    const revenuePrev = ((revenuePrevCents._sum?.amount ?? 0) - (revenuePrevCents._sum?.amountRefunded ?? 0)) / 100;

    // ---- Active clients (distinct clientId with booking in period) ----
    const [activeClientsPeriod, activeClientsPrev, activeSittersPeriod, activeSittersPrev] = await Promise.all([
      db.booking.groupBy({
        by: ['clientId'],
        where: {
          clientId: { not: null },
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      }).then((r) => new Set(r.map((x) => x.clientId).filter(Boolean)).size),
      db.booking.groupBy({
        by: ['clientId'],
        where: {
          clientId: { not: null },
          createdAt: { gte: prevStart, lte: prevEnd },
        },
      }).then((r) => new Set(r.map((x) => x.clientId).filter(Boolean)).size),
      db.booking.groupBy({
        by: ['sitterId'],
        where: {
          sitterId: { not: null },
          status: 'completed',
          updatedAt: { gte: periodStart, lte: periodEnd },
        },
      }).then((r) => r.length),
      db.booking.groupBy({
        by: ['sitterId'],
        where: {
          sitterId: { not: null },
          status: 'completed',
          updatedAt: { gte: prevStart, lte: prevEnd },
        },
      }).then((r) => r.length),
    ]);

    // Utilization: completed bookings in period / (activeSitters * days) as a simple proxy; cap at 100%
    const periodDays = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)));
    const utilizationRaw = activeSittersPeriod > 0
      ? Math.min(100, (completedPeriod / (activeSittersPeriod * periodDays)) * 100)
      : 0;
    const utilization = Math.round(utilizationRaw * 10) / 10;

    // Cancellation rate: cancelled / (completed + cancelled) in period
    const totalRelevant = completedPeriod + cancelledPeriod;
    const cancellationRate = totalRelevant > 0 ? (cancelledPeriod / totalRelevant) * 100 : 0;
    const totalRelevantPrev = completedPrev + cancelledPrev;
    const cancellationRatePrev = totalRelevantPrev > 0 ? (cancelledPrev / totalRelevantPrev) * 100 : 0;

    // Failed payments, automation failures (org- and period-scoped), payout volume
    const [
      failedPaymentCountPeriod,
      failedPaymentCountPrev,
      automationFailureCountPeriod,
      automationFailureCountPrev,
      payoutVolumeCentsPeriod,
      payoutVolumeCentsPrev,
    ] = await Promise.all([
      db.stripeCharge.count({
        where: {
          status: 'failed',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      }),
      db.stripeCharge.count({
        where: {
          status: 'failed',
          createdAt: { gte: prevStart, lte: prevEnd },
        },
      }),
      db.eventLog.count({
        where: {
          eventType: { in: ['automation.failed', 'automation.dead'] },
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      }),
      db.eventLog.count({
        where: {
          eventType: { in: ['automation.failed', 'automation.dead'] },
          createdAt: { gte: prevStart, lte: prevEnd },
        },
      }),
      db.payoutTransfer.aggregate({
        where: {
          status: 'paid',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { amount: true, amountReversed: true },
      }),
      db.payoutTransfer.aggregate({
        where: {
          status: 'paid',
          createdAt: { gte: prevStart, lte: prevEnd },
        },
        _sum: { amount: true, amountReversed: true },
      }),
    ]);

    const payoutVolumePeriod = ((payoutVolumeCentsPeriod._sum?.amount ?? 0) - (payoutVolumeCentsPeriod._sum?.amountReversed ?? 0)) / 100;
    const payoutVolumePrev = ((payoutVolumeCentsPrev._sum?.amount ?? 0) - (payoutVolumeCentsPrev._sum?.amountReversed ?? 0)) / 100;

    // Average booking value: revenue in period / completed bookings
    const averageBookingValue = completedPeriod > 0 ? revenuePeriod / completedPeriod : 0;
    const averageBookingValuePrev = completedPrev > 0 ? revenuePrev / completedPrev : 0;

    // Repeat booking rate: clients with 2+ bookings / clients with 1+ in period
    const [clientCountsPeriod, clientCountsPrev] = await Promise.all([
      db.booking.groupBy({
        by: ['clientId'],
        where: {
          clientId: { not: null },
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _count: { id: true },
      }),
      db.booking.groupBy({
        by: ['clientId'],
        where: {
          clientId: { not: null },
          createdAt: { gte: prevStart, lte: prevEnd },
        },
        _count: { id: true },
      }),
    ]);
    const totalClientsPeriod = clientCountsPeriod.length;
    const returningClientsPeriod = clientCountsPeriod.filter((c) => (c._count?.id ?? 0) >= 2).length;
    const repeatBookingRate = totalClientsPeriod > 0 ? (returningClientsPeriod / totalClientsPeriod) * 100 : 0;
    const totalClientsPrev = clientCountsPrev.length;
    const returningClientsPrev = clientCountsPrev.filter((c) => (c._count?.id ?? 0) >= 2).length;
    const repeatBookingRatePrev = totalClientsPrev > 0 ? (returningClientsPrev / totalClientsPrev) * 100 : 0;

    // Message response lag: median response minutes from MessageResponseLink in period (if present)
    let messageResponseLag: number | null = null;
    try {
      const links = await db.messageResponseLink.findMany({
        where: {
          createdAt: { gte: periodStart, lte: periodEnd },
          excluded: false,
        },
        select: { responseMinutes: true },
        take: 500,
      });
      if (links.length > 0) {
        const sorted = links.map((l) => l.responseMinutes).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        messageResponseLag = sorted.length % 2 === 0
          ? (sorted[mid - 1]! + sorted[mid]!) / 2
          : sorted[mid]!;
      }
    } catch {
      // Model or schema may not exist in all envs
    }

    const withTrend = (
      value: number,
      previousValue: number
    ): KpiWithTrend => ({
      value: Math.round(value * 100) / 100,
      previousValue: Math.round(previousValue * 100) / 100,
      deltaPercent: trendPercent(value, previousValue),
      trend: trendDirection(value, previousValue),
    });

    const round2 = (n: number) => Math.round(n * 100) / 100;

    return NextResponse.json({
      range,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      previousPeriodStart: prevStart.toISOString(),
      previousPeriodEnd: prevEnd.toISOString(),

      revenueToday: round2(revenueToday),
      revenueWeek: round2(revenueWeek),
      revenueMonth: round2(revenueMonth),
      revenue: withTrend(revenuePeriod, revenuePrev),

      bookingsToday,
      bookingsWeek,
      bookingsMonth,
      bookings: withTrend(bookingsPeriod, bookingsPrev),

      activeClients: withTrend(activeClientsPeriod, activeClientsPrev),
      activeSitters: withTrend(activeSittersPeriod, activeSittersPrev),
      utilization: round2(utilization),
      utilizationPrevious: round2(
        activeSittersPrev > 0
          ? Math.min(100, (completedPrev / (activeSittersPrev * periodDays)) * 100)
          : 0
      ),

      cancellationRate: withTrend(round2(cancellationRate), round2(cancellationRatePrev)),
      failedPaymentCount: withTrend(failedPaymentCountPeriod, failedPaymentCountPrev),
      automationFailureCount: withTrend(automationFailureCountPeriod, automationFailureCountPrev),
      payoutVolume: withTrend(round2(payoutVolumePeriod), round2(payoutVolumePrev)),
      averageBookingValue: withTrend(round2(averageBookingValue), round2(averageBookingValuePrev)),
      repeatBookingRate: withTrend(round2(repeatBookingRate), round2(repeatBookingRatePrev)),
      messageResponseLag: messageResponseLag != null ? { value: messageResponseLag } : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load analytics KPIs', message },
      { status: 500 }
    );
  }
}
