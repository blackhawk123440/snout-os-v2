import { prisma } from "@/lib/db";

export async function logMessagingTimelineEvent(params: {
  orgId: string;
  eventType: string;
  threadId: string;
  bookingId?: string | null;
  status?: "success" | "failed" | "skipped" | "pending";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.eventLog.create({
    data: {
      orgId: params.orgId,
      eventType: params.eventType,
      status: params.status ?? "success",
      bookingId: params.bookingId ?? null,
      metadata: JSON.stringify({
        threadId: params.threadId,
        ...(params.metadata ?? {}),
      }),
    },
  });
}
