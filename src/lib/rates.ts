import { prisma } from "@/lib/db";
import { calculatePriceWithRules } from "./pricing-engine";

export interface Rate {
  base: number;
  addlPet: number;
  holidayAdd: number;       // flat holiday add for this service
  base60?: number;          // optional 60-minute base for non-sitting services
}

export interface QuoteInput {
  service: string;                 // "Drop-ins" | "Walk" | "Housesitting" | "Pet Taxi"
  minutes?: number | null;
  quantity: number;                // visits count for non sitting services
  petCount: number;                // you can keep 1 if you do not collect pets yet
  afterHours: boolean;
  startAt: string;                 // ISO
  endAt: string;                   // ISO
  holidayDatesISO: string[];       // e.g. ["2025-11-27","2025-12-25"]
  rate: Rate;
}

export interface QuoteResult {
  total: number;
  notes: string;
  holidayApplied: boolean;
}

function isHoliday(startISO: string, endISO: string, holidays: Set<string>): boolean {
  // compare as America Chicago calendar dates
  const tz = "America/Chicago";
  const start = new Date(startISO);
  const end = new Date(endISO);
  
  // iterate calendar days from start to end inclusive
  const days: string[] = [];
  let d = new Date(start);
  d.setHours(0, 0, 0, 0);
  
  while (d <= end) {
    // format YYYY-MM-DD in America Chicago
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
    
    // Move to next day
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  
  return days.some(day => holidays.has(day));
}

export function computeQuote(i: QuoteInput): QuoteResult {
  const qty = Math.max(1, i.quantity || 1);
  const addlPets = Math.max(i.petCount - 1, 0);

  // base per visit for non sitting
  let per = i.rate.base;

  // auto apply holiday if any day overlaps your holiday list
  const holidaysSet = new Set(i.holidayDatesISO || []);
  const holidayApplies = isHoliday(i.startAt, i.endAt, holidaysSet);
  if (holidayApplies) per += i.rate.holidayAdd;

  // after hours add if you use it as a flat add
  // keep it zero if you do not want after hours for now
  const afterHoursAdd = i.afterHours ? 0 : 0;
  per += afterHoursAdd;

  // additional pets
  per += addlPets * i.rate.addlPet;

  let total = 0;
  let notes = `Base ${i.service}${i.minutes ? " " + i.minutes + "m" : ""}, pets ${i.petCount}, visits ${qty}`;

  if (i.service === "Housesitting") {
    // housesitting usually priced as a block not by visits
    // overtime removed - no longer adding overtime charges

    // housesitting total is base plus holiday add already included above
    total = per;
    notes += holidayApplies ? " +holiday" : "";
  } else {
    // non sitting multiply by quantity
    total = per * qty;
    notes += holidayApplies ? " +holiday" : "";
    if (i.afterHours) notes += " +after-hours";
  }

  return { 
    total: Number(total.toFixed(2)), 
    notes, 
    holidayApplied: holidayApplies 
  };
}

// Legacy interface for backward compatibility
export interface LegacyRate {
  id: string;
  service: string;
  duration: number;
  price: number;
  description: string;
}

export async function getAllRates(): Promise<LegacyRate[]> {
  // Note: Rate model doesn't exist in messaging dashboard schema
  // Return empty array - rates handled by API service
  return [];
  
  // Disabled code:
  // try {
  //   const rates = await prisma.rate.findMany({
  //     orderBy: { duration: 'asc' }
  //   });
  //   return rates.map((rate: any) => ({
  //     id: rate.id,
  //     service: rate.service,
  //     duration: rate.duration,
  //     price: rate.baseRate,
  //     description: `${rate.service} - ${rate.duration} minutes`,
  //   }));
  // } catch (error) {
  //   console.error("Failed to fetch rates:", error);
  //   return [];
  // }
}

// Default rates configuration
export const DEFAULT_RATES: Record<string, Rate> = {
  "Drop-ins": {
    base: 20,
    base60: 32,
    addlPet: 5,
    holidayAdd: 10,
  },
  "Dog Walking": {
    base: 20,
    base60: 32,
    addlPet: 5,
    holidayAdd: 10,
  },
  "Housesitting": {
    base: 80,
    addlPet: 10,
    holidayAdd: 25,
  },
  "24/7 Care": {
    base: 120,
    addlPet: 10,
    holidayAdd: 25,
  },
  "Pet Taxi": {
    base: 20,
    addlPet: 5,
    holidayAdd: 15,
  },
};

// Default holiday dates for 2025
export const DEFAULT_HOLIDAYS = [
  "2025-01-01", // New Year's Day
  "2025-01-20", // Martin Luther King Jr. Day
  "2025-02-17", // Presidents' Day
  "2025-05-26", // Memorial Day
  "2025-07-04", // Independence Day
  "2025-09-01", // Labor Day
  "2025-10-13", // Columbus Day
  "2025-11-11", // Veterans Day
  "2025-11-27", // Thanksgiving
  "2025-12-25", // Christmas Day
];

export function getRateForService(service: string): Rate | undefined {
  const s = (service || "").toLowerCase().trim();
  const aliases: Record<string, keyof typeof DEFAULT_RATES> = {
    "drop-ins": "Drop-ins",
    "drop ins": "Drop-ins",
    "drop in": "Drop-ins",
    "dog walking": "Dog Walking",
    "walk": "Dog Walking",
    "walking": "Dog Walking",
    "house sitting": "Housesitting",
    "housesitting": "Housesitting",
    "24/7 care": "24/7 Care",
    "24 7 care": "24/7 Care",
    "pet taxi": "Pet Taxi",
    "pet care": "Drop-ins",
    "pet sitting": "Housesitting",
  };
  const key = aliases[s] || (Object.keys(DEFAULT_RATES).find(k => k.toLowerCase() === s) as keyof typeof DEFAULT_RATES | undefined);
  return key ? DEFAULT_RATES[key] : undefined;
}

export async function calculateBookingPrice(
  service: string,
  startAt: Date,
  endAt: Date,
  petCount: number,
  quantity: number = 1,
  afterHours: boolean = false,
  address?: string,
  clientTags?: string[]
): Promise<{ total: number; notes: string; holidayApplied: boolean; pricingDetails?: any }> {
  try {
    const rate = getRateForService(service);
    if (!rate) {
      throw new Error(`No rate found for service: ${service}`);
    }

    const startDate = startAt instanceof Date ? startAt : new Date(startAt);
    const endDate = endAt instanceof Date ? endAt : new Date(endAt);
    
    const quoteInput: QuoteInput = {
      service,
      quantity,
      petCount,
      afterHours,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      holidayDatesISO: DEFAULT_HOLIDAYS,
      rate,
    };

    const baseResult = computeQuote(quoteInput);
    
    // Apply pricing rules from Pricing Engine
    try {
      const pricingContext = {
        service,
        startAt: startDate,
        endAt: endDate,
        petCount,
        quantity,
        afterHours,
        holiday: baseResult.holidayApplied,
        address: address || "",
        clientTags: clientTags || [],
      };

      const pricingResult = await calculatePriceWithRules(baseResult.total, pricingContext);
      
      return {
        total: pricingResult.total,
        notes: baseResult.notes + (pricingResult.fees.length > 0 ? ` +${pricingResult.fees.length} fee(s)` : "") + (pricingResult.discounts.length > 0 ? ` -${pricingResult.discounts.length} discount(s)` : ""),
        holidayApplied: baseResult.holidayApplied,
        pricingDetails: {
          basePrice: pricingResult.basePrice,
          fees: pricingResult.fees,
          discounts: pricingResult.discounts,
          multipliers: pricingResult.multipliers,
          subtotal: pricingResult.subtotal,
        },
      };
    } catch (pricingError) {
      // If pricing engine fails, return base result
      console.error("Pricing engine error (using base price):", pricingError);
      return baseResult;
    }
  } catch (error) {
    console.error("Failed to calculate booking price:", error);
    return { total: 0, notes: "Error calculating price", holidayApplied: false };
  }
}

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}m`;
  } else if (mins === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${mins}m`;
  }
}