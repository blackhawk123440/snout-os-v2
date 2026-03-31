import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/request-context";
import { getScopedDb } from "@/lib/tenancy";
import { createSitterAvailabilityRequest, syncConversationLifecycleWithBookingWorkflow } from "@/lib/messaging/conversation-service";
import { sendThreadMessage, asMessagingActorRole } from "@/lib/messaging/send";

const PostSchema = z.object({
  threadId: z.string().min(1),
  bookingId: z.string().optional(),
  sitterIds: z.array(z.string().min(1)).min(1),
  prompt: z.string().min(1).max(480).optional(),
});

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = PostSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const role = asMessagingActorRole(ctx.role);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { threadId, bookingId, sitterIds, prompt } = parsed.data;
  let requestMessageEventId: string | null = null;
  if (prompt?.trim()) {
    const send = await sendThreadMessage({
      orgId: ctx.orgId,
      threadId,
      actor: { role, userId: ctx.userId },
      body: prompt.trim(),
    });
    requestMessageEventId = send.messageEventId;
  }

  const created = await Promise.all(
    sitterIds.map((sitterId) =>
      createSitterAvailabilityRequest({
        orgId: ctx.orgId,
        threadId,
        bookingId,
        sitterId,
        requestedByUserId: ctx.userId,
        requestMessageEventId,
      })
    )
  );

  if (bookingId) {
    const db = getScopedDb({ orgId: ctx.orgId });
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        clientId: true,
        phone: true,
        firstName: true,
        lastName: true,
        sitterId: true,
        status: true,
        startAt: true,
        endAt: true,
      },
    });
    if (booking) {
      await syncConversationLifecycleWithBookingWorkflow({
        orgId: ctx.orgId,
        bookingId: booking.id,
        clientId: booking.clientId,
        phone: booking.phone,
        firstName: booking.firstName,
        lastName: booking.lastName,
        sitterId: booking.sitterId,
        bookingStatus: booking.status,
        serviceWindowStart: booking.startAt,
        serviceWindowEnd: booking.endAt,
      }).catch((error) => {
        console.error("[availability.requests] lifecycle sync failed:", error);
      });
    }
  }

  return NextResponse.json({
    count: created.length,
    requestIds: created.map((row) => row.id),
    requestMessageEventId,
  });
}

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["owner", "admin", "sitter"].includes(ctx.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = req.nextUrl ?? new URL(req.url);
  const threadId = url.searchParams.get("threadId") || undefined;
  const bookingId = url.searchParams.get("bookingId") || undefined;
  const db = getScopedDb({ orgId: ctx.orgId });
  const rows = await db.sitterAvailabilityRequest.findMany({
    where: {
      ...(threadId ? { threadId } : {}),
      ...(bookingId ? { bookingId } : {}),
      ...(ctx.role === "sitter" && ctx.sitterId ? { sitterId: ctx.sitterId } : {}),
    },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      threadId: row.threadId,
      bookingId: row.bookingId,
      sitterId: row.sitterId,
      status: row.status,
      requestedAt: row.requestedAt.toISOString(),
      respondedAt: row.respondedAt?.toISOString() ?? null,
      responseLatencySec: row.responseLatencySec ?? null,
    })),
  });
}

