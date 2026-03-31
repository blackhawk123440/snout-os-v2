/**
 * Messaging Audit Trail
 * 
 * Step 8: Comprehensive audit logging for messaging events.
 * 
 * Provides functions to log messaging events for operational control and trust.
 */

import { prisma } from '@/lib/db';

export type MessagingAuditEventType =
  | 'inbound_received'
  | 'outbound_queued'
  | 'outbound_sent'
  | 'outbound_blocked'
  | 'delivery_failure'
  | 'routing_auto_response'
  | 'policy_violation';

export interface LogMessagingEventParams {
  orgId: string;
  eventType: MessagingAuditEventType;
  threadId?: string;
  messageId?: string;
  actorUserId?: string;
  metadata?: Record<string, any>;
}

/**
 * Log a messaging audit event
 * 
 * Creates a MessagingAuditEvent record for operational visibility.
 * 
 * @param params - Event parameters
 */
export async function logMessagingEvent(
  params: LogMessagingEventParams
): Promise<void> {
  try {
    // Persist to EventLog (the existing audit event model)
    await prisma.eventLog.create({
      data: {
        orgId: params.orgId,
        eventType: `messaging.${params.eventType}`,
        status: 'success',
        metadata: JSON.stringify({
          threadId: params.threadId,
          messageId: params.messageId,
          actorUserId: params.actorUserId,
          ...params.metadata,
        }),
      },
    });
  } catch (error) {
    // Don't throw - audit logging failures shouldn't break the application
    console.error('[AuditTrail] Failed to log messaging event:', error);
  }
}

/**
 * Get messaging audit events
 * 
 * Retrieves audit events for a given organization with optional filtering.
 * 
 * @param orgId - Organization ID
 * @param params - Query parameters
 * @returns Array of audit events
 */
export async function getMessagingAuditEvents(
  orgId: string,
  params: {
    limit?: number;
    offset?: number;
    eventType?: MessagingAuditEventType;
    threadId?: string;
    actorUserId?: string;
  } = {}
): Promise<Array<{
  id: string;
  orgId: string;
  eventType: string;
  threadId: string | null;
  messageId: string | null;
  actorUserId: string | null;
  metadataJson: string | null;
  createdAt: Date;
}>> {
  const { limit = 50, offset = 0, eventType, threadId, actorUserId } = params;

  const where: Record<string, unknown> = {
    orgId,
    eventType: eventType ? `messaging.${eventType}` : { startsWith: 'messaging.' },
  };

  const rows = await prisma.eventLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
  });

  return rows.map((r: any) => {
    let parsed: Record<string, any> = {};
    try { parsed = JSON.parse(r.metadata || '{}'); } catch {}
    // Filter by threadId/actorUserId in-memory (metadata is JSON text)
    if (threadId && parsed.threadId !== threadId) return null;
    if (actorUserId && parsed.actorUserId !== actorUserId) return null;
    return {
      id: r.id,
      orgId: r.orgId,
      eventType: r.eventType.replace('messaging.', ''),
      threadId: parsed.threadId ?? null,
      messageId: parsed.messageId ?? null,
      actorUserId: parsed.actorUserId ?? null,
      metadataJson: r.metadata,
      createdAt: r.createdAt,
    };
  }).filter(Boolean) as any;
}
