/**
 * Reminder scheduler queue tests.
 * - Scheduling happens via tick (no global scan)
 * - Org-scoped processing
 * - Idempotency via jobId
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    org: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/tenancy", () => ({
  getScopedDb: vi.fn(),
}));

vi.mock("@/lib/automation-queue", () => ({
  enqueueAutomation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/event-logger", () => ({
  logEventFromLogger: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/queue-observability", () => ({
  recordQueueJobQueued: vi.fn().mockResolvedValue(undefined),
  attachQueueWorkerInstrumentation: vi.fn(),
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "job-1" }));
vi.mock("bullmq", () => {
  const mockQueueInstance = {
    add: mockQueueAdd,
    getRepeatableJobs: vi.fn().mockResolvedValue([]),
    removeRepeatableByKey: vi.fn().mockResolvedValue(undefined),
  };
  return {
    Queue: vi.fn().mockImplementation(function () {
      return mockQueueInstance;
    }),
    Worker: vi.fn().mockImplementation(function () {
      return {};
    }),
  };
});

import { prisma } from "@/lib/db";
import { getScopedDb } from "@/lib/tenancy";
import { enqueueAutomation } from "@/lib/automation-queue";
import {
  processRemindersForOrg,
  runReminderDispatcher,
} from "@/lib/reminder-scheduler-queue";

describe("reminder-scheduler-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("runReminderDispatcher", () => {
    it("enqueues reminder-tick job for each org", async () => {
      (prisma as any).org.findMany.mockResolvedValue([
        { id: "org-1" },
        { id: "org-2" },
      ]);

      const result = await runReminderDispatcher();

      expect(result.orgsProcessed).toBe(2);
      expect(mockQueueAdd).toHaveBeenCalledTimes(2);
      expect(mockQueueAdd).toHaveBeenCalledWith(
        "reminder-tick",
        expect.objectContaining({ orgId: "org-1", correlationId: expect.any(String) }),
        expect.objectContaining({ jobId: expect.stringContaining("org-1") })
      );
      expect(mockQueueAdd).toHaveBeenCalledWith(
        "reminder-tick",
        expect.objectContaining({ orgId: "org-2", correlationId: expect.any(String) }),
        expect.objectContaining({ jobId: expect.stringContaining("org-2") })
      );
    });
  });

  describe("processRemindersForOrg", () => {
    it("enqueues nightBeforeReminder for tomorrow bookings using getScopedDb", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);

      const mockDb = {
        booking: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "b1",
              orgId: "org-1",
              firstName: "Jane",
              lastName: "Doe",
              phone: "+15551234567",
              service: "Drop-in",
              sitterId: "s1",
              pets: [],
              timeSlots: [],
              sitter: { id: "s1" },
            },
          ]),
        },
      };
      (getScopedDb as any).mockReturnValue(mockDb);

      const result = await processRemindersForOrg("org-1");

      expect(getScopedDb).toHaveBeenCalledWith({ orgId: "org-1" });
      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ["pending", "confirmed"] },
          }),
        })
      );
      expect(result.processed).toBe(1);

      const dateKey = tomorrow.toISOString().slice(0, 10);
      expect(enqueueAutomation).toHaveBeenCalledWith(
        "nightBeforeReminder",
        "client",
        expect.objectContaining({
          orgId: "org-1",
          bookingId: "b1",
          firstName: "Jane",
          lastName: "Doe",
        }),
        `nightBeforeReminder:client:b1:${dateKey}`,
        undefined
      );
      expect(enqueueAutomation).toHaveBeenCalledWith(
        "nightBeforeReminder",
        "sitter",
        expect.objectContaining({
          orgId: "org-1",
          bookingId: "b1",
          sitterId: "s1",
        }),
        `nightBeforeReminder:sitter:b1:${dateKey}`,
        undefined
      );
    });

    it("uses deterministic idempotency keys for same booking+date", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);

      const mockDb = {
        booking: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "b1",
              orgId: "org-1",
              firstName: "Jane",
              lastName: "Doe",
              phone: "+15551234567",
              service: "Drop-in",
              sitterId: null,
              pets: [],
              timeSlots: [],
              sitter: null,
            },
          ]),
        },
      };
      (getScopedDb as any).mockReturnValue(mockDb);

      await processRemindersForOrg("org-1");
      await processRemindersForOrg("org-1");

      const dateKey = tomorrow.toISOString().slice(0, 10);
      const expectedKey = `nightBeforeReminder:client:b1:${dateKey}`;
      const calls = (enqueueAutomation as any).mock.calls;
      const clientCalls = calls.filter(
        (c: any[]) => c[0] === "nightBeforeReminder" && c[1] === "client"
      );
      expect(clientCalls.length).toBe(2);
      expect(clientCalls[0][3]).toBe(expectedKey);
      expect(clientCalls[1][3]).toBe(expectedKey);
    });

    it("does not enqueue when no bookings found", async () => {
      const mockDb = {
        booking: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };
      (getScopedDb as any).mockReturnValue(mockDb);

      const result = await processRemindersForOrg("org-1");

      expect(result.processed).toBe(0);
      expect(enqueueAutomation).not.toHaveBeenCalled();
    });
  });
});
