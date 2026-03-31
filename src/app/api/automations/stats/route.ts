/**
 * GET /api/automations/stats
 * Summary: totalEnabled, runsToday, failuresToday (org-scoped).
 */

import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireOwnerOrAdmin, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";
import { getAutomationSettings } from "@/lib/automation-utils";
import { AUTOMATION_TYPE_IDS } from "@/lib/automations/types";

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

  try {
    const settings = await getAutomationSettings(ctx.orgId);
    const totalEnabled = AUTOMATION_TYPE_IDS.filter((id) => settings[id]?.enabled === true).length;

    const db = getScopedDb(ctx);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [runsToday, failuresToday] = await Promise.all([
      db.eventLog.count({
        where: {
          eventType: { startsWith: "automation.run." },
          status: "success",
          createdAt: { gte: todayStart },
        },
      }),
      db.eventLog.count({
        where: {
          eventType: { in: ["automation.failed", "automation.dead"] },
          createdAt: { gte: todayStart },
        },
      }),
    ]);

    return NextResponse.json({
      totalEnabled,
      runsToday,
      failuresToday,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: "Failed to load stats", message }, { status: 500 });
  }
}
