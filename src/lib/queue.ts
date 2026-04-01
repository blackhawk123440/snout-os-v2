import { Queue, Worker } from "bullmq";
import { attachQueueWorkerInstrumentation } from "@/lib/queue-observability";
import { resolveCorrelationId } from "@/lib/correlation-id";
import { createRedisConnection } from "@/lib/redis-config";
import { isBuildPhase } from "@/lib/runtime-phase";

// Redis connection
const queueEnabled = !isBuildPhase && !!process.env.REDIS_URL;
const connection = queueEnabled ? createRedisConnection() : undefined;
const disabledQueue = (name: string) => ({ name } as unknown as Queue);

// Create queues
export const summaryQueue = queueEnabled ? new Queue("daily-summary", { connection }) : disabledQueue("daily-summary");
export const reconciliationQueue = queueEnabled ? new Queue("reconciliation", { connection }) : disabledQueue("reconciliation"); // Phase 7.2: Price reconciliation

export const summaryWorker = queueEnabled && connection ? new Worker(
  "daily-summary",
  async (job) => {
    const { processDailySummary } = await import("../worker/automation-worker");
    return await processDailySummary();
  },
  { connection }
): null;
if (summaryWorker) attachQueueWorkerInstrumentation(summaryWorker, (job) => ({
  orgId: "default",
  subsystem: "summary",
  resourceType: "system",
  resourceId: "daily-summary",
  correlationId: (job.data as any)?.correlationId,
  payload: job.data as Record<string, unknown>,
}));

// Phase 7.2: Pricing reconciliation worker
export const reconciliationWorker = queueEnabled && connection ? new Worker(
  "reconciliation",
  async (job) => {
    const { processPricingReconciliation } = await import("../worker/reconciliation-worker");
    return await processPricingReconciliation();
  },
  { connection }
): null;
if (reconciliationWorker) attachQueueWorkerInstrumentation(reconciliationWorker, (job) => ({
  orgId: "default",
  subsystem: "reconciliation",
  resourceType: "system",
  resourceId: "pricing-reconciliation",
  correlationId: (job.data as any)?.correlationId,
  payload: job.data as Record<string, unknown>,
}));

// Reminder scheduling: see reminder-scheduler-queue.ts (org-scoped, no global scan)

export async function scheduleDailySummary() {
  if (!summaryQueue) return;
  // Schedule daily summary at 9 PM
  // Note: no QueueJobRecord written here — BullMQ repeat jobs use a different job ID per
  // execution than the ID returned by queue.add(), so scheduling records would never
  // transition out of QUEUED. Execution records are tracked by attachQueueWorkerInstrumentation.
  const correlationId = resolveCorrelationId();
  await summaryQueue.add(
    "process-daily-summary",
    { correlationId },
    {
      repeat: {
        pattern: "0 21 * * *", // 9 PM daily
      },
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  );
}

// Phase 7.2: Schedule pricing reconciliation
// Per Master Spec Section 5.3: Pricing drift detection
export async function scheduleReconciliation() {
  if (!reconciliationQueue) return;
  // Schedule reconciliation daily at 2 AM (low traffic time)
  const correlationId = resolveCorrelationId();
  await reconciliationQueue.add(
    "process-pricing-reconciliation",
    { correlationId },
    {
      repeat: {
        pattern: "0 2 * * *", // 2 AM daily
      },
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  );
}

/** Track which workers initialized successfully for health reporting */
export const workerHealth: {
  initialized: boolean;
  workers: Record<string, { status: 'ok' | 'failed'; error?: string }>;
  startedAt: Date | null;
} = {
  initialized: false,
  workers: {},
  startedAt: null,
};

/**
 * Initialize all queue workers.
 * Each worker is initialized independently — a failure in one does not block others.
 * Failures are tracked in workerHealth for health endpoint reporting.
 */
export async function initializeQueues() {
  const errors: string[] = [];
  workerHealth.startedAt = new Date();

  async function initWorker(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      workerHealth.workers[name] = { status: 'ok' };
      console.log(`[Worker] ${name} ready`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      workerHealth.workers[name] = { status: 'failed', error: msg };
      errors.push(`${name}: ${msg}`);
      console.error(`[Worker] ${name} FAILED to initialize:`, error);
    }
  }

  await initWorker('reminder-scheduler', async () => {
    const { scheduleReminderDispatcher, initializeReminderSchedulerWorker } = await import(
      "./reminder-scheduler-queue"
    );
    await scheduleReminderDispatcher();
    initializeReminderSchedulerWorker();
  });

  await initWorker('daily-summary', async () => {
    await scheduleDailySummary();
  });

  await initWorker('reconciliation', async () => {
    await scheduleReconciliation();
  });

  await initWorker('automations', async () => {
    const { initializeAutomationWorker } = await import("./automation-queue");
    initializeAutomationWorker();
  });

  await initWorker('messaging-outbound', async () => {
    const { initializeOutboundMessageWorker } = await import("./messaging/outbound-queue");
    initializeOutboundMessageWorker();
  });

  await initWorker('messaging-thread-activity', async () => {
    const { initializeThreadActivityWorker } = await import("./messaging/thread-activity-queue");
    initializeThreadActivityWorker();
  });

  await initWorker('calendar-sync', async () => {
    const { initializeCalendarWorker, scheduleInboundCalendarSync } = await import("./calendar-queue");
    initializeCalendarWorker();
    await scheduleInboundCalendarSync();
  });

  await initWorker('pool-release', async () => {
    const { initializePoolReleaseWorker, schedulePoolRelease } = await import("./pool-release-queue");
    initializePoolReleaseWorker();
    await schedulePoolRelease();
  });

  await initWorker('payouts', async () => {
    const { initializePayoutWorker } = await import("./payout/payout-queue");
    initializePayoutWorker();
  });

  await initWorker('finance-reconcile', async () => {
    const { initializeFinanceReconcileWorker } = await import("./finance/reconcile-queue");
    initializeFinanceReconcileWorker();
  });

  workerHealth.initialized = true;

  if (errors.length > 0) {
    console.error(`[Worker] ${errors.length} worker(s) failed to initialize:`, errors);
    // Do NOT throw — let healthy workers continue processing.
    // The health endpoint will report the failures.
  }
}
