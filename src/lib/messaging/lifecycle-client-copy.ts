import { prisma } from "@/lib/db";
import { sendThreadMessage } from "@/lib/messaging/send";
import { logMessagingTimelineEvent } from "@/lib/messaging/timeline-events";

export type ClientLifecycleNoticeKind =
  | "meet_greet_scheduled"
  | "meet_greet_confirmed"
  | "service_activated"
  | "post_service_grace";

const NOTICE_COPY: Record<ClientLifecycleNoticeKind, string> = {
  meet_greet_scheduled:
    "Great news - your meet-and-greet is scheduled. We'll coordinate final details right here in this thread.",
  meet_greet_confirmed:
    "Thanks - your meet-and-greet is confirmed. We will finalize service details with you in this thread.",
  service_activated:
    "Your service conversation is now active for visit updates. You're still messaging one Snout team thread as usual.",
  post_service_grace:
    "Thanks again for today's visit. Our office team will continue follow-up from this same thread, and you can reply REBOOK anytime.",
};

export async function emitClientLifecycleNoticeIfNeeded(params: {
  orgId: string;
  threadId: string;
  notice: ClientLifecycleNoticeKind;
  dedupeKey: string;
}): Promise<void> {
  const body = NOTICE_COPY[params.notice];
  const existing = await prisma.messageEvent.findFirst({
    where: {
      orgId: params.orgId,
      threadId: params.threadId,
      direction: "outbound",
      actorType: "automation",
      body,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (existing) return;

  await sendThreadMessage({
    orgId: params.orgId,
    threadId: params.threadId,
    actor: { role: "automation", userId: null },
    body,
    idempotencyKey: `lifecycle:${params.notice}:${params.dedupeKey}`,
  });
  const thread = await prisma.messageThread.findUnique({
    where: { id: params.threadId },
    select: { bookingId: true },
  });
  await logMessagingTimelineEvent({
    orgId: params.orgId,
    threadId: params.threadId,
    bookingId: thread?.bookingId ?? null,
    eventType: "messaging.lifecycle.notice.sent",
    metadata: {
      notice: params.notice,
    },
  }).catch(() => {});
}
