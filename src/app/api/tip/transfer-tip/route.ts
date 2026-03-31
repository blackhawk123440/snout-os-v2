import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPublicOrgContext } from "@/lib/request-context";

const TRANSFER_RATE_LIMIT = {
  keyPrefix: "tip-transfer",
  limit: 20,
  windowSec: 300, // 20 transfer attempts per 5 minutes per IP
};

/**
 * POST /api/tip/transfer-tip
 * Transfers tip funds to sitter's connected Stripe account after successful payment.
 * Called from /tip/success page after payment confirmation.
 * Idempotent: if webhook already transferred, returns existing transfer ID.
 *
 * Body: { paymentIntentId: string, sitterId: string }
 */
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit(ip, TRANSFER_RATE_LIMIT);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 300) } }
    );
  }

  try {
    const body = await request.json();
    const { paymentIntentId, sitterId } = body;

    if (!paymentIntentId || !sitterId) {
      return NextResponse.json(
        { error: "paymentIntentId and sitterId are required" },
        { status: 400 }
      );
    }

    // Verify payment intent succeeded
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: `Payment not yet succeeded (status: ${paymentIntent.status})` },
        { status: 400 }
      );
    }

    // Prevent double-transfer: check metadata for existing transfer
    if (paymentIntent.metadata?.transfer_id) {
      return NextResponse.json({
        ok: true,
        transferId: paymentIntent.metadata.transfer_id,
        message: "Transfer already completed",
      });
    }

    // Scope to org for tenant isolation
    const { orgId } = getPublicOrgContext(request);

    // Look up sitter's connected Stripe account
    // sitterId could be a Stripe account ID (acct_xxx) or a sitter record ID
    let destinationAccountId: string | null = null;

    if (sitterId.startsWith("acct_")) {
      destinationAccountId = sitterId;
    } else {
      // Try looking up by sitter ID — scoped to org
      const sitter = await prisma.sitter.findFirst({
        where: { id: sitterId, orgId },
        select: { id: true },
      });
      if (sitter) {
        const stripeAccount = await prisma.sitterStripeAccount.findFirst({
          where: { sitterId: sitter.id, payoutsEnabled: true },
          select: { accountId: true },
        });
        if (stripeAccount) {
          destinationAccountId = stripeAccount.accountId;
        }
      }

      // If not found by ID, try looking up sitter by name alias — scoped to org
      if (!destinationAccountId) {
        const nameParts = sitterId.split("-");
        if (nameParts.length >= 2) {
          const sitters = await prisma.sitter.findMany({
            where: { orgId },
            select: { id: true, firstName: true, lastName: true },
          });
          const match = sitters.find((s) => {
            const fullName = [s.firstName, s.lastName]
              .filter(Boolean)
              .join("-")
              .toLowerCase();
            return fullName === sitterId.toLowerCase();
          });
          if (match) {
            const account = await prisma.sitterStripeAccount.findFirst({
              where: { sitterId: match.id, payoutsEnabled: true },
              select: { accountId: true },
            });
            destinationAccountId = account?.accountId ?? null;
          }
        }
      }
    }

    if (!destinationAccountId) {
      // Log for ops visibility but don't fail the user experience
      console.error(
        `[tip/transfer-tip] No connected Stripe account found for sitter: ${sitterId}`
      );
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sitter does not have a connected Stripe account. Tip was collected and will be transferred manually.",
        },
        { status: 200 }
      );
    }

    // Create transfer to connected account (100% of tip goes to sitter)
    const transfer = await stripe.transfers.create({
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      destination: destinationAccountId,
      source_transaction: paymentIntent.latest_charge as string,
      description: `Tip from ${paymentIntent.metadata?.payer_name || "client"}`,
      metadata: {
        payment_intent_id: paymentIntentId,
        sitter_id: sitterId,
        type: "tip_transfer",
      },
    });

    // Update payment intent metadata with transfer ID to prevent double-transfer
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        ...paymentIntent.metadata,
        transfer_id: transfer.id,
      },
    });

    return NextResponse.json({ ok: true, transferId: transfer.id });
  } catch (error: unknown) {
    console.error("[tip/transfer-tip] Error:", error);
    const message =
      error instanceof Error ? error.message : "Transfer failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
