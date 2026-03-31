/**
 * GET  /api/ops/bundles - List all service bundles for the org
 * POST /api/ops/bundles - Create a new service bundle
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAnyRole, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";

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

async function saveBundles(
  db: ReturnType<typeof getScopedDb>,
  orgId: string,
  bundles: ServiceBundle[]
): Promise<void> {
  await db.setting.upsert({
    where: { orgId_key: { orgId, key: BUNDLES_KEY } },
    create: {
      orgId,
      key: BUNDLES_KEY,
      value: JSON.stringify(bundles),
      category: "bundles",
      label: "Service Bundles",
    },
    update: {
      value: JSON.stringify(bundles),
    },
  });
}

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

  try {
    const db = getScopedDb(ctx);
    const bundles = await loadBundles(db);
    return NextResponse.json({ bundles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load bundles", message },
      { status: 500 }
    );
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

  let body: {
    name?: string;
    serviceType?: string;
    visitCount?: number;
    priceInCents?: number;
    discountPercent?: number;
    expirationDays?: number;
    autoRenew?: boolean;
    enabled?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const serviceType = typeof body.serviceType === "string" ? body.serviceType.trim() : "";
  const visitCount = typeof body.visitCount === "number" ? body.visitCount : 0;
  const priceInCents = typeof body.priceInCents === "number" ? body.priceInCents : 0;

  if (!name || !serviceType || visitCount <= 0 || priceInCents <= 0) {
    return NextResponse.json(
      { error: "Missing required fields: name, serviceType, visitCount (>0), priceInCents (>0)" },
      { status: 400 }
    );
  }

  try {
    const db = getScopedDb(ctx);
    const bundles = await loadBundles(db);

    const newBundle: ServiceBundle = {
      id: globalThis.crypto.randomUUID(),
      name,
      serviceType,
      visitCount,
      priceInCents,
      discountPercent: typeof body.discountPercent === "number" ? body.discountPercent : 0,
      expirationDays: typeof body.expirationDays === "number" ? body.expirationDays : 90,
      autoRenew: typeof body.autoRenew === "boolean" ? body.autoRenew : false,
      enabled: typeof body.enabled === "boolean" ? body.enabled : true,
      createdAt: new Date().toISOString(),
    };

    bundles.push(newBundle);
    await saveBundles(db, ctx.orgId, bundles);

    return NextResponse.json({ bundle: newBundle }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create bundle", message },
      { status: 500 }
    );
  }
}
