/**
 * Tests for messaging audit trail — verifies events persist to EventLog
 * instead of just console.log.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn().mockResolvedValue({ id: "evt-1" });
const mockFindMany = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/db", () => ({
  prisma: {
    eventLog: {
      create: (...args: any[]) => mockCreate(...args),
      findMany: (...args: any[]) => mockFindMany(...args),
    },
  },
}));

import { logMessagingEvent, getMessagingAuditEvents } from "../audit-trail";

describe("logMessagingEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists event to EventLog via prisma.eventLog.create", async () => {
    await logMessagingEvent({
      orgId: "org-1",
      eventType: "inbound_received",
      threadId: "thread-1",
      messageId: "msg-1",
      metadata: { from: "+15551234567" },
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.data.orgId).toBe("org-1");
    expect(callArg.data.eventType).toBe("messaging.inbound_received");
    expect(callArg.data.status).toBe("success");

    const metadata = JSON.parse(callArg.data.metadata);
    expect(metadata.threadId).toBe("thread-1");
    expect(metadata.messageId).toBe("msg-1");
    expect(metadata.from).toBe("+15551234567");
  });

  it("does not throw when EventLog create fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("DB down"));

    // Should not throw
    await logMessagingEvent({
      orgId: "org-1",
      eventType: "outbound_sent",
    });
  });

  it("includes actorUserId in metadata when provided", async () => {
    await logMessagingEvent({
      orgId: "org-1",
      eventType: "outbound_blocked",
      actorUserId: "user-1",
    });

    const metadata = JSON.parse(mockCreate.mock.calls[0][0].data.metadata);
    expect(metadata.actorUserId).toBe("user-1");
  });
});

describe("getMessagingAuditEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries EventLog with messaging prefix filter", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "evt-1",
        orgId: "org-1",
        eventType: "messaging.inbound_received",
        status: "success",
        metadata: JSON.stringify({ threadId: "t1", messageId: "m1" }),
        createdAt: new Date("2026-01-01"),
      },
    ]);

    const events = await getMessagingAuditEvents("org-1");
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("inbound_received"); // prefix stripped
    expect(events[0].threadId).toBe("t1");
    expect(events[0].messageId).toBe("m1");
  });

  it("returns empty array when no events match", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const events = await getMessagingAuditEvents("org-1");
    expect(events).toHaveLength(0);
  });

  it("filters by threadId in metadata", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "evt-1",
        orgId: "org-1",
        eventType: "messaging.inbound_received",
        status: "success",
        metadata: JSON.stringify({ threadId: "t1" }),
        createdAt: new Date(),
      },
      {
        id: "evt-2",
        orgId: "org-1",
        eventType: "messaging.outbound_sent",
        status: "success",
        metadata: JSON.stringify({ threadId: "t2" }),
        createdAt: new Date(),
      },
    ]);

    const events = await getMessagingAuditEvents("org-1", { threadId: "t1" });
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("evt-1");
  });
});
