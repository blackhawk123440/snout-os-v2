/**
 * GET /api/ops/ai/settings - Get AI settings
 * PATCH /api/ops/ai/settings - Update AI settings
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAnyRole, ForbiddenError } from "@/lib/rbac";
import { getOrCreateOrgAISettings, getBudgetUsageCents } from "@/lib/ai/governance";
import { getScopedDb } from "@/lib/tenancy";

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ["owner", "admin"]);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getOrCreateOrgAISettings(ctx.orgId);
    const usageCents = await getBudgetUsageCents(ctx.orgId, new Date());
    return NextResponse.json({
      ...settings,
      usageCentsThisMonth: usageCents,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to load settings", message: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ["owner", "admin"]);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { enabled?: boolean; monthlyBudgetCents?: number; hardStop?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = getScopedDb(ctx);

  try {
    let settings = await db.orgAISettings.findFirst({ where: {} });
    if (!settings) {
      settings = await db.orgAISettings.create({
        data: {
          orgId: ctx.orgId,
          enabled: body.enabled ?? true,
          monthlyBudgetCents: body.monthlyBudgetCents ?? 0,
          hardStop: body.hardStop ?? false,
        },
      });
    } else {
      const updateData: Record<string, unknown> = {};
      if (typeof body.enabled === "boolean") updateData.enabled = body.enabled;
      if (typeof body.monthlyBudgetCents === "number") updateData.monthlyBudgetCents = body.monthlyBudgetCents;
      if (typeof body.hardStop === "boolean") updateData.hardStop = body.hardStop;
      if (Object.keys(updateData).length > 0) {
        settings = await db.orgAISettings.update({
          where: { id: settings.id },
          data: updateData,
        });
      }
    }
    return NextResponse.json({
      enabled: settings.enabled,
      monthlyBudgetCents: settings.monthlyBudgetCents,
      hardStop: settings.hardStop,
      allowedModels: settings.allowedModels,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to update settings", message: msg }, { status: 500 });
  }
}
