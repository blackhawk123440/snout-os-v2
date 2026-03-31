/**
 * Dispatch Control Helper
 * 
 * Owner-facing control and visibility for the dispatch system.
 * Enforces valid dispatchStatus transitions and provides override actions.
 */

import { prisma } from '@/lib/db';
import { recordSitterAuditEvent } from '@/lib/audit-events';
import { enqueueCalendarSync } from '@/lib/calendar-queue';
import { emitBookingUpdated } from '@/lib/event-emitter';
import { ensureEventQueueBridge } from '@/lib/event-queue-bridge-init';
import { checkAssignmentAllowed } from '@/lib/availability/booking-conflict';
import { syncConversationLifecycleWithBookingWorkflow } from '@/lib/messaging/conversation-service';

export type DispatchStatus = 'auto' | 'manual_required' | 'manual_in_progress' | 'assigned';

/**
 * Valid dispatch status transitions
 * 
 * Rules:
 * - auto -> manual_required: When automation exhausts or fails
 * - auto -> assigned: Direct assignment (bypasses automation)
 * - manual_required -> manual_in_progress: Owner starts working on it
 * - manual_required -> assigned: Owner assigns directly
 * - manual_required -> auto: Owner resumes automation (retry)
 * - manual_in_progress -> assigned: Owner completes assignment
 * - assigned -> auto: Resume automation (for future bookings)
 */
const VALID_TRANSITIONS: Record<DispatchStatus, DispatchStatus[]> = {
  auto: ['manual_required', 'assigned'],
  manual_required: ['manual_in_progress', 'assigned', 'auto'], // Can resume automation
  manual_in_progress: ['assigned'],
  assigned: ['auto'], // Can resume automation after assignment
};

/**
 * Check if a dispatch status transition is valid
 */
export function isValidDispatchTransition(
  from: DispatchStatus | null,
  to: DispatchStatus
): boolean {
  if (!from) {
    // Null/undefined means 'auto' (default)
    from = 'auto';
  }
  return VALID_TRANSITIONS[from]?.includes(to) || false;
}

/**
 * Force assign a sitter to a booking (owner override)
 *
 * Valid transitions:
 * - manual_required -> assigned
 * - manual_in_progress -> assigned
 * - auto -> assigned (if booking is unassigned)
 *
 * When force=false and conflicts exist, throws AvailabilityConflictError (caller returns 409).
 * When force=true, logs override and proceeds.
 */
export async function forceAssignSitter(
  orgId: string,
  bookingId: string,
  sitterId: string,
  reason: string,
  actorId: string,
  options?: { force?: boolean; correlationId?: string }
): Promise<void> {
  // Get current booking state (need startAt/endAt for conflict check); org-scoped to prevent cross-org mutation
  const booking = await (prisma as any).booking.findFirst({
    where: { id: bookingId, orgId },
    select: {
      dispatchStatus: true,
      sitterId: true,
      status: true,
      startAt: true,
      endAt: true,
      clientId: true,
      phone: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  const { allowed, conflicts } = await checkAssignmentAllowed({
    db: prisma as any,
    orgId,
    sitterId,
    start: booking.startAt,
    end: booking.endAt,
    excludeBookingId: bookingId,
    respectGoogleBusy: true,
    force: options?.force ?? false,
    actorUserId: actorId,
    bookingId,
  });

  if (!allowed) {
    const { AvailabilityConflictError } = await import('@/lib/availability/booking-conflict');
    throw new AvailabilityConflictError('Sitter assignment conflicts with availability', conflicts);
  }

  const currentStatus: DispatchStatus = (booking.dispatchStatus || 'auto') as DispatchStatus;

  // Validate transition
  if (!isValidDispatchTransition(currentStatus, 'assigned')) {
    throw new Error(
      `Invalid transition from ${currentStatus} to assigned. Valid transitions: ${VALID_TRANSITIONS[currentStatus]?.join(', ') || 'none'}`
    );
  }

  // Verify sitter exists and is active
  const sitter = await (prisma as any).sitter.findUnique({
    where: { id: sitterId },
    select: { active: true },
  });

  if (!sitter) {
    throw new Error(`Sitter ${sitterId} not found`);
  }

  if (!sitter.active) {
    throw new Error(`Sitter ${sitterId} is not active`);
  }

  // Reassignment: Enqueue delete of old sitter's calendar event
  const previousSitterId = booking.sitterId;
  if (previousSitterId && previousSitterId !== sitterId) {
    enqueueCalendarSync({
      type: 'delete',
      bookingId,
      sitterId: previousSitterId,
      orgId,
      correlationId: options?.correlationId,
    }).catch((e) => console.error('[Force Assign] calendar delete enqueue failed:', e));
  }

  const previousStatus = booking.status;

  // Update booking (org-scoped)
  await (prisma as any).booking.updateMany({
    where: { id: bookingId, orgId },
    data: {
      sitterId: sitterId,
      dispatchStatus: 'assigned',
      status: 'confirmed',
    },
  });
  await syncConversationLifecycleWithBookingWorkflow({
    orgId,
    bookingId,
    clientId: booking.clientId,
    phone: booking.phone,
    firstName: booking.firstName,
    lastName: booking.lastName,
    sitterId,
    bookingStatus: 'confirmed',
    serviceWindowStart: booking.startAt,
    serviceWindowEnd: booking.endAt,
  }).catch((error) => {
    console.error('[Force Assign] lifecycle sync failed:', error);
  });

  if (previousStatus !== 'confirmed') {
    try {
      await ensureEventQueueBridge();
      const updated = await (prisma as any).booking.findFirst({
        where: { id: bookingId, orgId },
        include: { pets: true, timeSlots: true, sitter: true, client: true },
      });
      if (updated) await emitBookingUpdated(updated, previousStatus, options?.correlationId);
    } catch (err) {
      console.error('[Force Assign] Failed to emit booking.status.changed:', err);
    }
  }

  // Record audit event
  await recordSitterAuditEvent({
    orgId,
    sitterId: sitterId,
    eventType: 'dispatch.force_assign',
    actorType: 'owner',
    actorId: actorId,
    entityType: 'booking',
    entityId: bookingId,
    bookingId,
    correlationId: options?.correlationId,
    metadata: {
      fromStatus: currentStatus,
      toStatus: 'assigned',
      reason,
      bookingId,
      sitterId,
    },
  });

  // Enqueue calendar sync for new sitter (fail-open)
  enqueueCalendarSync({ type: 'upsert', bookingId, orgId, correlationId: options?.correlationId }).catch((e) =>
    console.error('[Force Assign] calendar sync enqueue failed:', e)
  );
}

/**
 * Resume automation for a booking (owner override)
 * 
 * Valid transitions:
 * - assigned -> auto (after assignment, can resume automation)
 * - manual_required -> auto (if owner wants to retry automation)
 * 
 * Note: manual_in_progress cannot resume automation (must assign first)
 */
export async function resumeAutomation(
  orgId: string,
  bookingId: string,
  reason: string,
  actorId: string,
  options?: { correlationId?: string }
): Promise<void> {
  // Get current booking state; org-scoped
  const booking = await (prisma as any).booking.findFirst({
    where: { id: bookingId, orgId },
    select: {
      dispatchStatus: true,
      sitterId: true,
      status: true,
    },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  const currentStatus: DispatchStatus = (booking.dispatchStatus || 'auto') as DispatchStatus;

  // Validate transition
  if (!isValidDispatchTransition(currentStatus, 'auto')) {
    throw new Error(
      `Invalid transition from ${currentStatus} to auto. Valid transitions: ${VALID_TRANSITIONS[currentStatus]?.join(', ') || 'none'}`
    );
  }

  // Update booking (org-scoped)
  await (prisma as any).booking.updateMany({
    where: { id: bookingId, orgId },
    data: {
      dispatchStatus: 'auto',
      manualDispatchReason: null,
      manualDispatchAt: null,
      // Keep sitterId if already assigned, otherwise leave unassigned for automation
    },
  });

  // Record audit event
  await recordSitterAuditEvent({
    orgId,
    sitterId: booking.sitterId || 'system',
    eventType: 'dispatch.resume_automation',
    actorType: 'owner',
    actorId: actorId,
    entityType: 'booking',
    entityId: bookingId,
    bookingId,
    correlationId: options?.correlationId,
    metadata: {
      fromStatus: currentStatus,
      toStatus: 'auto',
      reason,
      bookingId,
    },
  });
}
