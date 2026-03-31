/**
 * Canonical Pricing Types
 * 
 * Master Spec Reference: Lines 5.1.1-5.1.7 (Pricing System Design)
 * 
 * These types define the canonical pricing breakdown schema that is the
 * single source of truth for all pricing calculations.
 */

/**
 * Canonical Pricing Breakdown Schema
 * 
 * This is the single source of truth for pricing calculations.
 * All surfaces must use this structure when USE_PRICING_ENGINE_V1 is enabled.
 */
export interface CanonicalPricingBreakdown {
  // 5.1.1: Subtotal base services
  subtotalBaseServices: number;
  
  // 5.1.2: Add ons
  addOns: Array<{
    name: string;
    amount: number;
    type: "additional_pet" | "holiday" | "after_hours" | "rush" | "travel" | "custom";
    description?: string;
  }>;
  addOnsTotal: number;
  
  // 5.1.3: Fees
  fees: Array<{
    name: string;
    amount: number;
    type: "service_fee" | "platform_fee" | "transaction_fee" | "custom";
    description?: string;
  }>;
  feesTotal: number;
  
  // 5.1.4: Discounts
  discounts: Array<{
    name: string;
    amount: number;
    type: "promo_code" | "loyalty" | "volume" | "manual" | "custom";
    description?: string;
  }>;
  discountsTotal: number;
  
  // 5.1.5: Taxes (if applicable)
  taxes: Array<{
    name: string;
    amount: number;
    rate: number; // Percentage rate
    type: "sales_tax" | "service_tax" | "custom";
    description?: string;
  }>;
  taxesTotal: number;
  
  // 5.1.6: Total
  total: number;
  
  // 5.1.7: Metadata (service codes, durations, quantities, policy flags)
  metadata: {
    service: string;
    serviceCode?: string;
    quantity: number;
    unit: "visit" | "night" | "hour" | "day";
    duration?: number; // In minutes
    petCount: number;
    startAt: string; // ISO 8601
    endAt: string; // ISO 8601
    holidayApplied: boolean;
    afterHoursApplied: boolean;
    pricingVersion: string; // e.g., "v1.0.0"
    calculatedAt: string; // ISO 8601
    calculatedBy?: string; // System identifier
    pricingPolicyFlags?: {
      rushOrder?: boolean;
      travelRequired?: boolean;
      specialHandling?: boolean;
      [key: string]: boolean | undefined;
    };
  };
  
  // Computed totals for convenience (derived from above)
  subtotal: number; // subtotalBaseServices + addOnsTotal
  subtotalAfterDiscounts: number; // subtotal - discountsTotal
  finalTotal: number; // subtotalAfterDiscounts + feesTotal + taxesTotal (same as total)
}

/**
 * Pricing snapshot stored in database
 * 
 * Per Master Spec Line 5.2.1: "The booking stores pricingSnapshot which is the canonical output."
 */
export type PricingSnapshot = CanonicalPricingBreakdown;

