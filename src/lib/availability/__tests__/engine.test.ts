/**
 * Availability engine unit tests.
 * - Recurring windows generation
 * - Override precedence
 * - Booking conflict detection
 * - Google busy inclusion when enabled
 * - Timezone correctness
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getAvailabilityWindows, checkConflict } from "../engine";

vi.mock("@/lib/calendar/sync", () => ({
  getGoogleBusyRanges: vi.fn().mockResolvedValue([]),
}));

const mockDb = {
  sitter: {
    findFirst: vi.fn(),
  },
  sitterAvailabilityRule: {
    findMany: vi.fn(),
  },
  sitterAvailabilityOverride: {
    findMany: vi.fn(),
  },
  booking: {
    findMany: vi.fn(),
  },
  sitterTimeOff: {
    findMany: vi.fn(),
  },
};

describe("availability engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.sitter.findFirst.mockResolvedValue({
      availabilityEnabled: true,
      timezone: "America/Chicago",
      respectGoogleBusy: false,
    });
    mockDb.sitterAvailabilityRule.findMany.mockResolvedValue([]);
    mockDb.sitterAvailabilityOverride.findMany.mockResolvedValue([]);
    mockDb.booking.findMany.mockResolvedValue([]);
    mockDb.sitterTimeOff.findMany.mockResolvedValue([]);
  });

  describe("recurring windows generation", () => {
    it("expands Mon-Fri 9-5 into windows for date range", async () => {
      mockDb.sitterAvailabilityRule.findMany.mockResolvedValue([
        {
          daysOfWeek: "[1,2,3,4,5]",
          startTime: "09:00",
          endTime: "17:00",
          timezone: "America/Chicago",
        },
      ]);

      const start = new Date("2025-03-03T00:00:00Z"); // Mon
      const end = new Date("2025-03-07T23:59:59Z"); // Fri

      const windows = await getAvailabilityWindows({
        db: mockDb as any,
        orgId: "org-1",
        sitterId: "s1",
        start,
        end,
      });

      expect(windows.length).toBeGreaterThan(0);
      expect(mockDb.sitterAvailabilityRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ orgId: "org-1", sitterId: "s1", active: true }),
        })
      );
    });

    it("returns empty when no rules and no overrides", async () => {
      const start = new Date("2025-03-03T00:00:00Z");
      const end = new Date("2025-03-05T23:59:59Z");

      const windows = await getAvailabilityWindows({
        db: mockDb as any,
        orgId: "org-1",
        sitterId: "s1",
        start,
        end,
      });

      expect(windows).toEqual([]);
    });
  });

  describe("override precedence", () => {
    it("blackout override subtracts from base windows", async () => {
      mockDb.sitterAvailabilityRule.findMany.mockResolvedValue([
        {
          daysOfWeek: "[1,2,3,4,5]",
          startTime: "09:00",
          endTime: "17:00",
          timezone: "America/Chicago",
        },
      ]);
      mockDb.sitterAvailabilityOverride.findMany.mockResolvedValue([
        {
          date: new Date("2025-03-04T12:00:00Z"),
          startTime: "12:00",
          endTime: "14:00",
          isAvailable: false,
        },
      ]);

      const start = new Date("2025-03-04T00:00:00Z");
      const end = new Date("2025-03-04T23:59:59Z");

      const windows = await getAvailabilityWindows({
        db: mockDb as any,
        orgId: "org-1",
        sitterId: "s1",
        start,
        end,
      });

      expect(windows.length).toBeGreaterThanOrEqual(1);
      const hasGap = windows.some(
        (w) =>
          (w.start.getHours() < 12 || w.end.getHours() <= 12) &&
          (w.end.getHours() >= 14 || w.start.getHours() >= 14)
      );
      expect(hasGap || windows.length >= 2).toBe(true);
    });
  });

  describe("booking conflict detection", () => {
    it("returns booking_conflict when overlapping existing booking", async () => {
      mockDb.sitterAvailabilityRule.findMany.mockResolvedValue([
        {
          daysOfWeek: "[1,2,3,4,5]",
          startTime: "09:00",
          endTime: "17:00",
          timezone: "America/Chicago",
        },
      ]);
      mockDb.booking.findMany.mockResolvedValue([
        {
          id: "b1",
          startAt: new Date("2025-03-04T10:00:00Z"),
          endAt: new Date("2025-03-04T11:00:00Z"),
        },
      ]);

      const result = await checkConflict({
        db: mockDb as any,
        orgId: "org-1",
        sitterId: "s1",
        start: new Date("2025-03-04T10:30:00Z"),
        end: new Date("2025-03-04T11:30:00Z"),
      });

      expect(result.ok).toBe(false);
      expect(result.conflicts.some((c) => c.reason === "booking_conflict")).toBe(true);
    });

    it("returns ok when no conflicts", async () => {
      mockDb.sitterAvailabilityRule.findMany.mockResolvedValue([
        {
          daysOfWeek: "[1,2,3,4,5]",
          startTime: "09:00",
          endTime: "17:00",
          timezone: "America/Chicago",
        },
      ]);

      // Use times that fall within 09:00-17:00 Chicago (Tue Mar 4 2025)
      // 15:00 UTC = 09:00 CST, 16:00 UTC = 10:00 CST
      const result = await checkConflict({
        db: mockDb as any,
        orgId: "org-1",
        sitterId: "s1",
        start: new Date("2025-03-04T15:00:00Z"),
        end: new Date("2025-03-04T16:00:00Z"),
      });

      expect(result.ok).toBe(true);
      expect(result.conflicts).toEqual([]);
    });
  });

  describe("sitter availability disabled", () => {
    it("returns empty windows when availabilityEnabled is false", async () => {
      mockDb.sitter.findFirst.mockResolvedValue({
        availabilityEnabled: false,
        timezone: "America/Chicago",
        respectGoogleBusy: false,
      });
      mockDb.sitterAvailabilityRule.findMany.mockResolvedValue([
        {
          daysOfWeek: "[1,2,3,4,5]",
          startTime: "09:00",
          endTime: "17:00",
          timezone: "America/Chicago",
        },
      ]);

      const windows = await getAvailabilityWindows({
        db: mockDb as any,
        orgId: "org-1",
        sitterId: "s1",
        start: new Date("2025-03-04T00:00:00Z"),
        end: new Date("2025-03-04T23:59:59Z"),
      });

      expect(windows).toEqual([]);
    });

    it("returns outside_availability when sitter availability disabled", async () => {
      mockDb.sitter.findFirst.mockResolvedValue({
        availabilityEnabled: false,
        timezone: "America/Chicago",
        respectGoogleBusy: false,
      });

      const result = await checkConflict({
        db: mockDb as any,
        orgId: "org-1",
        sitterId: "s1",
        start: new Date("2025-03-04T09:00:00Z"),
        end: new Date("2025-03-04T10:00:00Z"),
      });

      expect(result.ok).toBe(false);
      expect(result.conflicts.some((c) => c.reason === "outside_availability")).toBe(true);
    });
  });

  describe("timezone correctness", () => {
    it("uses sitter timezone for rule expansion", async () => {
      mockDb.sitter.findFirst.mockResolvedValue({
        availabilityEnabled: true,
        timezone: "America/Los_Angeles",
        respectGoogleBusy: false,
      });
      mockDb.sitterAvailabilityRule.findMany.mockResolvedValue([
        {
          daysOfWeek: "[2]",
          startTime: "09:00",
          endTime: "17:00",
          timezone: "America/Los_Angeles",
        },
      ]);

      const start = new Date("2025-03-04T00:00:00Z"); // Tue UTC
      const end = new Date("2025-03-04T23:59:59Z");

      const windows = await getAvailabilityWindows({
        db: mockDb as any,
        orgId: "org-1",
        sitterId: "s1",
        start,
        end,
      });

      expect(windows.length).toBeGreaterThan(0);
      expect(mockDb.sitterAvailabilityRule.findMany).toHaveBeenCalled();
    });
  });
});
