/**
 * Form to Booking Mapper
 * 
 * Maps raw booking form payloads into canonical BookingCreateInput with explicit precedence rules.
 * This is Phase 1 of the form-to-dashboard wiring reconstruction.
 * 
 * Mapping Version: v1.0.0
 * 
 * Precedence Rules (Locked):
 * - Notes: specialInstructions > additionalNotes > notes (store all three in metadata)
 * - Timezone: Use payload timezone if present, else default to America/Chicago
 * - Quantity: Deterministic based on service type and time slots
 * - Pricing: Not changed in Phase 1, only maps inputs (captures form estimate in metadata)
 */

import { formatPhoneForAPI } from "./phone-format";
import {
  FormBookingPayload,
  RequestMetadata,
  validateFormPayload,
  VALID_SERVICES,
} from "./validation/form-booking";

/**
 * Mapping version for tracking
 */
export const MAPPING_VERSION = "v1.0.0";

/**
 * Default business timezone (America/Chicago)
 */
const DEFAULT_TIMEZONE = "America/Chicago";

/**
 * Raw notes fields stored for forensic traceability
 */
export interface RawNotesMetadata {
  specialInstructions: string | null;
  additionalNotes: string | null;
  notes: string | null;
  selectedField: "specialInstructions" | "additionalNotes" | "notes" | null;
}

/**
 * Mapping report for observability
 */
export interface MappingReport {
  version: string;
  normalizedFields: {
    service: string;
    phone: string;
    email: string | null;
    quantity: number;
    notes: string | null;
    timezone: string;
    startAt: string;
    endAt: string;
  };
  warnings: string[];
  notesPrecedence: {
    selectedField: "specialInstructions" | "additionalNotes" | "notes" | null;
    rawNotesMetadata: RawNotesMetadata;
  };
  timezoneConversion: {
    sourceTimezone: string;
    rawStartAt?: string;
    rawEndAt?: string;
    computedStartAt: string;
    computedEndAt: string;
  };
  quantityCalculation: {
    serviceType: string;
    method: string;
    inputValue?: number;
    computedValue: number;
  };
  pricingMetadata?: {
    formEstimate?: number;
    note: string;
  };
}

/**
 * Canonical BookingCreateInput type
 * Note: Booking model not available in messaging dashboard schema
 * This is a generic booking input interface for form mapping
 */
export interface BookingCreateInput {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  service: string;
  startAt: Date | string;
  endAt: Date | string;
  quantity?: number;
  notes?: string | null;
  afterHours?: boolean;
  holiday?: boolean;
  pets?: Array<{ name: string; species: string }>;
  timeSlots?: Array<{ startAt: Date | string; endAt: Date | string; duration?: number }>;
  totalPrice?: number;
  status?: string;
  paymentStatus?: string;
  [key: string]: any; // Allow additional fields
}

/**
 * Convert 12-hour time string to 24-hour format
 */
function convertTo24Hour(time12h: string | undefined | null): string {
  if (!time12h) return "09:00:00";
  
  const [time, modifier] = time12h.split(" ");
  let [hours, minutes] = time.split(":");
  
  if (hours === "12") hours = "00";
  if (modifier === "PM") {
    hours = String(parseInt(hours, 10) + 12).padStart(2, "0");
  }
  
  return `${String(hours).padStart(2, "0")}:${minutes || "00"}:00`;
}

/**
 * Create Date in timezone, treating local time as UTC (preserves time components)
 * This matches the existing API behavior but makes it explicit.
 */
function createDateInTimezone(dateStr: string, time24h: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = time24h.split(":").map(Number);
  
  // Create ISO string treating local time as UTC (preserves components)
  const isoString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00.000Z`;
  return new Date(isoString);
}

/**
 * Apply notes precedence rule:
 * 1. specialInstructions (if non-empty)
 * 2. additionalNotes (if non-empty)
 * 3. notes (if non-empty)
 * 4. null
 */
function resolveNotes(
  specialInstructions: string | null | undefined,
  additionalNotes: string | null | undefined,
  notes: string | null | undefined
): { selected: string | null; metadata: RawNotesMetadata } {
  const trimmedSpecial = specialInstructions?.trim() || null;
  const trimmedAdditional = additionalNotes?.trim() || null;
  const trimmedNotes = notes?.trim() || null;
  
  const metadata: RawNotesMetadata = {
    specialInstructions: trimmedSpecial,
    additionalNotes: trimmedAdditional,
    notes: trimmedNotes,
    selectedField: null,
  };
  
  // Precedence rule: specialInstructions > additionalNotes > notes
  if (trimmedSpecial) {
    metadata.selectedField = "specialInstructions";
    return { selected: trimmedSpecial, metadata };
  }
  
  if (trimmedAdditional) {
    metadata.selectedField = "additionalNotes";
    return { selected: trimmedAdditional, metadata };
  }
  
  if (trimmedNotes) {
    metadata.selectedField = "notes";
    return { selected: trimmedNotes, metadata };
  }
  
  return { selected: null, metadata };
}

/**
 * Resolve timezone: use payload timezone if present, else default to America/Chicago
 */
function resolveTimezone(
  payloadTimezone?: string | null,
  metadataTimezone?: string | null
): string {
  return payloadTimezone || metadataTimezone || DEFAULT_TIMEZONE;
}

/**
 * Calculate quantity deterministically based on service type and time slots
 */
function calculateQuantity(
  service: string,
  selectedDates: string[] | undefined,
  timeSlotsCount: number
): number {
  const isHouseSitting = service === "Housesitting" || service === "24/7 Care";
  
  if (isHouseSitting && selectedDates && selectedDates.length > 1) {
    // For house sitting: quantity = number of nights (days - 1)
    return selectedDates.length - 1;
  } else {
    // For other services: quantity = number of time slots
    return timeSlotsCount > 0 ? timeSlotsCount : 1;
  }
}

/**
 * Build time slots array from selectedDates and dateTimes
 */
function buildTimeSlots(
  selectedDates: string[] | undefined,
  dateTimes: Record<string, Array<{ time?: string; duration?: number; timeValue?: string; durationValue?: number }>> | undefined
): Array<{ startAt: Date; endAt: Date; duration: number }> {
  const timeSlots: Array<{ startAt: Date; endAt: Date; duration: number }> = [];
  
  if (!selectedDates || selectedDates.length === 0 || !dateTimes) {
    return timeSlots;
  }
  
  selectedDates.forEach((dateStr: string) => {
    const times = dateTimes[dateStr];
    if (!Array.isArray(times) || times.length === 0) {
      return;
    }
    
    times.forEach((timeEntry) => {
      const timeValue = timeEntry?.time || timeEntry?.timeValue;
      const durationValue = timeEntry?.duration || timeEntry?.durationValue || 30;
      
      if (typeof timeValue === "string" && timeValue.includes(":")) {
        const time24h = convertTo24Hour(timeValue);
        const duration = typeof durationValue === "number" ? durationValue : 30;
        
        const startDateTime = createDateInTimezone(dateStr, time24h);
        const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
        
        timeSlots.push({
          startAt: startDateTime,
          endAt: endDateTime,
          duration,
        });
      }
    });
  });
  
  return timeSlots;
}

/**
 * Calculate booking start/end dates for house sitting services
 */
function calculateHouseSittingDates(
  selectedDates: string[],
  dateTimes: Record<string, Array<{ time?: string; timeValue?: string }>> | undefined
): { startAt: Date; endAt: Date } {
  const sortedDates = [...selectedDates].sort();
  const firstDate = sortedDates[0];
  const lastDate = sortedDates[sortedDates.length - 1];
  
  // Get first time from first date
  const firstDateTimes = dateTimes?.[firstDate] || [];
  const firstTime = firstDateTimes.length > 0 ? firstDateTimes[0] : null;
  const firstTimeValue = firstTime?.time || firstTime?.timeValue;
  const firstTime24h = convertTo24Hour(firstTimeValue);
  const startAt = createDateInTimezone(firstDate, firstTime24h);
  
  // Get last time from last date
  const lastDateTimes = dateTimes?.[lastDate] || [];
  const lastTime = lastDateTimes.length > 0 ? lastDateTimes[lastDateTimes.length - 1] : null;
  const lastTimeValue = lastTime?.time || lastTime?.timeValue;
  
  let endAt: Date;
  if (lastTimeValue) {
    const lastTime24h = convertTo24Hour(lastTimeValue);
    endAt = createDateInTimezone(lastDate, lastTime24h);
  } else {
    // Default to end of day
    endAt = createDateInTimezone(lastDate, "23:59:59");
  }
  
  return { startAt, endAt };
}

/**
 * Build pets array, handling both new format (pets[]) and legacy format (petNames/petSpecies)
 */
function buildPetsArray(
  pets?: Array<{ name: string; species: string }>,
  petNames?: string[],
  petSpecies?: string | string[]
): Array<{ name: string; species: string }> {
  // New format: pets array
  if (Array.isArray(pets) && pets.length > 0) {
    return pets.map((pet) => ({
      name: (pet.name || "Pet").trim(),
      species: (pet.species || "Dog").trim(),
    }));
  }
  
  // Legacy format: petNames and petSpecies arrays
  if (Array.isArray(petNames) && petNames.length > 0) {
    const speciesArray = Array.isArray(petSpecies) ? petSpecies : [petSpecies].filter(Boolean);
    return petNames.map((name, index) => ({
      name: (name || `Pet ${index + 1}`).trim(),
      species: (speciesArray[index] || "Dog").trim(),
    }));
  }
  
  // Default fallback
  return [{ name: "Pet 1", species: "Dog" }];
}

/**
 * Main mapper function
 */
export function mapFormPayloadToBookingInput(
  payload: FormBookingPayload,
  metadata?: RequestMetadata
): { input: BookingCreateInput; report: MappingReport } {
  const warnings: string[] = [];
  const timezone = resolveTimezone(payload.timezone, metadata?.timezone);
  
  // Apply notes precedence rule
  const { selected: notes, metadata: notesMetadata } = resolveNotes(
    payload.specialInstructions,
    payload.additionalNotes,
    payload.notes
  );
  
  // Normalize phone number
  const normalizedPhone = formatPhoneForAPI(payload.phone);
  if (!normalizedPhone) {
    warnings.push("Phone number could not be normalized");
  }
  
  // Normalize email (trim and null if empty)
  const normalizedEmail = payload.email?.trim() || null;
  
  // Build pets array
  const pets = buildPetsArray(payload.pets, payload.petNames, payload.petSpecies);
  
  // Build time slots
  const timeSlots = buildTimeSlots(payload.selectedDates, payload.dateTimes);
  
  // Calculate quantity deterministically
  const quantity = calculateQuantity(payload.service, payload.selectedDates, timeSlots.length);
  
  // Calculate startAt/endAt dates
  let startAt: Date;
  let endAt: Date;
  let rawStartAt: string | undefined;
  let rawEndAt: string | undefined;
  
  const isHouseSitting = payload.service === "Housesitting" || payload.service === "24/7 Care";
  
  if (isHouseSitting && payload.selectedDates && payload.selectedDates.length > 1) {
    // For house sitting: use first and last selected dates
    const dates = calculateHouseSittingDates(payload.selectedDates, payload.dateTimes);
    startAt = dates.startAt;
    endAt = dates.endAt;
    rawStartAt = payload.selectedDates[0];
    rawEndAt = payload.selectedDates[payload.selectedDates.length - 1];
  } else {
    // For other services: use provided startAt/endAt
    startAt = new Date(payload.startAt);
    endAt = new Date(payload.endAt);
    rawStartAt = payload.startAt;
    rawEndAt = payload.endAt;
    
    // Validate dates
    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
      warnings.push("Invalid date format in startAt/endAt, using provided values");
    }
    
    if (endAt <= startAt) {
      warnings.push("endAt is not after startAt, using provided values");
    }
  }
  
  // Build canonical BookingCreateInput
  // Note: totalPrice is required by Prisma but will be calculated server-side in the booking service
  // For Phase 1, we set it to 0 as a placeholder - the booking service will recalculate it
  const input: BookingCreateInput = {
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    phone: normalizedPhone,
    email: normalizedEmail,
    address: payload.address?.trim() || null,
    pickupAddress: payload.pickupAddress?.trim() || null,
    dropoffAddress: payload.dropoffAddress?.trim() || null,
    service: payload.service,
    startAt,
    endAt,
    totalPrice: 0, // Placeholder - server-side pricing engine will calculate actual total
    status: "pending",
    paymentStatus: "unpaid",
    quantity,
    afterHours: payload.afterHours || false,
    holiday: payload.holiday || false,
    notes,
    pets: pets.map((pet) => ({
      name: pet.name,
      species: pet.species,
    })),
    ...(timeSlots.length > 0 && {
      timeSlots: timeSlots.map((slot) => ({
        startAt: slot.startAt,
        endAt: slot.endAt,
        duration: slot.duration,
      })),
    }),
  };
  
  // Build mapping report
  const report: MappingReport = {
    version: MAPPING_VERSION,
    normalizedFields: {
      service: payload.service,
      phone: normalizedPhone,
      email: normalizedEmail,
      quantity,
      notes,
      timezone,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    },
    warnings,
    notesPrecedence: {
      selectedField: notesMetadata.selectedField,
      rawNotesMetadata: notesMetadata,
    },
    timezoneConversion: {
      sourceTimezone: timezone,
      rawStartAt,
      rawEndAt,
      computedStartAt: startAt.toISOString(),
      computedEndAt: endAt.toISOString(),
    },
    quantityCalculation: {
      serviceType: payload.service,
      method: isHouseSitting ? "nights_based_on_selected_dates" : "time_slots_count",
      inputValue: payload.quantity,
      computedValue: quantity,
    },
    pricingMetadata: {
      note: "Pricing calculation not changed in Phase 1. Server-side pricing engine will compute totalPrice.",
    },
  };
  
  // Store raw notes metadata in a way that can be retrieved later if needed
  // For Phase 1, we'll log this in the report. In future phases, we could store in a separate metadata field.
  // The notes field itself contains the selected value based on precedence.
  
  return { input, report };
}

/**
 * Main entry point: validate and map form payload
 */
export function validateAndMapFormPayload(
  rawPayload: unknown,
  metadata?: RequestMetadata
):
  | { success: true; input: BookingCreateInput; report: MappingReport }
  | { success: false; errors: Array<{ field: string; message: string; code: string }> } {
  const validation = validateFormPayload(rawPayload);
  
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }
  
  const { input, report } = mapFormPayloadToBookingInput(validation.data, metadata);
  
  return { success: true, input, report };
}

