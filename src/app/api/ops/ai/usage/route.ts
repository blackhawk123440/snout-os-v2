/**
 * GET /api/ops/ai/usage - Usage this month + last 50 AIUsageLog entries
 */

import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAnyRole, ForbiddenError } from "@/lib/rbac";
import { getBudgetUsageCents } from "@/lib/ai/governance";
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

  const db = getScopedDb(ctx);
  const now = new Date();

  try {
    const usageCents = await getBudgetUsageCents(ctx.orgId, now);
    const logs = await db.aIUsageLog.findMany({
      where: {},
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({
      usageCentsThisMonth: usageCents,
      logs: logs.map((l) => ({
        id: l.id,
        featureKey: l.featureKey,
        promptKey: l.promptKey,
        promptVersion: l.promptVersion,
        model: l.model,
        totalTokens: l.totalTokens,
        costCents: l.costCents,
        status: l.status,
        error: l.error,
        createdAt: l.createdAt,
        metadata: l.metadata,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to load usage", message: msg }, { status: 500 });
  }
}
