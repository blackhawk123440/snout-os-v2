/**
 * Automation Worker - Queue-driven only.
 *
 * No setInterval or global scanning. All reminder/summary work is triggered by
 * BullMQ repeatable jobs (see reminder-scheduler-queue, queue.ts).
 *
 * processRemindersForOrg lives in reminder-scheduler-queue.ts (org-scoped).
 * processDailySummary remains here for daily-summary queue (stats aggregation).
 */

import { getScopedDb } from "@/lib/tenancy";

/**
 * Process daily summary for a single org. Returns stats only (no messages).
 * Used by daily-summary queue.
 */
export async function processDailySummaryForOrg(orgId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const db = getScopedDb({ orgId });

  const todayBookings = await db.booking.findMany({
    where: { startAt: { gte: today, lt: tomorrow } },
  });

  const byStatus = todayBookings.reduce(
    (acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const completed = todayBookings.filter((b) => b.status === "completed");
  const revenue = completed.reduce((s, b) => s + (b.totalPrice || 0), 0);

  return {
    orgId,
    total: todayBookings.length,
    pending: byStatus.pending || 0,
    confirmed: byStatus.confirmed || 0,
    completed: byStatus.completed || 0,
    revenue,
  };
}

/**
 * Process daily summary for all orgs. Used when daily-summary job runs.
 * Also persists DailyOrgStats for analytics trend queries.
 */
export async function processDailySummary() {
  const { prisma } = await import("@/lib/db");
  const orgs = await (prisma as any).org.findMany({ select: { id: true } });

  const results = [];
  for (const org of orgs) {
    const r = await processDailySummaryForOrg(org.id);
    results.push(r);
  }

  // Persist daily stats to DailyOrgStats for analytics trend queries
  try {
    const { computeDailyStatsForAllOrgs } = await import("@/lib/analytics/daily-stats-job");
    const statsCount = await computeDailyStatsForAllOrgs(new Date());
    console.log(`[daily-summary] DailyOrgStats computed for ${statsCount} orgs`);
  } catch (error) {
    console.error("[daily-summary] DailyOrgStats aggregation failed:", error);
    // Non-blocking — summary still returns results even if stats persist fails
  }

  return { orgs: results };
}

/**
 * No-op. Previously used setInterval; now all work is queue-driven.
 * Kept for backward compatibility if anything imports it.
 */
export function startAutomationWorker(): void {
  // No-op: reminders and summary are handled by BullMQ repeatable jobs
}
