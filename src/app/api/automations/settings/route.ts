/**
 * GET /api/automations/settings - Full automation settings for org
 * PATCH /api/automations/settings - Update automation settings (owner/admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireOwnerOrAdmin, ForbiddenError } from "@/lib/rbac";
import { getAutomationSettings, setAutomationSettings } from "@/lib/automation-utils";
import type { AutomationSettings } from "@/lib/automations/types";

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
    return NextResponse.json(settings as AutomationSettings);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: "Failed to load settings", message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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
    const body = (await request.json()) as Partial<AutomationSettings>;
    const updated = await setAutomationSettings(ctx.orgId, body);
    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: "Failed to save settings", message }, { status: 500 });
  }
}
