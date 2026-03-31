/**
 * POST /api/client/delete-account
 * Client self-delete (soft). Sets Client.deletedAt and User.deletedAt.
 * Requires session with clientId.
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
    requireRole(ctx, "client");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ctx.clientId || !ctx.userId) {
    return NextResponse.json({ error: "Client profile missing" }, { status: 403 });
  }

  const db = getScopedDb(ctx);

  try {
    const client = await db.client.findFirst({
      where: { id: ctx.clientId },
      include: { user: { select: { id: true } } },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (client.deletedAt) {
      return NextResponse.json({ error: "Account already deleted" }, { status: 400 });
    }

    await logEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: "client.delete.requested",
      entityType: "client",
      entityId: ctx.clientId,
      metadata: { clientId: ctx.clientId },
    });

    const now = new Date();

    await db.client.update({
      where: { id: ctx.clientId },
      data: { deletedAt: now },
    });

    if (client.user?.id) {
      await db.user.update({
        where: { id: client.user.id },
        data: { deletedAt: now },
      });
    }

    await logEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: "client.delete.completed",
      entityType: "client",
      entityId: ctx.clientId,
      metadata: { clientId: ctx.clientId },
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
