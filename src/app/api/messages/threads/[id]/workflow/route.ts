import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/request-context";
import { getScopedDb } from "@/lib/tenancy";
import { syncConversationLifecycleWithBookingWorkflow } from "@/lib/messaging/conversation-service";
import { logMessagingTimelineEvent } from "@/lib/messaging/timeline-events";
import { emitClientLifecycleNoticeIfNeeded } from "@/lib/messaging/lifecycle-client-copy";

const WorkflowActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("schedule_meet_and_greet"),
    scheduledAt: z.string().datetime(),
  }),
  z.object({
    action: z.literal("confirm_meet_and_greet"),
  }),
  z.object({
    action: z.literal("client_approves_sitter"),
  }),
  z.object({
    action: z.literal("sitter_approves_client"),
  }),
]);

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: threadId } = await context.params;
  const parsed = WorkflowActionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const db = getScopedDb({ orgId: ctx.orgId });
  const thread = await db.messageThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      bookingId: true,
      clientId: true,
      assignedSitterId: true,
    },
  });
  if (!thread || !thread.bookingId) {
    return NextResponse.json({ error: "Thread booking context unavailable" }, { status: 409 });
  }
  const booking = await db.booking.findUnique({
    where: { id: thread.bookingId },
    select: {
      id: true,
      orgId: true,
      firstName: true,
      lastName: true,
      phone: true,
      sitterId: true,
      status: true,
      startAt: true,
      endAt: true,
    },
  });
  if (!booking) {
    return NextResponse.json({ error: "Thread booking context unavailable" }, { status: 409 });
  }

  const now = new Date();

  if (parsed.data.action === "schedule_meet_and_greet") {
    const scheduledAt = new Date(parsed.data.scheduledAt);
    await syncConversationLifecycleWithBookingWorkflow({
      orgId: ctx.orgId,
      bookingId: booking.id,
      clientId: thread.clientId,
      phone: booking.phone,
      firstName: booking.firstName,
      lastName: booking.lastName,
      sitterId: booking.sitterId,
      bookingStatus: booking.status,
      serviceWindowStart: booking.startAt,
      serviceWindowEnd: booking.endAt,
      meetAndGreetScheduledAt: scheduledAt,
    });
    await logMessagingTimelineEvent({
      orgId: ctx.orgId,
      threadId,
      bookingId: booking.id,
      eventType: "messaging.meet_greet.scheduled",
      metadata: {
        scheduledAt: scheduledAt.toISOString(),
      },
    }).catch(() => {});
    await emitClientLifecycleNoticeIfNeeded({
      orgId: ctx.orgId,
      threadId,
      notice: "meet_greet_scheduled",
      dedupeKey: `${booking.id}:meet_greet_scheduled:${scheduledAt.toISOString()}`,
    }).catch(() => {});
  }

  if (parsed.data.action === "confirm_meet_and_greet") {
    await syncConversationLifecycleWithBookingWorkflow({
      orgId: ctx.orgId,
      bookingId: booking.id,
      clientId: thread.clientId,
      phone: booking.phone,
      firstName: booking.firstName,
      lastName: booking.lastName,
      sitterId: booking.sitterId,
      bookingStatus: booking.status,
      serviceWindowStart: booking.startAt,
      serviceWindowEnd: booking.endAt,
      meetAndGreetConfirmedAt: now,
    });
    await logMessagingTimelineEvent({
      orgId: ctx.orgId,
      threadId,
      bookingId: booking.id,
      eventType: "messaging.meet_greet.confirmed",
      metadata: { confirmedAt: now.toISOString() },
    }).catch(() => {});
    await emitClientLifecycleNoticeIfNeeded({
      orgId: ctx.orgId,
      threadId,
      notice: "meet_greet_confirmed",
      dedupeKey: `${booking.id}:meet_greet_confirmed`,
    }).catch(() => {});
  }

  if (parsed.data.action === "client_approves_sitter") {
    await syncConversationLifecycleWithBookingWorkflow({
      orgId: ctx.orgId,
      bookingId: booking.id,
      clientId: thread.clientId,
      phone: booking.phone,
      firstName: booking.firstName,
      lastName: booking.lastName,
      sitterId: booking.sitterId,
      bookingStatus: booking.status,
      serviceWindowStart: booking.startAt,
      serviceWindowEnd: booking.endAt,
      clientApprovedAt: now,
    });
    await logMessagingTimelineEvent({
      orgId: ctx.orgId,
      threadId,
      bookingId: booking.id,
      eventType: "messaging.approval.client_received",
      metadata: { approvedAt: now.toISOString() },
    }).catch(() => {});
  }

  if (parsed.data.action === "sitter_approves_client") {
    await syncConversationLifecycleWithBookingWorkflow({
      orgId: ctx.orgId,
      bookingId: booking.id,
      clientId: thread.clientId,
      phone: booking.phone,
      firstName: booking.firstName,
      lastName: booking.lastName,
      sitterId: booking.sitterId,
      bookingStatus: booking.status,
      serviceWindowStart: booking.startAt,
      serviceWindowEnd: booking.endAt,
      sitterApprovedAt: now,
    });
    await logMessagingTimelineEvent({
      orgId: ctx.orgId,
      threadId,
      bookingId: booking.id,
      eventType: "messaging.approval.sitter_received",
      metadata: { approvedAt: now.toISOString() },
    }).catch(() => {});
  }

  const updated = await db.messageThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      bookingId: true,
      laneType: true,
      activationStage: true,
      lifecycleStatus: true,
      clientApprovedAt: true,
      sitterApprovedAt: true,
      serviceApprovedAt: true,
      meetAndGreetConfirmedAt: true,
      graceEndsAt: true,
    },
  });

  return NextResponse.json({
    thread: {
      ...(updated ?? {}),
      clientApprovedAt: updated?.clientApprovedAt?.toISOString() ?? null,
      sitterApprovedAt: updated?.sitterApprovedAt?.toISOString() ?? null,
      serviceApprovedAt: updated?.serviceApprovedAt?.toISOString() ?? null,
      meetAndGreetConfirmedAt: updated?.meetAndGreetConfirmedAt?.toISOString() ?? null,
      graceEndsAt: updated?.graceEndsAt?.toISOString() ?? null,
    },
  });
}
