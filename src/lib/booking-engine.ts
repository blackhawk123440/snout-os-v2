/**
 * Booking Engine Extensions
 * 
 * Provides overlap detection, travel time calculation, and sitter recommendations
 */

import { prisma } from "@/lib/db";

interface TimeSlot {
  startAt: Date;
  endAt: Date;
  duration?: number;
}

interface BookingConflict {
  bookingId: string;
  conflictType: "overlap" | "travel_time" | "both";
  overlapMinutes: number;
  travelTimeMinutes: number;
  message: string;
}

interface SitterRecommendation {
  sitterId: string;
  sitter: {
    id: string;
    firstName: string;
    lastName: string;
    active: boolean;
    currentTier?: {
      priorityLevel: number;
    };
  };
  score: number;
  reasons: string[];
  conflicts: BookingConflict[];
}

/**
 * Calculate travel time between two addresses (in minutes)
 * This is a simplified version - in production, use a real geocoding/distance API
 */
export function calculateTravelTime(
  address1: string,
  address2: string,
  averageSpeedMph: number = 30
): number {
  // Simplified: assume 1 mile per minute at 30mph average
  // In production, use Google Maps API or similar
  // For now, return a default travel time based on address similarity
  if (!address1 || !address2) {
    return 15; // Default 15 minutes if addresses missing
  }

  // If addresses are very similar (same street), assume 5 minutes
  const addr1Normalized = address1.toLowerCase().trim();
  const addr2Normalized = address2.toLowerCase().trim();
  
  if (addr1Normalized === addr2Normalized) {
    return 5;
  }

  // Extract zip codes if available
  const zip1 = addr1Normalized.match(/\b\d{5}\b/)?.[0];
  const zip2 = addr2Normalized.match(/\b\d{5}\b/)?.[0];
  
  if (zip1 && zip2 && zip1 === zip2) {
    return 10; // Same zip code = 10 minutes
  }

  // Default travel time
  return 15;
}

/**
 * Check if two time slots overlap
 */
export function timeSlotsOverlap(
  slot1: TimeSlot,
  slot2: TimeSlot
): { overlaps: boolean; overlapMinutes: number } {
  const start1 = new Date(slot1.startAt).getTime();
  const end1 = new Date(slot1.endAt).getTime();
  const start2 = new Date(slot2.startAt).getTime();
  const end2 = new Date(slot2.endAt).getTime();

  // Check for overlap
  const overlaps = start1 < end2 && start2 < end1;

  if (!overlaps) {
    return { overlaps: false, overlapMinutes: 0 };
  }

  // Calculate overlap duration
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  const overlapMinutes = Math.round((overlapEnd - overlapStart) / (1000 * 60));

  return { overlaps: true, overlapMinutes };
}

/**
 * Check if there's enough travel time between two bookings
 */
export function hasEnoughTravelTime(
  booking1End: Date,
  booking2Start: Date,
  requiredTravelMinutes: number
): boolean {
  const timeBetween = (new Date(booking2Start).getTime() - new Date(booking1End).getTime()) / (1000 * 60);
  return timeBetween >= requiredTravelMinutes;
}

/**
 * Detect conflicts for a booking with existing bookings
 */
export async function detectBookingConflicts(
  bookingId: string,
  timeSlots: TimeSlot[],
  address: string,
  sitterId?: string
): Promise<BookingConflict[]> {
  const conflicts: BookingConflict[] = [];

  // Get existing bookings for the same sitter (or all bookings if no sitter specified)
  const where: any = {
    status: { in: ["pending", "confirmed"] },
    id: { not: bookingId },
  };

  if (sitterId) {
    where.sitterId = sitterId;
  }

  // Note: Booking model not available in messaging dashboard schema
  // Return empty array - booking conflict checking not available
  return [];
}

/**
 * Get sitter recommendations for a booking
 */
export async function getSitterRecommendations(
  bookingId: string,
  service: string,
  timeSlots: TimeSlot[],
  address: string,
  petCount: number
): Promise<SitterRecommendation[]> {
  // Note: Booking model not available in messaging dashboard schema
  // Return empty array - sitter recommendations not available
  return [];
}

/**
 * Check if a booking can be assigned to a sitter
 */
export async function canAssignSitter(
  bookingId: string,
  sitterId: string,
  timeSlots: TimeSlot[],
  address: string
): Promise<{ canAssign: boolean; conflicts: BookingConflict[]; message: string }> {
  const conflicts = await detectBookingConflicts(
    bookingId,
    timeSlots,
    address,
    sitterId
  );

  const hasOverlap = conflicts.some(c => c.conflictType === "overlap");
  const hasTravelTimeIssue = conflicts.some(c => c.conflictType === "travel_time");

  if (hasOverlap) {
    return {
      canAssign: false,
      conflicts,
      message: "Cannot assign: booking overlaps with existing bookings",
    };
  }

  if (hasTravelTimeIssue) {
    return {
      canAssign: false,
      conflicts,
      message: "Cannot assign: insufficient travel time between bookings",
    };
  }

  return {
    canAssign: true,
    conflicts: [],
    message: "Sitter can be assigned",
  };
}



