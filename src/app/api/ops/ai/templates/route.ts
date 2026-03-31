/**
 * GET /api/ops/ai/templates - List prompt templates (org + global)
 * POST /api/ops/ai/templates - Create/override template for org
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAnyRole, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";
import { getGlobalAIPromptTemplates } from "@/lib/ai/governance";

export async function GET() {
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

  try {
    const [orgTemplates, globalTemplates] = await Promise.all([
      db.aIPromptTemplate.findMany({
        where: {},
        orderBy: [{ key: "asc" }, { version: "desc" }],
      }),
      getGlobalAIPromptTemplates(),
    ]);
    const items = [
      ...orgTemplates.map((t) => ({ ...t, scope: "org" as const })),
      ...globalTemplates.map((t) => ({ ...t, scope: "global" as const })),
    ].sort((a, b) => a.key.localeCompare(b.key) || b.version - a.version);
    return NextResponse.json({ templates: items });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to load templates", message: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

  let body: { key: string; template: string; version?: number };
  try {
    const raw = await request.json();
    body = raw as { key: string; template: string; version?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.key?.trim() || !body.template?.trim()) {
    return NextResponse.json({ error: "key and template required" }, { status: 400 });
  }

  const db = getScopedDb(ctx);

  try {
    const latest = await db.aIPromptTemplate.findFirst({
      where: { key: body.key },
      orderBy: { version: "desc" },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    await db.aIPromptTemplate.updateMany({
      where: { key: body.key },
      data: { active: false },
    });

    const created = await db.aIPromptTemplate.create({
      data: {
        orgId: ctx.orgId,
        key: body.key.trim(),
        version: body.version ?? nextVersion,
        template: body.template.trim(),
        active: true,
      },
    });
    return NextResponse.json({
      id: created.id,
      key: created.key,
      version: created.version,
      active: created.active,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to create template", message: msg }, { status: 500 });
  }
}
