import { NextResponse } from "next/server";

/**
 * GET /api/tip/config
 * Returns Stripe publishable key for client-side Stripe Elements initialization.
 * Public endpoint — no auth required (tip pages are public-facing).
 */
export async function GET() {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return NextResponse.json(
      { error: "Stripe publishable key not configured" },
      { status: 500 }
    );
  }

  return NextResponse.json({ publishableKey });
}
