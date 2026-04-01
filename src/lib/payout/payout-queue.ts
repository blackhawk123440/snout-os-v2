/**
 * Payout queue: enqueue payout job on booking completion.
 * Idempotent via jobId = payout:{bookingId}
 */

import { Queue, Worker } from "bullmq";
import { prisma } from "@/lib/db";
import { getScopedDb } from "@/lib/tenancy";
import { calculatePayoutForBooking, executePayout } from "./payout-engine";
import { persistPayrollRunFromTransfer } from "@/lib/payroll/payroll-service";
import { logEvent } from "@/lib/log-event";
import { attachQueueWorkerInstrumentation, recordQueueJobQueued } from "@/lib/queue-observability";
import { resolveCorrelationId } from "@/lib/correlation-id";
import { createRedisConnection } from "@/lib/redis-config";
import { isBuildPhase } from "@/lib/runtime-phase";

const queueEnabled = !isBuildPhase && !!process.env.REDIS_URL;
const connection = queueEnabled ? createRedisConnection() : undefined;
const disabledQueue = (name: string) => ({ name } as unknown as Queue);

export const payoutQueue = queueEnabled ? new Queue("payouts", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
}) : disabledQueue("payouts");

const JOB_PREFIX = "payout";

export function getPayoutJobId(bookingId: string): string {
  return `${JOB_PREFIX}:${bookingId}`;
}

export async function enqueuePayoutForBooking(params: {
  orgId: string;
  bookingId: string;
  sitterId: string;
  correlationId?: string;
}): Promise<void> {
  if (!queueEnabled) return;
  const { orgId, bookingId, sitterId } = params;
  const jobId = getPayoutJobId(bookingId);
  const jobCorrelationId = params.correlationId ?? resolveCorrelationId();

  const existing = await payoutQueue.getJob(jobId);
  if (existing && !["failed", "completed"].includes(await existing.getState())) {
    return;
  }

  const job = await payoutQueue.add(
    "process-payout",
    { orgId, bookingId, sitterId, correlationId: jobCorrelationId },
    { jobId }
  );

  await logEvent({
    action: "payout.scheduled",
    orgId,
    correlationId: jobCorrelationId,
    metadata: { bookingId, sitterId },
  }).catch(() => {});

  await recordQueueJobQueued({
    queueName: payoutQueue.name,
    jobName: "process-payout",
    jobId: String(job.id),
    orgId,
    subsystem: "payout",
    resourceType: "booking",
    resourceId: bookingId,
    correlationId: jobCorrelationId,
    payload: { orgId, bookingId, sitterId, correlationId: jobCorrelationId },
  });
}

export function initializePayoutWorker(): Worker {
  if (!queueEnabled || !connection) {
    throw new Error("Payout worker unavailable during build or without REDIS_URL");
  }
  const worker = new Worker(
    "payouts",
    async (job) => {
      const { orgId, bookingId, sitterId, correlationId } = job.data;

      const db = getScopedDb({ orgId });
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        include: { sitter: true },
      });

      if (!booking) {
        throw new Error(`Booking ${bookingId} not found`);
      }
      if (booking.sitterId !== sitterId) {
        return;
      }
      if (booking.status !== "completed") {
        return;
      }
      if (booking.sitter?.deletedAt) {
        return; // Skip payout for deleted sitters
      }

      const totalPrice = Number(booking.totalPrice) || 0;
      if (totalPrice <= 0) return;

      const commissionPct = booking.sitter?.commissionPercentage ?? 80;
      const calc = calculatePayoutForBooking(totalPrice, commissionPct);
      if (calc.amountCents <= 0) return;

      const result = await executePayout({
        db: db as any,
        orgId,
        sitterId,
        bookingId,
        amountCents: calc.amountCents,
        currency: "usd",
        correlationId,
      });

      if (!result.success) {
        throw new Error(result.error || "Payout failed");
      }

      if (result.payoutTransferId) {
        const commissionAmount = totalPrice - calc.netAmount;
        await persistPayrollRunFromTransfer(
          db as any,
          orgId,
          result.payoutTransferId,
          sitterId,
          totalPrice,
          commissionAmount,
          calc.netAmount
        ).catch((e) => console.error("[PayoutWorker] persistPayrollRunFromTransfer failed:", e));
      }
    },
    { connection }
  );
  attachQueueWorkerInstrumentation(worker, (job) => {
    const data = job.data as { orgId: string; bookingId: string; sitterId: string; correlationId?: string };
    return {
      orgId: data.orgId ?? "default",
      subsystem: "payout",
      resourceType: "booking",
      resourceId: data.bookingId,
      correlationId: data.correlationId,
      payload: data as Record<string, unknown>,
    };
  });
  return worker;
}
