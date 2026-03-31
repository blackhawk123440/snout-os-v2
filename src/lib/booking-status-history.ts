/**
 * Booking Status History
 * 
 * Master Spec Reference: Section 3.3.3
 * 
 * Per Master Spec 3.3.3: "Booking status history is immutable and stored."
 * 
 * Helper functions for tracking booking status changes with audit trail.
 */

import { prisma } from "./db";

export interface StatusChangeMetadata {
  [key: string]: any;
}

/**
 * Log a booking status change to status history
 * 
 * Creates an immutable record of the status change with:
 * - Previous status (fromStatus)
 * - New status (toStatus)
 * - User who made the change (changedBy)
 * - Optional reason and metadata
 * 
 * Per Master Spec 3.3.3: History is immutable - no updates or deletes allowed.
 */
export async function logBookingStatusChange(
  bookingId: string,
  toStatus: string,
  options?: {
    fromStatus?: string | null;
    changedBy?: string | null;
    reason?: string | null;
    metadata?: StatusChangeMetadata;
  }
): Promise<void> {
  try {
    // Use type assertion since Prisma client may not be generated yet
    await (prisma as any).bookingStatusHistory.create({
      data: {
        bookingId,
        fromStatus: options?.fromStatus || null,
        toStatus,
        changedBy: options?.changedBy || null,
        reason: options?.reason || null,
        metadata: options?.metadata ? JSON.stringify(options.metadata) : null,
      },
    });
  } catch (error) {
    // Don't throw - status history logging failures shouldn't break booking updates
    console.error(`[BookingStatusHistory] Failed to log status change for booking ${bookingId}:`, error);
  }
}

/**
 * Get status history for a booking
 * 
 * Returns all status changes for a booking, ordered by creation date (oldest first).
 */
export async function getBookingStatusHistory(bookingId: string) {
  // Use type assertion since Prisma client may not be generated yet
  return await (prisma as any).bookingStatusHistory.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    include: {
      booking: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          service: true,
        },
      },
    },
  });
}

