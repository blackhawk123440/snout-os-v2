/**
 * GET /api/ops/finance/ledger/export?start=&end=&format=csv|json
 * Org-scoped LedgerEntry export. Owner/admin only.
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

  const url = request.nextUrl ?? new URL(request.url);
  const { searchParams } = url;
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const format = searchParams.get("format") || "json";

  const end = endParam ? new Date(endParam) : new Date();
  const start = startParam ? new Date(startParam) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const db = getScopedDb(ctx);
  const entries = await db.ledgerEntry.findMany({
    where: { occurredAt: { gte: start, lte: end } },
    orderBy: { occurredAt: "asc" },
  });

  if (format === "csv") {
    const esc = (v: string | null | undefined) => (v == null ? "" : `"${String(v).replace(/"/g, '""')}"`);
    const header = "id,orgId,entryType,source,stripeId,bookingId,clientId,sitterId,amountCents,currency,status,occurredAt,createdAt";
    const rows = entries.map(
      (e) =>
        `${esc(e.id)},${esc(e.orgId)},${esc(e.entryType)},${esc(e.source)},${esc(e.stripeId)},${esc(e.bookingId)},${esc(e.clientId)},${esc(e.sitterId)},${e.amountCents},${esc(e.currency)},${esc(e.status)},${e.occurredAt.toISOString()},${e.createdAt.toISOString()}`
    );
    const csv = [header, ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="ledger-${start.toISOString().slice(0, 10)}-${end.toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    start: start.toISOString(),
    end: end.toISOString(),
    count: entries.length,
    entries: entries.map((e) => ({
      id: e.id,
      orgId: e.orgId,
      entryType: e.entryType,
      source: e.source,
      stripeId: e.stripeId,
      bookingId: e.bookingId,
      clientId: e.clientId,
      sitterId: e.sitterId,
      amountCents: e.amountCents,
      currency: e.currency,
      status: e.status,
      occurredAt: e.occurredAt,
      createdAt: e.createdAt,
    })),
  });
}
