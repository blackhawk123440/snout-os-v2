/**
 * Audit Event Helper
 * 
 * Centralized helper for writing audit/event logs for sitter actions.
 * Uses EventLog model (exists in Prisma schema).
 */

import { prisma } from '@/lib/db';

export interface AuditEventParams {
  orgId: string;
  sitterId: string;
  eventType: string;
  actorType: 'owner' | 'sitter' | 'system' | 'automation';
  actorId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  bookingId?: string;
  correlationId?: string;
}

/**
 * Record an audit event for sitter actions
 */
export async function recordSitterAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await (prisma as any).eventLog.create({
      data: {
        eventType: params.eventType,
        status: 'success',
        bookingId: params.bookingId || null,
        metadata: JSON.stringify({
          orgId: params.orgId,
          sitterId: params.sitterId,
          actorType: params.actorType,
          actorId: params.actorId,
          entityType: params.entityType,
          entityId: params.entityId,
          correlationId: params.correlationId ?? null,
          ...params.metadata,
        }),
        createdAt: new Date(),
      },
    });
  } catch (error: any) {
    // Don't throw - audit failures shouldn't break the application
    console.error('[Audit Event] Failed to record event:', {
      eventType: params.eventType,
      sitterId: params.sitterId,
      error: error.message,
    });
  }
}

/**
 * Record offer accepted event
 */
export async function recordOfferAccepted(
  orgId: string,
  sitterId: string,
  bookingId: string,
  offerId: string,
  responseSeconds: number,
  actorId?: string,
  correlationId?: string
): Promise<void> {
  await recordSitterAuditEvent({
    orgId,
    sitterId,
    eventType: 'offer.accepted',
    actorType: 'sitter',
    actorId: actorId || sitterId,
    entityType: 'offer',
    entityId: offerId,
    bookingId,
    correlationId,
    metadata: {
      responseSeconds,
      offerId,
    },
  });
}

/**
 * Record offer declined event
 */
export async function recordOfferDeclined(
  orgId: string,
  sitterId: string,
  bookingId: string,
  offerId: string,
  responseSeconds: number,
  reason?: string,
  actorId?: string,
  correlationId?: string
): Promise<void> {
  await recordSitterAuditEvent({
    orgId,
    sitterId,
    eventType: 'offer.declined',
    actorType: 'sitter',
    actorId: actorId || sitterId,
    entityType: 'offer',
    entityId: offerId,
    bookingId,
    correlationId,
    metadata: {
      responseSeconds,
      offerId,
      reason: reason || 'declined',
    },
  });
}

/**
 * Record offer expired event
 */
export async function recordOfferExpired(
  orgId: string,
  sitterId: string,
  bookingId: string,
  offerId: string,
  actorId?: string,
  correlationId?: string
): Promise<void> {
  await recordSitterAuditEvent({
    orgId,
    sitterId,
    eventType: 'offer.expired',
    actorType: 'system',
    actorId: actorId || 'system',
    entityType: 'offer',
    entityId: offerId,
    bookingId,
    correlationId,
    metadata: {
      offerId,
    },
  });
}

/**
 * Record sitter status changed event
 */
export async function recordSitterStatusChanged(
  orgId: string,
  sitterId: string,
  oldStatus: string,
  newStatus: string,
  actorId?: string,
  correlationId?: string
): Promise<void> {
  await recordSitterAuditEvent({
    orgId,
    sitterId,
    eventType: 'sitter.status_changed',
    actorType: actorId ? 'owner' : 'system',
    actorId: actorId || 'system',
    entityType: 'sitter',
    entityId: sitterId,
    correlationId,
    metadata: {
      oldStatus,
      newStatus,
    },
  });
}

/**
 * Record tier changed event
 */
export async function recordTierChanged(
  orgId: string,
  sitterId: string,
  oldTier: string | null,
  newTier: string,
  reason: string,
  actorId?: string,
  correlationId?: string
): Promise<void> {
  await recordSitterAuditEvent({
    orgId,
    sitterId,
    eventType: 'tier.changed',
    actorType: 'system',
    actorId: actorId || 'system',
    entityType: 'sitter',
    entityId: sitterId,
    correlationId,
    metadata: {
      oldTier,
      newTier,
      reason,
    },
  });
}

/**
 * Record availability toggled event
 */
export async function recordAvailabilityToggled(
  orgId: string,
  sitterId: string,
  isAvailable: boolean,
  actorId?: string,
  correlationId?: string
): Promise<void> {
  await recordSitterAuditEvent({
    orgId,
    sitterId,
    eventType: 'sitter.availability_changed',
    actorType: actorId ? 'sitter' : 'owner',
    actorId: actorId || 'system',
    entityType: 'sitter',
    entityId: sitterId,
    correlationId,
    metadata: {
      isAvailable,
    },
  });
}

/**
 * Record offer accept blocked event
 */
export async function recordOfferAcceptBlocked(
  orgId: string,
  sitterId: string,
  bookingId: string,
  offerId: string,
  reason: string,
  actorId?: string,
  correlationId?: string
): Promise<void> {
  await recordSitterAuditEvent({
    orgId,
    sitterId,
    eventType: 'offer.accept_blocked',
    actorType: 'sitter',
    actorId: actorId || sitterId,
    entityType: 'offer',
    entityId: offerId,
    bookingId,
    correlationId,
    metadata: {
      offerId,
      reason,
    },
  });
}

/**
 * Record offer reassigned event
 */
export async function recordOfferReassigned(
  orgId: string,
  fromSitterId: string,
  toSitterId: string,
  bookingId: string,
  offerId: string,
  reason: string,
  actorId?: string,
  correlationId?: string
): Promise<void> {
  await recordSitterAuditEvent({
    orgId,
    sitterId: toSitterId, // Primary sitter is the new one
    eventType: 'offer.reassigned',
    actorType: 'system',
    actorId: actorId || 'system',
    entityType: 'offer',
    entityId: offerId,
    bookingId,
    correlationId,
    metadata: {
      fromSitterId,
      toSitterId,
      offerId,
      reason,
    },
  });
}

/**
 * Record offer exhausted event (max attempts reached)
 */
export async function recordOfferExhausted(
  orgId: string,
  bookingId: string,
  attempts: number,
  reason: string,
  actorId?: string,
  correlationId?: string
): Promise<void> {
  await recordSitterAuditEvent({
    orgId,
    sitterId: 'system', // System-level event
    eventType: 'offer.exhausted',
    actorType: 'system',
    actorId: actorId || 'system',
    entityType: 'booking',
    entityId: bookingId,
    bookingId,
    correlationId,
    metadata: {
      bookingId,
      attempts,
      reason,
    },
  });
}

/**
 * Record manual dispatch required event
 */
export async function recordManualDispatchRequired(
  orgId: string,
  bookingId: string,
  reason: string,
  actorId?: string,
  correlationId?: string
): Promise<void> {
  await recordSitterAuditEvent({
    orgId,
    sitterId: 'system', // System-level event
    eventType: 'dispatch.manual_required',
    actorType: 'system',
    actorId: actorId || 'system',
    entityType: 'booking',
    entityId: bookingId,
    bookingId,
    correlationId,
    metadata: {
      bookingId,
      reason,
    },
  });
}
