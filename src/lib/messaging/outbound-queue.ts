import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { logEvent } from "@/lib/log-event";

export interface OutboundMessageJobData {
  orgId: string;
  messageEventId: string;
  provider?: "twilio";
}

const QUEUE_NAME = "messages.outbound";
const MESSAGE_WORKER_CONCURRENCY = Number(process.env.MESSAGE_SEND_WORKER_CONCURRENCY || "16");
const MESSAGE_MAX_ATTEMPTS = Number(process.env.MESSAGE_SEND_MAX_ATTEMPTS || "4");
const MESSAGE_RETRY_DELAY_MS = Number(process.env.MESSAGE_SEND_RETRY_DELAY_MS || "2000");
const MESSAGE_QUEUE_PRESSURE_WAITING_THRESHOLD = Number(process.env.MESSAGE_QUEUE_PRESSURE_WAITING_THRESHOLD || "200");
const MESSAGE_QUEUE_PRESSURE_ACTIVE_THRESHOLD = Number(process.env.MESSAGE_QUEUE_PRESSURE_ACTIVE_THRESHOLD || String(MESSAGE_WORKER_CONCURRENCY));
const MESSAGE_PROVIDER_MAX_INFLIGHT_PER_ORG = Number(process.env.MESSAGE_PROVIDER_MAX_INFLIGHT_PER_ORG || "8");
const MESSAGE_PROVIDER_MIN_INTERVAL_MS = Number(process.env.MESSAGE_PROVIDER_MIN_INTERVAL_MS || "40");
const MESSAGE_RETRY_STAGGER_MS = Number(process.env.MESSAGE_RETRY_STAGGER_MS || "250");

let redisConnection: IORedis | null = null;
let outboundQueue: Queue<OutboundMessageJobData> | null = null;
let outboundWorker: Worker<OutboundMessageJobData> | null = null;
const orgDispatchInFlight = new Map<string, number>();
const orgDispatchLastSentAtMs = new Map<string, number>();

function getRedisConnection(): IORedis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  if (!redisConnection) {
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableAutoPipelining: true,
      lazyConnect: true,
    });
  }
  return redisConnection;
}

export function isOutboundQueueAvailable(): boolean {
  return !!getRedisConnection();
}

function getOutboundQueue(): Queue<OutboundMessageJobData> | null {
  if (outboundQueue) return outboundQueue;
  const connection = getRedisConnection();
  if (!connection) return null;
  outboundQueue = new Queue<OutboundMessageJobData>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: Math.max(1, MESSAGE_MAX_ATTEMPTS),
      backoff: {
        type: "exponential",
        delay: Math.max(500, MESSAGE_RETRY_DELAY_MS),
      },
      removeOnComplete: 500,
      removeOnFail: 200,
    },
  });
  return outboundQueue;
}

export async function enqueueOutboundMessage(data: OutboundMessageJobData): Promise<boolean> {
  const queue = getOutboundQueue();
  if (!queue) return false;
  await queue.add("send", data, {
    jobId: data.messageEventId,
  });
  return true;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireProviderPermit(orgId: string): Promise<void> {
  const maxInFlight = Math.max(1, MESSAGE_PROVIDER_MAX_INFLIGHT_PER_ORG);
  const minInterval = Math.max(0, MESSAGE_PROVIDER_MIN_INTERVAL_MS);
  let attempts = 0;
  while (attempts < 400) {
    const inFlight = orgDispatchInFlight.get(orgId) || 0;
    const lastSentAt = orgDispatchLastSentAtMs.get(orgId) || 0;
    const sinceLastSend = Date.now() - lastSentAt;
    if (inFlight < maxInFlight && sinceLastSend >= minInterval) {
      orgDispatchInFlight.set(orgId, inFlight + 1);
      orgDispatchLastSentAtMs.set(orgId, Date.now());
      return;
    }
    attempts += 1;
    await sleep(Math.min(50, Math.max(10, minInterval - sinceLastSend)));
  }
}

function releaseProviderPermit(orgId: string): void {
  const inFlight = orgDispatchInFlight.get(orgId) || 0;
  if (inFlight <= 1) {
    orgDispatchInFlight.delete(orgId);
    return;
  }
  orgDispatchInFlight.set(orgId, inFlight - 1);
}

export async function getOutboundQueuePressure(): Promise<{
  available: boolean;
  waiting: number;
  active: number;
  delayed: number;
  forceQueuedOnly: boolean;
}> {
  const queue = getOutboundQueue();
  if (!queue) {
    return {
      available: false,
      waiting: 0,
      active: 0,
      delayed: 0,
      forceQueuedOnly: false,
    };
  }
  try {
    const [waiting, active, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
    ]);
    const forceQueuedOnly =
      waiting >= Math.max(1, MESSAGE_QUEUE_PRESSURE_WAITING_THRESHOLD) ||
      active >= Math.max(1, MESSAGE_QUEUE_PRESSURE_ACTIVE_THRESHOLD);
    return {
      available: true,
      waiting,
      active,
      delayed,
      forceQueuedOnly,
    };
  } catch {
    return {
      available: false,
      waiting: 0,
      active: 0,
      delayed: 0,
      forceQueuedOnly: false,
    };
  }
}

export function initializeOutboundMessageWorker(): Worker<OutboundMessageJobData> | null {
  if (outboundWorker) return outboundWorker;
  const connection = getRedisConnection();
  if (!connection) {
    console.warn("[Messaging Queue] REDIS_URL missing; outbound worker disabled");
    return null;
  }

  outboundWorker = new Worker<OutboundMessageJobData>(
    QUEUE_NAME,
    async (job: Job<OutboundMessageJobData>) => {
      const { dispatchMessageEventDelivery } = await import("@/lib/messaging/send");
      await acquireProviderPermit(job.data.orgId);
      try {
        const attempt = (job.attemptsMade ?? 0) + 1;
        if (attempt > 1) {
          const stagger = Math.min(
            2000,
            MESSAGE_RETRY_STAGGER_MS * attempt + Math.floor(Math.random() * MESSAGE_RETRY_STAGGER_MS)
          );
          await sleep(stagger);
        }
        await dispatchMessageEventDelivery({
          orgId: job.data.orgId,
          messageEventId: job.data.messageEventId,
          throwOnRetryable: true,
          attempt,
          maxAttempts: typeof job.opts.attempts === "number" ? job.opts.attempts : MESSAGE_MAX_ATTEMPTS,
        });
      } finally {
        releaseProviderPermit(job.data.orgId);
      }
    },
    {
      connection,
      concurrency: Math.max(1, MESSAGE_WORKER_CONCURRENCY),
    }
  );

  outboundWorker.on("completed", (job) => {
    console.log(`[Messaging Queue] Delivered message event ${job.data.messageEventId}`);
  });

  outboundWorker.on("failed", async (job, err) => {
    const orgId = job?.data?.orgId || "default";
    const messageEventId = job?.data?.messageEventId || "unknown";
    const attempts = (job?.attemptsMade ?? 0) + 1;
    console.error(`[Messaging Queue] Failed message event ${messageEventId} (attempt ${attempts})`, err);
    await logEvent({
      orgId,
      action: "message.delivery.worker_failed",
      status: "failed",
      entityType: "message",
      entityId: messageEventId,
      metadata: {
        attempts,
        error: err?.message ?? String(err),
      },
    }).catch(() => {});
  });

  return outboundWorker;
}
