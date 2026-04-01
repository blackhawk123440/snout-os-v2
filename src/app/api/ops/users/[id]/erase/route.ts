import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAnyRole, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";
import { logEvent } from "@/lib/log-event";
import { eraseClientAccountData, eraseSitterAccountData } from "@/lib/privacy/erase-account";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteParams) {
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

  const { id } = await params;
  const db = getScopedDb(ctx);

  const user = await db.user.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true,
      role: true,
      client: { select: { id: true } },
      sitter: { select: { id: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.client?.id && !user.sitter?.id) {
    return NextResponse.json(
      { error: "Erase workflow currently supports client and sitter accounts only." },
      { status: 400 }
    );
  }

  if (user.client?.id) {
    await eraseClientAccountData(db as any, ctx.orgId, user.client.id, user.id);
    await logEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId || undefined,
      action: "privacy.erase.completed",
      entityType: "client",
      entityId: user.client.id,
      metadata: { userId: user.id, role: user.role, target: "client" },
    });
    return NextResponse.json({ ok: true, target: "client", erased: true });
  }

  await eraseSitterAccountData(db as any, ctx.orgId, user.sitter!.id, user.id);
  await logEvent({
    orgId: ctx.orgId,
    actorUserId: ctx.userId || undefined,
    action: "privacy.erase.completed",
    entityType: "sitter",
    entityId: user.sitter!.id,
    metadata: { userId: user.id, role: user.role, target: "sitter" },
  });
  return NextResponse.json({ ok: true, target: "sitter", erased: true });
}
