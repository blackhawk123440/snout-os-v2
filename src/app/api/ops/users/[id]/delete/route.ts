/**
 * POST /api/ops/users/[id]/delete
 * Owner/admin soft-delete of a user and linked role entity (sitter/client).
 */

import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAnyRole, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";
import { logEvent } from "@/lib/log-event";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  const db = getScopedDb(ctx);

  try {
    const user = await db.user.findFirst({
      where: { id: userId },
      include: {
        sitter: { select: { id: true } },
        client: { select: { id: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.deletedAt) {
      return NextResponse.json({ error: "User already deleted" }, { status: 400 });
    }

    const now = new Date();

    await db.user.update({
      where: { id: userId },
      data: { deletedAt: now },
    });

    if (user.sitter?.id) {
      await db.sitter.update({
        where: { id: user.sitter.id },
        data: { deletedAt: now },
      });
    }

    if (user.client?.id) {
      await db.client.update({
        where: { id: user.client.id },
        data: { deletedAt: now },
      });
    }

    await logEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId ?? undefined,
      action: "user.delete.admin",
      entityType: "user",
      entityId: userId,
      metadata: {
        userId,
        sitterId: user.sitter?.id ?? null,
        clientId: user.client?.id ?? null,
      },
    });

    return NextResponse.json({ success: true, message: "User deleted" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete user", message: msg },
      { status: 500 }
    );
  }
}
