import type { Queue } from "bullmq";
import { automationQueue } from "@/lib/automation-queue";
import { calendarQueue } from "@/lib/calendar-queue";
import { payoutQueue } from "@/lib/payout/payout-queue";
import { financeReconcileQueue } from "@/lib/finance/reconcile-queue";
import { reminderSchedulerQueue } from "@/lib/reminder-scheduler-queue";
import { srsQueue } from "@/lib/tiers/srs-queue";
import { summaryQueue, reconciliationQueue } from "@/lib/queue";
import { poolReleaseQueue } from "@/lib/pool-release-queue";

const QUEUE_BY_NAME: Record<string, Queue> = {
  [automationQueue.name]: automationQueue,
  [calendarQueue.name]: calendarQueue,
  [payoutQueue.name]: payoutQueue,
  [financeReconcileQueue.name]: financeReconcileQueue,
  [reminderSchedulerQueue.name]: reminderSchedulerQueue,
  [srsQueue.name]: srsQueue,
  [summaryQueue.name]: summaryQueue,
  [reconciliationQueue.name]: reconciliationQueue,
  [poolReleaseQueue.name]: poolReleaseQueue,
};

export function getQueueByName(name: string): Queue | null {
  return QUEUE_BY_NAME[name] ?? null;
}

export const RETRYABLE_QUEUE_NAMES = new Set(Object.keys(QUEUE_BY_NAME));
