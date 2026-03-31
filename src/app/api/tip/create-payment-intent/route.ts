import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";

const TIP_RATE_LIMIT = {
  keyPrefix: "tip-create",
  limit: 10,
  windowSec: 300, // 10 tip attempts per 5 minutes per IP
};

/**
 * POST /api/tip/create-payment-intent
 * Creates a Stripe PaymentIntent for a tip payment.
 * Public endpoint — tip pages are client-facing without login.
 *
 * Body: { amount: number (cents), currency: string, metadata?: Record<string, string> }
 * Returns: { clientSecret: string }
 */
export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit(ip, TIP_RATE_LIMIT);
  if (!rl.success) {
    return NextResponse.json(
      { error: { message: "Too many tip attempts. Please try again later." } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 300) } }
    );
  }

  try {
    const body = await request.json();
    const { amount, currency = "usd", metadata = {} } = body;

    if (!amount || typeof amount !== "number" || amount < 50) {
      return NextResponse.json(
        { error: { message: "Tip amount must be at least $0.50 (50 cents)" } },
        { status: 400 }
      );
    }

    if (amount > 100000) {
      return NextResponse.json(
        { error: { message: "Tip amount exceeds maximum allowed ($1,000)" } },
        { status: 400 }
      );
    }

    const idempotencyKey = request.headers.get("X-Idempotency-Key") || undefined;

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(amount),
        currency,
        metadata: {
          ...metadata,
          type: "tip",
        },
      },
      idempotencyKey ? { idempotencyKey } : undefined
    );

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: unknown) {
    console.error("[tip/create-payment-intent] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create payment intent";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
