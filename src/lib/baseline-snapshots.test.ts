/**
 * Tests for Baseline Snapshots
 */

import { findMismatches } from "./baseline-snapshots";

describe("findMismatches", () => {
  it("should find no mismatches when all values match", () => {
    const snapshot = {
      id: "1",
      bookingId: "booking-1",
      timestamp: new Date(),
      bookingFormTotal: 100.0,
      calendarViewTotal: 100.0,
      sitterDashboardTotal: 100.0,
      ownerDashboardTotal: 100.0,
      stripePaymentTotal: null,
      storedTotalPrice: 100.0,
      calculatedBreakdown: { total: 100.0 },
      notes: null,
    };

    const mismatches = findMismatches(snapshot);
    expect(mismatches).toHaveLength(0);
  });

  it("should find mismatches when values differ", () => {
    const snapshot = {
      id: "1",
      bookingId: "booking-1",
      timestamp: new Date(),
      bookingFormTotal: 100.0,
      calendarViewTotal: 105.0, // Mismatch
      sitterDashboardTotal: 100.0,
      ownerDashboardTotal: 100.0,
      stripePaymentTotal: null,
      storedTotalPrice: 100.0,
      calculatedBreakdown: { total: 100.0 },
      notes: null,
    };

    const mismatches = findMismatches(snapshot);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].source).toBe("calendarViewTotal");
    expect(mismatches[0].value).toBe(105.0);
    expect(mismatches[0].expected).toBe(100.0);
    expect(mismatches[0].difference).toBe(5.0);
  });

  it("should ignore small floating point differences", () => {
    const snapshot = {
      id: "1",
      bookingId: "booking-1",
      timestamp: new Date(),
      bookingFormTotal: 100.005, // Very small difference
      calendarViewTotal: null,
      sitterDashboardTotal: null,
      ownerDashboardTotal: null,
      stripePaymentTotal: null,
      storedTotalPrice: 100.0,
      calculatedBreakdown: { total: 100.0 },
      notes: null,
    };

    const mismatches = findMismatches(snapshot);
    expect(mismatches).toHaveLength(0); // Should ignore < 0.01 difference
  });

  it("should handle null values", () => {
    const snapshot = {
      id: "1",
      bookingId: "booking-1",
      timestamp: new Date(),
      bookingFormTotal: null,
      calendarViewTotal: null,
      sitterDashboardTotal: null,
      ownerDashboardTotal: null,
      stripePaymentTotal: null,
      storedTotalPrice: 100.0,
      calculatedBreakdown: { total: 100.0 },
      notes: null,
    };

    const mismatches = findMismatches(snapshot);
    // When all view totals are null, only storedTotalPrice is checked
    // Since storedTotalPrice (100.0) matches calculatedBreakdown.total (100.0), there's no mismatch
    expect(mismatches).toHaveLength(0);
  });

  it("should use storedTotalPrice when calculatedBreakdown is null", () => {
    const snapshot = {
      id: "1",
      bookingId: "booking-1",
      timestamp: new Date(),
      bookingFormTotal: 105.0,
      calendarViewTotal: null,
      sitterDashboardTotal: null,
      ownerDashboardTotal: null,
      stripePaymentTotal: null,
      storedTotalPrice: 100.0,
      calculatedBreakdown: null,
      notes: null,
    };

    const mismatches = findMismatches(snapshot);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].expected).toBe(100.0); // Uses storedTotalPrice
  });

  it("should return empty array when no expected value exists", () => {
    const snapshot = {
      id: "1",
      bookingId: "booking-1",
      timestamp: new Date(),
      bookingFormTotal: 100.0,
      calendarViewTotal: null,
      sitterDashboardTotal: null,
      ownerDashboardTotal: null,
      stripePaymentTotal: null,
      storedTotalPrice: null,
      calculatedBreakdown: null,
      notes: null,
    };

    const mismatches = findMismatches(snapshot);
    expect(mismatches).toHaveLength(0); // Can't compare without expected value
  });
});

