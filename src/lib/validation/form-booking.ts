/**
 * Form Booking Validation Schema
 * Validates raw booking form payloads before mapping to canonical BookingCreateInput
 */

import { z } from "zod";

/**
 * Valid service names that the API accepts
 */
export const VALID_SERVICES = [
  "Dog Walking",
  "Housesitting",
  "24/7 Care",
  "Drop-ins",
  "Pet Taxi",
] as const;

export type ValidService = typeof VALID_SERVICES[number];

/**
 * Pet object schema
 */
const petSchema = z.object({
  name: z.string().min(1, "Pet name is required"),
  species: z.string().min(1, "Pet species is required"),
});

/**
 * Date-time entry schema (from form's dateTimes structure)
 */
const dateTimeEntrySchema = z.object({
  time: z.string().optional(),
  duration: z.number().int().positive().optional(),
  timeValue: z.string().optional(), // Alternative field name
  durationValue: z.number().int().positive().optional(), // Alternative field name
}).passthrough(); // Allow additional fields

/**
 * Raw form payload schema
 * This matches what the booking form actually sends
 */
export const formBookingPayloadSchema = z.object({
  // Required contact fields
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  
  // Address fields (conditional based on service)
  address: z.string().optional().nullable(),
  pickupAddress: z.string().optional().nullable(),
  dropoffAddress: z.string().optional().nullable(),
  
  // Service and timing
  service: z.enum(["Dog Walking", "Housesitting", "24/7 Care", "Drop-ins", "Pet Taxi"] as [string, ...string[]], {
    message: `Service must be one of: ${VALID_SERVICES.join(", ")}`,
  }),
  startAt: z.string().datetime({ message: "startAt must be a valid ISO datetime string" }),
  endAt: z.string().datetime({ message: "endAt must be a valid ISO datetime string" }),
  
  // Duration and quantity (may be recalculated by mapper)
  minutes: z.number().int().positive().optional(),
  quantity: z.number().int().positive().optional(),
  
  // Pet information
  pets: z.array(petSchema).min(1, "At least one pet is required").optional(),
  petNames: z.array(z.string()).optional(), // Legacy format
  petSpecies: z.string().or(z.array(z.string())).optional(), // Legacy format
  
  // Notes fields (all three possible sources)
  notes: z.string().optional().nullable(),
  specialInstructions: z.string().optional().nullable(),
  additionalNotes: z.string().optional().nullable(),
  
  // Date/time selection data
  selectedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be in YYYY-MM-DD format")).optional(),
  dateTimes: z.record(z.string(), z.array(dateTimeEntrySchema)).optional(),
  
  // Flags
  afterHours: z.boolean().optional().default(false),
  holiday: z.boolean().optional().default(false),
  
  // Metadata
  createdFrom: z.string().optional(),
  timezone: z.string().optional(), // IANA timezone string (e.g., "America/Chicago")
}).refine(
  (data) => {
    const startDate = new Date(data.startAt);
    const endDate = new Date(data.endAt);
    return !isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate > startDate;
  },
  {
    message: "endAt must be after startAt",
    path: ["endAt"],
  }
).refine(
  (data) => {
    // Pet Taxi requires pickup and dropoff addresses
    if (data.service === "Pet Taxi") {
      return data.pickupAddress && data.dropoffAddress;
    }
    return true;
  },
  {
    message: "Pickup and dropoff addresses are required for Pet Taxi service",
    path: ["pickupAddress"],
  }
).refine(
  (data) => {
    // Non-house-sitting, non-pet-taxi services require address
    if (data.service !== "Housesitting" && data.service !== "24/7 Care" && data.service !== "Pet Taxi") {
      return data.address && data.address.trim().length > 0;
    }
    return true;
  },
  {
    message: "Service address is required",
    path: ["address"],
  }
);

export type FormBookingPayload = z.infer<typeof formBookingPayloadSchema>;

/**
 * Request metadata schema (extracted from NextRequest)
 */
export const requestMetadataSchema = z.object({
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  sourcePage: z.string().url().optional(),
  submittedAt: z.string().datetime().optional(),
  timezone: z.string().optional(), // IANA timezone string
});

export type RequestMetadata = z.infer<typeof requestMetadataSchema>;

/**
 * Validation error result
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Validate form payload and return typed result or errors
 */
export function validateFormPayload(
  rawPayload: unknown
): { success: true; data: FormBookingPayload } | { success: false; errors: ValidationError[] } {
  try {
    const validated = formBookingPayloadSchema.parse(rawPayload);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: ValidationError[] = error.issues.map((err) => ({
        field: err.path.join(".") || "root",
        message: err.message,
        code: err.code,
      }));
      return { success: false, errors };
    }
    return {
      success: false,
      errors: [{ field: "root", message: "Unknown validation error", code: "unknown" }],
    };
  }
}

