/**
 * POST /api/ops/finance/reconcile - Trigger reconciliation for date range
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAnyRole, ForbiddenError } from "@/lib/rbac";
import { enqueueFinanceReconcile } from "@/lib/finance/reconcile-queue";

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
    requireAnyRole(ctx, ["owner", "admin"]);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { start?: string; end?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const start = body.start ? new Date(body.start) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
  const end = body.end ? new Date(body.end) : new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }
  if (start >= end) {
    return NextResponse.json({ error: "start must be before end" }, { status: 400 });
  }

  try {
    const jobId = await enqueueFinanceReconcile({
      orgId: ctx.orgId,
      start,
      end,
      correlationId: ctx.correlationId,
    });
    return NextResponse.json({ jobId, start: start.toISOString(), end: end.toISOString() });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to enqueue", message: msg }, { status: 500 });
  }
}
