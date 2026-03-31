/**
 * GET /api/ops/predictions
 * Predictive booking intelligence for the owner dashboard (Phase 3.2).
 *
 * Returns:
 * - missingBookingAlerts: clients who usually book on a certain day but haven't this week
 * - demandForecast: predicted booking volume for each day of next week
 * - revenueProjection: current month revenue pace and projection
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import type { PrismaClient } from '@prisma/client';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

interface MissingBookingAlert {
  clientId: string;
  clientName: string;
  usualDay: string;
  service: string;
  lastBookedAt: string;
}

interface DemandForecastDay {
  date: string;
  dayOfWeek: string;
  predicted: number;
}

interface RevenueProjection {
  currentMonthTotal: number;
  projectedMonthEnd: number;
  lastMonthTotal: number;
}

/**
 * Detect clients who usually book on certain weekdays but haven't this week.
 */
async function detectMissingBookings(db: PrismaClient): Promise<MissingBookingAlert[]> {
  const now = new Date();
  const todayDow = now.getDay(); // 0=Sun, 6=Sat

  // Get all active clients with recent bookings
  const clients = await db.client.findMany({
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });

  const alerts: MissingBookingAlert[] = [];

  for (const client of clients) {
    // Get last 30 bookings for this client
    const recentBookings = await db.booking.findMany({
      where: {
        clientId: client.id,
        status: { notIn: ['cancelled', 'canceled'] },
      },
      select: { startAt: true, service: true },
      orderBy: { startAt: 'desc' },
      take: 30,
    });

    if (recentBookings.length < 3) continue;

    // Count bookings by day of week
    const dayCounts: Record<number, { count: number; service: string; lastAt: Date }> = {};
    for (const b of recentBookings) {
      const dow = b.startAt.getDay();
      if (!dayCounts[dow]) {
        dayCounts[dow] = { count: 0, service: b.service, lastAt: b.startAt };
      }
      dayCounts[dow].count++;
      if (b.startAt > dayCounts[dow].lastAt) {
        dayCounts[dow].lastAt = b.startAt;
      }
    }

    // A "pattern" day is one where at least 30% of their bookings fall on that day
    const totalBookings = recentBookings.length;
    for (const [dowStr, info] of Object.entries(dayCounts)) {
      const dow = Number(dowStr);
      const ratio = info.count / totalBookings;

      if (ratio < 0.3) continue;

      // Only flag if today is that day
      if (dow !== todayDow) continue;

      // Check if they have a booking this week for that day
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const existingThisWeek = await db.booking.findFirst({
        where: {
          clientId: client.id,
          status: { notIn: ['cancelled', 'canceled'] },
          startAt: { gte: weekStart, lt: weekEnd },
        },
        select: { id: true },
      });

      if (!existingThisWeek) {
        alerts.push({
          clientId: client.id,
          clientName: `${client.firstName} ${client.lastName}`.trim(),
          usualDay: DAY_NAMES[dow],
          service: info.service,
          lastBookedAt: info.lastAt.toISOString(),
        });
      }
    }
  }

  return alerts;
}

/**
 * Forecast demand for each day of next week by averaging
 * the same weekday's booking count over the last 4 weeks.
 */
async function forecastDemand(db: PrismaClient): Promise<DemandForecastDay[]> {
  const now = new Date();

  // Find the start of next week (next Sunday)
  const nextWeekStart = new Date(now);
  nextWeekStart.setDate(nextWeekStart.getDate() + (7 - nextWeekStart.getDay()));
  nextWeekStart.setHours(0, 0, 0, 0);

  const forecast: DemandForecastDay[] = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const forecastDate = new Date(nextWeekStart);
    forecastDate.setDate(forecastDate.getDate() + dayOffset);
    const dow = forecastDate.getDay();

    // Count bookings for the same weekday in each of the last 4 weeks
    let total = 0;
    for (let weekBack = 1; weekBack <= 4; weekBack++) {
      const sampleDate = new Date(forecastDate);
      sampleDate.setDate(sampleDate.getDate() - weekBack * 7);
      const dayStart = new Date(sampleDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(sampleDate);
      dayEnd.setHours(23, 59, 59, 999);

      const count = await db.booking.count({
        where: {
          status: { notIn: ['cancelled', 'canceled'] },
          startAt: { gte: dayStart, lte: dayEnd },
        },
      });
      total += count;
    }

    const predicted = Math.round(total / 4);

    forecast.push({
      date: forecastDate.toISOString().slice(0, 10),
      dayOfWeek: DAY_NAMES[dow],
      predicted,
    });
  }

  return forecast;
}

/**
 * Project current month's revenue based on pace so far.
 */
async function projectRevenue(db: PrismaClient): Promise<RevenueProjection> {
  const now = new Date();

  // Current month boundaries
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = currentMonthEnd.getDate();
  const daysElapsed = now.getDate();

  // Last month boundaries
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  lastMonthEnd.setHours(23, 59, 59, 999);

  // Current month revenue so far
  const currentMonthBookings = await db.booking.findMany({
    where: {
      status: { notIn: ['cancelled', 'canceled'] },
      startAt: { gte: currentMonthStart, lte: now },
    },
    select: { totalPrice: true },
  });
  const currentMonthTotal = currentMonthBookings.reduce(
    (sum, b) => sum + (b.totalPrice || 0),
    0,
  );

  // Last month total revenue
  const lastMonthBookings = await db.booking.findMany({
    where: {
      status: { notIn: ['cancelled', 'canceled'] },
      startAt: { gte: lastMonthStart, lte: lastMonthEnd },
    },
    select: { totalPrice: true },
  });
  const lastMonthTotal = lastMonthBookings.reduce(
    (sum, b) => sum + (b.totalPrice || 0),
    0,
  );

  // Project: (revenue so far / days elapsed) * days in month
  const projectedMonthEnd =
    daysElapsed > 0
      ? Math.round((currentMonthTotal / daysElapsed) * daysInMonth)
      : 0;

  return {
    currentMonthTotal: Math.round(currentMonthTotal),
    projectedMonthEnd,
    lastMonthTotal: Math.round(lastMonthTotal),
  };
}

export async function GET() {
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
    const db = getScopedDb(ctx);

    const [missingBookingAlerts, demandForecast, revenueProjection] =
      await Promise.all([
        detectMissingBookings(db),
        forecastDemand(db),
        projectRevenue(db),
      ]);

    return NextResponse.json({
      missingBookingAlerts,
      demandForecast,
      revenueProjection,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate predictions', message },
      { status: 500 },
    );
  }
}
