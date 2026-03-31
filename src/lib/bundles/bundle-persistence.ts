/**
 * Shared bundle persistence helpers.
 * Used by both the client bundles API and the Stripe webhook.
 */

import type { PrismaClient } from '@prisma/client';

const BUNDLES_KEY = 'service_bundles';
const PURCHASES_KEY = 'client_bundle_purchases';

export interface BundlePurchase {
  id: string;
  bundleId: string;
  clientId: string;
  remainingVisits: number;
  purchasedAt: string;
  expiresAt: string;
  status: 'pending_payment' | 'active' | 'expired' | 'depleted' | 'payment_failed';
  stripeSessionId?: string;
}

export async function loadPurchases(db: PrismaClient | any): Promise<BundlePurchase[]> {
  const row = await db.setting.findFirst({ where: { key: PURCHASES_KEY } });
  if (!row) return [];
  try {
    return JSON.parse(row.value);
  } catch {
    return [];
  }
}

export async function savePurchases(
  db: PrismaClient | any,
  orgId: string,
  purchases: BundlePurchase[]
): Promise<void> {
  await db.setting.upsert({
    where: { orgId_key: { orgId, key: PURCHASES_KEY } },
    create: { orgId, key: PURCHASES_KEY, value: JSON.stringify(purchases), category: 'bundles', label: 'Client Bundle Purchases' },
    update: { value: JSON.stringify(purchases) },
  });
}
