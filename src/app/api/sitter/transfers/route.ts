/**
 * GET /api/sitter/transfers
 * Returns PayoutTransfer rows for the current sitter. Requires SITTER role.
 */

import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, "sitter");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ctx?.sitterId) {
    return NextResponse.json({ error: "Sitter profile missing" }, { status: 403 });
  }

  const db = getScopedDb(ctx);

  try {
    const transfers = await db.payoutTransfer.findMany({
      where: { sitterId: ctx.sitterId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      transfers: transfers.map((t) => ({
        id: t.id,
        bookingId: t.bookingId,
        stripeTransferId: t.stripeTransferId,
        amount: t.amount,
        amountReversed: t.amountReversed ?? 0,
        netAmount: t.amount - (t.amountReversed ?? 0),
        currency: t.currency,
        status: t.status,
        lastError: t.lastError,
        createdAt: t.createdAt,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load transfers", message: msg },
      { status: 500 }
    );
  }
}
