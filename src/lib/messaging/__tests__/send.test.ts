import { beforeEach, describe, expect, it, vi } from "vitest";

const mockThreadFindUnique = vi.fn();
const mockThreadUpdate = vi.fn();
const mockThreadUpdateMany = vi.fn();
const mockEventFindFirst = vi.fn();
const mockEventCreate = vi.fn();
const mockEventFindUnique = vi.fn();
const mockEventUpdate = vi.fn();
const mockChooseFromNumber = vi.fn();
const mockGetClientE164 = vi.fn();
const mockProviderSend = vi.fn();
const mockEnqueueOutbound = vi.fn();
const mockQueueAvailable = vi.fn();
const mockQueuePressure = vi.fn();
const mockThreadActivityQueueAvailable = vi.fn();
const mockEnqueueThreadActivity = vi.fn();
const mockShouldForceQueuedOnly = vi.fn();
const mockGetProviderPressureState = vi.fn();
const mockRecordProviderTransientFailure = vi.fn();
const mockRecordProviderSendSuccess = vi.fn();
const mockCheckRateLimit = vi.fn();

vi.mock("@/lib/tenancy", () => ({
  getScopedDb: vi.fn(() => ({
    messageThread: {
      findUnique: (...args: unknown[]) => mockThreadFindUnique(...args),
      update: (...args: unknown[]) => mockThreadUpdate(...args),
      updateMany: (...args: unknown[]) => mockThreadUpdateMany(...args),
    },
    messageEvent: {
      findFirst: (...args: unknown[]) => mockEventFindFirst(...args),
      create: (...args: unknown[]) => mockEventCreate(...args),
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
      update: (...args: unknown[]) => mockEventUpdate(...args),
    },
    optOutState: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  })),
}));

vi.mock("@/lib/messaging/choose-from-number", () => ({
  chooseFromNumber: (...args: unknown[]) => mockChooseFromNumber(...args),
}));

vi.mock("@/lib/messaging/client-contact-lookup", () => ({
  getClientE164ForClient: (...args: unknown[]) => mockGetClientE164(...args),
}));

vi.mock("@/lib/messaging/provider-factory", () => ({
  getMessagingProvider: vi.fn(async () => ({
    sendMessage: (...args: unknown[]) => mockProviderSend(...args),
  })),
}));

vi.mock("@/lib/messaging/outbound-queue", () => ({
  enqueueOutboundMessage: (...args: unknown[]) => mockEnqueueOutbound(...args),
  isOutboundQueueAvailable: (...args: unknown[]) => mockQueueAvailable(...args),
  getOutboundQueuePressure: (...args: unknown[]) => mockQueuePressure(...args),
}));

vi.mock("@/lib/messaging/thread-activity-queue", () => ({
  isThreadActivityQueueAvailable: (...args: unknown[]) => mockThreadActivityQueueAvailable(...args),
  enqueueThreadActivityUpdate: (...args: unknown[]) => mockEnqueueThreadActivity(...args),
}));

vi.mock("@/lib/messaging/provider-pressure", () => ({
  shouldForceQueuedOnly: (...args: unknown[]) => mockShouldForceQueuedOnly(...args),
  getProviderPressureState: (...args: unknown[]) => mockGetProviderPressureState(...args),
  recordProviderTransientFailure: (...args: unknown[]) => mockRecordProviderTransientFailure(...args),
  recordProviderSendSuccess: (...args: unknown[]) => mockRecordProviderSendSuccess(...args),
}));

vi.mock("@/lib/log-event", () => ({
  logEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/realtime/bus", () => ({
  publish: vi.fn(async () => undefined),
  channels: {
    messagesThread: (orgId: string, threadId: string) => `${orgId}:${threadId}`,
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

import { dispatchMessageEventDelivery, sendThreadMessage } from "@/lib/messaging/send";

describe("messaging async handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockThreadFindUnique.mockResolvedValue({
      id: "thread-1",
      orgId: "org-1",
      clientId: "client-1",
      assignedSitterId: null,
      assignmentWindows: [],
    });
    mockThreadUpdate.mockResolvedValue({});
    mockThreadUpdateMany.mockResolvedValue({ count: 1 });
    mockEventFindFirst.mockResolvedValue(null);
    mockEventCreate.mockResolvedValue({
      id: "event-1",
      threadId: "thread-1",
      providerMessageSid: null,
      providerErrorCode: null,
      providerErrorMessage: null,
      deliveryStatus: "queued",
    });
    mockQueueAvailable.mockReturnValue(true);
    mockThreadActivityQueueAvailable.mockReturnValue(true);
    mockEnqueueThreadActivity.mockResolvedValue(true);
    mockQueuePressure.mockResolvedValue({
      available: true,
      waiting: 0,
      active: 0,
      delayed: 0,
      forceQueuedOnly: false,
    });
    mockShouldForceQueuedOnly.mockResolvedValue(false);
    mockGetProviderPressureState.mockResolvedValue({
      provider: "twilio",
      orgId: "org-1",
      mode: "normal",
      forcedQueuedOnly: false,
      transientFailureCount: 0,
      recentFailureCodes: [],
      windowStartedAt: new Date().toISOString(),
      lastFailureAt: null,
      lastSuccessAt: null,
      degradedUntil: null,
      reason: null,
    });
    mockRecordProviderTransientFailure.mockResolvedValue({
      forcedQueuedOnly: true,
      reason: "transient failure burst",
      transientFailureCount: 10,
      degradedUntil: new Date(Date.now() + 60_000).toISOString(),
      recentFailureCodes: ["429"],
    });
    mockRecordProviderSendSuccess.mockResolvedValue(undefined);
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 100, resetAt: Date.now() / 1000 + 60 });
    mockEnqueueOutbound.mockResolvedValue(true);
    mockChooseFromNumber.mockResolvedValue({ e164: "+15550000001" });
    mockGetClientE164.mockResolvedValue("+15550000002");
    mockProviderSend.mockResolvedValue({ success: true, messageSid: "SM123" });
  });

  it("queues outbound provider work by default and returns queued", async () => {
    const result = await sendThreadMessage({
      orgId: "org-1",
      threadId: "thread-1",
      actor: { role: "owner", userId: "owner-1" },
      body: "Hello from owner",
      idempotencyKey: "idem-123",
    });

    expect(result.deliveryStatus).toBe("queued");
    expect(result.accepted).toBe(true);
    expect(result.queued).toBe(true);
    expect(mockEnqueueThreadActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        threadId: "thread-1",
      })
    );
    expect(mockEnqueueOutbound).toHaveBeenCalledWith({
      orgId: "org-1",
      messageEventId: "event-1",
    });
    expect(mockProviderSend).not.toHaveBeenCalled();
  });

  it("reuses existing event when idempotency key repeats", async () => {
    mockEventFindFirst.mockResolvedValueOnce({
      id: "event-existing",
      threadId: "thread-1",
      deliveryStatus: "queued",
      providerMessageSid: null,
      providerErrorCode: null,
      providerErrorMessage: null,
    });

    const result = await sendThreadMessage({
      orgId: "org-1",
      threadId: "thread-1",
      actor: { role: "owner", userId: "owner-1" },
      body: "Hello from owner",
      idempotencyKey: "idem-replay",
    });

    expect(result.event.id).toBe("event-existing");
    expect(result.replay).toBe(true);
    expect(result.accepted).toBe(true);
    expect(mockEventCreate).not.toHaveBeenCalled();
    expect(mockEnqueueOutbound).not.toHaveBeenCalled();
  });

  it("enforces queued-only handoff when provider is degraded even with forceSend", async () => {
    mockShouldForceQueuedOnly.mockResolvedValueOnce(true);
    const result = await sendThreadMessage({
      orgId: "org-1",
      threadId: "thread-1",
      actor: { role: "owner", userId: "owner-1" },
      body: "pressure mode",
      forceSend: true,
    });
    expect(result.deliveryStatus).toBe("queued");
    expect(result.handoffMeta).toEqual(
      expect.objectContaining({
        mode: "async",
      })
    );
  });
});

describe("dispatchMessageEventDelivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("avoids duplicate provider sends for already delivered events", async () => {
    mockEventFindUnique.mockResolvedValueOnce({
      id: "event-2",
      threadId: "thread-1",
      direction: "outbound",
      deliveryStatus: "sent",
      providerMessageSid: "SM-already",
      providerErrorCode: null,
      providerErrorMessage: null,
      body: "hello",
      attemptCount: 1,
      thread: { id: "thread-1", clientId: "client-1" },
    });

    const result = await dispatchMessageEventDelivery({
      orgId: "org-1",
      messageEventId: "event-2",
      throwOnRetryable: true,
      attempt: 1,
      maxAttempts: 4,
    });

    expect(result.deliveryStatus).toBe("sent");
    expect(mockProviderSend).not.toHaveBeenCalled();
    expect(mockEventUpdate).not.toHaveBeenCalled();
  });

  it("records transient provider pressure on 429 failures", async () => {
    mockEventFindUnique.mockResolvedValueOnce({
      id: "event-3",
      threadId: "thread-1",
      direction: "outbound",
      deliveryStatus: "queued",
      providerMessageSid: null,
      providerErrorCode: null,
      providerErrorMessage: null,
      body: "hello",
      attemptCount: 0,
      thread: { id: "thread-1", clientId: "client-1" },
    });
    mockProviderSend.mockResolvedValueOnce({
      success: false,
      errorCode: "429",
      errorMessage: "too many requests",
    });
    mockEventUpdate.mockResolvedValueOnce({
      id: "event-3",
      threadId: "thread-1",
      deliveryStatus: "queued",
      providerMessageSid: null,
      providerErrorCode: "429",
      providerErrorMessage: "too many requests",
    });

    const res = await dispatchMessageEventDelivery({
      orgId: "org-1",
      messageEventId: "event-3",
      throwOnRetryable: false,
      attempt: 1,
      maxAttempts: 4,
    });
    expect(res.deliveryStatus).toBe("queued");
    expect(mockRecordProviderTransientFailure).toHaveBeenCalledWith(
      expect.objectContaining({ code: "429" })
    );
  });

  it("records timeout bursts as transient provider pressure", async () => {
    mockEventFindUnique.mockResolvedValueOnce({
      id: "event-4",
      threadId: "thread-1",
      direction: "outbound",
      deliveryStatus: "queued",
      providerMessageSid: null,
      providerErrorCode: null,
      providerErrorMessage: null,
      body: "hello",
      attemptCount: 0,
      thread: { id: "thread-1", clientId: "client-1" },
    });
    mockProviderSend.mockRejectedValueOnce(new Error("network timeout"));
    mockEventUpdate.mockResolvedValueOnce({
      id: "event-4",
      threadId: "thread-1",
      deliveryStatus: "queued",
      providerMessageSid: null,
      providerErrorCode: "ETIMEDOUT",
      providerErrorMessage: "network timeout",
    });

    const res = await dispatchMessageEventDelivery({
      orgId: "org-1",
      messageEventId: "event-4",
      throwOnRetryable: false,
      attempt: 1,
      maxAttempts: 4,
    });
    expect(res.deliveryStatus).toBe("queued");
    expect(mockRecordProviderTransientFailure).toHaveBeenCalledWith(
      expect.objectContaining({ code: "ETIMEDOUT" })
    );
  });

  it("does not duplicate provider sends when retried after sent state", async () => {
    mockEventFindUnique
      .mockResolvedValueOnce({
        id: "event-5",
        threadId: "thread-1",
        direction: "outbound",
        deliveryStatus: "queued",
        providerMessageSid: null,
        providerErrorCode: null,
        providerErrorMessage: null,
        body: "hello",
        attemptCount: 0,
        thread: { id: "thread-1", clientId: "client-1" },
      })
      .mockResolvedValueOnce({
        id: "event-5",
        threadId: "thread-1",
        direction: "outbound",
        deliveryStatus: "sent",
        providerMessageSid: "SM-1",
        providerErrorCode: null,
        providerErrorMessage: null,
        body: "hello",
        attemptCount: 1,
        thread: { id: "thread-1", clientId: "client-1" },
      });
    mockProviderSend.mockResolvedValueOnce({ success: true, messageSid: "SM-1" });
    mockEventUpdate.mockResolvedValueOnce({
      id: "event-5",
      threadId: "thread-1",
      deliveryStatus: "sent",
      providerMessageSid: "SM-1",
      providerErrorCode: null,
      providerErrorMessage: null,
    });

    const first = await dispatchMessageEventDelivery({
      orgId: "org-1",
      messageEventId: "event-5",
      throwOnRetryable: true,
      attempt: 1,
      maxAttempts: 4,
    });
    const second = await dispatchMessageEventDelivery({
      orgId: "org-1",
      messageEventId: "event-5",
      throwOnRetryable: true,
      attempt: 2,
      maxAttempts: 4,
    });

    expect(first.deliveryStatus).toBe("sent");
    expect(second.deliveryStatus).toBe("sent");
    expect(mockProviderSend).toHaveBeenCalledTimes(1);
  });

  it("applies retry dispatch limiter namespace for retry attempts", async () => {
    mockEventFindUnique.mockResolvedValueOnce({
      id: "event-6",
      threadId: "thread-1",
      direction: "outbound",
      deliveryStatus: "queued",
      providerMessageSid: null,
      providerErrorCode: null,
      providerErrorMessage: null,
      body: "hello",
      attemptCount: 1,
      thread: { id: "thread-1", clientId: "client-1" },
    });
    mockProviderSend.mockResolvedValueOnce({ success: true, messageSid: "SM-2" });
    mockEventUpdate.mockResolvedValueOnce({
      id: "event-6",
      threadId: "thread-1",
      deliveryStatus: "sent",
      providerMessageSid: "SM-2",
      providerErrorCode: null,
      providerErrorMessage: null,
    });

    await dispatchMessageEventDelivery({
      orgId: "org-1",
      messageEventId: "event-6",
      throwOnRetryable: true,
      attempt: 2,
      maxAttempts: 4,
    });

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "org-1:twilio",
      expect.objectContaining({ keyPrefix: "messages-provider-retry" })
    );
  });
});
