/**
 * Pricing Snapshot Helpers
 * 
 * Master Spec Reference: Lines 5.2.1-5.2.4 (Single Source of Truth Rules)
 * 
 * Helper functions for storing and retrieving pricing snapshots from the database.
 */

import type { CanonicalPricingBreakdown, PricingSnapshot } from "./pricing-types";

/**
 * Serialize pricing breakdown to JSON string for database storage
 * 
 * Per Master Spec Line 5.2.1: "The booking stores pricingSnapshot which is the canonical output."
 */
export function serializePricingSnapshot(breakdown: CanonicalPricingBreakdown): string {
  return JSON.stringify(breakdown);
}

/**
 * Deserialize pricing snapshot from database JSON string
 * 
 * Returns null if snapshot is invalid or missing.
 */
export function deserializePricingSnapshot(
  snapshotJson: string | null | undefined
): PricingSnapshot | null {
  if (!snapshotJson || snapshotJson.trim() === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(snapshotJson);
    // Basic validation - ensure it has required fields
    if (typeof parsed.total === 'number' && parsed.metadata) {
      return parsed as PricingSnapshot;
    }
    return null;
  } catch (error) {
    console.error("[PricingSnapshot] Failed to deserialize snapshot:", error);
    return null;
  }
}

/**
 * Get total price from snapshot
 * 
 * Convenience function to extract total from snapshot, with fallback.
 */
export function getTotalFromSnapshot(
  snapshotJson: string | null | undefined,
  fallbackTotal: number
): number {
  const snapshot = deserializePricingSnapshot(snapshotJson);
  if (snapshot && typeof snapshot.total === 'number') {
    return snapshot.total;
  }
  return fallbackTotal;
}

