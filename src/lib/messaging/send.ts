import { getScopedDb } from "@/lib/tenancy";
import { createHash } from "node:crypto";
import { chooseFromNumber } from "@/lib/messaging/choose-from-number";
import { getClientE164ForClient } from "@/lib/messaging/client-contact-lookup";
import { getMessagingProvider } from "@/lib/messaging/provider-factory";
import { enqueueOutboundMessage, getOutboundQueuePressure, isOutboundQueueAvailable } from "@/lib/messaging/outbound-queue";
import { enqueueThreadActivityUpdate, isThreadActivityQueueAvailable } from "@/lib/messaging/thread-activity-queue";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  recordProviderSendSuccess,
  recordProviderTransientFailure,
  shouldForceQueuedOnly,
} from "@/lib/messaging/provider-pressure";
import { createSoftAntiPoachingFlag } from "@/lib/messaging/anti-poaching-flags";
import { captureAvailabilityResponseFromMessage } from "@/lib/messaging/conversation-service";
import { logEvent } from "@/lib/log-event";
import { publish, channels } from "@/lib/realtime/bus";
import type { SendMessageResult } from "@/lib/messaging/provider";

export type MessagingActorRole = "owner" | "admin" | "sitter" | "client" | "system" | "automation";

export interface MessagingActor {
  role: MessagingActorRole;
  userId?: string | null;
  sitterId?: string | null;
  clientId?: string | null;
}

export function asMessagingActorRole(role: string): MessagingActorRole | null {
  if (
    role === "owner" ||
    role === "admin" ||
    role === "sitter" ||
    role === "client" ||
    role === "system" ||
    role === "automation"
  ) {
    return role;
  }
  return null;
}

type ThreadForSend = {
  id: string;
  orgId: string;
  clientId: string | null;
  assignedSitterId: string | null;
  assignmentWindows: Array<{
    id: string;
    sitterId: string;
    startAt: Date;
    endAt: Date;
  }>;
};

export function assertMessagingThreadAccess(
  thread: ThreadForSend,
  actor: MessagingActor,
  requireActiveWindow: boolean
) {
  if (actor.role === "owner" || actor.role === "admin" || actor.role === "system" || actor.role === "automation") {
    return;
  }

  if (actor.role === "client") {
    if (!actor.clientId || thread.clientId !== actor.clientId) {
      throw new Error("Forbidden: client cannot access this thread");
    }
    return;
  }

  if (actor.role === "sitter") {
    if (!actor.sitterId) throw new Error("Forbidden: sitter context required");
    const activeWindow = thread.assignmentWindows[0];
    const isAssignedSitter = thread.assignedSitterId === actor.sitterId;
    const hasWindow = !!activeWindow && activeWindow.sitterId === actor.sitterId;
    if (!isAssignedSitter && !hasWindow) {
      throw new Error("Forbidden: sitter cannot access this thread");
    }
    if (requireActiveWindow) {
      if (!activeWindow || activeWindow.sitterId !== actor.sitterId) {
        throw new Error("Forbidden: no active assignment window");
      }
      const now = new Date();
      if (now < activeWindow.startAt || now > activeWindow.endAt) {
        throw new Error("Forbidden: assignment window not active");
      }
    }
    return;
  }

  throw new Error("Forbidden");
}

function actorTypeForEvent(role: MessagingActorRole): "client" | "sitter" | "owner" | "system" | "automation" {
  if (role === "admin") return "owner";
  return role;
}

function normalizeProviderErrorCode(code: unknown): string {
  if (code === null || code === undefined || code === "") return "UNKNOWN_ERROR";
  return String(code);
}

const SEND_PROVIDER_TIMEOUT_MS = Number(process.env.MESSAGE_SEND_PROVIDER_TIMEOUT_MS || "8000");
const SEND_PREHANDOFF_PROBE_TIMEOUT_MS = Number(process.env.MESSAGE_SEND_PREHANDOFF_PROBE_TIMEOUT_MS || "250");
const MESSAGE_SEND_ALLOW_FORCE_SYNC = process.env.MESSAGE_SEND_ALLOW_FORCE_SYNC === "true";
const MESSAGE_PROVIDER_DISPATCH_LIMIT_PER_MINUTE = Number(process.env.MESSAGE_PROVIDER_DISPATCH_LIMIT_PER_MINUTE || "2400");
const MESSAGE_PROVIDER_RETRY_LIMIT_PER_MINUTE = Number(process.env.MESSAGE_PROVIDER_RETRY_LIMIT_PER_MINUTE || "1200");
const RETRYABLE_PROVIDER_CODES = new Set(["20429", "429", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "UNKNOWN_ERROR"]);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  }) as Promise<T>;
}

function isRetryableProviderFailure(providerErrorCode: string | null, providerErrorMessage: string | null): boolean {
  const code = normalizeProviderErrorCode(providerErrorCode);
  if (RETRYABLE_PROVIDER_CODES.has(code)) return true;
  const msg = String(providerErrorMessage || "").toLowerCase();
  return msg.includes("rate") || msg.includes("throttle") || msg.includes("timeout") || msg.includes("tempor");
}

function computeIdempotencyFingerprint(input: {
  orgId: string;
  threadId: string;
  actorType: string;
  body: string;
}): string {
  return createHash("sha256")
    .update(`${input.orgId}|${input.threadId}|${input.actorType}|${input.body}`)
    .digest("hex");
}

function buildMetadataJson(input: { idempotencyKey?: string; handoff: "sync" | "async" | "none" }): string {
  return JSON.stringify({
    handoff: input.handoff,
    idempotencyKey: input.idempotencyKey || null,
  });
}

export class RetryableProviderDeliveryError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "RetryableProviderDeliveryError";
    this.code = code;
  }
}

type DeliveryStatus = "queued" | "sent" | "delivered" | "failed";

export interface MessageHandoffMeta {
  mode: "async" | "sync" | "none";
  providerDegraded: boolean;
  queueUnderPressure: boolean;
}

export interface SendThreadMessageResult {
  accepted: boolean;
  queued: boolean;
  replay: boolean;
  event: {
    id: string;
    threadId: string;
    deliveryStatus: string;
    body?: string;
    direction?: string;
    actorType?: string;
    createdAt?: Date;
    providerMessageSid?: string | null;
    providerErrorCode?: string | null;
    providerErrorMessage?: string | null;
  };
  messageId: string;
  messageEventId: string;
  deliveryStatus: DeliveryStatus;
  providerMessageSid: string | null;
  providerErrorCode: string | null;
  providerErrorMessage: string | null;
  handoffMeta: MessageHandoffMeta;
}

export interface MessageIntakeStepProfile {
  threadLookupMs?: number;
  idempotencyLookupMs?: number;
  queuePressureProbeMs?: number;
  providerPressureProbeMs?: number;
  intentPersistMs?: number;
  threadUpdateMs?: number;
  enqueueMs?: number;
}

const MESSAGE_INTAKE_OPTIMIZED_THREAD_LOOKUP = process.env.MESSAGE_INTAKE_OPTIMIZED_THREAD_LOOKUP === "true";

async function checkDispatchLimiter(orgId: string, attemptNo: number): Promise<void> {
  const isRetry = attemptNo > 1;
  const rl = await checkRateLimit(`${orgId}:twilio`, {
    keyPrefix: isRetry ? "messages-provider-retry" : "messages-provider-dispatch",
    limit: Math.max(100, isRetry ? MESSAGE_PROVIDER_RETRY_LIMIT_PER_MINUTE : MESSAGE_PROVIDER_DISPATCH_LIMIT_PER_MINUTE),
    windowSec: 60,
  });
  if (!rl.success) {
    throw new RetryableProviderDeliveryError(
      `provider dispatch throttled (${isRetry ? "retry" : "primary"})`,
      "DISPATCH_RATE_LIMITED"
    );
  }
}

export async function dispatchMessageEventDelivery(params: {
  orgId: string;
  messageEventId: string;
  throwOnRetryable?: boolean;
  attempt?: number;
  maxAttempts?: number;
}): Promise<{
  deliveryStatus: DeliveryStatus;
  providerMessageSid: string | null;
  providerErrorCode: string | null;
  providerErrorMessage: string | null;
  retryable: boolean;
}> {
  const db = getScopedDb({ orgId: params.orgId });
  const event = await db.messageEvent.findUnique({
    where: { id: params.messageEventId },
    include: {
      thread: {
        select: {
          id: true,
          clientId: true,
        },
      },
    },
  });
  if (!event) throw new Error("Message not found");
  if (event.direction !== "outbound") throw new Error("Cannot dispatch inbound message");
  if (!event.thread?.clientId) throw new Error("Thread has no client");

  if ((event.deliveryStatus === "sent" || event.deliveryStatus === "delivered") && event.providerMessageSid) {
    return {
      deliveryStatus: event.deliveryStatus as DeliveryStatus,
      providerMessageSid: event.providerMessageSid,
      providerErrorCode: event.providerErrorCode ?? null,
      providerErrorMessage: event.providerErrorMessage ?? null,
      retryable: false,
    };
  }

  const [routingResult, toE164, provider] = await Promise.all([
    chooseFromNumber(event.threadId, params.orgId),
    getClientE164ForClient(params.orgId, event.thread.clientId),
    getMessagingProvider(params.orgId),
  ]);
  if (!toE164) {
    console.warn(`[SMS] No phone number for client ${event.thread?.clientId} — marking message failed`);
    await db.messageEvent.update({
      where: { id: event.id },
      data: { deliveryStatus: 'failed', failureCode: 'no_phone', failureDetail: 'Client has no phone number on file' },
    });
    return {
      deliveryStatus: 'failed' as DeliveryStatus,
      providerMessageSid: null,
      providerErrorCode: 'no_phone',
      providerErrorMessage: 'Client has no phone number on file',
      retryable: false,
    };
  }

  // TCPA compliance: check opt-out before sending
  const optOut = await db.optOutState.findFirst({
    where: { orgId: params.orgId, phoneE164: toE164, state: 'opted_out' },
  });
  if (optOut) {
    console.warn(`[SMS] Blocked send to opted-out number`);
    await db.messageEvent.update({
      where: { id: event.id },
      data: { deliveryStatus: 'failed', failureCode: 'opted_out', failureDetail: 'Recipient has opted out of SMS' },
    });
    return {
      deliveryStatus: 'failed' as DeliveryStatus,
      providerMessageSid: null,
      providerErrorCode: 'opted_out',
      providerErrorMessage: 'Recipient has opted out of SMS',
      retryable: false,
    };
  }

  const attemptNo = Math.max(1, params.attempt ?? ((event.attemptCount ?? 0) + 1));
  const maxAttempts = Math.max(1, params.maxAttempts ?? 1);

  await checkDispatchLimiter(params.orgId, attemptNo);

  const sendResult: SendMessageResult = await withTimeout(
    provider.sendMessage({
      to: toE164,
      fromE164: routingResult.e164,
      fromNumberSid: undefined,
      body: event.body,
    }),
    SEND_PROVIDER_TIMEOUT_MS,
    `provider timeout after ${SEND_PROVIDER_TIMEOUT_MS}ms`
  ).catch((error: unknown) => ({
    success: false,
    errorCode: "ETIMEDOUT",
    errorMessage: error instanceof Error ? error.message : "Provider timeout",
    messageSid: undefined,
  }));

  const providerErrorCode = sendResult.success ? null : normalizeProviderErrorCode(sendResult.errorCode);
  const providerErrorMessage = sendResult.success
    ? null
    : sendResult.errorMessage ?? "Failed to send message";
  const retryable = !sendResult.success && isRetryableProviderFailure(providerErrorCode, providerErrorMessage);

  let deliveryStatus: DeliveryStatus = sendResult.success ? "sent" : "failed";
  if (retryable) {
    deliveryStatus = "queued";
  }
  if (retryable && params.throwOnRetryable && attemptNo >= maxAttempts) {
    deliveryStatus = "failed";
  }

  const updated = await db.messageEvent.update({
    where: { id: event.id },
    data: {
      deliveryStatus,
      providerMessageSid: sendResult.messageSid ?? event.providerMessageSid,
      failureCode: sendResult.success ? null : providerErrorCode,
      failureDetail: sendResult.success ? null : providerErrorMessage,
      providerErrorCode: sendResult.success ? null : providerErrorCode,
      providerErrorMessage: sendResult.success ? null : providerErrorMessage,
      attemptCount: attemptNo,
      lastAttemptAt: new Date(),
    },
  });

  const action = updated.deliveryStatus === "sent" ? "message.sent" : updated.deliveryStatus === "queued" ? "message.queued" : "message.failed";
  void logEvent({
    orgId: params.orgId,
    action,
    entityType: "message",
    entityId: updated.id,
    metadata: {
      threadId: updated.threadId,
      retryable,
      attemptNo,
      providerMessageSid: updated.providerMessageSid,
      providerErrorCode,
      providerErrorMessage,
    },
  });
  void publish(channels.messagesThread(params.orgId, updated.threadId), {
    type: updated.deliveryStatus === "sent" ? "message.new" : "message.updated",
    threadId: updated.threadId,
    messageId: updated.id,
    ts: Date.now(),
  }).catch(() => {});

  if (sendResult.success) {
    await recordProviderSendSuccess({ provider: "twilio", orgId: params.orgId });
  } else if (retryable) {
    const pressure = await recordProviderTransientFailure({
      provider: "twilio",
      orgId: params.orgId,
      code: providerErrorCode ?? "UNKNOWN_ERROR",
      message: providerErrorMessage,
    });
    if (pressure.forcedQueuedOnly) {
      void logEvent({
        orgId: params.orgId,
        action: "message.provider.degraded",
        entityType: "message",
        entityId: updated.id,
        metadata: {
          reason: pressure.reason,
          transientFailureCount: pressure.transientFailureCount,
          degradedUntil: pressure.degradedUntil,
          recentFailureCodes: pressure.recentFailureCodes,
        },
      });
    }
  }

  if (retryable && params.throwOnRetryable && attemptNo < maxAttempts) {
    throw new RetryableProviderDeliveryError(providerErrorMessage ?? "Retryable provider failure", providerErrorCode ?? "UNKNOWN_ERROR");
  }

  return {
    deliveryStatus,
    providerMessageSid: updated.providerMessageSid ?? null,
    providerErrorCode,
    providerErrorMessage,
    retryable,
  };
}

export async function sendThreadMessage(params: {
  orgId: string;
  threadId: string;
  actor: MessagingActor;
  body: string;
  forceSend?: boolean;
  idempotencyKey?: string;
  intakeProfile?: MessageIntakeStepProfile;
  correlationId?: string; // preserved for call-site compatibility
}): Promise<SendThreadMessageResult> {
  const db = getScopedDb({ orgId: params.orgId });
  const threadLookupStartedAt = Date.now();
  const needsWindow = params.actor.role === "sitter" || !MESSAGE_INTAKE_OPTIMIZED_THREAD_LOOKUP;
  const thread = needsWindow
    ? await db.messageThread.findUnique({
        where: { id: params.threadId },
        select: {
          id: true,
          orgId: true,
          clientId: true,
          assignedSitterId: true,
          assignmentWindows: {
            where: { startAt: { lte: new Date() }, endAt: { gte: new Date() } },
            orderBy: { startAt: 'desc' },
            take: 1,
            select: { id: true, sitterId: true, startAt: true, endAt: true },
          },
        },
      })
    : await db.messageThread.findUnique({
        where: { id: params.threadId },
        select: {
          id: true,
          orgId: true,
          clientId: true,
          assignedSitterId: true,
          assignmentWindows: false,
        },
      });
  if (params.intakeProfile) params.intakeProfile.threadLookupMs = Date.now() - threadLookupStartedAt;

  if (!thread) throw new Error("Thread not found");
  const threadForAccess: ThreadForSend = {
    id: thread.id,
    orgId: thread.orgId,
    clientId: thread.clientId,
    assignedSitterId: thread.assignedSitterId,
    assignmentWindows: Array.isArray((thread as any).assignmentWindows) ? (thread as any).assignmentWindows : [],
  };
  assertMessagingThreadAccess(threadForAccess, params.actor, params.actor.role === "sitter");

  const messageBody = params.body.trim();
  if (!messageBody) throw new Error("Message body cannot be empty");

  const eventActorType = actorTypeForEvent(params.actor.role);
  const idempotencyKey = params.idempotencyKey?.trim() || undefined;
  const idempotencyFingerprint = idempotencyKey
    ? computeIdempotencyFingerprint({
        orgId: params.orgId,
        threadId: params.threadId,
        actorType: eventActorType,
        body: messageBody,
      })
    : undefined;
  if (idempotencyKey) {
    const idemStartedAt = Date.now();
    const existing = await db.messageEvent.findFirst({
      where: {
        threadId: params.threadId,
        orgId: params.orgId,
        direction: "outbound",
        actorType: eventActorType,
        idempotencyKey,
      },
      orderBy: { createdAt: "desc" },
    });
    if (params.intakeProfile) params.intakeProfile.idempotencyLookupMs = Date.now() - idemStartedAt;
    if (existing) {
      if (existing.idempotencyFingerprint && existing.idempotencyFingerprint !== idempotencyFingerprint) {
        throw new Error("Conflict: idempotency key reused with a different payload");
      }
      return {
        accepted: true,
        queued: existing.deliveryStatus === "queued",
        replay: true,
        event: existing,
        messageId: existing.id,
        messageEventId: existing.id,
        deliveryStatus: existing.deliveryStatus as DeliveryStatus,
        providerMessageSid: existing.providerMessageSid ?? null,
        providerErrorCode: existing.providerErrorCode ?? null,
        providerErrorMessage: existing.providerErrorMessage ?? null,
        handoffMeta: {
          mode: existing.deliveryStatus === "queued" ? "async" : "sync",
          providerDegraded: false,
          queueUnderPressure: false,
        },
      };
    }
  }

  const shouldDispatchProvider = params.actor.role !== "client";
  const queueAvailable = isOutboundQueueAvailable();
  const forceSync = params.forceSend === true && MESSAGE_SEND_ALLOW_FORCE_SYNC;
  const queueProbeStartedAt = Date.now();
  const queuePressure = shouldDispatchProvider
    ? await withTimeout(
        getOutboundQueuePressure(),
        Math.max(100, SEND_PREHANDOFF_PROBE_TIMEOUT_MS),
        "queue pressure probe timeout"
      ).catch(() => null)
    : null;
  if (params.intakeProfile) params.intakeProfile.queuePressureProbeMs = Date.now() - queueProbeStartedAt;
  const providerProbeStartedAt = Date.now();
  const providerDegraded = shouldDispatchProvider
    ? await withTimeout(
        shouldForceQueuedOnly({ provider: "twilio", orgId: params.orgId }),
        Math.max(100, SEND_PREHANDOFF_PROBE_TIMEOUT_MS),
        "provider pressure probe timeout"
      ).catch(() => false)
    : false;
  if (params.intakeProfile) params.intakeProfile.providerPressureProbeMs = Date.now() - providerProbeStartedAt;
  const queueUnderPressure = !!queuePressure?.forceQueuedOnly;
  const enforceAsync = providerDegraded || queueUnderPressure;
  const shouldAsyncHandoff =
    shouldDispatchProvider &&
    queueAvailable &&
    (!forceSync || enforceAsync);

  const metadataJson = buildMetadataJson({
    idempotencyKey,
    handoff: shouldDispatchProvider ? (shouldAsyncHandoff ? "async" : "sync") : "none",
  });

  const persistStartedAt = Date.now();
  const event = await db.messageEvent.create({
    data: {
      threadId: params.threadId,
      orgId: params.orgId,
      direction: "outbound",
      actorType: eventActorType,
      actorUserId: params.actor.role === "client" ? null : (params.actor.userId ?? null),
      actorClientId: params.actor.role === "client" ? (params.actor.clientId ?? null) : null,
      body: messageBody,
      idempotencyKey: idempotencyKey ?? null,
      idempotencyFingerprint: idempotencyFingerprint ?? null,
      routingDisposition: "normal",
      metadataJson,
      deliveryStatus: shouldDispatchProvider ? "queued" : "sent",
      providerMessageSid: null,
      failureCode: null,
      failureDetail: null,
      providerErrorCode: null,
      providerErrorMessage: null,
      attemptCount: shouldDispatchProvider ? 0 : 1,
      lastAttemptAt: shouldDispatchProvider ? null : new Date(),
    },
  });
  if (params.intakeProfile) params.intakeProfile.intentPersistMs = Date.now() - persistStartedAt;

  const threadUpdateStartedAt = Date.now();
  const activityAtMs = Date.now();
  let threadActivityQueued = false;
  if (isThreadActivityQueueAvailable()) {
    try {
      threadActivityQueued = await enqueueThreadActivityUpdate({
        orgId: params.orgId,
        threadId: params.threadId,
        activityAtMs,
      });
    } catch {
      threadActivityQueued = false;
    }
  }
  if (!threadActivityQueued) {
    const now = new Date(activityAtMs);
    const actorThreadUpdate =
      params.actor.role === "client"
        ? { lastClientMessageAt: now }
        : params.actor.role === "sitter"
          ? { lastSitterMessageAt: now }
          : {};
    await db.messageThread.updateMany({
      where: { id: params.threadId },
      data: {
        lastMessageAt: now,
        lastOutboundAt: now,
        ...actorThreadUpdate,
      },
    });
    void logEvent({
      orgId: params.orgId,
      actorUserId: params.actor.userId ?? undefined,
      action: "message.thread_activity.sync_fallback",
      entityType: "thread",
      entityId: params.threadId,
      metadata: {
        reason: "thread_activity_queue_unavailable",
      },
    });
  }

  // Push notification to the other party (fire-and-forget)
  void (async () => {
    try {
      const { pushNewMessage } = await import('@/lib/notifications/push-dispatch');
      const senderName = params.actor.role === 'client' ? 'Client'
        : params.actor.role === 'sitter' ? 'Sitter'
        : 'Team';

      // Push to client if sender is not client
      if (params.actor.role !== 'client' && thread.clientId) {
        await pushNewMessage({
          recipientClientId: thread.clientId,
          senderName,
          preview: messageBody,
          threadUrl: `/client/messages/${params.threadId}`,
        });
      }

      // Push to sitter if sender is not sitter
      if (params.actor.role !== 'sitter' && thread.assignedSitterId) {
        await pushNewMessage({
          recipientSitterId: thread.assignedSitterId,
          senderName,
          preview: messageBody,
          threadUrl: `/sitter/inbox`,
        });
      }
    } catch { /* push is non-critical */ }
  })();

  // Keep intake path minimal: moderation + YES/NO response capture are soft side-effects.
  void createSoftAntiPoachingFlag({
    orgId: params.orgId,
    threadId: params.threadId,
    messageEventId: event.id,
    body: messageBody,
  }).catch(() => {});
  if (params.actor.role === "sitter" && params.actor.sitterId) {
    void captureAvailabilityResponseFromMessage({
      orgId: params.orgId,
      threadId: params.threadId,
      sitterId: params.actor.sitterId,
      body: messageBody,
      responseMessageEventId: event.id,
    }).catch(() => {});
  }
  if (params.intakeProfile) params.intakeProfile.threadUpdateMs = Date.now() - threadUpdateStartedAt;

  if (!shouldDispatchProvider) {
    void logEvent({
      orgId: params.orgId,
      actorUserId: params.actor.userId ?? undefined,
      action: "message.sent",
      entityType: "message",
      entityId: event.id,
      metadata: { threadId: params.threadId, clientOriginated: true },
    });
    void publish(channels.messagesThread(params.orgId, params.threadId), {
      type: "message.new",
      threadId: params.threadId,
      messageId: event.id,
      ts: Date.now(),
    }).catch(() => {});
    return {
      accepted: true,
      queued: false,
      replay: false,
      event,
      messageId: event.id,
      messageEventId: event.id,
      deliveryStatus: "sent" as DeliveryStatus,
      providerMessageSid: null,
      providerErrorCode: null,
      providerErrorMessage: null,
      handoffMeta: {
        mode: "none",
        providerDegraded: false,
        queueUnderPressure: false,
      },
    };
  }

  if (!queueAvailable) {
    throw new Error("Message queue unavailable");
  }

  if (shouldAsyncHandoff) {
    const enqueueStartedAt = Date.now();
    const enqueued = await enqueueOutboundMessage({
      orgId: params.orgId,
      messageEventId: event.id,
    });
    if (params.intakeProfile) params.intakeProfile.enqueueMs = Date.now() - enqueueStartedAt;
    if (enqueued) {
      void logEvent({
        orgId: params.orgId,
        actorUserId: params.actor.userId ?? undefined,
        action: "message.queued",
        entityType: "message",
        entityId: event.id,
        metadata: {
          threadId: params.threadId,
          handoff: "async",
          providerThrottleClass: providerDegraded ? "degraded-mode" : queueUnderPressure ? "queue-pressure" : "deferred",
          providerDegraded,
          queuePressure,
          providerPressure: null,
        },
      });
      void publish(channels.messagesThread(params.orgId, params.threadId), {
        type: "message.updated",
        threadId: params.threadId,
        messageId: event.id,
        ts: Date.now(),
      }).catch(() => {});
      return {
        accepted: true,
        queued: true,
        replay: false,
        event,
        messageId: event.id,
        messageEventId: event.id,
        deliveryStatus: "queued" as DeliveryStatus,
        providerMessageSid: null,
        providerErrorCode: null,
        providerErrorMessage: null,
        handoffMeta: {
          mode: "async",
          providerDegraded,
          queueUnderPressure,
        },
      };
    }
    throw new Error("Message queue enqueue failed");
  }

  const dispatch = await dispatchMessageEventDelivery({
    orgId: params.orgId,
    messageEventId: event.id,
    throwOnRetryable: false,
    attempt: 1,
    maxAttempts: 1,
  });
  const refreshed = await db.messageEvent.findUnique({ where: { id: event.id } });

  return {
    accepted: true,
    queued: dispatch.deliveryStatus === "queued",
    replay: false,
    event: refreshed ?? event,
    messageId: (refreshed ?? event).id,
    messageEventId: (refreshed ?? event).id,
    deliveryStatus: dispatch.deliveryStatus,
    providerMessageSid: dispatch.providerMessageSid,
    providerErrorCode: dispatch.providerErrorCode,
    providerErrorMessage: dispatch.providerErrorMessage,
    handoffMeta: {
      mode: "sync",
      providerDegraded,
      queueUnderPressure,
    },
  };
}

export async function retryThreadMessage(params: {
  orgId: string;
  messageId: string;
  actor: MessagingActor;
  correlationId?: string; // preserved for call-site compatibility
}) {
  const db = getScopedDb({ orgId: params.orgId });
  const event = await db.messageEvent.findUnique({
    where: { id: params.messageId },
    include: {
      thread: {
        select: {
          id: true,
          orgId: true,
          clientId: true,
          assignedSitterId: true,
          assignmentWindows: {
            where: { startAt: { lte: new Date() }, endAt: { gte: new Date() } },
            orderBy: { startAt: 'desc' },
            take: 1,
            select: { id: true, sitterId: true, startAt: true, endAt: true },
          },
        },
      },
    },
  });

  if (!event) throw new Error("Message not found");
  if (event.direction !== "outbound") throw new Error("Cannot retry inbound message");
  assertMessagingThreadAccess(event.thread, params.actor, params.actor.role === "sitter");
  if (params.actor.role === "client") throw new Error("Client cannot retry provider delivery");
  if (!event.thread.clientId) throw new Error("Thread has no client");

  const dispatch = await dispatchMessageEventDelivery({
    orgId: params.orgId,
    messageEventId: params.messageId,
    throwOnRetryable: false,
    attempt: Math.max(1, (event.attemptCount ?? 0) + 1),
    maxAttempts: 1,
  });
  const updated = await db.messageEvent.findUnique({ where: { id: params.messageId } });
  const attemptNo = updated?.attemptCount ?? (event.attemptCount ?? 0) + 1;

  return { updated, attemptNo, success: dispatch.deliveryStatus === "sent" || dispatch.deliveryStatus === "delivered" };
}

export async function sendDirectMessage(params: {
  orgId: string;
  actor: MessagingActor;
  toE164: string;
  body: string;
  threadId?: string;
  fromE164?: string;
}) {
  // TCPA compliance: check opt-out before sending
  try {
    const optDb = getScopedDb({ orgId: params.orgId });
    const optOut = await optDb.optOutState.findFirst({
      where: { orgId: params.orgId, phoneE164: params.toE164, state: 'opted_out' },
    });
    if (optOut) {
      console.warn(`[sendDirectMessage] Blocked send to opted-out number`);
      return { success: false, messageSid: null, errorCode: 'opted_out', errorMessage: 'Recipient has opted out' };
    }
  } catch (e) {
    // OptOutState lookup failed — log but proceed (model may not be in scoped proxy)
    console.error('[sendDirectMessage] OptOutState check failed:', e);
  }

  const provider = await getMessagingProvider(params.orgId);
  let fromE164 = params.fromE164;
  if (!fromE164 && params.threadId) {
    const routing = await chooseFromNumber(params.threadId, params.orgId);
    fromE164 = routing.e164;
  }
  const sendResult = await provider.sendMessage({
    to: params.toE164,
    fromE164,
    body: params.body,
  });

  if (!params.threadId) return sendResult;

  const db = getScopedDb({ orgId: params.orgId });
  const event = await db.messageEvent.create({
    data: {
      threadId: params.threadId,
      orgId: params.orgId,
      direction: "outbound",
      actorType: actorTypeForEvent(params.actor.role),
      actorUserId: params.actor.role === "client" ? null : (params.actor.userId ?? null),
      actorClientId: params.actor.role === "client" ? (params.actor.clientId ?? null) : null,
      body: params.body,
      metadataJson: buildMetadataJson({ handoff: "sync" }),
      deliveryStatus: sendResult.success ? "sent" : "failed",
      providerMessageSid: sendResult.messageSid ?? null,
      failureCode: sendResult.success ? null : normalizeProviderErrorCode(sendResult.errorCode),
      failureDetail: sendResult.success ? null : (sendResult.errorMessage ?? "Failed to send message"),
      providerErrorCode: sendResult.success ? null : normalizeProviderErrorCode(sendResult.errorCode),
      providerErrorMessage: sendResult.success ? null : (sendResult.errorMessage ?? "Failed to send message"),
      attemptCount: 1,
      lastAttemptAt: new Date(),
    },
  });
  await db.messageThread.update({
    where: { id: params.threadId },
    data: { lastMessageAt: new Date(), lastOutboundAt: new Date() },
  });
  await publish(channels.messagesThread(params.orgId, params.threadId), {
    type: sendResult.success ? "message.new" : "message.updated",
    threadId: params.threadId,
    messageId: event.id,
    ts: Date.now(),
  }).catch(() => {});
  return sendResult;
}

