import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/request-context", () => ({
  getRequestContext: vi.fn(),
}));
vi.mock("@/lib/tenancy", () => ({
  getScopedDb: vi.fn(),
}));
vi.mock("@/lib/messaging/conversation-service", () => ({
  syncConversationLifecycleWithBookingWorkflow: vi.fn(),
}));
vi.mock("@/lib/messaging/timeline-events", () => ({
  logMessagingTimelineEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/messaging/lifecycle-client-copy", () => ({
  emitClientLifecycleNoticeIfNeeded: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../route";
import { getRequestContext } from "@/lib/request-context";
import { getScopedDb } from "@/lib/tenancy";

describe("POST /api/messages/threads/[id]/workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: "org-1",
      role: "owner",
      userId: "u1",
    } as any);
    vi.mocked(getScopedDb).mockReturnValue({
      messageThread: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: "thread-1",
            bookingId: "booking-1",
            clientId: "client-1",
            assignedSitterId: "sitter-1",
            booking: {
              id: "booking-1",
              orgId: "org-1",
              firstName: "Alex",
              lastName: "Client",
              phone: "+15551112222",
              sitterId: "sitter-1",
              status: "confirmed",
              startAt: new Date("2026-03-20T10:00:00.000Z"),
              endAt: new Date("2026-03-20T14:00:00.000Z"),
            },
          })
          .mockResolvedValueOnce({
            id: "thread-1",
            bookingId: "booking-1",
            laneType: "company",
            activationStage: "meet_and_greet",
            lifecycleStatus: "active",
            clientApprovedAt: null,
            sitterApprovedAt: null,
            serviceApprovedAt: null,
            meetAndGreetConfirmedAt: null,
            graceEndsAt: null,
          }),
      },
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: "booking-1",
          orgId: "org-1",
          firstName: "Alex",
          lastName: "Client",
          phone: "+15551112222",
          sitterId: "sitter-1",
          status: "confirmed",
          startAt: new Date("2026-03-20T10:00:00.000Z"),
          endAt: new Date("2026-03-20T14:00:00.000Z"),
        }),
      },
    } as any);
  });

  it("handles schedule meet-and-greet action", async () => {
    const req = new Request("http://localhost/api/messages/threads/thread-1/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "schedule_meet_and_greet",
        scheduledAt: "2026-03-18T18:00:00.000Z",
      }),
    });

    const res = await POST(req as any, { params: Promise.resolve({ id: "thread-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.thread.id).toBe("thread-1");
  });
});
