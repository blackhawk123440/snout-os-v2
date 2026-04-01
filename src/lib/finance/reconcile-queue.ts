/**
 * Finance reconciliation queue: reconcile ledger vs Stripe-persisted tables.
 * Triggered from ops UI.
 */

import { Queue, Worker } from "bullmq";
import { getScopedDb } from "@/lib/tenancy";
import { reconcileOrgRange } from "./reconcile";
import { logEvent } from "@/lib/log-event";
import { attachQueueWorkerInstrumentation, recordQueueJobQueued } from "@/lib/queue-observability";
import { resolveCorrelationId } from "@/lib/correlation-id";
import { createRedisConnection } from "@/lib/redis-config";
import { isBuildPhase } from "@/lib/runtime-phase";

const queueEnabled = !isBuildPhase && !!process.env.REDIS_URL;
const connection = queueEnabled ? createRedisConnection() : undefined;
const disabledQueue = (name: string) => ({ name } as unknown as Queue);
const FINANCE_RECONCILE_WORKER_CONCURRENCY = Number(process.env.FINANCE_RECONCILE_WORKER_CONCURRENCY || "4");

export const financeReconcileQueue = queueEnabled ? new Queue("finance.reconcile", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 20,
  },
}) : disabledQueue("finance.reconcile");

export interface FinanceReconcileJobData {
  orgId: string;
  start: string; // ISO date
  end: string;   // ISO date
  correlationId?: string;
}

export async function enqueueFinanceReconcile(params: {
  orgId: string;
  start: Date;
  end: Date;
  correlationId?: string;
}): Promise<string> {
  if (!queueEnabled) {
    return "build-skip";
  }
  const jobCorrelationId = params.correlationId ?? resolveCorrelationId();
  const payload: FinanceReconcileJobData = {
    orgId: params.orgId,
    start: params.start.toISOString(),
    end: params.end.toISOString(),
    correlationId: jobCorrelationId,
  };
  const job = await financeReconcileQueue.add(
    "reconcile",
    payload as FinanceReconcileJobData
  );
  await logEvent({
    orgId: params.orgId,
    action: "finance.reconcile.requested",
    correlationId: jobCorrelationId,
    metadata: { jobId: job.id, start: params.start.toISOString(), end: params.end.toISOString() },
  }).catch(() => {});
  await recordQueueJobQueued({
    queueName: financeReconcileQueue.name,
    jobName: "reconcile",
    jobId: String(job.id),
    orgId: params.orgId,
    subsystem: "finance",
    resourceType: "org",
    resourceId: params.orgId,
    correlationId: jobCorrelationId,
    payload: payload as unknown as Record<string, unknown>,
  });
  return job.id!;
}

export function initializeFinanceReconcileWorker(): Worker {
  if (!queueEnabled || !connection) {
    throw new Error("Finance reconcile worker unavailable during build or without REDIS_URL");
  }
  const worker = new Worker(
    "finance.reconcile",
    async (job) => {
      const { orgId, start, end } = job.data as FinanceReconcileJobData;
      const startDate = new Date(start);
      const endDate = new Date(end);

      await logEvent({
        orgId,
        action: "finance.reconcile.started",
        correlationId: (job.data as FinanceReconcileJobData).correlationId,
        metadata: { jobId: job.id },
      }).catch(() => {});

      try {
        const result = await reconcileOrgRange({ orgId, start: startDate, end: endDate });

        const db = getScopedDb({ orgId });
        await db.reconciliationRun.create({
          data: {
            orgId,
            rangeStart: startDate,
            rangeEnd: endDate,
            status: "succeeded",
            totalsJson: result.totalsByType as object,
            mismatchJson: {
              missingInDb: result.missingInDb,
              missingInStripe: result.missingInStripe,
              amountDiffs: result.amountDiffs,
            } as object,
          },
        });

        await logEvent({
          orgId,
          action: "finance.reconcile.succeeded",
          correlationId: (job.data as FinanceReconcileJobData).correlationId,
          metadata: {
            jobId: job.id,
            totalsByType: result.totalsByType,
            missingCount: result.missingInDb.length + result.missingInStripe.length,
          },
        }).catch(() => {});

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const db = getScopedDb({ orgId });
        await db.reconciliationRun.create({
          data: {
            orgId,
            rangeStart: startDate,
            rangeEnd: endDate,
            status: "failed",
            mismatchJson: { error: msg } as object,
          },
        });
        await logEvent({
          orgId,
          action: "finance.reconcile.failed",
          status: "failed",
          correlationId: (job.data as FinanceReconcileJobData).correlationId,
          metadata: { jobId: job.id, error: msg },
        }).catch(() => {});
        throw err;
      }
    },
    {
      connection,
      concurrency: Math.max(1, FINANCE_RECONCILE_WORKER_CONCURRENCY),
    }
  );
  attachQueueWorkerInstrumentation(worker, (job) => {
    const data = job.data as FinanceReconcileJobData;
    return {
      orgId: data.orgId ?? "default",
      subsystem: "finance",
      resourceType: "org",
      resourceId: data.orgId,
      correlationId: data.correlationId,
      payload: data as unknown as Record<string, unknown>,
    };
  });
  return worker;
}
