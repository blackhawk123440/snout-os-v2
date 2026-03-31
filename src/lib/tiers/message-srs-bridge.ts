/**
 * Message SRS Bridge
 * 
 * Shared function that can be called from both Next.js and NestJS
 * Processes messages for SRS responsiveness tracking
 * 
 * This is a direct function call (not HTTP) to avoid:
 * - Auth dependency
 * - Base URL dependency
 * - Deployment topology mismatch
 * - Retry duplication risk
 * - Silent failures
 */

import { prisma } from '@/lib/db';
import { requiresResponse, linkResponseToRequiringMessage } from './message-instrumentation';

/**
 * Process a message for SRS tracking
 * 
 * This function:
 * 1. Creates or updates MessageEvent record (bridging from Message to MessageEvent)
 * 2. Sets requiresResponse flag if needed
 * 3. Links response if this is a reply
 * 
 * @param orgId - Organization ID
 * @param threadId - MessageThread ID
 * @param messageId - Message ID (from NestJS Message or Next.js MessageEvent)
 * @param message - Message data
 */
export async function processMessageForSRS(
  orgId: string,
  threadId: string,
  messageId: string,
  message: {
    direction: string;
    actorType: string;
    body: string;
    hasPolicyViolation?: boolean;
    createdAt: Date;
  }
): Promise<void> {
  try {
    // Create or update MessageEvent record (bridge from Message to MessageEvent)
    const messageEvent = await (prisma as any).messageEvent.upsert({
      where: { id: messageId },
      create: {
        id: messageId,
        orgId,
        threadId,
        direction: message.direction,
        actorType: message.actorType,
        body: message.body,
        requiresResponse: false, // Will be set below
        createdAt: message.createdAt,
        deliveryStatus: message.direction === 'inbound' ? 'received' : 'queued',
      },
      update: {
        body: message.body,
      },
    });

    // Update requiresResponse flag
    const needsResponse = requiresResponse(message);
    if (needsResponse) {
      await (prisma as any).messageEvent.update({
        where: { id: messageEvent.id },
        data: { requiresResponse: true },
      });
    }

    // If this is a response (sitter/owner), link it
    if (message.actorType === 'sitter' || message.actorType === 'owner') {
      await linkResponseToRequiringMessage(
        orgId,
        threadId,
        messageEvent.id,
        message.actorType,
        message.createdAt
      );
    }
  } catch (error) {
    // Log but don't throw - SRS processing shouldn't block message creation
    console.error('[SRS Bridge] Failed to process message for SRS:', error);
    // TODO: Create alert/audit event for SRS processing failures
  }
}
