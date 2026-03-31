import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { getScopedDb } from "@/lib/tenancy";

const EVENT_LABELS: Record<string, string> = {
  "messaging.company_lane.ensured": "Company lane ensured",
  "messaging.availability.requested": "Availability request sent",
  "messaging.availability.responded": "Sitter availability response received",
  "messaging.meet_greet.scheduled": "Meet-and-greet scheduled",
  "messaging.meet_greet.confirmed": "Meet-and-greet confirmed",
  "messaging.approval.client_received": "Client approval received",
  "messaging.approval.sitter_received": "Sitter approval received",
  "messaging.service_lane.activated": "Service lane activated",
  "messaging.grace.started": "Post-service grace started",
  "messaging.lane.rerouted": "Service lane expired and rerouted",
  "messaging.flag.anti_poaching": "Anti-poaching flag raised",
  "messaging.lifecycle.notice.sent": "Lifecycle notice sent",
  "messaging.sitter.reassigned": "Sitter reassigned",
};

function parseJsonSafe(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET(
  _request: Request,
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
  const db = getScopedDb({ orgId: ctx.orgId });
  const thread = await db.messageThread.findUnique({
    where: { id: threadId },
    select: { id: true, bookingId: true },
  });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const eventWhere: any = {
    orgId: ctx.orgId,
    eventType: { startsWith: "messaging." },
    OR: [
      { metadata: { contains: `"threadId":"${threadId}"` } },
      ...(thread.bookingId ? [{ bookingId: thread.bookingId }] : []),
    ],
  };

  const [events, flags] = await Promise.all([
    db.eventLog.findMany({
      where: eventWhere,
      orderBy: { createdAt: "desc" },
      take: 120,
      select: {
        id: true,
        eventType: true,
        status: true,
        metadata: true,
        createdAt: true,
      },
    }),
    db.messageConversationFlag.findMany({
      where: { orgId: ctx.orgId, threadId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        type: true,
        severity: true,
        metadataJson: true,
        createdAt: true,
      },
    }),
  ]);

  const timelineItems = [
    ...events.map((event) => ({
      id: event.id,
      kind: "event",
      eventType: event.eventType,
      label: EVENT_LABELS[event.eventType] ?? event.eventType,
      status: event.status,
      metadata: parseJsonSafe(event.metadata),
      createdAt: event.createdAt.toISOString(),
    })),
    ...flags.map((flag) => ({
      id: flag.id,
      kind: "flag",
      eventType: `flag.${flag.type}`,
      label:
        flag.type === "anti_poaching"
          ? "Anti-poaching flag raised"
          : `${flag.type} flag raised`,
      status: flag.severity,
      metadata: parseJsonSafe(flag.metadataJson),
      createdAt: flag.createdAt.toISOString(),
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({ items: timelineItems });
}
