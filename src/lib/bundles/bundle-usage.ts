/**
 * Bundle usage/depletion logic.
 *
 * When a booking completes, checks if the client has an active bundle
 * matching the service type. If so, decrements remainingVisits.
 * When visits hit 0, status transitions to 'depleted'.
 */

import type { PrismaClient } from '@prisma/client';

const PURCHASES_KEY = 'client_bundle_purchases';
const BUNDLES_KEY = 'service_bundles';

interface BundlePurchase {
  id: string;
  bundleId: string;
  clientId: string;
  remainingVisits: number;
  purchasedAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'depleted';
}

interface ServiceBundle {
  id: string;
  serviceType: string;
  [key: string]: unknown;
}

/**
 * Try to use a bundle visit for a completed booking.
 * Returns the updated purchase if a visit was deducted, null otherwise.
 */
export async function tryUseBundleVisit(
  db: PrismaClient,
  orgId: string,
  clientId: string,
  serviceType: string,
  bookingId: string
): Promise<{ used: boolean; purchaseId?: string; remaining?: number } | null> {
  try {
    // Load bundles to get service type mapping
    const bundlesRow = await (db as any).setting.findFirst({ where: { key: BUNDLES_KEY } });
    const bundles: ServiceBundle[] = bundlesRow?.value ? JSON.parse(bundlesRow.value) : [];

    // Load purchases
    const purchasesRow = await (db as any).setting.findFirst({ where: { key: PURCHASES_KEY } });
    const allPurchases: BundlePurchase[] = purchasesRow?.value ? JSON.parse(purchasesRow.value) : [];

    // Find active purchase for this client matching the service type
    const now = new Date();
    const matchingPurchase = allPurchases.find((p) => {
      if (p.clientId !== clientId || p.status !== 'active' || p.remainingVisits <= 0) return false;
      if (new Date(p.expiresAt) <= now) return false;
      const bundle = bundles.find((b) => b.id === p.bundleId);
      return bundle?.serviceType?.toLowerCase() === serviceType?.toLowerCase();
    });

    if (!matchingPurchase) {
      return { used: false };
    }

    // Decrement
    matchingPurchase.remainingVisits -= 1;
    if (matchingPurchase.remainingVisits <= 0) {
      matchingPurchase.status = 'depleted';
    }

    // Persist
    await (db as any).setting.upsert({
      where: { orgId_key: { orgId, key: PURCHASES_KEY } },
      create: {
        orgId,
        key: PURCHASES_KEY,
        value: JSON.stringify(allPurchases),
        category: 'bundles',
        label: 'Client Bundle Purchases',
      },
      update: {
        value: JSON.stringify(allPurchases),
      },
    });

    // Mark booking as covered by bundle — set paymentStatus to 'paid' and zero out amount
    await (db as any).booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'paid',
        notes: (await (db as any).booking.findUnique({ where: { id: bookingId }, select: { notes: true } })
          .then((b: any) => b?.notes || '')).concat(
          `\n[Bundle] Visit covered by bundle ${matchingPurchase.bundleId} (purchase ${matchingPurchase.id})`
        ).trim(),
      },
    }).catch(() => {});

    // Log
    await (db as any).eventLog.create({
      data: {
        orgId,
        eventType: 'bundle.visit_used',
        status: 'success',
        bookingId,
        metadata: JSON.stringify({
          clientId,
          purchaseId: matchingPurchase.id,
          bundleId: matchingPurchase.bundleId,
          remainingVisits: matchingPurchase.remainingVisits,
          serviceType,
          depleted: matchingPurchase.status === 'depleted',
        }),
      },
    }).catch(() => {});

    return {
      used: true,
      purchaseId: matchingPurchase.id,
      remaining: matchingPurchase.remainingVisits,
    };
  } catch (error) {
    console.error('[bundle-usage] Failed to deduct bundle visit:', error);
    return null;
  }
}
