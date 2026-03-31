import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { ForbiddenError, requireOwnerOrAdmin } from "@/lib/rbac";
import { getProviderPressureState } from "@/lib/messaging/provider-pressure";
import { getOutboundQueuePressure } from "@/lib/messaging/outbound-queue";

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [providerPressure, queuePressure] = await Promise.all([
    getProviderPressureState({ provider: "twilio", orgId: ctx.orgId }),
    getOutboundQueuePressure(),
  ]);

  return NextResponse.json({
    orgId: ctx.orgId,
    providerPressure,
    queuePressure,
    forcedQueuedOnly: providerPressure.forcedQueuedOnly || queuePressure.forceQueuedOnly,
  });
}
