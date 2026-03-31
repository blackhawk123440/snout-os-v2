/**
 * GET /api/ops/failures
 * Queue failure console data: QueueJobRecord with filters.
 */

import { NextRequest, NextResponse } from "next/server";
import { QueueJobStatus } from "@prisma/client";
import { getRequestContext } from "@/lib/request-context";
import { requireOwnerOrAdmin, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";

const DEFAULT_LIMIT = 50;

function parseStatusList(value: string | null): QueueJobStatus[] | null {
  if (!value) return null;
  const raw = value.split(",").map((v) => v.trim().toUpperCase()).filter(Boolean);
  const allowed = new Set(Object.values(QueueJobStatus));
  const statuses = raw.filter((v) => allowed.has(v as QueueJobStatus)) as QueueJobStatus[];
  return statuses.length > 0 ? statuses : null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
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

  const url = (request as NextRequest).nextUrl ?? new URL(request.url);
  const { searchParams } = url;
  const limit = Math.min(
    parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    100
  );
  const statuses = parseStatusList(searchParams.get("status")) ?? [
    QueueJobStatus.FAILED,
    QueueJobStatus.DEAD_LETTERED,
  ];
  const subsystem = searchParams.get("subsystem")?.trim();
  const resourceType = searchParams.get("resourceType")?.trim();
  const resourceId = searchParams.get("resourceId")?.trim();
  const correlationId = searchParams.get("correlationId")?.trim();
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));

  const db = getScopedDb(ctx);
  const where: Record<string, unknown> = {
    status: { in: statuses },
  };
  if (subsystem) where.subsystem = subsystem;
  if (resourceType) where.resourceType = resourceType;
  if (resourceId) where.resourceId = resourceId;
  if (correlationId) where.correlationId = correlationId;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const records = await db.queueJobRecord.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  const bookingIds = Array.from(
    new Set(records.filter((r) => r.resourceType === "booking" && r.resourceId).map((r) => r.resourceId!))
  );
  const sitterIds = Array.from(
    new Set(records.filter((r) => r.resourceType === "sitter" && r.resourceId).map((r) => r.resourceId!))
  );

  const [bookings, sitters] = await Promise.all([
    bookingIds.length
      ? db.booking.findMany({
          where: { id: { in: bookingIds } },
          select: { id: true, firstName: true, lastName: true, service: true, startAt: true, status: true },
        })
      : Promise.resolve([]),
    sitterIds.length
      ? db.sitter.findMany({
          where: { id: { in: sitterIds } },
          select: { id: true, firstName: true, lastName: true, active: true },
        })
      : Promise.resolve([]),
  ]);

  const bookingMap = new Map(bookings.map((b) => [b.id, b]));
  const sitterMap = new Map(sitters.map((s) => [s.id, s]));

  const items = records.map((r) => {
    let payload: Record<string, unknown> | null = null;
    if (r.payloadJson) {
      try {
        payload = JSON.parse(r.payloadJson);
      } catch {
        payload = null;
      }
    }
    const booking = r.resourceType === "booking" ? bookingMap.get(r.resourceId || "") : null;
    const sitter = r.resourceType === "sitter" ? sitterMap.get(r.resourceId || "") : null;
    return {
      id: r.id,
      queueName: r.queueName,
      jobName: r.jobName,
      jobId: r.jobId,
      status: r.status,
      retryCount: r.retryCount,
      lastError: r.lastError,
      providerErrorCode: r.providerErrorCode,
      subsystem: r.subsystem,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      correlationId: r.correlationId,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      retryOfJobId: r.retryOfJobId,
      lastRetryAt: r.lastRetryAt,
      lastRetryBy: r.lastRetryBy,
      payload,
      booking: booking
        ? {
            id: booking.id,
            clientName: `${booking.firstName} ${booking.lastName}`.trim(),
            service: booking.service,
            startAt: booking.startAt,
            status: booking.status,
          }
        : null,
      sitter: sitter
        ? {
            id: sitter.id,
            name: `${sitter.firstName} ${sitter.lastName}`.trim(),
            active: sitter.active,
          }
        : null,
    };
  });

  return NextResponse.json({ items, count: items.length });
}
