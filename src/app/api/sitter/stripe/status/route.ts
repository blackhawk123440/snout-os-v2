/**
 * GET /api/sitter/stripe/status
 * Returns Stripe Connect onboarding status for current sitter.
 */

import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";
import { getAccountStatus } from "@/lib/stripe-connect";

export async function GET() {
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

  const db = getScopedDb(ctx);

  try {
    const account = await db.sitterStripeAccount.findFirst({
      where: { sitterId: ctx.sitterId },
    });

    if (!account) {
      return NextResponse.json({
        connected: false,
        onboardingStatus: "pending",
        payoutsEnabled: false,
        chargesEnabled: false,
      });
    }

    // Refresh status from Stripe if onboarding is not yet complete
    if (account.accountId && (!account.payoutsEnabled || account.onboardingStatus !== "complete")) {
      try {
        const liveStatus = await getAccountStatus(account.accountId);
        const newOnboardingStatus = liveStatus.detailsSubmitted ? "complete" : "onboarding";
        if (
          liveStatus.payoutsEnabled !== account.payoutsEnabled ||
          liveStatus.chargesEnabled !== account.chargesEnabled ||
          newOnboardingStatus !== account.onboardingStatus
        ) {
          await db.sitterStripeAccount.update({
            where: { id: account.id },
            data: {
              payoutsEnabled: liveStatus.payoutsEnabled,
              chargesEnabled: liveStatus.chargesEnabled,
              onboardingStatus: newOnboardingStatus,
            },
          });
          return NextResponse.json({
            connected: true,
            accountId: account.accountId,
            onboardingStatus: newOnboardingStatus,
            payoutsEnabled: liveStatus.payoutsEnabled,
            chargesEnabled: liveStatus.chargesEnabled,
          });
        }
      } catch (e) {
        // If Stripe API fails, return cached status
        console.error("[Stripe Status] Failed to refresh from Stripe:", e);
      }
    }

    return NextResponse.json({
      connected: true,
      accountId: account.accountId,
      onboardingStatus: account.onboardingStatus,
      payoutsEnabled: account.payoutsEnabled,
      chargesEnabled: account.chargesEnabled,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load status", message: msg },
      { status: 500 }
    );
  }
}
