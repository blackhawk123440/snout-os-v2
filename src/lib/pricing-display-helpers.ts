/**
 * Pricing Display Helpers
 * 
 * Master Spec Reference: Lines 5.2.2 (Display Rules)
 * "Surfaces display pricingSnapshot by default when flag true"
 * 
 * Helper functions for displaying pricing from snapshot or calculating it.
 */

import type { CanonicalPricingBreakdown } from "./pricing-types";
import { deserializePricingSnapshot } from "./pricing-snapshot-helpers";
import { calculatePriceBreakdown } from "./booking-utils";
import { env } from "./env";

/**
 * Get pricing breakdown for display
 * 
 * Per Master Spec Line 5.2.2: "Surfaces display pricingSnapshot by default"
 * When USE_PRICING_ENGINE_V1 is enabled and snapshot exists, use it.
 * Otherwise, fall back to calculatePriceBreakdown for backward compatibility.
 */
export function getPricingForDisplay(booking: {
  service: string;
  startAt: Date | string;
  endAt: Date | string;
  pets: Array<{ species: string }>;
  quantity?: number;
  afterHours?: boolean;
  holiday?: boolean;
  totalPrice?: number | null;
  timeSlots?: Array<{ id?: string; startAt: Date | string; endAt: Date | string; duration: number }>;
  pricingSnapshot?: string | null;
}): {
  total: number;
  breakdown: Array<{ label: string; amount: number; description?: string }>;
  isFromSnapshot: boolean;
} {
  const usePricingEngine = env.USE_PRICING_ENGINE_V1 === true;

  if (usePricingEngine && booking.pricingSnapshot) {
    // Use snapshot when flag is enabled and snapshot exists
    const snapshot = deserializePricingSnapshot(booking.pricingSnapshot);
    if (snapshot) {
      // Convert canonical breakdown to display format
      const breakdown: Array<{ label: string; amount: number; description?: string }> = [];

      // Add base services
      if (snapshot.subtotalBaseServices > 0) {
        breakdown.push({
          label: `${snapshot.metadata.service} (${snapshot.metadata.quantity} ${snapshot.metadata.unit}${snapshot.metadata.quantity > 1 ? 's' : ''})`,
          amount: snapshot.subtotalBaseServices,
          description: `$${snapshot.metadata.service} base`,
        });
      }

      // Add add-ons
      snapshot.addOns.forEach(addon => {
        breakdown.push({
          label: addon.name,
          amount: addon.amount,
          description: addon.description,
        });
      });

      // Add fees
      snapshot.fees.forEach(fee => {
        breakdown.push({
          label: fee.name,
          amount: fee.amount,
          description: fee.description,
        });
      });

      // Add discounts (display as negative)
      snapshot.discounts.forEach(discount => {
        breakdown.push({
          label: discount.name,
          amount: -discount.amount, // Negative for display
          description: discount.description,
        });
      });

      // Add taxes
      snapshot.taxes.forEach(tax => {
        breakdown.push({
          label: tax.name,
          amount: tax.amount,
          description: tax.description || `${tax.rate}%`,
        });
      });

      return {
        total: snapshot.total,
        breakdown,
        isFromSnapshot: true,
      };
    }
  }

  // Fallback to old calculation method
  const oldBreakdown = calculatePriceBreakdown(booking);
  return {
    total: oldBreakdown.total,
    breakdown: oldBreakdown.breakdown,
    isFromSnapshot: false,
  };
}

