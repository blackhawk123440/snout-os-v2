/**
 * GET /api/ops/payouts
 * Owner view: list PayoutTransfer rows with sitter info. Supports filters: sitterId, status.
 */

import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAnyRole, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";

export async function GET(request: Request) {
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
  const { searchParams } = new URL(request.url);
  const sitterId = searchParams.get("sitterId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 200);

  try {
    const where: { sitterId?: string; status?: string } = {};
    if (sitterId) where.sitterId = sitterId;
    if (status) where.status = status;

    const transfers = await db.payoutTransfer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        sitter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const items = transfers.map((t) => ({
      id: t.id,
      orgId: t.orgId,
      sitterId: t.sitterId,
      sitterName: t.sitter
        ? `${t.sitter.firstName ?? ""} ${t.sitter.lastName ?? ""}`.trim() || "Unknown"
        : "Unknown",
      bookingId: t.bookingId,
      stripeTransferId: t.stripeTransferId,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      lastError: t.lastError,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return NextResponse.json({ transfers: items });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load payouts", message: msg },
      { status: 500 }
    );
  }
}
