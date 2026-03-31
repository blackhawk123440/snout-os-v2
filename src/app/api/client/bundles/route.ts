/**
 * GET  /api/client/bundles - List available bundles + client's purchases
 * POST /api/client/bundles - Initiate bundle purchase (creates Stripe Checkout session)
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireRole, requireClientContext, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";
import { loadPurchases, savePurchases, type BundlePurchase } from "@/lib/bundles/bundle-persistence";

const BUNDLES_KEY = "service_bundles";

interface ServiceBundle {
  id: string;
  name: string;
  serviceType: string;
  visitCount: number;
  priceInCents: number;
  discountPercent: number;
  expirationDays: number;
  autoRenew: boolean;
  enabled: boolean;
  createdAt: string;
}

async function loadBundles(db: ReturnType<typeof getScopedDb>): Promise<ServiceBundle[]> {
  const row = await db.setting.findFirst({
    where: { key: BUNDLES_KEY },
  });
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Mark expired / depleted purchases so status stays accurate. */
function refreshStatuses(purchases: BundlePurchase[]): BundlePurchase[] {
  const now = new Date();
  return purchases.map((p) => {
    if (p.status === "active") {
      if (p.remainingVisits <= 0) return { ...p, status: "depleted" as const };
      if (new Date(p.expiresAt) <= now) return { ...p, status: "expired" as const };
    }
    return p;
  });
}

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, "client");
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);

    const [allBundles, allPurchases] = await Promise.all([
      loadBundles(db),
      loadPurchases(db),
    ]);

    const availableBundles = allBundles.filter((b) => b.enabled);
    const clientPurchases = refreshStatuses(
      allPurchases.filter((p) => p.clientId === ctx.clientId && p.status !== "payment_failed" && p.status !== "pending_payment")
    );

    return NextResponse.json({
      bundles: availableBundles,
      purchases: clientPurchases,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load bundles", message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/client/bundles
 * Creates a Stripe Checkout session for the bundle purchase.
 * The purchase is created with status 'pending_payment'.
 * On successful payment (webhook), status transitions to 'active'.
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, "client");
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { bundleId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bundleId = typeof body.bundleId === "string" ? body.bundleId.trim() : "";
  if (!bundleId) {
    return NextResponse.json(
      { error: "Missing required field: bundleId" },
      { status: 400 }
    );
  }

  try {
    const db = getScopedDb(ctx);

    const allBundles = await loadBundles(db);
    const bundle = allBundles.find((b) => b.id === bundleId && b.enabled);
    if (!bundle) {
      return NextResponse.json(
        { error: "Bundle not found or not available" },
        { status: 404 }
      );
    }

    // Create pending purchase
    const allPurchases = await loadPurchases(db);
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + bundle.expirationDays);

    const purchaseId = globalThis.crypto.randomUUID();
    const purchase: BundlePurchase = {
      id: purchaseId,
      bundleId: bundle.id,
      clientId: ctx.clientId,
      remainingVisits: bundle.visitCount,
      purchasedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: "pending_payment",
    };

    // Create Stripe Checkout session
    const { stripe } = await import("@/lib/stripe");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: bundle.name,
              description: `${bundle.visitCount} ${bundle.serviceType} visits (${bundle.discountPercent}% off)`,
            },
            unit_amount: bundle.priceInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingType: "bundle",
        purchaseId,
        bundleId: bundle.id,
        orgId: ctx.orgId,
        clientId: ctx.clientId,
      },
      success_url: `${baseUrl}/client/billing?bundle_purchased=true`,
      cancel_url: `${baseUrl}/client/billing?bundle_cancelled=true`,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    purchase.stripeSessionId = session.id;
    allPurchases.push(purchase);
    await savePurchases(db, ctx.orgId, allPurchases);

    return NextResponse.json({
      checkoutUrl: session.url,
      purchaseId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to initiate bundle purchase", message },
      { status: 500 }
    );
  }
}
