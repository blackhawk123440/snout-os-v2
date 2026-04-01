/**
 * Health Check Helpers
 * 
 * Master Spec Reference: Section 9.1
 * 
 * Helper functions for checking system health status.
 */

import IORedis from "ioredis";
import { Queue } from "bullmq";
import { isBuildPhase } from "@/lib/runtime-phase";

/**
 * Check Redis connection
 */
export async function checkRedisConnection(): Promise<{ connected: boolean; error?: string }> {
  if (isBuildPhase) {
    return { connected: false, error: "Skipped during build" };
  }
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return { connected: false, error: "REDIS_URL missing" };
  }
  try {
    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      connectTimeout: 2000,
      lazyConnect: true,
    });

    await connection.ping();
    await connection.quit();
    return { connected: true };
  } catch (error: any) {
    return { connected: false, error: error?.message || String(error) };
  }
}

/**
 * Check queue connectivity
 * Tests if queues can be accessed
 */
export async function checkQueueConnection(): Promise<{ connected: boolean; error?: string }> {
  if (isBuildPhase) {
    return { connected: false, error: "Skipped during build" };
  }
  try {
    const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      connectTimeout: 2000,
      lazyConnect: true,
    });

    // Test with a temporary queue
    const testQueue = new Queue("health-check", { connection });
    await testQueue.getWaitingCount();
    await testQueue.close();
    await connection.quit();

    return { connected: true };
  } catch (error: any) {
    return { connected: false, error: error?.message || String(error) };
  }
}

/**
 * Get worker heartbeat and last processed job timestamp
 * Checks automation queue for last completed job
 */
export async function getWorkerStatus(): Promise<{
  hasWorkers: boolean;
  lastJobProcessed?: string;
  queues: {
    automation: { waiting: number; active: number; completed: number; failed: number };
    automationHigh: { waiting: number; active: number; completed: number; failed: number };
    reminders: { waiting: number; active: number; completed: number; failed: number };
    summary: { waiting: number; active: number; completed: number; failed: number };
    reconciliation: { waiting: number; active: number; completed: number; failed: number };
  };
}> {
  if (isBuildPhase) {
    return {
      hasWorkers: false,
      queues: {
        automation: { waiting: 0, active: 0, completed: 0, failed: 0 },
        automationHigh: { waiting: 0, active: 0, completed: 0, failed: 0 },
        reminders: { waiting: 0, active: 0, completed: 0, failed: 0 },
        summary: { waiting: 0, active: 0, completed: 0, failed: 0 },
        reconciliation: { waiting: 0, active: 0, completed: 0, failed: 0 },
      },
    };
  }
  try {
    const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      connectTimeout: 2000,
      lazyConnect: true,
    });

    // Check automation queue (most important for worker status)
    const automationQueue = new Queue("automations", { connection });
    const automationHighQueue = new Queue("automations.high", { connection });
    const reminderQueue = new Queue("reminders", { connection });
    const summaryQueue = new Queue("daily-summary", { connection });
    const reconciliationQueue = new Queue("reconciliation", { connection });

    // Get queue stats
    const [automationStats, automationHighStats, reminderStats, summaryStats, reconciliationStats] = await Promise.all([
      Promise.all([
        automationQueue.getWaitingCount(),
        automationQueue.getActiveCount(),
        automationQueue.getCompletedCount(),
        automationQueue.getFailedCount(),
      ]).then(([waiting, active, completed, failed]) => ({ waiting, active, completed, failed })),
      Promise.all([
        automationHighQueue.getWaitingCount(),
        automationHighQueue.getActiveCount(),
        automationHighQueue.getCompletedCount(),
        automationHighQueue.getFailedCount(),
      ]).then(([waiting, active, completed, failed]) => ({ waiting, active, completed, failed })),
      Promise.all([
        reminderQueue.getWaitingCount(),
        reminderQueue.getActiveCount(),
        reminderQueue.getCompletedCount(),
        reminderQueue.getFailedCount(),
      ]).then(([waiting, active, completed, failed]) => ({ waiting, active, completed, failed })),
      Promise.all([
        summaryQueue.getWaitingCount(),
        summaryQueue.getActiveCount(),
        summaryQueue.getCompletedCount(),
        summaryQueue.getFailedCount(),
      ]).then(([waiting, active, completed, failed]) => ({ waiting, active, completed, failed })),
      Promise.all([
        reconciliationQueue.getWaitingCount(),
        reconciliationQueue.getActiveCount(),
        reconciliationQueue.getCompletedCount(),
        reconciliationQueue.getFailedCount(),
      ]).then(([waiting, active, completed, failed]) => ({ waiting, active, completed, failed })),
    ]);

    // Get last completed job from automation queue
    let lastJobProcessed: string | undefined;
    try {
      const jobs = await automationQueue.getJobs(["completed"], 0, 0);
      if (jobs.length > 0) {
        const lastJob = jobs[0];
        lastJobProcessed = new Date(lastJob.processedOn || Date.now()).toISOString();
      }
    } catch (error) {
      // Ignore errors when fetching last job
    }

    await automationQueue.close();
    await automationHighQueue.close();
    await reminderQueue.close();
    await summaryQueue.close();
    await reconciliationQueue.close();
    await connection.quit();

    return {
      hasWorkers: true, // If we can connect to queues, workers are likely running
      lastJobProcessed,
      queues: {
        automation: automationStats,
        automationHigh: automationHighStats,
        reminders: reminderStats,
        summary: summaryStats,
        reconciliation: reconciliationStats,
      },
    };
  } catch (error: any) {
    return {
      hasWorkers: false,
      queues: {
        automation: { waiting: 0, active: 0, completed: 0, failed: 0 },
        automationHigh: { waiting: 0, active: 0, completed: 0, failed: 0 },
        reminders: { waiting: 0, active: 0, completed: 0, failed: 0 },
        summary: { waiting: 0, active: 0, completed: 0, failed: 0 },
        reconciliation: { waiting: 0, active: 0, completed: 0, failed: 0 },
      },
    };
  }
}
