import type { Job, Worker } from "bullmq";
import { QueueJobStatus } from "@prisma/client";
import { getScopedDb } from "@/lib/tenancy";
import { resolveCorrelationId, normalizeCorrelationId } from "@/lib/correlation-id";
import { publish, channels } from "@/lib/realtime/bus";

export interface QueueJobMeta {
  orgId: string;
  subsystem: string;
  resourceType?: string;
  resourceId?: string;
  correlationId?: string;
  payload?: Record<string, unknown>;
  retryOfJobId?: string;
}

type QueueJobIdentity = {
  queueName: string;
  jobName: string;
  jobId: string;
};

function normalizeJobId(jobId: unknown): string | null {
  if (jobId === null || jobId === undefined) return null;
  const value = String(jobId).trim();
  return value ? value : null;
}

function normalizePayload(data: unknown): string | null {
  if (data === null || data === undefined) return null;
  try {
    return JSON.stringify(data);
  } catch {
    return null;
  }
}

function resolveJobCorrelationId(job: Job, fallback?: string): string {
  const fromJob = normalizeCorrelationId((job.data as any)?.correlationId);
  return fromJob ?? resolveCorrelationId(undefined, fallback);
}

function extractProviderErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const err = error as Record<string, any>;
  const candidates = [
    err.code,
    err.raw?.code,
    err.raw?.decline_code,
    err.statusCode,
    err.response?.data?.error?.code,
    err.response?.data?.error?.type,
    err.errors?.[0]?.reason,
    err.error?.code,
  ];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const value = String(candidate).trim();
    if (value) return value;
  }
  return null;
}

function formatErrorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message;
  if (error === null || error === undefined) return null;
  return String(error);
}

async function upsertQueueJobRecord(params: QueueJobIdentity & QueueJobMeta & {
  status: QueueJobStatus;
  retryCount?: number;
  lastError?: string | null;
  providerErrorCode?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}): Promise<void> {
  const db = getScopedDb({ orgId: params.orgId });
  const payloadJson = params.payload ? normalizePayload(params.payload) : null;
  const retryCount = params.retryCount ?? 0;

  await db.queueJobRecord.upsert({
    where: {
      queueName_jobId: {
        queueName: params.queueName,
        jobId: params.jobId,
      },
    },
    create: {
      queueName: params.queueName,
      jobName: params.jobName,
      jobId: params.jobId,
      status: params.status,
      retryCount,
      lastError: params.lastError ?? null,
      providerErrorCode: params.providerErrorCode ?? null,
      subsystem: params.subsystem,
      resourceType: params.resourceType ?? null,
      resourceId: params.resourceId ?? null,
      correlationId: params.correlationId ?? null,
      payloadJson,
      startedAt: params.startedAt ?? null,
      finishedAt: params.finishedAt ?? null,
      retryOfJobId: params.retryOfJobId ?? null,
    },
    update: {
      status: params.status,
      retryCount,
      lastError: params.lastError ?? null,
      providerErrorCode: params.providerErrorCode ?? null,
      subsystem: params.subsystem,
      resourceType: params.resourceType ?? null,
      resourceId: params.resourceId ?? null,
      correlationId: params.correlationId ?? null,
      payloadJson: payloadJson ?? undefined,
      startedAt: params.startedAt ?? undefined,
      finishedAt: params.finishedAt ?? undefined,
      retryOfJobId: params.retryOfJobId ?? undefined,
    },
  });
}

export async function recordQueueJobQueued(params: QueueJobIdentity & QueueJobMeta): Promise<void> {
  const correlationId = params.correlationId ?? resolveCorrelationId();
  await upsertQueueJobRecord({
    ...params,
    correlationId,
    status: QueueJobStatus.QUEUED,
    retryCount: 0,
    lastError: null,
    providerErrorCode: null,
  });
}

export async function recordQueueJobRunning(job: Job, meta: QueueJobMeta): Promise<void> {
  const jobId = normalizeJobId(job.id);
  if (!jobId) return;
  const correlationId = resolveJobCorrelationId(job, meta.correlationId);
  await upsertQueueJobRecord({
    queueName: job.queueName,
    jobName: job.name,
    jobId,
    ...meta,
    correlationId,
    status: QueueJobStatus.RUNNING,
    startedAt: new Date(),
  });
}

export async function recordQueueJobSucceeded(job: Job, meta: QueueJobMeta): Promise<void> {
  const jobId = normalizeJobId(job.id);
  if (!jobId) return;
  const correlationId = resolveJobCorrelationId(job, meta.correlationId);
  await upsertQueueJobRecord({
    queueName: job.queueName,
    jobName: job.name,
    jobId,
    ...meta,
    correlationId,
    status: QueueJobStatus.SUCCEEDED,
    finishedAt: new Date(),
    retryCount: job.attemptsMade ?? 0,
    lastError: null,
    providerErrorCode: null,
  });
}

export async function recordQueueJobFailed(job: Job, meta: QueueJobMeta, error: unknown): Promise<void> {
  const jobId = normalizeJobId(job.id);
  if (!jobId) return;
  const correlationId = resolveJobCorrelationId(job, meta.correlationId);
  const maxAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
  const attemptsMade = job.attemptsMade ?? 0;
  const isDeadLettered = attemptsMade >= maxAttempts;
  await upsertQueueJobRecord({
    queueName: job.queueName,
    jobName: job.name,
    jobId,
    ...meta,
    correlationId,
    status: isDeadLettered ? QueueJobStatus.DEAD_LETTERED : QueueJobStatus.FAILED,
    finishedAt: new Date(),
    retryCount: attemptsMade,
    lastError: formatErrorMessage(error),
    providerErrorCode: extractProviderErrorCode(error),
  });
  publish(channels.opsFailures(meta.orgId), {
    type: isDeadLettered ? "queue.dead" : "queue.failed",
    ts: Date.now(),
    queueName: job.queueName,
    jobName: job.name,
    jobId,
    subsystem: meta.subsystem,
    correlationId,
  }).catch(() => {});
}

export function attachQueueWorkerInstrumentation(
  worker: Worker,
  getMeta: (job: Job) => QueueJobMeta | Promise<QueueJobMeta>
): void {
  worker.on("active", async (job) => {
    const meta = await getMeta(job);
    await recordQueueJobRunning(job, meta);
  });
  worker.on("completed", async (job) => {
    const meta = await getMeta(job);
    await recordQueueJobSucceeded(job, meta);
  });
  worker.on("failed", async (job, err) => {
    if (!job) return;
    const meta = await getMeta(job);
    await recordQueueJobFailed(job, meta, err);
  });
}
