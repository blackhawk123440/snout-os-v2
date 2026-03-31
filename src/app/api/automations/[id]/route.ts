/**
 * GET /api/automations/[id] - Get one automation type config
 * PATCH /api/automations/[id] - Update one automation type (owner/admin only)
 * id = automation type id (bookingConfirmation, nightBeforeReminder, ...)
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireOwnerOrAdmin, ForbiddenError } from "@/lib/rbac";
import { getAutomationSettings, setAutomationSettings } from "@/lib/automation-utils";
import { AUTOMATION_TYPE_IDS, type AutomationTypeId } from "@/lib/automations/types";

const TYPE_IDS_SET = new Set<string>(AUTOMATION_TYPE_IDS);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!id || !TYPE_IDS_SET.has(id)) {
    return NextResponse.json({ error: "Invalid automation type id" }, { status: 404 });
  }

  try {
    const settings = await getAutomationSettings(ctx.orgId);
    const block = settings[id as AutomationTypeId];
    return NextResponse.json(block ?? {});
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: "Failed to load automation", message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!id || !TYPE_IDS_SET.has(id)) {
    return NextResponse.json({ error: "Invalid automation type id" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const partial = { [id]: body } as Partial<Record<AutomationTypeId, unknown>>;
    const updated = await setAutomationSettings(ctx.orgId, partial as any);
    return NextResponse.json(updated[id as AutomationTypeId]);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: "Failed to update automation", message }, { status: 500 });
  }
}
