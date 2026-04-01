/**
 * Automation Queue
 * 
 * Per Master Spec Line 259: "Move every automation execution to the worker queue"
 * Line 6.2.1: "Triggers produce durable jobs in Redis queue"
 * Line 6.2.2: "Worker processes jobs with retries, backoff, and idempotency keys"
 * Line 6.2.3: "Each automation run writes an EventLog record with inputs, outputs, and errors"
 */

import { Queue, Worker } from "bullmq";
import { logAutomationRun, logEventFromLogger } from "./event-logger";
import { publish, channels } from "@/lib/realtime/bus";
import { createRedisConnection } from "@/lib/redis-config";
import { isBuildPhase } from "@/lib/runtime-phase";

// Redis connection
const queueEnabled = !isBuildPhase && !!process.env.REDIS_URL;
const connection = queueEnabled ? createRedisConnection() : undefined;
const disabledQueue = (name: string) => ({ name } as unknown as Queue);
const AUTOMATION_WORKER_CONCURRENCY = Number(process.env.AUTOMATION_WORKER_CONCURRENCY || "12");
const AUTOMATION_HIGH_WORKER_CONCURRENCY = Number(
  process.env.AUTOMATION_HIGH_WORKER_CONCURRENCY || "8"
);
const AUTOMATION_QUEUE_DEFAULT = "automations";
const AUTOMATION_QUEUE_HIGH = "automations.high";
const HIGH_PRIORITY_AUTOMATIONS = new Set(
  String(process.env.AUTOMATION_HIGH_PRIORITY_TYPES || "bookingConfirmation,ownerNewBookingAlert")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

// Create automation queue
export const automationQueue = queueEnabled ? new Queue(AUTOMATION_QUEUE_DEFAULT, {
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry 3 times
    backoff: {
      type: "exponential",
      delay: 3000, // Increase initial delay to reduce retry amplification under saturation
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
  },
}) : disabledQueue(AUTOMATION_QUEUE_DEFAULT);

export const automationHighQueue = queueEnabled ? new Queue(AUTOMATION_QUEUE_HIGH, {
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry 3 times
    backoff: {
      type: "exponential",
      delay: 3000, // Increase initial delay to reduce retry amplification under saturation
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
  },
}) : disabledQueue(AUTOMATION_QUEUE_HIGH);

/**
 * Job data for automation execution
 */
export interface AutomationJobData {
  automationType: string; // e.g., "ownerNewBookingAlert", "bookingConfirmation", "nightBeforeReminder"
  recipient: "client" | "sitter" | "owner"; // Who to send to
  context: {
    bookingId?: string;
    sitterId?: string;
    orgId?: string;
    [key: string]: any; // Additional context data
  };
  idempotencyKey?: string; // Optional idempotency key to prevent duplicate execution
  queueClass?: "high" | "default";
}

function resolveQueueClass(automationType: string): "high" | "default" {
  if (HIGH_PRIORITY_AUTOMATIONS.has(automationType)) return "high";
  return "default";
}

/**
 * Enqueue an automation job
 * This is the new way to trigger automations - jobs are processed by the worker
 */
export async function enqueueAutomation(
  automationType: string,
  recipient: "client" | "sitter" | "owner",
  context: AutomationJobData["context"],
  idempotencyKey?: string,
  _correlationId?: string // preserved for call-site compatibility
): Promise<void> {
  if (!queueEnabled) return;
  const jobData: AutomationJobData = {
    automationType,
    recipient,
    context,
    idempotencyKey,
    queueClass: resolveQueueClass(automationType),
  };

  const jobOptions: any = {
    jobId: idempotencyKey, // Use idempotency key as job ID to prevent duplicates
  };
  const queue = jobData.queueClass === "high" ? automationHighQueue : automationQueue;
  await queue.add(`automation:${automationType}:${recipient}`, jobData, jobOptions);
}

/**
 * Create worker for processing automation jobs
 * This worker will execute automations and write EventLog records
 */
export function createAutomationWorker(
  queueName: string,
  concurrency: number,
  queueClass: "high" | "default"
): Worker {
  if (!queueEnabled || !connection) {
    throw new Error("Automation worker unavailable during build or without REDIS_URL");
  }
  return new Worker(
    queueName,
    async (job) => {
      const { automationType, recipient, context } = job.data as AutomationJobData;
      const jobId = job.id;
      
      // Log that automation run started
      await logAutomationRun(
        automationType,
        "pending",
        {
          bookingId: context.bookingId,
          metadata: { 
            jobId, 
            recipient, 
            context,
            queueClass,
            message: `Starting automation: ${automationType} for ${recipient}`
          }
        }
      );

      try {
        // Import automation execution logic
        const { executeAutomationForRecipient } = await import("./automation-executor");
        
        // Execute the automation
        const result = await executeAutomationForRecipient(automationType, recipient, context);

        // If the executor returned a failure, throw so BullMQ retries the job
        if (!result.success && !result.metadata?.skipped) {
          throw new Error(result.error || `Automation ${automationType} returned success=false for ${recipient}`);
        }

        // Log success
        await logAutomationRun(
          automationType,
          "success",
          {
            bookingId: context.bookingId,
            metadata: {
              jobId,
              recipient,
              queueClass,
              result,
              message: `Automation executed successfully: ${automationType} for ${recipient}`
            }
          }
        );

        return result;
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        const orgId = (context as any).orgId ?? 'default';

        // Log automation.failed to EventLog for admin visibility (include context for retry)
        await logAutomationRun(
          automationType,
          "failed",
          {
            orgId,
            bookingId: context.bookingId,
            error: errorMessage,
            metadata: {
              jobId,
              recipient,
              queueClass,
              context,
              stack: error?.stack,
              message: `Automation failed: ${automationType} for ${recipient} - ${errorMessage}`,
            },
          }
        );

        throw error;
      }
    },
    { 
      connection,
      concurrency: Math.max(1, concurrency),
    }
  );
}

/**
 * Initialize automation worker
 * Call this when the application starts
 */
let automationWorker: Worker | null = null;
let automationHighWorker: Worker | null = null;

const DEAD_LETTER_AFTER_ATTEMPTS = 3;

export function initializeAutomationWorker(): Worker {
  if (!automationWorker) {
    automationWorker = createAutomationWorker(
      AUTOMATION_QUEUE_DEFAULT,
      AUTOMATION_WORKER_CONCURRENCY,
      "default"
    );
    
    automationWorker.on("completed", (job) => {
      console.log(`[Automation Queue] Job ${job.id} completed: ${job.data.automationType} for ${job.data.recipient}`);
    });
    
    automationWorker.on("failed", async (job, err) => {
      console.error(`[Automation Queue] Job ${job?.id} failed: ${job?.data?.automationType} for ${job?.data?.recipient}`, err);
      try {
        const { captureWorkerError } = await import("@/lib/worker-sentry");
        captureWorkerError(err instanceof Error ? err : new Error(String(err)), {
          jobName: `automation:${(job?.data as any)?.automationType}`,
          orgId: (job?.data as any)?.context?.orgId,
          bookingId: (job?.data as any)?.context?.bookingId,
        });
      } catch (_) {}
      const attempts = (job?.attemptsMade ?? 0) + 1;
      if (job && attempts >= DEAD_LETTER_AFTER_ATTEMPTS) {
        try {
          const orgId = (job.data as any).context?.orgId ?? "default";
          await logEventFromLogger("automation.dead", "failed", {
            orgId,
            bookingId: (job.data as any).context?.bookingId,
            error: err?.message || String(err),
            metadata: {
              automationType: (job.data as AutomationJobData).automationType,
              recipient: (job.data as AutomationJobData).recipient,
              context: (job.data as AutomationJobData).context,
              jobId: job.id,
              attempts,
              queueClass: "default",
            },
          });
          publish(channels.opsFailures(orgId), { type: "automation.dead", ts: Date.now() }).catch(() => {});
        } catch (e) {
          console.error("[Automation Queue] Failed to log dead letter:", e);
        }
      }
    });
  }

  if (!automationHighWorker) {
    automationHighWorker = createAutomationWorker(
      AUTOMATION_QUEUE_HIGH,
      AUTOMATION_HIGH_WORKER_CONCURRENCY,
      "high"
    );
    automationHighWorker.on("completed", (job) => {
      console.log(`[Automation Queue High] Job ${job.id} completed: ${job.data.automationType}`);
    });
    automationHighWorker.on("failed", async (job, err) => {
      console.error(`[Automation Queue High] Job ${job?.id} failed: ${job?.data?.automationType} for ${job?.data?.recipient}`, err);
      try {
        const { captureWorkerError } = await import("@/lib/worker-sentry");
        captureWorkerError(err instanceof Error ? err : new Error(String(err)), {
          jobName: `automation.high:${(job?.data as any)?.automationType}`,
          orgId: (job?.data as any)?.context?.orgId,
          bookingId: (job?.data as any)?.context?.bookingId,
        });
      } catch (_) {}
      const attempts = (job?.attemptsMade ?? 0) + 1;
      if (job && attempts >= DEAD_LETTER_AFTER_ATTEMPTS) {
        try {
          const orgId = (job.data as any).context?.orgId ?? "default";
          await logEventFromLogger("automation.dead", "failed", {
            orgId,
            bookingId: (job.data as any).context?.bookingId,
            error: err?.message || String(err),
            metadata: {
              automationType: (job.data as AutomationJobData).automationType,
              recipient: (job.data as AutomationJobData).recipient,
              context: (job.data as AutomationJobData).context,
              jobId: job.id,
              attempts,
              queueClass: "high",
            },
          });
          publish(channels.opsFailures(orgId), { type: "automation.dead", ts: Date.now() }).catch(() => {});
        } catch (e) {
          console.error("[Automation Queue High] Failed to log dead letter:", e);
        }
      }
    });
  }
  
  return automationWorker;
}
