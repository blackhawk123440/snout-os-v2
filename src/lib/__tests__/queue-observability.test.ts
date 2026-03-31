import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueueJobStatus } from "@prisma/client";
import {
  recordQueueJobQueued,
  recordQueueJobRunning,
  recordQueueJobFailed,
} from "@/lib/queue-observability";

const upsertMock = vi.fn();

vi.mock("@/lib/tenancy", () => ({
  getScopedDb: () => ({
    queueJobRecord: {
      upsert: upsertMock,
    },
  }),
}));

vi.mock("@/lib/realtime/bus", () => ({
  publish: vi.fn().mockResolvedValue(undefined),
  channels: {
    opsFailures: (orgId: string) => `org:${orgId}:ops:failures`,
  },
}));

describe("queue-observability", () => {
  beforeEach(() => {
    upsertMock.mockClear();
  });

  it("records queued status", async () => {
    await recordQueueJobQueued({
      queueName: "automations",
      jobName: "automation:bookingConfirmation:client",
      jobId: "job-1",
      orgId: "org-1",
      subsystem: "automation",
      resourceType: "booking",
      resourceId: "booking-1",
      correlationId: "corr-1",
      payload: { bookingId: "booking-1" },
    });

    const call = upsertMock.mock.calls[0][0];
    expect(call.create.status).toBe(QueueJobStatus.QUEUED);
    expect(call.create.correlationId).toBe("corr-1");
  });

  it("records running status", async () => {
    await recordQueueJobRunning(
      {
        id: "job-2",
        queueName: "calendar-sync",
        name: "calendar:upsert",
        data: { correlationId: "corr-2" },
      } as any,
      {
        orgId: "org-1",
        subsystem: "calendar",
        resourceType: "booking",
        resourceId: "booking-2",
      }
    );

    const call = upsertMock.mock.calls[0][0];
    expect(call.update.status).toBe(QueueJobStatus.RUNNING);
    expect(call.update.correlationId).toBe("corr-2");
  });

  it("records failed status with provider code", async () => {
    await recordQueueJobFailed(
      {
        id: "job-3",
        queueName: "payouts",
        name: "process-payout",
        data: {},
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as any,
      {
        orgId: "org-1",
        subsystem: "payout",
        resourceType: "booking",
        resourceId: "booking-3",
      },
      { code: "stripe_error" }
    );

    const call = upsertMock.mock.calls[0][0];
    expect(call.update.status).toBe(QueueJobStatus.FAILED);
    expect(call.update.providerErrorCode).toBe("stripe_error");
  });

  it("records dead lettered status after max attempts", async () => {
    await recordQueueJobFailed(
      {
        id: "job-4",
        queueName: "calendar-sync",
        name: "calendar:delete",
        data: {},
        attemptsMade: 3,
        opts: { attempts: 3 },
      } as any,
      {
        orgId: "org-1",
        subsystem: "calendar",
        resourceType: "booking",
        resourceId: "booking-4",
      },
      new Error("boom")
    );

    const call = upsertMock.mock.calls[0][0];
    expect(call.update.status).toBe(QueueJobStatus.DEAD_LETTERED);
  });
});
