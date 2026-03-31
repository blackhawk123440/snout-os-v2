import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/request-context", () => ({
  getPublicOrgContext: vi.fn(() => ({ orgId: "personal-org" })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    booking: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rates", () => ({
  calculateBookingPrice: vi.fn(async () => ({ holidayApplied: false })),
}));

vi.mock("@/lib/booking-utils", () => ({
  formatPetsByQuantity: vi.fn(),
  calculatePriceBreakdown: vi.fn(() => ({ total: 42 })),
  formatDatesAndTimesForMessage: vi.fn(),
  formatDateForMessage: vi.fn(),
  formatTimeForMessage: vi.fn(),
}));

vi.mock("@/lib/form-to-booking-mapper", () => ({
  validateAndMapFormPayload: vi.fn(() => ({
    success: true,
    input: {
      firstName: "A",
      lastName: "B",
      phone: "+15555555555",
      service: "Dog Walking",
      startAt: new Date("2026-02-01T10:00:00.000Z"),
      endAt: new Date("2026-02-01T10:30:00.000Z"),
      pets: [{ name: "Rex", species: "Dog" }],
      quantity: 1,
      afterHours: false,
    },
    report: {},
  })),
}));

vi.mock("@/lib/form-mapper-helpers", () => ({
  extractRequestMetadata: vi.fn(() => ({})),
  redactMappingReport: vi.fn((v) => v),
}));

vi.mock("@/lib/event-emitter", () => ({
  emitBookingCreated: vi.fn(async () => undefined),
  eventEmitter: {
    on: vi.fn(),
    onAll: vi.fn(),
    emit: vi.fn(),
  },
}));

vi.mock("@/lib/event-queue-bridge-init", () => ({
  ensureEventQueueBridge: vi.fn(async () => undefined),
}));

vi.mock("@/lib/calendar-queue", () => ({
  enqueueCalendarSync: vi.fn(async () => null),
}));

vi.mock("@/lib/env", () => ({
  env: {
    ENABLE_FORM_MAPPER_V1: true,
    USE_PRICING_ENGINE_V1: false,
  },
}));

vi.mock("@/lib/pricing-parity-harness", () => ({
  compareAndLogPricing: vi.fn(),
}));

vi.mock("@/lib/automation-queue", () => ({
  enqueueAutomation: vi.fn(async () => undefined),
}));

import { POST } from "@/app/api/form/route";
import { prisma } from "@/lib/db";
import { getPublicOrgContext } from "@/lib/request-context";

describe("form route tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).booking.create.mockResolvedValue({
      id: "b1",
      status: "pending",
      notes: null,
      pets: [],
      timeSlots: [],
    });
  });

  it("always sets orgId on public booking create", async () => {
    const req = new Request("http://localhost/api/form", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ any: "payload" }),
    });

    const response = await POST(req as any);
    expect(response.status).toBe(200);
    expect((prisma as any).booking.create).toHaveBeenCalled();

    const call = (prisma as any).booking.create.mock.calls[0][0];
    expect(call.data.orgId).toBe("personal-org");
    expect(call.data.pets.create[0].orgId).toBe("personal-org");
  });

  it("rejects public booking when SaaS org binding is missing", async () => {
    (getPublicOrgContext as any).mockImplementationOnce(() => {
      throw new Error("missing org binding");
    });

    const req = new Request("http://localhost/api/form", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ any: "payload" }),
    });

    const response = await POST(req as any);
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error).toContain("Public booking is disabled in SaaS mode");
  });
});
