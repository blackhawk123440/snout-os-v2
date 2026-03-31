/**
 * GET /api/automations/ledger
 * Recent automation run events (success + failed) for the org. Owner/admin only.
 * Query: limit (default 50), tab = success | fail | all (default all).
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireOwnerOrAdmin, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";

const DEFAULT_LIMIT = 50;

function mapItem(f: { id: string; eventType: string; automationType: string | null; status: string; error: string | null; bookingId: string | null; metadata: string | null; createdAt: Date }) {
  const metadata = f.metadata
    ? typeof f.metadata === "string"
      ? JSON.parse(f.metadata)
      : f.metadata
    : null;
  return {
    id: f.id,
    eventType: f.eventType,
    automationType: f.automationType,
    status: f.status,
    error: f.error,
    bookingId: f.bookingId,
    metadata,
    createdAt: f.createdAt,
  };
}

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    100
  );
  const tab = searchParams.get("tab") || "all";

  try {
    const db = getScopedDb(ctx);
    const builtWhere: Record<string, unknown> =
      tab === "success"
        ? { eventType: { startsWith: "automation.run." }, status: "success" }
        : tab === "fail"
          ? { eventType: { in: ["automation.failed", "automation.dead"] } }
          : {
              OR: [
                { eventType: { startsWith: "automation.run." } },
                { eventType: "automation.failed" },
                { eventType: "automation.dead" },
              ],
            };

    const events = await db.eventLog.findMany({
      where: builtWhere,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        eventType: true,
        automationType: true,
        status: true,
        error: true,
        bookingId: true,
        metadata: true,
        createdAt: true,
      },
    });

    const items = events.map(mapItem);
    return NextResponse.json({ items, count: items.length, tab });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: "Failed to load ledger", message }, { status: 500 });
  }
}
