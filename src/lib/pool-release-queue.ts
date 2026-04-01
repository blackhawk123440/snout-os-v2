/**
 * Pool Release Queue
 * 
 * BullMQ scheduled job that runs every 5 minutes to release pool numbers
 * based on rotation settings.
 */

import { Queue, Worker } from "bullmq";
import { releasePoolNumbers } from "./messaging/pool-release-job";
import { attachQueueWorkerInstrumentation } from "@/lib/queue-observability";
import { resolveCorrelationId } from "@/lib/correlation-id";
import { createRedisConnection } from "@/lib/redis-config";
import { isBuildPhase } from "@/lib/runtime-phase";

// Redis connection
const queueEnabled = !isBuildPhase && !!process.env.REDIS_URL;
const connection = queueEnabled ? createRedisConnection() : undefined;
const disabledQueue = (name: string) => ({ name } as unknown as Queue);

// Create pool release queue
export const poolReleaseQueue = queueEnabled ? new Queue("pool-release", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 10,
    removeOnFail: 5,
  },
}) : disabledQueue("pool-release");

/**
 * Create worker for processing pool release jobs
 */
export function createPoolReleaseWorker(): Worker {
  if (!queueEnabled || !connection) {
    throw new Error("Pool release worker unavailable during build or without REDIS_URL");
  }
  const worker = new Worker(
    "pool-release",
    async (job) => {
      console.log(`[Pool Release Queue] Processing job ${job.id}`);
      const stats = await releasePoolNumbers();
      console.log(`[Pool Release Queue] Job ${job.id} completed:`, stats);
      return stats;
    },
    {
      connection,
      concurrency: 1, // Process one job at a time
    }
  );
  attachQueueWorkerInstrumentation(worker, (job) => {
    const correlationId = (job.data as any)?.correlationId;
    return {
      orgId: "default",
      subsystem: "messaging",
      resourceType: "system",
      resourceId: "pool-release",
      correlationId,
      payload: job.data as Record<string, unknown>,
    };
  });
  return worker;
}

/**
 * Schedule pool release job (runs every 5 minutes)
 */
export async function schedulePoolRelease(): Promise<void> {
  if (!queueEnabled) return;
  // Remove any existing repeatable jobs first
  const repeatableJobs = await poolReleaseQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await poolReleaseQueue.removeRepeatableByKey(job.key);
  }

  // Schedule new repeatable job (every 5 minutes)
  const correlationId = resolveCorrelationId();
  await poolReleaseQueue.add(
    "release-pool-numbers",
    { correlationId },
    {
      repeat: {
        pattern: "*/5 * * * *", // Every 5 minutes
      },
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  );
  console.log("[Pool Release Queue] Scheduled repeatable job (every 5 minutes)");
}

/**
 * Initialize pool release worker and schedule
 */
let poolReleaseWorker: Worker | null = null;

export function initializePoolReleaseWorker(): Worker {
  if (!poolReleaseWorker) {
    poolReleaseWorker = createPoolReleaseWorker();

    poolReleaseWorker.on("completed", (job) => {
      console.log(`[Pool Release Queue] Job ${job.id} completed`);
    });

    poolReleaseWorker.on("failed", (job, err) => {
      console.error(`[Pool Release Queue] Job ${job?.id} failed:`, err);
    });
  }

  return poolReleaseWorker;
}
