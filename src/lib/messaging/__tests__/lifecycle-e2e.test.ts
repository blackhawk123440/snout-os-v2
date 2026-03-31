import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureCompanyLaneConversationForBookingIntake,
  createSitterAvailabilityRequest,
  captureAvailabilityResponseFromMessage,
  syncConversationLifecycleWithBookingWorkflow,
  reconcileConversationLifecycleForThread,
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
    eventLog: {
      create: vi.fn(),
      findMany: vi.fn(),
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
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    messageConversationFlag: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { findClientContactByPhone } from "@/lib/messaging/client-contact-lookup";

describe("messaging lifecycle e2e", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("booking intake ensures company lane", async () => {
    vi.mocked(findClientContactByPhone).mockResolvedValue({ clientId: "client-1" } as any);
    vi.mocked(prisma.messageThread.findFirst).mockResolvedValueOnce(null as any);
    vi.mocked(prisma.messageNumber.findFirst).mockResolvedValue({
      id: "front-1",
      e164: "+15550000000",
    } as any);
    vi.mocked(prisma.messageThread.create).mockResolvedValue({ id: "thread-1" } as any);

    const result = await ensureCompanyLaneConversationForBookingIntake({
      orgId: "org-1",
      bookingId: "booking-1",
      phone: "+15551112222",
    });

    expect(result.threadId).toBe("thread-1");
    expect(prisma.messageThread.create).toHaveBeenCalled();
  });

  it("records sitter availability request and response logging", async () => {
    vi.mocked(prisma.sitterAvailabilityRequest.create).mockResolvedValue({ id: "req-1" } as any);
    vi.mocked(prisma.sitterAvailabilityRequest.findFirst).mockResolvedValue({
      id: "req-1",
      requestedAt: new Date(Date.now() - 20_000),
    } as any);

    const request = await createSitterAvailabilityRequest({
      orgId: "org-1",
      threadId: "thread-1",
      sitterId: "sitter-1",
      bookingId: "booking-1",
    });
    const captured = await captureAvailabilityResponseFromMessage({
      orgId: "org-1",
      threadId: "thread-1",
      sitterId: "sitter-1",
      body: "YES",
      responseMessageEventId: "event-1",
    });

    expect(request.id).toBe("req-1");
    expect(captured).toBe(true);
    expect(prisma.sitterAvailabilityRequest.update).toHaveBeenCalled();
  });

  it("covers meet-and-greet schedule/confirm and approval-driven activation", async () => {
    vi.mocked(prisma.messageThread.findFirst).mockResolvedValue({ id: "thread-1" } as any);
    vi.mocked(prisma.messageThread.findUnique)
      .mockResolvedValueOnce({
        id: "thread-1",
        assignedSitterId: "sitter-1",
        laneType: "company",
        clientApprovedAt: null,
        sitterApprovedAt: null,
        serviceWindowStart: new Date("2026-03-20T08:00:00.000Z"),
        serviceWindowEnd: new Date("2026-03-20T12:00:00.000Z"),
        meetAndGreetConfirmedAt: null,
      } as any)
      .mockResolvedValueOnce({
        id: "thread-1",
        assignedSitterId: "sitter-1",
        laneType: "company",
        clientApprovedAt: new Date("2026-03-14T10:00:00.000Z"),
        sitterApprovedAt: new Date("2026-03-14T10:01:00.000Z"),
        serviceWindowStart: new Date("2026-03-20T08:00:00.000Z"),
        serviceWindowEnd: new Date("2026-03-20T12:00:00.000Z"),
        meetAndGreetConfirmedAt: new Date("2026-03-14T09:30:00.000Z"),
      } as any);
    vi.mocked(prisma.messageNumber.findFirst).mockResolvedValue({
      id: "pool-1",
      e164: "+15557770000",
      numberClass: "pool",
    } as any);

    await syncConversationLifecycleWithBookingWorkflow({
      orgId: "org-1",
      bookingId: "booking-1",
      clientId: "client-1",
      sitterId: "sitter-1",
      bookingStatus: "confirmed",
      serviceWindowStart: new Date("2026-03-20T08:00:00.000Z"),
      serviceWindowEnd: new Date("2026-03-20T12:00:00.000Z"),
      meetAndGreetScheduledAt: new Date("2026-03-15T10:00:00.000Z"),
      meetAndGreetConfirmedAt: new Date("2026-03-15T10:30:00.000Z"),
    });
    await syncConversationLifecycleWithBookingWorkflow({
      orgId: "org-1",
      bookingId: "booking-1",
      clientId: "client-1",
      sitterId: "sitter-1",
      bookingStatus: "confirmed",
      serviceWindowStart: new Date("2026-03-20T08:00:00.000Z"),
      serviceWindowEnd: new Date("2026-03-20T12:00:00.000Z"),
      clientApprovedAt: new Date("2026-03-14T10:00:00.000Z"),
      sitterApprovedAt: new Date("2026-03-14T10:01:00.000Z"),
    });

    expect(prisma.messageThread.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          laneType: "service",
          activationStage: "service",
        }),
      })
    );
  });

  it("covers post-service grace transition", async () => {
    vi.mocked(prisma.messageThread.findFirst).mockResolvedValue({ id: "thread-1" } as any);
    vi.mocked(prisma.messageThread.findUnique).mockResolvedValue({
      id: "thread-1",
      assignedSitterId: "sitter-1",
      laneType: "service",
      clientApprovedAt: new Date("2026-03-14T10:00:00.000Z"),
      sitterApprovedAt: new Date("2026-03-14T10:01:00.000Z"),
      serviceWindowStart: new Date("2026-03-20T08:00:00.000Z"),
      serviceWindowEnd: new Date("2026-03-20T12:00:00.000Z"),
      meetAndGreetConfirmedAt: new Date("2026-03-15T10:30:00.000Z"),
    } as any);

    await syncConversationLifecycleWithBookingWorkflow({
      orgId: "org-1",
      bookingId: "booking-1",
      clientId: "client-1",
      sitterId: "sitter-1",
      bookingStatus: "completed",
      serviceWindowStart: new Date("2026-03-20T08:00:00.000Z"),
      serviceWindowEnd: new Date("2026-03-20T12:00:00.000Z"),
    });

    expect(prisma.messageThread.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lifecycleStatus: "grace" }),
      })
    );
  });

  it("covers expired lane reroute", async () => {
    vi.mocked(prisma.messageThread.findUnique).mockResolvedValue({
      id: "thread-1",
      orgId: "org-1",
      bookingId: "booking-1",
      laneType: "service",
      activationStage: "service",
      lifecycleStatus: "grace",
      assignedRole: "sitter",
      assignedSitterId: "sitter-1",
      serviceWindowStart: new Date("2026-03-20T08:00:00.000Z"),
      serviceWindowEnd: new Date("2026-03-20T12:00:00.000Z"),
      graceEndsAt: new Date("2026-03-21T12:00:00.000Z"),
    } as any);
    vi.mocked(prisma.messageThread.update).mockResolvedValue({ bookingId: "booking-1" } as any);

    const result = await reconcileConversationLifecycleForThread({
      orgId: "org-1",
      threadId: "thread-1",
      now: new Date("2026-03-24T12:00:00.000Z"),
    });

    expect(result.rerouted).toBe(true);
    expect(prisma.messageNumber.updateMany).toHaveBeenCalled();
  });

  it("covers same-sitter rebook without forced reroute reset", async () => {
    vi.mocked(prisma.messageThread.findFirst).mockResolvedValue({ id: "thread-1" } as any);
    vi.mocked(prisma.messageThread.findUnique).mockResolvedValue({
      id: "thread-1",
      assignedSitterId: "sitter-1",
      laneType: "company",
      clientApprovedAt: null,
      sitterApprovedAt: null,
      serviceWindowStart: null,
      serviceWindowEnd: null,
      meetAndGreetConfirmedAt: null,
    } as any);

    await syncConversationLifecycleWithBookingWorkflow({
      orgId: "org-1",
      bookingId: "booking-2",
      clientId: "client-1",
      sitterId: "sitter-1",
      bookingStatus: "confirmed",
      serviceWindowStart: new Date("2026-03-25T08:00:00.000Z"),
      serviceWindowEnd: new Date("2026-03-25T12:00:00.000Z"),
    });

    expect(prisma.messageNumber.updateMany).not.toHaveBeenCalled();
  });

  it("covers different-sitter rebook reset", async () => {
    vi.mocked(prisma.messageThread.findFirst).mockResolvedValue({ id: "thread-1" } as any);
    vi.mocked(prisma.messageThread.findUnique).mockResolvedValue({
      id: "thread-1",
      assignedSitterId: "sitter-1",
      laneType: "service",
      clientApprovedAt: new Date("2026-03-20T08:00:00.000Z"),
      sitterApprovedAt: new Date("2026-03-20T08:10:00.000Z"),
      serviceWindowStart: new Date("2026-03-25T08:00:00.000Z"),
      serviceWindowEnd: new Date("2026-03-25T12:00:00.000Z"),
      meetAndGreetConfirmedAt: new Date("2026-03-22T09:00:00.000Z"),
    } as any);

    await syncConversationLifecycleWithBookingWorkflow({
      orgId: "org-1",
      bookingId: "booking-3",
      clientId: "client-1",
      sitterId: "sitter-2",
      bookingStatus: "confirmed",
      serviceWindowStart: new Date("2026-03-28T08:00:00.000Z"),
      serviceWindowEnd: new Date("2026-03-28T12:00:00.000Z"),
    });

    expect(prisma.messageNumber.updateMany).toHaveBeenCalled();
  });
});
