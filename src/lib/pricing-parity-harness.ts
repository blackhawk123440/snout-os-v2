/**
 * Pricing Parity Harness
 * 
 * Master Spec Reference: Line 245
 * "Add a PricingParity harness that computes totals using old paths and new engine, 
 * logs differences, does not change charges"
 * 
 * This harness compares pricing calculations from the old path (calculatePriceBreakdown)
 * with the new path (calculateCanonicalPricing) to detect any discrepancies.
 * It does NOT change charges - it only logs differences for verification.
 */

import { calculatePriceBreakdown } from "./booking-utils";
import { calculateCanonicalPricing, type PricingEngineInput } from "./pricing-engine-v1";

export interface ParityComparison {
  bookingId?: string;
  oldTotal: number;
  newTotal: number;
  difference: number;
  differencePercent: number;
  oldBreakdown: {
    basePrice: number;
    additionalPets: number;
    holidayAdd: number;
    afterHoursAdd: number;
    quantity: number;
    total: number;
  };
  newBreakdown: {
    subtotalBaseServices: number;
    addOnsTotal: number;
    feesTotal: number;
    discountsTotal: number;
    taxesTotal: number;
    total: number;
  };
  match: boolean;
  warnings: string[];
}

/**
 * Compare pricing from old path vs new engine
 * 
 * Per master spec line 245: "does not change charges"
 * This function only compares and logs - it does not modify any data.
 */
export function comparePricingPaths(
  input: PricingEngineInput,
  bookingId?: string
): ParityComparison {
  // Calculate using old path (calculatePriceBreakdown)
  const oldBreakdown = calculatePriceBreakdown({
    service: input.service,
    startAt: typeof input.startAt === 'string' ? new Date(input.startAt) : input.startAt,
    endAt: typeof input.endAt === 'string' ? new Date(input.endAt) : input.endAt,
    pets: input.pets,
    quantity: input.quantity,
    afterHours: input.afterHours,
    holiday: input.holiday,
    timeSlots: input.timeSlots?.map(ts => ({
      startAt: typeof ts.startAt === 'string' ? new Date(ts.startAt) : ts.startAt,
      endAt: typeof ts.endAt === 'string' ? new Date(ts.endAt) : ts.endAt,
      duration: ts.duration,
    })),
  });

  // Calculate using new engine (calculateCanonicalPricing)
  const newBreakdown = calculateCanonicalPricing(input);

  const oldTotal = oldBreakdown.total;
  const newTotal = newBreakdown.total;
  const difference = Math.abs(newTotal - oldTotal);
  const differencePercent = oldTotal > 0 ? (difference / oldTotal) * 100 : 0;
  const match = difference < 0.01; // Consider match if difference is less than 1 cent

  const warnings: string[] = [];
  
  if (!match) {
    warnings.push(`Pricing mismatch: old=${oldTotal.toFixed(2)}, new=${newTotal.toFixed(2)}, diff=$${difference.toFixed(2)} (${differencePercent.toFixed(2)}%)`);
  }

  // Check for structural differences
  const oldAddOnsTotal = oldBreakdown.additionalPets + oldBreakdown.holidayAdd + oldBreakdown.afterHoursAdd;
  const newAddOnsTotal = newBreakdown.addOnsTotal;
  
  if (Math.abs(oldAddOnsTotal - newAddOnsTotal) > 0.01) {
    warnings.push(`Add-ons total mismatch: old=${oldAddOnsTotal.toFixed(2)}, new=${newAddOnsTotal.toFixed(2)}`);
  }

  if (Math.abs(oldBreakdown.basePrice - newBreakdown.subtotalBaseServices) > 0.01) {
    warnings.push(`Base price mismatch: old=${oldBreakdown.basePrice.toFixed(2)}, new=${newBreakdown.subtotalBaseServices.toFixed(2)}`);
  }

  return {
    bookingId,
    oldTotal,
    newTotal,
    difference,
    differencePercent,
    oldBreakdown: {
      basePrice: oldBreakdown.basePrice,
      additionalPets: oldBreakdown.additionalPets,
      holidayAdd: oldBreakdown.holidayAdd,
      afterHoursAdd: oldBreakdown.afterHoursAdd,
      quantity: oldBreakdown.quantity,
      total: oldBreakdown.total,
    },
    newBreakdown: {
      subtotalBaseServices: newBreakdown.subtotalBaseServices,
      addOnsTotal: newBreakdown.addOnsTotal,
      feesTotal: newBreakdown.feesTotal,
      discountsTotal: newBreakdown.discountsTotal,
      taxesTotal: newBreakdown.taxesTotal,
      total: newBreakdown.total,
    },
    match,
    warnings,
  };
}

/**
 * Log parity comparison results
 * 
 * Per master spec line 245: "logs differences"
 * This function logs the comparison results for monitoring and verification.
 */
export function logParityComparison(comparison: ParityComparison): void {
  if (comparison.match) {
    console.log(`[PricingParity] ✅ Match for booking ${comparison.bookingId || 'unknown'}: $${comparison.oldTotal.toFixed(2)}`);
  } else {
    console.warn(`[PricingParity] ⚠️  Mismatch for booking ${comparison.bookingId || 'unknown'}:`, {
      oldTotal: comparison.oldTotal,
      newTotal: comparison.newTotal,
      difference: comparison.difference,
      differencePercent: comparison.differencePercent,
      warnings: comparison.warnings,
    });
  }
}

/**
 * Compare and log pricing paths (convenience function)
 */
export function compareAndLogPricing(
  input: PricingEngineInput,
  bookingId?: string
): ParityComparison {
  const comparison = comparePricingPaths(input, bookingId);
  logParityComparison(comparison);
  return comparison;
}

