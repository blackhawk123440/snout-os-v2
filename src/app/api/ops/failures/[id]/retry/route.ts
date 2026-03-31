/**
 * POST /api/ops/failures/[id]/retry
 * Safely re-enqueue a failed queue job with dedupe guard.
 */

import { NextRequest, NextResponse } from "next/server";
import { QueueJobStatus } from "@prisma/client";
import { getRequestContext } from "@/lib/request-context";
import { requireOwnerOrAdmin, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";
import { resolveCorrelationId } from "@/lib/correlation-id";
import { getQueueByName } from "@/lib/queue-registry";
import { recordQueueJobQueued } from "@/lib/queue-observability";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getScopedDb(ctx);

  const record = await db.queueJobRecord.findFirst({ where: { id } });
  if (!record) {
    return NextResponse.json({ error: "Failure record not found" }, { status: 404 });
  }

  const retryableStatus =
    record.status === QueueJobStatus.FAILED || record.status === QueueJobStatus.DEAD_LETTERED;
  if (!retryableStatus) {
    return NextResponse.json({ error: "Only failed jobs can be retried" }, { status: 409 });
  }

  const existingRetry = await db.queueJobRecord.findFirst({
    where: {
      retryOfJobId: record.jobId,
      status: { in: [QueueJobStatus.QUEUED, QueueJobStatus.RUNNING, QueueJobStatus.SUCCEEDED] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existingRetry) {
    return NextResponse.json({ error: "Retry already queued or completed" }, { status: 409 });
  }

  const queue = getQueueByName(record.queueName);
  if (!queue) {
    return NextResponse.json({ error: "Queue not available for retry" }, { status: 400 });
  }

  let payload: Record<string, unknown> = {};
  if (record.payloadJson) {
    try {
      payload = JSON.parse(record.payloadJson);
    } catch {
      return NextResponse.json({ error: "Stored payload could not be parsed" }, { status: 422 });
    }
  }

  const correlationId = ctx.correlationId ?? resolveCorrelationId(request);
  payload = {
    ...payload,
    correlationId,
    retryOfJobId: record.jobId,
  };
  if (typeof payload.idempotencyKey === "string" && payload.idempotencyKey.trim()) {
    payload.idempotencyKey = `${payload.idempotencyKey}:retry:${Date.now()}`;
  }

  const retryJobId = `retry:${record.jobId}:${Date.now()}`;
  const job = await queue.add(record.jobName, payload, { jobId: retryJobId });

  await recordQueueJobQueued({
    queueName: record.queueName,
    jobName: record.jobName,
    jobId: String(job.id),
    orgId: record.orgId,
    subsystem: record.subsystem,
    resourceType: record.resourceType ?? undefined,
    resourceId: record.resourceId ?? undefined,
    correlationId,
    payload,
    retryOfJobId: record.jobId,
  });

  await db.queueJobRecord.update({
    where: { id: record.id },
    data: {
      lastRetryAt: new Date(),
      lastRetryBy: ctx.userId ?? "system",
    },
  });

  return NextResponse.json({
    success: true,
    jobId: job.id,
    correlationId,
    retryOfJobId: record.jobId,
  });
}
