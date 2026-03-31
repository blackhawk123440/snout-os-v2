/**
 * POST /api/sitter/stripe/connect
 * Creates or returns Stripe Connect onboarding link for sitter.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";
import { createConnectAccount } from "@/lib/stripe-connect";

export async function POST(request: NextRequest) {
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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const returnUrl = `${baseUrl}/sitter/profile?stripe=return`;
  const refreshUrl = `${baseUrl}/sitter/profile?stripe=refresh`;

  const db = getScopedDb(ctx);

  try {
    const sitter = await db.sitter.findUnique({
      where: { id: ctx.sitterId },
      select: { email: true },
    });
    if (!sitter?.email) {
      return NextResponse.json(
        { error: "Sitter email required for Stripe Connect" },
        { status: 400 }
      );
    }

    const existing = await db.sitterStripeAccount.findFirst({
      where: { sitterId: ctx.sitterId },
    });

    let accountId: string;
    let onboardingUrl: string | null;

    if (existing?.accountId) {
      const { createAccountLink } = await import("@/lib/stripe-connect");
      accountId = existing.accountId;
      onboardingUrl = await createAccountLink({
        accountId: existing.accountId,
        returnUrl,
        refreshUrl,
      });
      await db.sitterStripeAccount.update({
        where: { id: existing.id },
        data: { onboardingStatus: "onboarding" },
      });
    } else {
      const result = await createConnectAccount({
        email: sitter.email,
        returnUrl,
        refreshUrl,
      });
      accountId = result.accountId;
      onboardingUrl = result.onboardingUrl;
      await db.sitterStripeAccount.create({
        data: {
          orgId: ctx.orgId,
          sitterId: ctx.sitterId,
          accountId,
          onboardingStatus: "onboarding",
          payoutsEnabled: false,
          chargesEnabled: false,
        },
      });
    }

    return NextResponse.json({
      accountId,
      onboardingUrl,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Stripe Connect] Failed:", msg);
    return NextResponse.json(
      { error: "Failed to create Connect account", message: msg },
      { status: 500 }
    );
  }
}
