/**
 * Client Classification Helpers — DEAD SCAFFOLDING
 *
 * WARNING: This module's only production caller is proactive-thread-creation.ts,
 * which throws immediately before using the classification result.
 * Both helper functions (checkBookingRecurrenceFlags, checkForActiveWeeklyPlan)
 * are stubs that return false — classification always returns isOneTimeClient: true.
 *
 * These stubs are harmless (no runtime crash, no silent false success) but
 * provide no real classification. Kept for test compatibility.
 */

import { prisma } from '@/lib/db';

/**
 * Determine if a client is one-time or recurring
 * 
 * Classification rules (per Messaging Master Spec V1):
 * 1. Primary: Check explicit recurrence flags on booking (if booking linked)
 * 2. Primary: Check for active weekly plan signal
 * 3. Default: One-time if no explicit recurrence signal
 * 4. Secondary: Booking count may be used as heuristic, but never override explicit flags
 * 
 * @param context - Context for classification
 * @returns isOneTimeClient boolean
 */
export async function determineClientClassification(context: {
  clientId?: string | null;
  bookingId?: string | null;
  orgId: string;
}): Promise<{ isOneTimeClient: boolean; isRecurringClient: boolean }> {
  // Rule 1 (Primary): If booking is linked, check explicit recurrence flags
  // Note: Booking model not available in messaging dashboard schema
  // For messaging-only deployments, skip booking-based classification
  if (context.bookingId) {
    // Booking model doesn't exist - default to one-time
    return {
      isOneTimeClient: true,
      isRecurringClient: false,
    };
  }

  // Rule 2 (Primary): If client has active weekly plan, mark as recurring
  if (context.clientId) {
    const hasWeeklyPlan = await checkForActiveWeeklyPlan(
      context.clientId,
      context.orgId
    );

    if (hasWeeklyPlan) {
      return {
        isOneTimeClient: false,
        isRecurringClient: true,
      };
    }
  }

  // Rule 3 (Default): No explicit recurrence signal - default to one-time
  return {
    isOneTimeClient: true,
    isRecurringClient: false,
  };
}

/**
 * Check for explicit recurrence flags on booking
 * 
 * Looks for explicit recurrence indicators:
 * - isRecurring flag on booking (when implemented)
 * - Recurrence metadata in booking custom fields
 * - Part of recurring booking series
 * 
 * @param bookingId - Booking ID to check
 * @returns true if explicit recurrence signal exists
 */
async function checkBookingRecurrenceFlags(bookingId: string): Promise<boolean> {
  // TODO: Implement when recurrence system is added
  // For now, return false (no explicit recurrence flags exist yet)
  // This ensures we default to one-time when no explicit signal
  
  // Future implementation:
  // - Check booking.isRecurring flag
  // - Check booking.recurrenceSeriesId
  // - Check custom fields for recurrence metadata
  
  return false;
}

/**
 * Check booking count as secondary heuristic (never overrides explicit flags)
 * 
 * Note: This function is kept for reference but is not used in primary classification.
 * Booking count may be used as a secondary heuristic in the future, but it must
 * never override explicit recurrence flags or active weekly plan signals.
 */
async function getBookingCountHeuristic(
  clientId: string
): Promise<number> {
  // Note: Booking model not available in messaging dashboard schema
  return 0;
}

/**
 * Check if client has active weekly plan
 * 
 * Note: Weekly plan system not yet implemented in schema.
 * This is a placeholder for future implementation.
 * 
 * For now, we'll check for recurring booking patterns instead.
 */
async function checkForActiveWeeklyPlan(
  clientId: string,
  orgId: string
): Promise<boolean> {
  // TODO: Implement weekly plan check when weekly plan system is added
  // For now, return false (no weekly plans exist yet)
  return false;
}
