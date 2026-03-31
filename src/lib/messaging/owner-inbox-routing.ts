/**
 * Owner Inbox Routing Helpers
 * 
 * Phase 1.3.3: Owner Inbox Routing Scaffolding
 * 
 * Helper hooks for routing messages to owner inbox outside assignment windows.
 * Full window enforcement deferred to Phase 2.
 */

import { prisma } from '@/lib/db';
import type { InboundMessage } from './provider';
import { logEvent } from '../event-logger';

/**
 * Route message to owner inbox
 * 
 * Used when:
 * - Message arrives outside assignment window (Phase 2)
 * - Pool number mismatch detected (Phase 1.3.1)
 * - Manual routing required
 * 
 * @param inboundMessage - Inbound message to route
 * @param orgId - Organization ID
 * @param reason - Reason for routing to owner inbox
 * @returns Owner inbox thread ID and message event ID
 */
export async function routeToOwnerInbox(
  inboundMessage: InboundMessage,
  orgId: string,
  reason: string
): Promise<{
  ownerThreadId: string;
  messageEventId: string;
}> {
  // Find or create owner inbox thread
  const ownerThread = await findOrCreateOwnerInboxThread(orgId);

  // Create inbound message in owner inbox
  // Note: messageEvent model doesn't exist - using Message instead
  const message = await (prisma as any).message.create({
    data: {
      threadId: ownerThread.id,
      orgId,
      direction: 'inbound',
      senderType: 'client',
      providerMessageSid: inboundMessage.messageSid,
      body: inboundMessage.body,
      // Note: mediaUrls would need to be stored differently in Message model
      // Message model doesn't have mediaJson field
    },
  });

  // Update owner inbox thread timestamps
  // Thread model has: lastActivityAt, ownerUnreadCount (not lastInboundAt or lastMessageAt)
  await (prisma as any).thread.update({
    where: { id: ownerThread.id },
    data: {
      lastActivityAt: inboundMessage.timestamp,
      ownerUnreadCount: {
        increment: 1,
      },
    },
  });

  // Log audit event
  try {
    await logEvent(
      'messaging.routedToOwnerInbox',
      'success',
      {
        metadata: {
          ownerThreadId: ownerThread.id,
          messageId: message.id,
          senderE164: inboundMessage.from,
          reason,
        },
      }
    );
  } catch (error) {
    console.error('[owner-inbox-routing] Failed to log event:', error);
    // Continue - logging failure shouldn't block routing
  }

  return {
    ownerThreadId: ownerThread.id,
    messageEventId: message.id, // Keep same return type for compatibility
  };
}

/**
 * Find or create owner inbox thread
 * 
 * Owner inbox is a special thread for routing messages that require owner attention.
 * There is exactly one owner inbox thread per org.
 */
export async function findOrCreateOwnerInboxThread(orgId: string) {
  // Ensure prisma is initialized
  if (!prisma) {
    throw new Error('Prisma client not initialized. Ensure DATABASE_URL is set.');
  }

  // Look for existing owner inbox thread
  // Thread model doesn't have 'scope' field - use threadType='other' and specific clientId pattern
  // For owner inbox, we'll use a special clientId pattern or find by threadType
  const existing = await (prisma as any).thread.findFirst({
    where: {
      orgId,
      threadType: 'other', // Owner inbox can be 'other' type
      // Note: Thread model requires clientId, so we can't use null
      // We'll need to create a special client for owner inbox or use a different approach
    },
  });

  if (existing) {
    return existing;
  }

  // Thread model requires: orgId, clientId (required), numberId (required), threadType, status.
  // Cannot create without a real clientId and numberId.
  // NOTE: This code path is currently unreachable from production — all callers are test-only.
  // If this becomes reachable, it must be given a real clientId and numberId.
  throw new Error(
    `Cannot create owner inbox thread for org ${orgId}: Thread model requires clientId and numberId. ` +
    'Owner inbox thread must be pre-created via setup or admin flow.'
  );
}

/**
 * Check if message should be routed to owner inbox
 * 
 * Phase 2: Full window enforcement
 * Uses routing resolution engine to determine if message should route to owner inbox
 * 
 * @param threadId - Thread ID
 * @param timestamp - Message timestamp
 * @returns true if should route to owner inbox
 */
export async function shouldRouteToOwnerInbox(
  threadId: string,
  timestamp: Date
): Promise<{ shouldRoute: boolean; reason?: string }> {
  // Phase 2: Use routing resolution engine
  const { resolveRoutingForInboundMessage } = await import('./routing-resolution');
  
  const resolution = await resolveRoutingForInboundMessage(threadId, timestamp);
  
  return {
    shouldRoute: resolution.target === 'owner_inbox',
    reason: resolution.reason,
  };
}
