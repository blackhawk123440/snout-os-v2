/**
 * Event Hooks for SRS System
 * 
 * Call these functions when events occur to feed the SRS system
 */

import { prisma } from '@/lib/db';
import { processMessageEvent, linkResponseToRequiringMessage } from './message-instrumentation';

/**
 * Process a MessageEvent for SRS responsiveness tracking
 * Call this after creating a MessageEvent
 */
export async function onMessageEventCreated(
  orgId: string,
  threadId: string,
  messageEventId: string,
  message: {
    direction: string;
    actorType: string;
    body: string;
    hasPolicyViolation?: boolean;
    createdAt: Date;
  }
): Promise<void> {
  try {
    await processMessageEvent(orgId, threadId, messageEventId, message);
  } catch (error) {
    console.error('[SRS] Failed to process message event:', error);
    // Don't throw - SRS processing shouldn't block message creation
  }
}

/**
 * Create OfferEvent when a sitter is offered work
 * Call this when SitterPoolOffer is created or when sitter is assigned to booking
 */
export async function onCreateOffer(
  orgId: string,
  sitterId: string,
  bookingId: string,
  threadId: string | null,
  options: {
    withinAvailability?: boolean;
    leadTimeValid?: boolean;
    routingValid?: boolean;
  } = {}
): Promise<string> {
  const offerEvent = await (prisma as any).offerEvent.create({
    data: {
      orgId,
      sitterId,
      bookingId,
      threadId,
      offeredAt: new Date(),
      withinAvailability: options.withinAvailability ?? true,
      leadTimeValid: options.leadTimeValid ?? true,
      routingValid: options.routingValid ?? true,
      excluded: false,
    },
  });

  return offerEvent.id;
}

/**
 * Record offer acceptance
 */
export async function onOfferAccepted(
  orgId: string,
  sitterId: string,
  bookingId: string
): Promise<void> {
  const offerEvent = await (prisma as any).offerEvent.findFirst({
    where: {
      orgId,
      sitterId,
      bookingId,
      acceptedAt: null,
      declinedAt: null,
    },
    orderBy: { offeredAt: 'desc' },
  });

  if (offerEvent) {
    await (prisma as any).offerEvent.update({
      where: { id: offerEvent.id },
      data: { acceptedAt: new Date() },
    });
  }
}

/**
 * Record offer decline
 */
export async function onOfferDeclined(
  orgId: string,
  sitterId: string,
  bookingId: string,
  reason?: string
): Promise<void> {
  const offerEvent = await (prisma as any).offerEvent.findFirst({
    where: {
      orgId,
      sitterId,
      bookingId,
      acceptedAt: null,
      declinedAt: null,
    },
    orderBy: { offeredAt: 'desc' },
  });

  if (offerEvent) {
    await (prisma as any).offerEvent.update({
      where: { id: offerEvent.id },
      data: {
        declinedAt: new Date(),
        declineReason: reason || 'declined',
      },
    });
  }
}

/**
 * Create VisitEvent when a visit is recorded
 */
export async function onCreateVisit(
  orgId: string,
  sitterId: string,
  bookingId: string,
  visit: {
    scheduledStart: Date;
    scheduledEnd: Date;
    checkInAt?: Date;
    checkOutAt?: Date;
    status: 'completed' | 'late' | 'missed' | 'canceled';
    lateMinutes?: number;
    checklistMissedCount?: number;
    mediaMissingCount?: number;
    complaintVerified?: boolean;
    safetyFlag?: boolean;
    excluded?: boolean;
    excludedReason?: string;
    threadId?: string;
  }
): Promise<string> {
  const visitEvent = await (prisma as any).visitEvent.create({
    data: {
      orgId,
      sitterId,
      bookingId,
      threadId: visit.threadId || null,
      scheduledStart: visit.scheduledStart,
      scheduledEnd: visit.scheduledEnd,
      checkInAt: visit.checkInAt || null,
      checkOutAt: visit.checkOutAt || null,
      status: visit.status,
      lateMinutes: visit.lateMinutes || 0,
      checklistMissedCount: visit.checklistMissedCount || 0,
      mediaMissingCount: visit.mediaMissingCount || 0,
      complaintVerified: visit.complaintVerified || false,
      safetyFlag: visit.safetyFlag || false,
      excluded: visit.excluded || false,
      excludedReason: visit.excludedReason || null,
    },
  });

  return visitEvent.id;
}

/**
 * Update visit event (e.g., when check-in/check-out occurs)
 */
export async function onVisitUpdated(
  visitEventId: string,
  updates: {
    checkInAt?: Date;
    checkOutAt?: Date;
    status?: 'completed' | 'late' | 'missed' | 'canceled';
    lateMinutes?: number;
    checklistMissedCount?: number;
    mediaMissingCount?: number;
    complaintVerified?: boolean;
    safetyFlag?: boolean;
  }
): Promise<void> {
  await (prisma as any).visitEvent.update({
    where: { id: visitEventId },
    data: updates,
  });
}
