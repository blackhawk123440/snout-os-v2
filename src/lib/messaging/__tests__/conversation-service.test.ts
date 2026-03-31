import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureCompanyLaneConversationForBookingIntake,
  captureAvailabilityResponseFromMessage,
  reconcileConversationLifecycleForThread,
  shouldActivateServiceLaneFromApprovals,
} from "@/lib/messaging/conversation-service";

vi.mock("@/lib/messaging/client-contact-lookup", () => ({
  findClientContactByPhone: vi.fn(),
  createClientContact: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    client: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    messageThread: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    messageNumber: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    sitterAvailabilityRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    messageConversationFlag: {
      create: vi.fn(),
    },
    eventLog: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { findClientContactByPhone } from "@/lib/messaging/client-contact-lookup";

describe("conversation-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates company lane conversation on booking intake", async () => {
    vi.mocked(findClientContactByPhone).mockResolvedValue({ clientId: "client-1" } as any);
    vi.mocked(prisma.messageThread.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.messageNumber.findFirst).mockResolvedValue({
      id: "num-front",
      e164: "+15550000000",
    } as any);
    vi.mocked(prisma.messageThread.create).mockResolvedValue({ id: "thread-1" } as any);

    const res = await ensureCompanyLaneConversationForBookingIntake({
      orgId: "org-1",
      bookingId: "booking-1",
      phone: "+15551112222",
    });

    expect(res.reused).toBe(false);
    expect(res.threadId).toBe("thread-1");
    expect(prisma.messageThread.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          laneType: "company",
          activationStage: "intake",
          assignedRole: "front_desk",
        }),
      })
    );
  });

  it("captures sitter YES/NO availability response with latency", async () => {
    vi.mocked(prisma.sitterAvailabilityRequest.findFirst).mockResolvedValue({
      id: "req-1",
      requestedAt: new Date(Date.now() - 15_000),
    } as any);

    const captured = await captureAvailabilityResponseFromMessage({
      orgId: "org-1",
      threadId: "thread-1",
      sitterId: "sitter-1",
      body: "YES",
      responseMessageEventId: "event-1",
    });

    expect(captured).toBe(true);
    expect(prisma.sitterAvailabilityRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "req-1" },
        data: expect.objectContaining({
          status: "yes",
          responseMessageEventId: "event-1",
        }),
      })
    );
  });

  it("reroutes expired service lane and releases assignment", async () => {
    vi.mocked(prisma.messageThread.findUnique).mockResolvedValue({
      id: "thread-1",
      orgId: "org-1",
      laneType: "service",
      activationStage: "service",
      lifecycleStatus: "grace",
      assignedRole: "sitter",
      assignedSitterId: "sitter-1",
      serviceWindowStart: new Date("2026-03-14T10:00:00.000Z"),
      serviceWindowEnd: new Date("2026-03-14T16:00:00.000Z"),
      graceEndsAt: new Date("2026-03-15T16:00:00.000Z"),
    } as any);

    const result = await reconcileConversationLifecycleForThread({
      orgId: "org-1",
      threadId: "thread-1",
      now: new Date("2026-03-18T10:00:00.000Z"),
    });

    expect(result.rerouted).toBe(true);
    expect(prisma.messageThread.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "thread-1" },
        data: expect.objectContaining({
          laneType: "company",
          assignedRole: "front_desk",
        }),
      })
    );
    expect(prisma.messageNumber.updateMany).toHaveBeenCalled();
  });

  it("requires deterministic approval inputs before service lane activation", () => {
    expect(
      shouldActivateServiceLaneFromApprovals({
        clientApprovedAt: new Date("2026-03-14T10:00:00.000Z"),
        sitterApprovedAt: null,
        assignedSitterId: "sitter-1",
        serviceWindowStart: new Date("2026-03-20T08:00:00.000Z"),
        serviceWindowEnd: new Date("2026-03-20T12:00:00.000Z"),
      })
    ).toBe(false);

    expect(
      shouldActivateServiceLaneFromApprovals({
        clientApprovedAt: new Date("2026-03-14T10:00:00.000Z"),
        sitterApprovedAt: new Date("2026-03-14T10:01:00.000Z"),
        assignedSitterId: "sitter-1",
        serviceWindowStart: new Date("2026-03-20T08:00:00.000Z"),
        serviceWindowEnd: new Date("2026-03-20T12:00:00.000Z"),
      })
    ).toBe(true);
  });
});

