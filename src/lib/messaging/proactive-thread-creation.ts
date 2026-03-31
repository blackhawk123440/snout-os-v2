/**
 * Proactive Thread Creation
 * 
 * Phase 4.3: Operational Integration Upgrade
 * 
 * On booking assignment for weekly clients, proactively creates or links:
 * - MessageThread
 * - MessageNumber assignment
 * - AssignmentWindow with buffers
 * 
 * Ensures idempotency: No duplicate threads, no duplicate windows
 */

import { prisma } from '@/lib/db';
import { determineClientClassification } from './client-classification';
import { assignNumberToThread, determineThreadNumberClass } from './number-helpers';
import { findOrCreateAssignmentWindow } from './window-helpers';
import { getDefaultOrgId } from './org-helpers';
import { TwilioProvider } from './providers/twilio';

/**
 * Ensure proactive thread creation for booking assignment
 * 
 * Called when:
 * - Booking is assigned to a sitter
 * - Only for weekly/recurring clients (not one-time)
 * - Feature flag ENABLE_PROACTIVE_THREAD_CREATION must be enabled
 * 
 * Idempotent: Can be called multiple times without creating duplicates
 * 
 * @param bookingId - Booking ID
 * @param sitterId - Assigned sitter ID
 * @param orgId - Organization ID (optional)
 * @returns Thread ID and window ID, or null if skipped
 */
export async function ensureProactiveThreadCreation(
  bookingId: string,
  sitterId: string,
  orgId?: string
): Promise<{
  threadId: string;
  windowId: string;
  numberClass: string;
} | null> {
  // Check feature flag
  const { env } = await import('@/lib/env');
  if (!env.ENABLE_PROACTIVE_THREAD_CREATION) {
    return null; // Feature flag disabled, skip proactive creation
  }

  // Note: Booking model doesn't exist in messaging dashboard schema
  // This function is disabled - proactive thread creation handled by API service
  throw new Error('Proactive thread creation not available - Booking model not in messaging schema');
  
  // Disabled code:
  // const resolvedOrgId = orgId || (await getDefaultOrgId());
  // const booking = await prisma.booking.findUnique({ ... });

  // Find or create thread for this booking and client
  // Note: Thread model doesn't have bookingId, scope, assignedSitterId, isOneTimeClient, or isMeetAndGreet
  // Thread model requires: orgId, clientId, numberId, threadType, status
  // This functionality should be handled by the API service
  // For now, return null to skip proactive creation
  return null;
}

/**
 * Handle booking reassignment (sitter change)
 * 
 * Updates existing thread assignment and window sitter ID
 * 
 * @param bookingId - Booking ID
 * @param newSitterId - New assigned sitter ID
 * @param orgId - Organization ID (optional)
 */
export async function handleBookingReassignment(
  bookingId: string,
  newSitterId: string | null,
  orgId?: string
): Promise<void> {
  const resolvedOrgId = orgId || (await getDefaultOrgId());

  // Note: Thread model doesn't have bookingId or assignedSitterId
  // Thread model uses sitterId, not assignedSitterId
  // This functionality should be handled by the API service
  // For now, this is a no-op
  return;

  if (newSitterId) {
    // Get booking for window update
    // Note: Booking model not available in messaging dashboard schema
    const booking = null;
    // Original code (commented out):
    // await prisma.booking.findUnique({
    //   where: { id: bookingId },
    //   select: {
    //     startAt: true,
    //     endAt: true,
    //     service: true,
    //   },
    // });

    // Note: Booking model not available, so skip window update
    // Original code (commented out - Booking model not in API schema):
    // if (booking && booking.startAt && booking.endAt && booking.service) {
    //   const windowId = await findOrCreateAssignmentWindow(
    //     bookingId,
    //     thread.id,
    //     newSitterId,
    //     booking.startAt,
    //     booking.endAt,
    //     booking.service,
    //     resolvedOrgId
    //   );
    //   await prisma.messageThread.update({
    //     where: { id: thread.id },
    //     data: { assignmentWindowId: windowId },
    //   });
    //   const numberClass = await determineThreadNumberClass({
    //     assignedSitterId: newSitterId,
    //     isMeetAndGreet: thread.isMeetAndGreet || false,
    //     isOneTimeClient: thread.isOneTimeClient || false,
    //   });
    //   const provider = new TwilioProvider();
    //   await assignNumberToThread(
    //     thread.id,
    //     numberClass,
    //     resolvedOrgId,
    //     provider,
    //     {
    //       sitterId: newSitterId,
    //       isOneTimeClient: thread.isOneTimeClient || undefined,
    //       isMeetAndGreet: thread.isMeetAndGreet || undefined,
    //     }
    //   );
    // }
  } else {
    // Sitter unassigned - close active windows
    const { closeAllBookingWindows } = await import('./window-helpers');
    await closeAllBookingWindows(bookingId);
  }
}
