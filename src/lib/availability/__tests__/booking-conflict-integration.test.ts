/**
 * Integration test: booking assignment rejects conflicts (409) unless force=true.
 * Tests the checkAssignmentAllowed helper and AvailabilityConflictError flow.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkAssignmentAllowed } from "@/lib/availability/booking-conflict";

vi.mock("@/lib/calendar/sync", () => ({
  getGoogleBusyRanges: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/log-event", () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

const mockDb = {
  sitter: { findFirst: vi.fn() },
  sitterAvailabilityRule: { findMany: vi.fn() },
  sitterAvailabilityOverride: { findMany: vi.fn() },
  booking: { findMany: vi.fn() },
  sitterTimeOff: { findMany: vi.fn() },
};

describe("booking conflict integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.sitter.findFirst.mockResolvedValue({
      availabilityEnabled: true,
      timezone: "America/Chicago",
      respectGoogleBusy: false,
    });
    mockDb.sitterAvailabilityRule.findMany.mockResolvedValue([
      { daysOfWeek: "[1,2,3,4,5]", startTime: "09:00", endTime: "17:00", timezone: "America/Chicago" },
    ]);
    mockDb.sitterAvailabilityOverride.findMany.mockResolvedValue([]);
    mockDb.sitterTimeOff.findMany.mockResolvedValue([]);
  });

  it("checkAssignmentAllowed returns allowed:false when booking conflict", async () => {
    mockDb.booking.findMany.mockResolvedValue([
      {
        id: "b1",
        startAt: new Date("2025-03-04T10:00:00Z"),
        endAt: new Date("2025-03-04T11:00:00Z"),
      },
    ]);

    const result = await checkAssignmentAllowed({
      db: mockDb as any,
      orgId: "org-1",
      sitterId: "s1",
      start: new Date("2025-03-04T10:30:00Z"),
      end: new Date("2025-03-04T11:30:00Z"),
      respectGoogleBusy: true,
      force: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.conflicts.some((c) => c.reason === "booking_conflict")).toBe(true);
  });

  it("checkAssignmentAllowed returns allowed:true when force=true despite conflicts", async () => {
    mockDb.booking.findMany.mockResolvedValue([
      {
        id: "b1",
        startAt: new Date("2025-03-04T10:00:00Z"),
        endAt: new Date("2025-03-04T11:00:00Z"),
      },
    ]);

    const result = await checkAssignmentAllowed({
      db: mockDb as any,
      orgId: "org-1",
      sitterId: "s1",
      start: new Date("2025-03-04T10:30:00Z"),
      end: new Date("2025-03-04T11:30:00Z"),
      respectGoogleBusy: true,
      force: true,
      actorUserId: "user-1",
      bookingId: "booking-1",
    });

    expect(result.allowed).toBe(true);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("checkAssignmentAllowed returns allowed:true when no conflicts", async () => {
    mockDb.booking.findMany.mockResolvedValue([]);

    const result = await checkAssignmentAllowed({
      db: mockDb as any,
      orgId: "org-1",
      sitterId: "s1",
      // 15:00Z-16:00Z is 09:00-10:00 in America/Chicago (inside configured rule)
      start: new Date("2025-03-04T15:00:00Z"),
      end: new Date("2025-03-04T16:00:00Z"),
      respectGoogleBusy: true,
      force: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.conflicts).toEqual([]);
  });
});
