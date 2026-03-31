import { beforeEach, describe, expect, it, vi } from "vitest";

const mockThreadFindUnique = vi.fn();
const mockMessageCount = vi.fn();
const mockMessageFindMany = vi.fn();
const mockSendThreadMessage = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockGetOutboundQueuePressure = vi.fn();

vi.mock("@/lib/request-context", () => ({
  getRequestContext: vi.fn(),
}));

vi.mock("@/lib/tenancy", () => ({
  getScopedDb: vi.fn(() => ({
    messageThread: {
      findUnique: (...args: unknown[]) => mockThreadFindUnique(...args),
    },
    messageEvent: {
      count: (...args: unknown[]) => mockMessageCount(...args),
      findMany: (...args: unknown[]) => mockMessageFindMany(...args),
    },
  })),
}));

vi.mock("@/lib/messaging/send", () => ({
  asMessagingActorRole: vi.fn(() => "owner"),
  assertMessagingThreadAccess: vi.fn(),
  sendThreadMessage: (...args: unknown[]) => mockSendThreadMessage(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getRateLimitIdentifier: vi.fn(() => "ip-1"),
}));

vi.mock("@/lib/messaging/outbound-queue", () => ({
  isOutboundQueueAvailable: vi.fn(() => true),
  getOutboundQueuePressure: (...args: unknown[]) => mockGetOutboundQueuePressure(...args),
}));

import { getRequestContext } from "@/lib/request-context";
import { GET, POST } from "@/app/api/messages/threads/[id]/messages/route";

describe("GET /api/messages/threads/[id]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: "org-1",
      role: "owner",
      userId: "owner-1",
      sitterId: null,
      clientId: null,
    } as never);

    mockThreadFindUnique.mockResolvedValue({
      id: "t1",
      orgId: "org-1",
      clientId: "c1",
      assignedSitterId: null,
      assignmentWindows: [],
    });
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 100, resetAt: Date.now() / 1000 + 60 });
    mockGetOutboundQueuePressure.mockResolvedValue({
      available: true,
      waiting: 0,
      active: 0,
      delayed: 0,
      forceQueuedOnly: false,
    });
    mockSendThreadMessage.mockReset();
  });

  it("returns paginated message payload with sort/filters metadata", async () => {
    mockMessageCount.mockResolvedValueOnce(2);
    mockMessageFindMany.mockResolvedValueOnce([
      {
        id: "m2",
        threadId: "t1",
        direction: "outbound",
        actorType: "owner",
        actorUserId: "owner-1",
        body: "Hello",
        deliveryStatus: "sent",
        providerMessageSid: null,
        failureCode: null,
        failureDetail: null,
        providerErrorCode: null,
        providerErrorMessage: null,
        createdAt: new Date("2026-03-01T11:00:00.000Z"),
      },
      {
        id: "m1",
        threadId: "t1",
        direction: "inbound",
        actorType: "client",
        actorUserId: null,
        body: "Hi",
        deliveryStatus: "delivered",
        providerMessageSid: null,
        failureCode: null,
        failureDetail: null,
        providerErrorCode: null,
        providerErrorMessage: null,
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
      },
    ]);

    const req = new Request(
      "http://localhost/api/messages/threads/t1/messages?page=1&pageSize=50&direction=inbound"
    );
    const res = await GET(req as any, { params: Promise.resolve({ id: "t1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 50,
        total: 2,
        hasMore: false,
        sort: { field: "createdAt", direction: "desc" },
        filters: expect.objectContaining({ direction: "inbound" }),
      })
    );
    expect(body.items).toHaveLength(2);
  });

  it("caps page size to max and computes skip correctly", async () => {
    mockMessageCount.mockResolvedValueOnce(0);
    mockMessageFindMany.mockResolvedValueOnce([]);

    const req = new Request(
      "http://localhost/api/messages/threads/t1/messages?page=2&pageSize=999"
    );
    const res = await GET(req as any, { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(200);

    expect(mockMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 200,
        take: 200,
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("returns 202 when send path degrades to queued delivery", async () => {
    mockSendThreadMessage.mockResolvedValueOnce({
      accepted: true,
      queued: true,
      replay: false,
      event: { id: "m-queued" },
      messageId: "m-queued",
      messageEventId: "m-queued",
      deliveryStatus: "queued",
      providerMessageSid: null,
      providerErrorCode: "20429",
      providerErrorMessage: "Rate limit",
      handoffMeta: { mode: "async", providerDegraded: true, queueUnderPressure: false },
    });

    const req = new Request("http://localhost/api/messages/threads/t1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "idem-1" },
      body: JSON.stringify({ body: "hello" }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: "t1" }) });
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body).toEqual(
      expect.objectContaining({
        accepted: true,
        queued: true,
        messageId: "m-queued",
        messageEventId: "m-queued",
      })
    );
    expect(mockSendThreadMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "idem-1",
      })
    );
  });

  it("returns 503 contract when handoff cannot be completed", async () => {
    mockSendThreadMessage.mockResolvedValueOnce({
      accepted: false,
      queued: false,
      replay: false,
      event: { id: "m-retryable" },
      messageId: "m-retryable",
      messageEventId: "m-retryable",
      deliveryStatus: "failed",
      providerMessageSid: null,
      providerErrorCode: "20429",
      providerErrorMessage: "Too many requests",
      handoffMeta: { mode: "sync", providerDegraded: false, queueUnderPressure: false },
    });

    const req = new Request("http://localhost/api/messages/threads/t1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "hello" }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        accepted: false,
        queued: false,
      })
    );
  });

  it("returns stable accepted replay contract for idempotent resend", async () => {
    mockSendThreadMessage.mockResolvedValueOnce({
      accepted: true,
      queued: true,
      replay: true,
      event: { id: "m-replay" },
      messageId: "m-replay",
      messageEventId: "m-replay",
      deliveryStatus: "queued",
      providerMessageSid: null,
      providerErrorCode: null,
      providerErrorMessage: null,
      handoffMeta: { mode: "async", providerDegraded: false, queueUnderPressure: false },
    });

    const req = new Request("http://localhost/api/messages/threads/t1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "idem-replay" },
      body: JSON.stringify({ body: "hello" }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: "t1" }) });
    const body = await res.json();
    expect(res.status).toBe(202);
    expect(body).toEqual(
      expect.objectContaining({
        accepted: true,
        queued: true,
        replay: true,
        messageId: "m-replay",
        messageEventId: "m-replay",
      })
    );
  });
});
