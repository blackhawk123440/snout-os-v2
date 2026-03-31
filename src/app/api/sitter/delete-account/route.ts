/**
 * POST /api/sitter/delete-account
 * Sitter self-delete (soft). Sets Sitter.deletedAt and User.deletedAt.
 */

import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";
import { logEvent } from "@/lib/log-event";

export async function POST() {
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

  if (!ctx.sitterId || !ctx.userId) {
    return NextResponse.json({ error: "Sitter profile missing" }, { status: 403 });
  }

  const db = getScopedDb(ctx);

  try {
    const sitter = await db.sitter.findFirst({
      where: { id: ctx.sitterId },
      include: { user: { select: { id: true } } },
    });

    if (!sitter) {
      return NextResponse.json({ error: "Sitter not found" }, { status: 404 });
    }

    if (sitter.deletedAt) {
      return NextResponse.json({ error: "Account already deleted" }, { status: 400 });
    }

    await logEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: "sitter.delete.requested",
      entityType: "sitter",
      entityId: ctx.sitterId,
      metadata: { sitterId: ctx.sitterId },
    });

    const now = new Date();

    await db.sitter.update({
      where: { id: ctx.sitterId },
      data: { deletedAt: now },
    });

    if (sitter.user?.id) {
      await db.user.update({
        where: { id: sitter.user.id },
        data: { deletedAt: now },
      });
    }

    await logEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: "sitter.delete.completed",
      entityType: "sitter",
      entityId: ctx.sitterId,
      metadata: { sitterId: ctx.sitterId },
    });

    return NextResponse.json({ success: true, message: "Account deleted" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete account", message: msg },
      { status: 500 }
    );
  }
}
