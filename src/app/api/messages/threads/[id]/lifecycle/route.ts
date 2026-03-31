import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/request-context";
import { getScopedDb } from "@/lib/tenancy";
import {
  activateServiceLaneForApprovedConversation,
  reconcileConversationLifecycleForThread,
} from "@/lib/messaging/conversation-service";

const PatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_stage"), stage: z.enum(["intake", "staffing", "meet_and_greet", "follow_up"]) }),
  z.object({ action: z.literal("meet_and_greet_confirmed") }),
  z.object({
    action: z.literal("activate_service_lane"),
    sitterId: z.string().min(1),
    serviceWindowStart: z.string().datetime(),
    serviceWindowEnd: z.string().datetime(),
    graceHours: z.number().int().positive().max(240).optional(),
  }),
  z.object({ action: z.literal("expire_if_needed") }),
]);

export async function PATCH(
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

  const params = await context.params;
  const threadId = params.id;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const db = getScopedDb({ orgId: ctx.orgId });

  if (parsed.data.action === "set_stage") {
    const updated = await db.messageThread.update({
      where: { id: threadId },
      data: {
        activationStage: parsed.data.stage,
        laneType: "company",
        assignedRole: "front_desk",
        lifecycleStatus: "active",
      },
      select: { id: true, activationStage: true, laneType: true, lifecycleStatus: true },
    });
    return NextResponse.json(updated);
  }

  if (parsed.data.action === "meet_and_greet_confirmed") {
    const updated = await db.messageThread.update({
      where: { id: threadId },
      data: {
        activationStage: "meet_and_greet",
        laneType: "company",
        assignedRole: "front_desk",
        lifecycleStatus: "active",
        meetAndGreetConfirmedAt: new Date(),
      },
      select: { id: true, activationStage: true, meetAndGreetConfirmedAt: true },
    });
    return NextResponse.json(updated);
  }

  if (parsed.data.action === "activate_service_lane") {
    await activateServiceLaneForApprovedConversation({
      orgId: ctx.orgId,
      threadId,
      assignedSitterId: parsed.data.sitterId,
      serviceWindowStart: new Date(parsed.data.serviceWindowStart),
      serviceWindowEnd: new Date(parsed.data.serviceWindowEnd),
      graceHours: parsed.data.graceHours,
    });
    const updated = await db.messageThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        laneType: true,
        activationStage: true,
        lifecycleStatus: true,
        assignedSitterId: true,
        serviceWindowStart: true,
        serviceWindowEnd: true,
        graceEndsAt: true,
      },
    });
    return NextResponse.json(updated);
  }

  const reconciled = await reconcileConversationLifecycleForThread({
    orgId: ctx.orgId,
    threadId,
  });
  return NextResponse.json(reconciled);
}

