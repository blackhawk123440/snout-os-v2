import { prisma } from "@/lib/db";
import { detectAntiPoachingViolations } from "@/lib/messaging/anti-poaching-detection";
import { logMessagingTimelineEvent } from "@/lib/messaging/timeline-events";

export async function createSoftAntiPoachingFlag(params: {
  orgId: string;
  threadId: string;
  messageEventId: string;
  body: string;
}): Promise<boolean> {
  const detection = detectAntiPoachingViolations(params.body);
  if (!detection.detected) return false;

  await prisma.messageConversationFlag.create({
    data: {
      orgId: params.orgId,
      threadId: params.threadId,
      messageEventId: params.messageEventId,
      type: "anti_poaching",
      severity: "medium",
      metadataJson: JSON.stringify({
        reasons: detection.reasons,
        violations: detection.violations.map((v) => ({
          type: v.type,
          reason: v.reason,
          contentPreview: v.content.slice(0, 16),
        })),
        mode: "soft_detect_only",
      }),
    },
  });
  const thread = await prisma.messageThread.findUnique({
    where: { id: params.threadId },
    select: { bookingId: true },
  });
  await logMessagingTimelineEvent({
    orgId: params.orgId,
    threadId: params.threadId,
    bookingId: thread?.bookingId ?? null,
    eventType: "messaging.flag.anti_poaching",
    metadata: {
      reasons: detection.reasons,
      messageEventId: params.messageEventId,
    },
  }).catch(() => {});
  return true;
}

