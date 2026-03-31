/**
 * Pricing Engine v1 - Canonical Pricing Calculation
 * 
 * Master Spec Reference: Lines 241-251 (Phase 2), Lines 5.1-5.3 (Pricing System Design)
 * 
 * This is the single source of truth for pricing calculations when USE_PRICING_ENGINE_V1 is enabled.
 * Outputs canonical pricing breakdown schema as defined in master spec.
 */

import { getRateForService, DEFAULT_HOLIDAYS } from "./rates";
import type { CanonicalPricingBreakdown } from "./pricing-types";

/**
 * Input for pricing calculation
 */
export interface PricingEngineInput {
  service: string;
  startAt: Date | string;
  endAt: Date | string;
  pets: Array<{ species: string }>;
  quantity?: number;
  afterHours?: boolean;
  holiday?: boolean;
  timeSlots?: Array<{ 
    id?: string; 
    startAt: Date | string; 
    endAt: Date | string; 
    duration: number;
  }>;
  // Optional: For future expansion
  clientId?: string;
  zipCode?: string;
  promoCode?: string;
}

/**
 * Calculate canonical pricing breakdown using PricingEngine v1
 * 
 * This function implements the canonical pricing breakdown schema as defined
 * in the master spec (Lines 5.1.1-5.1.7).
 */
export function calculateCanonicalPricing(
  input: PricingEngineInput
): CanonicalPricingBreakdown {
  const startDate = input.startAt instanceof Date ? input.startAt : new Date(input.startAt);
  const endDate = input.endAt instanceof Date ? input.endAt : new Date(input.endAt);
  const petCount = input.pets.length;
  const quantity = input.quantity || 1;
  const afterHours = input.afterHours || false;
  
  // Get rate for service
  const rate = getRateForService(input.service);
  if (!rate) {
    // Return zero breakdown if service not found
    return createZeroBreakdown(input, "Service rate not found");
  }

  // Determine if holiday applies
  const holidayApplied = input.holiday !== undefined 
    ? input.holiday 
    : checkHoliday(startDate, endDate);

  // Initialize breakdown
  const addOns: CanonicalPricingBreakdown["addOns"] = [];
  const fees: CanonicalPricingBreakdown["fees"] = [];
  const discounts: CanonicalPricingBreakdown["discounts"] = [];
  const taxes: CanonicalPricingBreakdown["taxes"] = [];

  // Calculate base services subtotal
  let subtotalBaseServices = 0;
  
  const isHouseSittingService = input.service === "Housesitting" || input.service === "24/7 Care";
  
  if (isHouseSittingService) {
    // House sitting: price per night
    const nights = calculateNights(startDate, endDate);
    subtotalBaseServices = rate.base * nights;
    
    // Add additional pets as add-on (per night)
    const additionalPets = Math.max(petCount - 1, 0);
    if (additionalPets > 0) {
      const additionalPetsAmount = additionalPets * rate.addlPet * nights;
      addOns.push({
        name: `Additional Pets (${additionalPets})`,
        amount: additionalPetsAmount,
        type: "additional_pet",
        description: `$${rate.addlPet} × ${additionalPets} × ${nights} nights`,
      });
    }
    
    // Add holiday add-on (per night)
    if (holidayApplied) {
      const holidayAmount = rate.holidayAdd * nights;
      addOns.push({
        name: "Holiday Rate",
        amount: holidayAmount,
        type: "holiday",
        description: `$${rate.holidayAdd} × ${nights} nights`,
      });
    }
  } else {
    // Visit-based services: price per time slot
    const timeSlots = input.timeSlots || [];
    const hasTimeSlots = timeSlots.length > 0;
    
    if (hasTimeSlots) {
      // Calculate based on actual time slots (30min vs 60min)
      let count30 = 0;
      let count60 = 0;
      
      timeSlots.forEach(ts => {
        const duration = typeof ts.duration === 'number' ? ts.duration : 30;
        if (duration >= 60) count60++;
        else count30++;
      });
      
      const per30 = rate.base;
      const per60 = rate.base60 ?? rate.base;
      
      subtotalBaseServices = (count30 * per30) + (count60 * per60);
      
      // Add additional pets as add-on (per visit)
      const additionalPets = Math.max(petCount - 1, 0);
      if (additionalPets > 0) {
        const visits = count30 + count60;
        const additionalPetsAmount = additionalPets * rate.addlPet * visits;
        addOns.push({
          name: `Additional Pets (${additionalPets})`,
          amount: additionalPetsAmount,
          type: "additional_pet",
          description: `$${rate.addlPet} × ${additionalPets} × ${visits} visits`,
        });
      }
      
      // Add holiday add-on (per visit)
      if (holidayApplied) {
        const visits = count30 + count60;
        const holidayAmount = rate.holidayAdd * visits;
        addOns.push({
          name: "Holiday Rate",
          amount: holidayAmount,
          type: "holiday",
          description: `$${rate.holidayAdd} × ${visits} visits`,
        });
      }
    } else {
      // Fallback: use quantity
      subtotalBaseServices = rate.base * quantity;
      
      // Add additional pets as add-on
      const additionalPets = Math.max(petCount - 1, 0);
      if (additionalPets > 0) {
        const additionalPetsAmount = additionalPets * rate.addlPet * quantity;
        addOns.push({
          name: `Additional Pets (${additionalPets})`,
          amount: additionalPetsAmount,
          type: "additional_pet",
          description: `$${rate.addlPet} × ${additionalPets} × ${quantity} visits`,
        });
      }
      
      // Add holiday add-on
      if (holidayApplied) {
        const holidayAmount = rate.holidayAdd * quantity;
        addOns.push({
          name: "Holiday Rate",
          amount: holidayAmount,
          type: "holiday",
          description: `$${rate.holidayAdd} × ${quantity} visits`,
        });
      }
    }
    
    // Add after-hours add-on (if applicable)
    if (afterHours) {
      // Currently no after-hours charge, but structure is in place
      // addOns.push({ name: "After Hours", amount: 0, type: "after_hours" });
    }
  }

  // Calculate totals
  const addOnsTotal = addOns.reduce((sum, addon) => sum + addon.amount, 0);
  const feesTotal = fees.reduce((sum, fee) => sum + fee.amount, 0);
  const discountsTotal = discounts.reduce((sum, discount) => sum + discount.amount, 0);
  const taxesTotal = taxes.reduce((sum, tax) => sum + tax.amount, 0);
  
  const subtotal = subtotalBaseServices + addOnsTotal;
  const subtotalAfterDiscounts = subtotal - discountsTotal;
  const finalTotal = subtotalAfterDiscounts + feesTotal + taxesTotal;

  // Determine unit and duration
  const unit = isHouseSittingService ? "night" : "visit";
  const duration = isHouseSittingService 
    ? calculateNights(startDate, endDate) * 24 * 60 // Convert nights to minutes
    : input.timeSlots?.[0]?.duration || 30;

  // Build metadata
  const metadata: CanonicalPricingBreakdown["metadata"] = {
    service: input.service,
    quantity: isHouseSittingService ? calculateNights(startDate, endDate) : (input.timeSlots?.length || quantity),
    unit: unit as "visit" | "night",
    duration,
    petCount,
    startAt: startDate.toISOString(),
    endAt: endDate.toISOString(),
    holidayApplied,
    afterHoursApplied: afterHours,
    pricingVersion: "v1.0.0",
    calculatedAt: new Date().toISOString(),
    calculatedBy: "pricing-engine-v1",
  };

  return {
    subtotalBaseServices,
    addOns,
    addOnsTotal,
    fees,
    feesTotal,
    discounts,
    discountsTotal,
    taxes,
    taxesTotal,
    total: finalTotal,
    subtotal,
    subtotalAfterDiscounts,
    finalTotal,
    metadata,
  };
}

/**
 * Helper: Calculate number of nights between dates
 */
function calculateNights(start: Date, end: Date): number {
  const startCalendarDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endCalendarDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diffTime = endCalendarDay.getTime() - startCalendarDay.getTime();
  const calendarDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, calendarDays - 1); // Nights = days - 1
}

/**
 * Helper: Check if holiday applies to date range
 */
function checkHoliday(start: Date, end: Date): boolean {
  const holidaysSet = new Set(DEFAULT_HOLIDAYS);
  const tz = "America/Chicago";
  
  const days: string[] = [];
  let d = new Date(start);
  d.setHours(0, 0, 0, 0);
  
  while (d <= end) {
    const parts = new Intl.DateTimeFormat("en-CA", { 
      timeZone: tz, 
      year: "numeric", 
      month: "2-digit", 
      day: "2-digit" 
    }).formatToParts(d);
    
    const y = parts.find(p => p.type === "year")!.value;
    const m = parts.find(p => p.type === "month")!.value;
    const da = parts.find(p => p.type === "day")!.value;
    days.push(`${y}-${m}-${da}`);
    
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  
  return days.some(day => holidaysSet.has(day));
}

/**
 * Helper: Create zero breakdown for error cases
 */
function createZeroBreakdown(
  input: PricingEngineInput,
  reason: string
): CanonicalPricingBreakdown {
  const startDate = input.startAt instanceof Date ? input.startAt : new Date(input.startAt);
  const endDate = input.endAt instanceof Date ? input.endAt : new Date(input.endAt);
  
  return {
    subtotalBaseServices: 0,
    addOns: [],
    addOnsTotal: 0,
    fees: [],
    feesTotal: 0,
    discounts: [],
    discountsTotal: 0,
    taxes: [],
    taxesTotal: 0,
    total: 0,
    subtotal: 0,
    subtotalAfterDiscounts: 0,
    finalTotal: 0,
    metadata: {
      service: input.service,
      quantity: input.quantity || 1,
      unit: "visit",
      petCount: input.pets.length,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      holidayApplied: false,
      afterHoursApplied: false,
      pricingVersion: "v1.0.0",
      calculatedAt: new Date().toISOString(),
      calculatedBy: "pricing-engine-v1",
      pricingPolicyFlags: {},
    },
  };
}

