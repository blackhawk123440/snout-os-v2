/**
 * PATCH /api/ops/ai/templates/[id] - Activate a template version (org templates only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAnyRole, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";

export async function PATCH(
  _request: NextRequest,
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

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Template ID required" }, { status: 400 });
  }

  const db = getScopedDb(ctx);

  try {
    const template = await db.aIPromptTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await db.aIPromptTemplate.updateMany({
      where: { key: template.key },
      data: { active: false },
    });
    await db.aIPromptTemplate.update({
      where: { id },
      data: { active: true },
    });
    return NextResponse.json({
      id: template.id,
      key: template.key,
      version: template.version,
      active: true,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to activate template", message: msg },
      { status: 500 }
    );
  }
}
