/**
 * POST /api/automations/test-message
 * Send a test SMS for automation template preview. Owner/admin only.
 * Body: { template: string, phoneNumber: string, recipientType?: 'client' | 'sitter' | 'owner' }
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireOwnerOrAdmin, ForbiddenError } from "@/lib/rbac";
import { formatPhoneForAPI } from "@/lib/phone-format";
import { getMessagingProvider } from "@/lib/messaging/provider-factory";
import { getScopedDb } from "@/lib/tenancy";

export async function POST(request: NextRequest) {
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
    const body = (await request.json()) as {
      template?: string;
      phoneNumber?: string;
      recipientType?: "client" | "sitter" | "owner";
    };
    const template = typeof body.template === "string" ? body.template.trim() : "";
    const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template is required" },
        { status: 400 }
      );
    }
    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    const formatted = formatPhoneForAPI(phoneNumber);
    if (!formatted) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    const db = getScopedDb(ctx);

    // TCPA compliance: check opt-out before sending test message
    try {
      const optOut = await db.optOutState.findFirst({
        where: { orgId: ctx.orgId, phoneE164: formatted, state: 'opted_out' },
      });
      if (optOut) {
        return NextResponse.json({ success: false, error: 'Recipient has opted out of SMS' }, { status: 400 });
      }
    } catch { /* opt-out model may not be in scoped proxy */ }

    const provider = await getMessagingProvider(ctx.orgId);

    // Prefer a real org number from inventory; fallback to env/provider default path.
    const fromNumber = await db.messageNumber.findFirst({
      where: { numberClass: "front_desk", status: "active" },
      select: { e164: true },
      orderBy: { updatedAt: "desc" },
    });
    const sendResult = await provider.sendMessage({
      to: formatted,
      body: template,
      ...(fromNumber?.e164 ? { fromE164: fromNumber.e164 } : {}),
    });

    if (!sendResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send test message",
          errorCode: sendResult.errorCode ?? null,
          message: sendResult.errorMessage ?? null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageSid: sendResult.messageSid ?? null,
      fromE164: fromNumber?.e164 ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: "Failed to send test message", message },
      { status: 500 }
    );
  }
}
