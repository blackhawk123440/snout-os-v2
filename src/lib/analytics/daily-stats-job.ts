/**
 * Daily Org Stats Aggregation
 *
 * Computes and persists daily metrics for an org into the DailyOrgStats table.
 * Called by the daily-summary queue job after the existing summary logic.
 * Uses upsert so it's safe to run multiple times for the same date.
 */

import { prisma } from '@/lib/db';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Compute and store daily stats for a single org on a given date.
 * Idempotent — safe to call multiple times (upsert by orgId+date).
 */
export async function computeDailyStatsForOrg(orgId: string, date: Date): Promise<void> {
  const start = startOfDay(date);
  const end = endOfDay(date);

  const [created, confirmed, completed, revenue, newClients] = await Promise.all([
    (prisma as any).booking.count({
      where: { orgId, createdAt: { gte: start, lte: end } },
    }),
    (prisma as any).booking.count({
      where: { orgId, status: 'confirmed', updatedAt: { gte: start, lte: end } },
    }),
    (prisma as any).booking.count({
      where: { orgId, status: 'completed', updatedAt: { gte: start, lte: end } },
    }),
    (prisma as any).booking.aggregate({
      where: { orgId, paymentStatus: 'paid', updatedAt: { gte: start, lte: end } },
      _sum: { totalPrice: true },
    }),
    (prisma as any).client.count({
      where: { orgId, createdAt: { gte: start, lte: end } },
    }),
  ]);

  const revenueTotal = revenue?._sum?.totalPrice ?? 0;

  await (prisma as any).dailyOrgStats.upsert({
    where: { orgId_date: { orgId, date: start } },
    create: {
      orgId,
      date: start,
      bookingsCreated: created,
      bookingsConfirmed: confirmed,
      bookingsCompleted: completed,
      revenueTotal,
      newClients,
      notificationsSent: 0,
    },
    update: {
      bookingsCreated: created,
      bookingsConfirmed: confirmed,
      bookingsCompleted: completed,
      revenueTotal,
      newClients,
    },
  });
}

/**
 * Compute daily stats for ALL orgs for a given date.
 */
export async function computeDailyStatsForAllOrgs(date?: Date): Promise<number> {
  const targetDate = date ?? new Date();
  const orgs = await (prisma as any).org.findMany({ select: { id: true } });

  let processed = 0;
  for (const org of orgs) {
    try {
      await computeDailyStatsForOrg(org.id, targetDate);
      processed++;
    } catch (error) {
      console.error(`[daily-stats] Failed for org ${org.id}:`, error);
    }
  }

  return processed;
}
