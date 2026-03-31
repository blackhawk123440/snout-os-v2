/**
 * Baseline Snapshots
 * 
 * Captures pricing totals across different views for comparison
 */

import { prisma } from "@/lib/db";
import { calculatePriceBreakdown } from "@/lib/booking-utils";

export interface BaselineSnapshot {
  id: string;
  bookingId: string;
  timestamp: Date;
  bookingFormTotal: number | null;
  calendarViewTotal: number | null;
  sitterDashboardTotal: number | null;
  ownerDashboardTotal: number | null;
  stripePaymentTotal: number | null;
  storedTotalPrice: number | null;
  calculatedBreakdown: any | null;
  notes: string | null;
}

/**
 * Capture a baseline snapshot for a booking
 */
export async function captureBaselineSnapshot(
  bookingId: string,
  options: {
    bookingFormTotal?: number;
    calendarViewTotal?: number;
    sitterDashboardTotal?: number;
    ownerDashboardTotal?: number;
    stripePaymentTotal?: number;
    notes?: string;
  } = {}
): Promise<BaselineSnapshot> {
  // Note: Booking model not available in messaging dashboard schema
  // Baseline snapshots not available for messaging-only deployments
  throw new Error('Baseline snapshots not available - Booking model not in messaging dashboard schema');
}

/**
 * Get all snapshots for a booking
 */
export async function getBaselineSnapshots(bookingId: string): Promise<BaselineSnapshot[]> {
  // Note: BaselineSnapshot model not available in messaging dashboard schema
  return [];
}

/**
 * Get all snapshots
 */
export async function getAllBaselineSnapshots(): Promise<BaselineSnapshot[]> {
  // Note: BaselineSnapshot model not available in messaging dashboard schema
  return [];
}

/**
 * Compare snapshot values and identify mismatches
 */
export function findMismatches(snapshot: BaselineSnapshot): Array<{
  source: string;
  value: number;
  expected: number;
  difference: number;
}> {
  const mismatches: Array<{
    source: string;
    value: number;
    expected: number;
    difference: number;
  }> = [];

  // Use calculated breakdown total as the expected value
  const expectedTotal =
    snapshot.calculatedBreakdown?.total ?? snapshot.storedTotalPrice ?? null;

  if (expectedTotal === null) {
    return mismatches; // Can't compare if no expected value
  }

  const sources = [
    { name: "bookingFormTotal", value: snapshot.bookingFormTotal },
    { name: "calendarViewTotal", value: snapshot.calendarViewTotal },
    { name: "sitterDashboardTotal", value: snapshot.sitterDashboardTotal },
    { name: "ownerDashboardTotal", value: snapshot.ownerDashboardTotal },
    { name: "stripePaymentTotal", value: snapshot.stripePaymentTotal },
    { name: "storedTotalPrice", value: snapshot.storedTotalPrice },
  ];

  for (const source of sources) {
    if (source.value !== null && source.value !== undefined) {
      const difference = Math.abs(source.value - expectedTotal);
      // Allow small floating point differences (0.01)
      if (difference > 0.01) {
        mismatches.push({
          source: source.name,
          value: source.value,
          expected: expectedTotal,
          difference,
        });
      }
    }
  }

  return mismatches;
}

