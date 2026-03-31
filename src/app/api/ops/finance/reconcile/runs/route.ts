/**
 * GET /api/ops/finance/reconcile/runs?limit=20 - List reconciliation runs
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAnyRole, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";

export async function GET(request: NextRequest) {
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

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10) || 20, 100);

  const db = getScopedDb(ctx);
  const runs = await db.reconciliationRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      rangeStart: true,
      rangeEnd: true,
      status: true,
      totalsJson: true,
      mismatchJson: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id,
      rangeStart: r.rangeStart,
      rangeEnd: r.rangeEnd,
      status: r.status,
      totalsJson: r.totalsJson,
      mismatchJson: r.mismatchJson,
      createdAt: r.createdAt,
    })),
  });
}
