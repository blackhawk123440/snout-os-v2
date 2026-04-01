import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { getScopedDb } from "@/lib/tenancy";
import { logEvent } from "@/lib/log-event";
import { isBuildPhase } from "@/lib/runtime-phase";

export interface ThreadActivityJobData {
  orgId: string;
  threadId: string;
  activityAtMs: number;
}

const THREAD_ACTIVITY_QUEUE_NAME = "messages.thread-activity";
const THREAD_ACTIVITY_DEBOUNCE_MS = Number(process.env.MESSAGE_THREAD_ACTIVITY_DEBOUNCE_MS || "750");
const THREAD_ACTIVITY_WORKER_CONCURRENCY = Number(process.env.MESSAGE_THREAD_ACTIVITY_WORKER_CONCURRENCY || "32");

let redisConnection: IORedis | null = null;
let threadActivityQueue: Queue<ThreadActivityJobData> | null = null;
let threadActivityWorker: Worker<ThreadActivityJobData> | null = null;

function getRedisConnection(): IORedis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || isBuildPhase) return null;
  if (!redisConnection) {
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableAutoPipelining: true,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  }
  return redisConnection;
}

export function isThreadActivityQueueAvailable(): boolean {
  return !!getRedisConnection();
}

function getThreadActivityQueue(): Queue<ThreadActivityJobData> | null {
  if (threadActivityQueue) return threadActivityQueue;
  const connection = getRedisConnection();
  if (!connection) return null;
  threadActivityQueue = new Queue<ThreadActivityJobData>(THREAD_ACTIVITY_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "fixed", delay: 250 },
      removeOnComplete: 1000,
      removeOnFail: 500,
    },
  });
  return threadActivityQueue;
}

function getThreadActivityBucket(activityAtMs: number): number {
  const debounceMs = Math.max(100, THREAD_ACTIVITY_DEBOUNCE_MS);
  return Math.floor(activityAtMs / debounceMs);
}

export async function enqueueThreadActivityUpdate(data: ThreadActivityJobData): Promise<boolean> {
  const queue = getThreadActivityQueue();
  if (!queue) return false;
  const bucket = getThreadActivityBucket(data.activityAtMs);
  const debounceMs = Math.max(100, THREAD_ACTIVITY_DEBOUNCE_MS);
  await queue.add("touch", data, {
    // Coalesce bursts for the same thread into a single write per debounce window.
    jobId: `${data.orgId}:${data.threadId}:${bucket}`,
    delay: debounceMs,
  });
  return true;
}

async function applyThreadActivityUpdate(job: Job<ThreadActivityJobData>): Promise<void> {
  const { orgId, threadId, activityAtMs } = job.data;
  const db = getScopedDb({ orgId });
  const activityAt = new Date(activityAtMs);
  await db.$executeRaw`
    UPDATE "MessageThread"
    SET
      "lastMessageAt" = CASE
        WHEN "lastMessageAt" IS NULL OR "lastMessageAt" < ${activityAt} THEN ${activityAt}
        ELSE "lastMessageAt"
      END,
      "lastOutboundAt" = CASE
        WHEN "lastOutboundAt" IS NULL OR "lastOutboundAt" < ${activityAt} THEN ${activityAt}
        ELSE "lastOutboundAt"
      END
    WHERE "id" = ${threadId}
  `;
}

export function initializeThreadActivityWorker(): Worker<ThreadActivityJobData> | null {
  if (threadActivityWorker) return threadActivityWorker;
  const connection = getRedisConnection();
  if (!connection) {
    console.warn("[Messaging Thread Activity] REDIS_URL missing; async updater disabled");
    return null;
  }

  threadActivityWorker = new Worker<ThreadActivityJobData>(
    THREAD_ACTIVITY_QUEUE_NAME,
    applyThreadActivityUpdate,
    {
      connection,
      concurrency: Math.max(1, THREAD_ACTIVITY_WORKER_CONCURRENCY),
    }
  );

  threadActivityWorker.on("failed", async (job, err) => {
    const orgId = job?.data?.orgId || "default";
    const threadId = job?.data?.threadId || "unknown";
    await logEvent({
      orgId,
      action: "message.thread_activity.worker_failed",
      status: "failed",
      entityType: "thread",
      entityId: threadId,
      metadata: {
        attempts: (job?.attemptsMade ?? 0) + 1,
        error: err?.message ?? String(err),
      },
    }).catch(() => {});
  });

  return threadActivityWorker;
}
