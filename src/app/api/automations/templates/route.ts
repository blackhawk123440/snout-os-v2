/**
 * GET /api/automations/templates
 * Returns message templates per automation type (client/sitter/owner) from persisted settings.
 * Owner/admin only, org-scoped.
 */

import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireOwnerOrAdmin, ForbiddenError } from "@/lib/rbac";
import { getAutomationSettings } from "@/lib/automation-utils";
import { AUTOMATION_TYPE_IDS, type AutomationTypeId } from "@/lib/automations/types";

export async function GET() {
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

  try {
    const settings = await getAutomationSettings(ctx.orgId);
    const templates: Record<
      AutomationTypeId,
      { client?: string; sitter?: string; owner?: string }
    > = {} as any;
    for (const id of AUTOMATION_TYPE_IDS) {
      const block = settings[id];
      if (!block || typeof block !== "object") continue;
      templates[id] = {};
      if (typeof block.messageTemplateClient === "string" && block.messageTemplateClient.trim())
        templates[id].client = block.messageTemplateClient;
      if (typeof block.messageTemplateSitter === "string" && block.messageTemplateSitter.trim())
        templates[id].sitter = block.messageTemplateSitter;
      if (typeof block.messageTemplateOwner === "string" && block.messageTemplateOwner.trim())
        templates[id].owner = block.messageTemplateOwner;
    }
    return NextResponse.json(templates);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: "Failed to load templates", message }, { status: 500 });
  }
}
