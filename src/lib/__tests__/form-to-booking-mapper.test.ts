/**
 * Form to Booking Mapper Tests
 * 
 * Tests to prove mapping correctness, including:
 * - Notes precedence rules
 * - Timezone conversion
 * - Quantity determinism
 * - No field drops
 */

import { describe, it, expect } from "vitest";
import {
  mapFormPayloadToBookingInput,
  validateAndMapFormPayload,
  MAPPING_VERSION,
} from "../form-to-booking-mapper";
import type { FormBookingPayload, RequestMetadata } from "../validation/form-booking";

describe("Form to Booking Mapper", () => {
  describe("Notes Precedence", () => {
    it("should prefer specialInstructions over additionalNotes and notes", () => {
      const payload: FormBookingPayload = {
        firstName: "John",
        lastName: "Doe",
        phone: "5551234567",
        service: "Dog Walking",
        startAt: "2024-01-15T10:00:00Z",
        endAt: "2024-01-15T11:00:00Z",
        specialInstructions: "Use side door",
        additionalNotes: "Park in driveway",
        notes: "Ring doorbell",
      };

      const { input, report } = mapFormPayloadToBookingInput(payload);

      expect(input.notes).toBe("Use side door");
      expect(report.notesPrecedence.selectedField).toBe("specialInstructions");
      expect(report.notesPrecedence.rawNotesMetadata.specialInstructions).toBe("Use side door");
      expect(report.notesPrecedence.rawNotesMetadata.additionalNotes).toBe("Park in driveway");
      expect(report.notesPrecedence.rawNotesMetadata.notes).toBe("Ring doorbell");
    });

    it("should prefer additionalNotes over notes when specialInstructions is empty", () => {
      const payload: FormBookingPayload = {
        firstName: "Jane",
        lastName: "Smith",
        phone: "5559876543",
        service: "Drop-ins",
        startAt: "2024-01-16T09:00:00Z",
        endAt: "2024-01-16T10:00:00Z",
        specialInstructions: "",
        additionalNotes: "Key under mat",
        notes: "Leave food bowl",
      };

      const { input, report } = mapFormPayloadToBookingInput(payload);

      expect(input.notes).toBe("Key under mat");
      expect(report.notesPrecedence.selectedField).toBe("additionalNotes");
    });

    it("should use notes when other fields are empty", () => {
      const payload: FormBookingPayload = {
        firstName: "Bob",
        lastName: "Johnson",
        phone: "5555555555",
        service: "Pet Taxi",
        startAt: "2024-01-17T14:00:00Z",
        endAt: "2024-01-17T15:00:00Z",
        pickupAddress: "123 Main St",
        dropoffAddress: "456 Oak Ave",
        specialInstructions: null,
        additionalNotes: null,
        notes: "Dog is friendly",
      };

      const { input, report } = mapFormPayloadToBookingInput(payload);

      expect(input.notes).toBe("Dog is friendly");
      expect(report.notesPrecedence.selectedField).toBe("notes");
    });

    it("should return null when all notes fields are empty", () => {
      const payload: FormBookingPayload = {
        firstName: "Alice",
        lastName: "Brown",
        phone: "5551112222",
        service: "Housesitting",
        startAt: "2024-01-18T08:00:00Z",
        endAt: "2024-01-19T20:00:00Z",
        specialInstructions: null,
        additionalNotes: "",
        notes: null,
      };

      const { input, report } = mapFormPayloadToBookingInput(payload);

      expect(input.notes).toBeNull();
      expect(report.notesPrecedence.selectedField).toBeNull();
    });

    it("should handle whitespace-only notes as empty", () => {
      const payload: FormBookingPayload = {
        firstName: "Charlie",
        lastName: "Wilson",
        phone: "5553334444",
        service: "Dog Walking",
        startAt: "2024-01-20T12:00:00Z",
        endAt: "2024-01-20T13:00:00Z",
        specialInstructions: "   ",
        additionalNotes: "\n\t  ",
        notes: "Valid note",
      };

      const { input, report } = mapFormPayloadToBookingInput(payload);

      expect(input.notes).toBe("Valid note");
      expect(report.notesPrecedence.selectedField).toBe("notes");
    });
  });

  describe("Timezone Conversion", () => {
    it("should use payload timezone when provided", () => {
      const payload: FormBookingPayload = {
        firstName: "David",
        lastName: "Lee",
        phone: "5554445555",
        service: "Drop-ins",
        startAt: "2024-01-21T10:00:00Z",
        endAt: "2024-01-21T11:00:00Z",
        timezone: "America/New_York",
      };

      const { report } = mapFormPayloadToBookingInput(payload);

      expect(report.timezoneConversion.sourceTimezone).toBe("America/New_York");
    });

    it("should use metadata timezone when payload timezone is missing", () => {
      const payload: FormBookingPayload = {
        firstName: "Emma",
        lastName: "Davis",
        phone: "5556667777",
        service: "Dog Walking",
        startAt: "2024-01-22T09:00:00Z",
        endAt: "2024-01-22T10:00:00Z",
      };

      const metadata: RequestMetadata = {
        timezone: "America/Los_Angeles",
      };

      const { report } = mapFormPayloadToBookingInput(payload, metadata);

      expect(report.timezoneConversion.sourceTimezone).toBe("America/Los_Angeles");
    });

    it("should default to America/Chicago when no timezone provided", () => {
      const payload: FormBookingPayload = {
        firstName: "Frank",
        lastName: "Miller",
        phone: "5557778888",
        service: "Pet Taxi",
        startAt: "2024-01-23T15:00:00Z",
        endAt: "2024-01-23T16:00:00Z",
        pickupAddress: "789 Pine St",
        dropoffAddress: "321 Elm Ave",
      };

      const { report } = mapFormPayloadToBookingInput(payload);

      expect(report.timezoneConversion.sourceTimezone).toBe("America/Chicago");
    });
  });

  describe("Quantity Calculation", () => {
    it("should calculate quantity as nights for house sitting (selectedDates.length - 1)", () => {
      const payload: FormBookingPayload = {
        firstName: "Grace",
        lastName: "Taylor",
        phone: "5558889999",
        service: "Housesitting",
        startAt: "2024-01-24T08:00:00Z",
        endAt: "2024-01-26T20:00:00Z",
        selectedDates: ["2024-01-24", "2024-01-25", "2024-01-26"],
        dateTimes: {
          "2024-01-24": [{ time: "08:00 AM", duration: 60 }],
          "2024-01-26": [{ time: "08:00 PM", duration: 60 }],
        },
      };

      const { input, report } = mapFormPayloadToBookingInput(payload);

      expect(input.quantity).toBe(2); // 3 days - 1 = 2 nights
      expect(report.quantityCalculation.method).toBe("nights_based_on_selected_dates");
      expect(report.quantityCalculation.computedValue).toBe(2);
    });

    it("should calculate quantity as time slots count for non-house-sitting services", () => {
      const payload: FormBookingPayload = {
        firstName: "Henry",
        lastName: "Anderson",
        phone: "5559990000",
        service: "Dog Walking",
        startAt: "2024-01-25T10:00:00Z",
        endAt: "2024-01-25T11:00:00Z",
        address: "100 Main St",
        selectedDates: ["2024-01-25", "2024-01-26"],
        dateTimes: {
          "2024-01-25": [
            { time: "10:00 AM", duration: 30 },
            { time: "02:00 PM", duration: 30 },
          ],
          "2024-01-26": [{ time: "10:00 AM", duration: 30 }],
        },
      };

      const { input, report } = mapFormPayloadToBookingInput(payload);

      expect(input.quantity).toBe(3); // 3 time slots total
      expect(report.quantityCalculation.method).toBe("time_slots_count");
      expect(report.quantityCalculation.computedValue).toBe(3);
    });

    it("should default to quantity 1 when no time slots provided for non-house-sitting", () => {
      const payload: FormBookingPayload = {
        firstName: "Ivy",
        lastName: "Thomas",
        phone: "5550001111",
        service: "Drop-ins",
        startAt: "2024-01-26T14:00:00Z",
        endAt: "2024-01-26T15:00:00Z",
        address: "200 Oak Ave",
      };

      const { input, report } = mapFormPayloadToBookingInput(payload);

      expect(input.quantity).toBe(1);
      expect(report.quantityCalculation.computedValue).toBe(1);
    });
  });

  describe("Midnight Crossing Edge Cases", () => {
    it("should handle dates crossing midnight correctly", () => {
      const payload: FormBookingPayload = {
        firstName: "Jack",
        lastName: "White",
        phone: "5551112222",
        service: "24/7 Care",
        startAt: "2024-01-27T23:30:00Z",
        endAt: "2024-01-28T00:30:00Z",
        selectedDates: ["2024-01-27", "2024-01-28"],
        dateTimes: {
          "2024-01-27": [{ time: "11:30 PM", duration: 60 }],
          "2024-01-28": [{ time: "12:30 AM", duration: 60 }],
        },
      };

      const { input, report } = mapFormPayloadToBookingInput(payload);

      expect(input.startAt).toBeInstanceOf(Date);
      expect(input.endAt).toBeInstanceOf(Date);
      expect(input.endAt.getTime()).toBeGreaterThan(input.startAt.getTime());
      expect(input.quantity).toBe(1); // 2 dates - 1 = 1 night
    });
  });

  describe("Multiple Pets Handling", () => {
    it("should handle multiple pets with different species", () => {
      const payload: FormBookingPayload = {
        firstName: "Karen",
        lastName: "Harris",
        phone: "5552223333",
        service: "Dog Walking",
        startAt: "2024-01-28T09:00:00Z",
        endAt: "2024-01-28T10:00:00Z",
        address: "300 Elm St",
        pets: [
          { name: "Buddy", species: "Dog" },
          { name: "Whiskers", species: "Cat" },
          { name: "Tweety", species: "Bird" },
        ],
      };

      const { input } = mapFormPayloadToBookingInput(payload);

      expect(input.pets).toBeDefined();
      expect(Array.isArray(input.pets)).toBe(true);
      expect(input.pets).toHaveLength(3);
      expect(input.pets?.[0].name).toBe("Buddy");
      expect(input.pets?.[0].species).toBe("Dog");
      expect(input.pets?.[1].name).toBe("Whiskers");
      expect(input.pets?.[1].species).toBe("Cat");
      expect(input.pets?.[2].name).toBe("Tweety");
      expect(input.pets?.[2].species).toBe("Bird");
    });

    it("should handle legacy petNames/petSpecies format", () => {
      const payload: FormBookingPayload = {
        firstName: "Larry",
        lastName: "Clark",
        phone: "5553334444",
        service: "Drop-ins",
        startAt: "2024-01-29T11:00:00Z",
        endAt: "2024-01-29T12:00:00Z",
        address: "400 Pine Ave",
        petNames: ["Max", "Lucy"],
        petSpecies: ["Dog", "Dog"],
      };

      const { input } = mapFormPayloadToBookingInput(payload);

      expect(input.pets).toBeDefined();
      expect(input.pets).toHaveLength(2);
      expect(input.pets?.[0].name).toBe("Max");
      expect(input.pets?.[0].species).toBe("Dog");
      expect(input.pets?.[1].name).toBe("Lucy");
      expect(input.pets?.[1].species).toBe("Dog");
    });

    it("should default to one pet when no pets provided", () => {
      const payload: FormBookingPayload = {
        firstName: "Mary",
        lastName: "Lewis",
        phone: "5554445555",
        service: "Dog Walking",
        startAt: "2024-01-30T13:00:00Z",
        endAt: "2024-01-30T14:00:00Z",
        address: "500 Maple Dr",
      };

      const { input } = mapFormPayloadToBookingInput(payload);

      expect(input.pets).toBeDefined();
      expect(input.pets).toHaveLength(1);
      expect(input.pets?.[0].name).toBe("Pet 1");
      expect(input.pets?.[0].species).toBe("Dog");
    });
  });

  describe("Field Preservation", () => {
    it("should preserve all direct mapping fields without dropping any", () => {
      const payload: FormBookingPayload = {
        firstName: "Nancy",
        lastName: "Walker",
        phone: "5555556666",
        email: "nancy@example.com",
        service: "Pet Taxi",
        startAt: "2024-01-31T10:00:00Z",
        endAt: "2024-01-31T11:00:00Z",
        pickupAddress: "600 Oak St",
        dropoffAddress: "700 Elm Ave",
        address: null,
      };

      const { input } = mapFormPayloadToBookingInput(payload);

      expect(input.firstName).toBe("Nancy");
      expect(input.lastName).toBe("Walker");
      expect(input.phone).toBe("+15555556666"); // Formatted
      expect(input.email).toBe("nancy@example.com");
      expect(input.service).toBe("Pet Taxi");
      expect(input.pickupAddress).toBe("600 Oak St");
      expect(input.dropoffAddress).toBe("700 Elm Ave");
      expect(input.address).toBeNull();
      expect(input.status).toBe("pending");
      expect(input.paymentStatus).toBe("unpaid");
      expect(input.afterHours).toBe(false);
      expect(input.holiday).toBe(false);
    });

    it("should preserve trimmed values correctly", () => {
      const payload: FormBookingPayload = {
        firstName: "  Oliver  ",
        lastName: "  Young  ",
        phone: "5556667777",
        email: "  oliver@example.com  ",
        service: "Dog Walking",
        startAt: "2024-02-01T09:00:00Z",
        endAt: "2024-02-01T10:00:00Z",
        address: "  800 Main St  ",
      };

      const { input } = mapFormPayloadToBookingInput(payload);

      expect(input.firstName).toBe("Oliver");
      expect(input.lastName).toBe("Young");
      expect(input.email).toBe("oliver@example.com");
      expect(input.address).toBe("800 Main St");
    });
  });

  describe("TimeSlots Creation", () => {
    it("should create time slots from selectedDates and dateTimes", () => {
      const payload: FormBookingPayload = {
        firstName: "Patricia",
        lastName: "King",
        phone: "5557778888",
        service: "Dog Walking",
        startAt: "2024-02-02T10:00:00Z",
        endAt: "2024-02-02T11:00:00Z",
        address: "900 Oak Blvd",
        selectedDates: ["2024-02-02"],
        dateTimes: {
          "2024-02-02": [
            { time: "10:00 AM", duration: 30 },
            { time: "02:00 PM", duration: 60 },
          ],
        },
      };

      const { input } = mapFormPayloadToBookingInput(payload);

      expect(input.timeSlots).toBeDefined();
      expect(input.timeSlots).toHaveLength(2);
      expect(input.timeSlots?.[0].duration).toBe(30);
      expect(input.timeSlots?.[1].duration).toBe(60);
    });

    it("should handle timeValue and durationValue alternative field names", () => {
      const payload: FormBookingPayload = {
        firstName: "Quinn",
        lastName: "Wright",
        phone: "5558889999",
        service: "Drop-ins",
        startAt: "2024-02-03T14:00:00Z",
        endAt: "2024-02-03T15:00:00Z",
        address: "1000 Pine Rd",
        selectedDates: ["2024-02-03"],
        dateTimes: {
          "2024-02-03": [
            { timeValue: "03:00 PM", durationValue: 45 },
          ],
        },
      };

      const { input } = mapFormPayloadToBookingInput(payload);

      expect(input.timeSlots).toBeDefined();
      expect(input.timeSlots).toHaveLength(1);
      expect(input.timeSlots?.[0].duration).toBe(45);
    });
  });

  describe("Validation Integration", () => {
    it("should validate and map valid payload", () => {
      const payload = {
        firstName: "Robert",
        lastName: "Lopez",
        phone: "5559990000",
        service: "Dog Walking",
        startAt: "2024-02-04T10:00:00Z",
        endAt: "2024-02-04T11:00:00Z",
        address: "1100 Elm Way",
      };

      const result = validateAndMapFormPayload(payload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.input.firstName).toBe("Robert");
        expect(result.report.version).toBe(MAPPING_VERSION);
      }
    });

    it("should return validation errors for invalid payload", () => {
      const payload = {
        firstName: "", // Invalid: empty
        lastName: "Martinez",
        phone: "123", // Invalid: too short
        service: "Invalid Service", // Invalid: not in enum
        startAt: "2024-02-05T10:00:00Z",
        endAt: "2024-02-05T09:00:00Z", // Invalid: before startAt
      };

      const result = validateAndMapFormPayload(payload);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.field === "firstName")).toBe(true);
        expect(result.errors.some((e) => e.field === "phone")).toBe(true);
        expect(result.errors.some((e) => e.field === "service")).toBe(true);
      }
    });
  });

  describe("Mapping Report Completeness", () => {
    it("should include all required fields in mapping report", () => {
      const payload: FormBookingPayload = {
        firstName: "Sarah",
        lastName: "Garcia",
        phone: "5550001111",
        service: "Housesitting",
        startAt: "2024-02-06T08:00:00Z",
        endAt: "2024-02-08T20:00:00Z",
        selectedDates: ["2024-02-06", "2024-02-07", "2024-02-08"],
        dateTimes: {
          "2024-02-06": [{ time: "08:00 AM", duration: 60 }],
          "2024-02-08": [{ time: "08:00 PM", duration: 60 }],
        },
        notes: "Water plants daily",
        timezone: "America/Chicago",
      };

      const { report } = mapFormPayloadToBookingInput(payload);

      expect(report.version).toBe(MAPPING_VERSION);
      expect(report.normalizedFields).toBeDefined();
      expect(report.normalizedFields.service).toBe("Housesitting");
      expect(report.normalizedFields.quantity).toBe(2);
      expect(report.normalizedFields.notes).toBe("Water plants daily");
      expect(report.notesPrecedence).toBeDefined();
      expect(report.timezoneConversion).toBeDefined();
      expect(report.quantityCalculation).toBeDefined();
      expect(report.pricingMetadata).toBeDefined();
    });
  });
});

