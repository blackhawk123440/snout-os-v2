/**
 * Form Route Integration Tests
 * 
 * Tests for form route with mapper integration behind feature flag
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../form/route";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  prisma: {
    booking: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rates", () => ({
  calculateBookingPrice: vi.fn().mockResolvedValue({
    total: 100,
    holidayApplied: false,
  }),
}));

vi.mock("@/lib/booking-utils", () => ({
  calculatePriceBreakdown: vi.fn().mockReturnValue({ total: 100 }),
  formatPetsByQuantity: vi.fn().mockReturnValue("1 Dog"),
  formatDatesAndTimesForMessage: vi.fn().mockReturnValue("Jan 1, 2024 10:00 AM"),
  formatDateForMessage: vi.fn().mockReturnValue("Jan 1, 2024"),
  formatTimeForMessage: vi.fn().mockReturnValue("10:00 AM"),
}));

vi.mock("@/lib/automation-utils", () => ({
  shouldSendToRecipient: vi.fn().mockResolvedValue(false),
  getMessageTemplate: vi.fn().mockResolvedValue(null),
  replaceTemplateVariables: vi.fn().mockReturnValue("Test message"),
}));

vi.mock("@/lib/message-utils", () => ({
  sendMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/event-emitter", () => ({
  emitBookingCreated: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/env", () => ({
  env: {
    ENABLE_FORM_MAPPER_V1: false,
  },
}));

vi.mock("@/lib/phone-utils", () => ({
  getOwnerPhone: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/sms-templates", () => ({
  sendOwnerAlert: vi.fn().mockResolvedValue(undefined),
}));

describe("Form Route Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (body: any): NextRequest => {
    return new NextRequest("http://localhost:3000/api/form", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  };

  describe("Feature Flag: OFF (existing behavior)", () => {
    it("should use existing validation and mapping logic when flag is false", async () => {
      const { env } = await import("@/lib/env");
      vi.mocked(env).ENABLE_FORM_MAPPER_V1 = false;

      const { prisma } = await import("@/lib/db");
      vi.mocked(prisma.booking.create).mockResolvedValue({
        id: "test-booking-id",
        firstName: "John",
        lastName: "Doe",
        phone: "+15551234567",
        email: "john@example.com",
        address: "123 Main St",
        pickupAddress: null,
        dropoffAddress: null,
        service: "Dog Walking",
        startAt: new Date("2024-01-15T10:00:00Z"),
        endAt: new Date("2024-01-15T11:00:00Z"),
        totalPrice: 100,
        status: "pending",
        paymentStatus: "unpaid",
        quantity: 1,
        afterHours: false,
        holiday: false,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sitterId: null,
        assignmentType: null,
        stripePaymentLinkUrl: null,
        tipLinkUrl: null,
        clientId: null,
        pets: [],
        timeSlots: [],
      } as any);

      const request = createMockRequest({
        firstName: "John",
        lastName: "Doe",
        phone: "5551234567",
        service: "Dog Walking",
        startAt: "2024-01-15T10:00:00Z",
        endAt: "2024-01-15T11:00:00Z",
        address: "123 Main St",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.booking).toBeDefined();
      expect(data.booking.id).toBe("test-booking-id");
    });

    it("should return 400 with existing error format when validation fails", async () => {
      const { env } = await import("@/lib/env");
      vi.mocked(env).ENABLE_FORM_MAPPER_V1 = false;

      const request = createMockRequest({
        firstName: "", // Invalid: empty
        lastName: "Doe",
        phone: "123", // Invalid: too short
        service: "Dog Walking",
        startAt: "2024-01-15T10:00:00Z",
        endAt: "2024-01-15T11:00:00Z",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error).toContain("Missing required fields");
    });
  });

  describe("Feature Flag: ON (mapper path)", () => {
    it("should use mapper validation when flag is true", async () => {
      const { env } = await import("@/lib/env");
      vi.mocked(env).ENABLE_FORM_MAPPER_V1 = true;

      const { prisma } = await import("@/lib/db");
      vi.mocked(prisma.booking.create).mockResolvedValue({
        id: "test-booking-id",
        firstName: "Jane",
        lastName: "Smith",
        phone: "+15559876543",
        email: "jane@example.com",
        address: "456 Oak Ave",
        pickupAddress: null,
        dropoffAddress: null,
        service: "Drop-ins",
        startAt: new Date("2024-01-16T09:00:00Z"),
        endAt: new Date("2024-01-16T10:00:00Z"),
        totalPrice: 100,
        status: "pending",
        paymentStatus: "unpaid",
        quantity: 1,
        afterHours: false,
        holiday: false,
        notes: "Key under mat",
        createdAt: new Date(),
        updatedAt: new Date(),
        sitterId: null,
        assignmentType: null,
        stripePaymentLinkUrl: null,
        tipLinkUrl: null,
        clientId: null,
        pets: [],
        timeSlots: [],
      } as any);

      const request = createMockRequest({
        firstName: "Jane",
        lastName: "Smith",
        phone: "5559876543",
        email: "jane@example.com",
        service: "Drop-ins",
        startAt: "2024-01-16T09:00:00Z",
        endAt: "2024-01-16T10:00:00Z",
        address: "456 Oak Ave",
        additionalNotes: "Key under mat",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.booking).toBeDefined();
      expect(data.booking.id).toBe("test-booking-id");
    });

    it("should return 400 with structured validation errors when mapper validation fails", async () => {
      const { env } = await import("@/lib/env");
      vi.mocked(env).ENABLE_FORM_MAPPER_V1 = true;

      const request = createMockRequest({
        firstName: "", // Invalid: empty
        lastName: "Smith",
        phone: "123", // Invalid: too short
        service: "Invalid Service", // Invalid: not in enum
        startAt: "2024-01-16T09:00:00Z",
        endAt: "2024-01-16T08:00:00Z", // Invalid: before startAt
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.errors).toBeDefined();
      expect(Array.isArray(data.errors)).toBe(true);
      expect(data.errors.length).toBeGreaterThan(0);
      // Should have structured error objects with field and message
      expect(data.errors[0]).toHaveProperty("field");
      expect(data.errors[0]).toHaveProperty("message");
    });
  });

  describe("Response Shape", () => {
    it("should return consistent response shape regardless of flag", async () => {
      const { env } = await import("@/lib/env");
      const { prisma } = await import("@/lib/db");

      // Test with flag OFF
      vi.mocked(env).ENABLE_FORM_MAPPER_V1 = false;
      vi.mocked(prisma.booking.create).mockResolvedValue({
        id: "test-id-1",
        firstName: "John",
        lastName: "Doe",
        phone: "+15551234567",
        email: "john@example.com",
        address: "123 Main St",
        pickupAddress: null,
        dropoffAddress: null,
        service: "Dog Walking",
        startAt: new Date("2024-01-15T10:00:00Z"),
        endAt: new Date("2024-01-15T11:00:00Z"),
        totalPrice: 100,
        status: "pending",
        paymentStatus: "unpaid",
        quantity: 1,
        afterHours: false,
        holiday: false,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sitterId: null,
        assignmentType: null,
        stripePaymentLinkUrl: null,
        tipLinkUrl: null,
        clientId: null,
        pets: [],
        timeSlots: [],
      } as any);

      const request1 = createMockRequest({
        firstName: "John",
        lastName: "Doe",
        phone: "5551234567",
        service: "Dog Walking",
        startAt: "2024-01-15T10:00:00Z",
        endAt: "2024-01-15T11:00:00Z",
        address: "123 Main St",
      });

      const response1 = await POST(request1);
      const data1 = await response1.json();

      expect(data1).toHaveProperty("success");
      expect(data1).toHaveProperty("booking");
      expect(data1.booking).toHaveProperty("id");
      expect(data1.booking).toHaveProperty("totalPrice");
      expect(data1.booking).toHaveProperty("status");
      expect(data1.booking).toHaveProperty("notes");

      // Test with flag ON
      vi.mocked(env).ENABLE_FORM_MAPPER_V1 = true;
      vi.mocked(prisma.booking.create).mockResolvedValue({
        id: "test-id-2",
        firstName: "Jane",
        lastName: "Smith",
        phone: "+15559876543",
        email: "jane@example.com",
        address: "456 Oak Ave",
        pickupAddress: null,
        dropoffAddress: null,
        service: "Drop-ins",
        startAt: new Date("2024-01-16T09:00:00Z"),
        endAt: new Date("2024-01-16T10:00:00Z"),
        totalPrice: 100,
        status: "pending",
        paymentStatus: "unpaid",
        quantity: 1,
        afterHours: false,
        holiday: false,
        notes: "Test notes",
        createdAt: new Date(),
        updatedAt: new Date(),
        sitterId: null,
        assignmentType: null,
        stripePaymentLinkUrl: null,
        tipLinkUrl: null,
        clientId: null,
        pets: [],
        timeSlots: [],
      } as any);

      const request2 = createMockRequest({
        firstName: "Jane",
        lastName: "Smith",
        phone: "5559876543",
        email: "jane@example.com",
        service: "Drop-ins",
        startAt: "2024-01-16T09:00:00Z",
        endAt: "2024-01-16T10:00:00Z",
        address: "456 Oak Ave",
        notes: "Test notes",
      });

      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect(data2).toHaveProperty("success");
      expect(data2).toHaveProperty("booking");
      expect(data2.booking).toHaveProperty("id");
      expect(data2.booking).toHaveProperty("totalPrice");
      expect(data2.booking).toHaveProperty("status");
      expect(data2.booking).toHaveProperty("notes");

      // Response shapes should match
      expect(Object.keys(data1)).toEqual(Object.keys(data2));
      expect(Object.keys(data1.booking)).toEqual(Object.keys(data2.booking));
    });
  });
});

