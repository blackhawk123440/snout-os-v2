/**
 * Anti-Poaching Enforcement
 * 
 * Phase 3.2: Enforcement Logic
 * 
 * Handles blocking, audit logging, owner notifications, and warning messages
 */

import { prisma } from '@/lib/db';
import type { MessagingProvider, InboundMessage } from './provider';
import {
  detectAntiPoachingViolations,
  redactViolationsForOwner,
  generateAntiPoachingWarning,
} from './anti-poaching-detection';
import { findOrCreateOwnerInboxThread, routeToOwnerInbox } from './owner-inbox-routing';
import { logEvent } from '../event-logger';
import { getDefaultOrgId } from './org-helpers';
import { sendDirectMessage } from './send';

export interface BlockedMessageResult {
  wasBlocked: boolean;
  messageEventId?: string;
  antiPoachingAttemptId?: string;
  warningSent: boolean;
  ownerNotified: boolean;
}

/**
 * Block a message due to anti-poaching violation
 * 
 * This function:
 * - Creates MessageEvent with blocked flags
 * - Creates AntiPoachingAttempt record
 * - Notifies owner via owner inbox
 * - Sends warning to sender
 * 
 * @param params - Blocking parameters
 * @returns Blocking result
 */
export async function blockAntiPoachingMessage(params: {
  threadId: string;
  orgId: string;
  direction: 'inbound' | 'outbound';
  actorType: 'client' | 'sitter';
  actorId?: string;
  body: string;
  violations: Array<{
    type: 'phone_number' | 'email' | 'url' | 'social_media';
    content: string;
    reason: string;
  }>;
  provider?: MessagingProvider;
  inboundMessage?: InboundMessage; // For inbound messages
  senderE164?: string; // For outbound messages (client phone)
}): Promise<BlockedMessageResult> {
  const { threadId, orgId, direction, actorType, actorId, body, violations } = params;

  // Create MessageEvent with blocked flags in metadata
  const metadataJson = JSON.stringify({
    wasBlocked: true,
    antiPoachingFlagged: true,
    antiPoachingReasons: violations.map(v => v.reason),
    violationTypes: violations.map(v => v.type),
  });

  // Note: messageEvent and antiPoachingAttempt models don't exist in messaging dashboard schema
  // Using Message and PolicyViolation instead
  const primaryViolation = violations[0];
  
  // Create Message with blocked status
  const blockedMessage = await (prisma as any).message.create({
    data: {
      threadId,
      orgId,
      body,
      direction: direction === 'inbound' ? 'inbound' : 'outbound',
      senderType: actorType === 'sitter' ? 'sitter' : 'client',
      senderId: actorId || null,
      hasPolicyViolation: true,
      // Note: delivery status is tracked in MessageDelivery, not Message
    },
  });

  // Create PolicyViolation record for anti-poaching
  // Schema violationType: 'phone' | 'email' | 'url' | 'social' | 'other'
  // Use 'other' for anti-poaching violations
  const policyViolation = await (prisma as any).policyViolation.create({
    data: {
      orgId,
      threadId,
      messageId: blockedMessage.id,
      violationType: 'other', // Schema doesn't have 'anti_poaching', use 'other'
      detectedSummary: violations.map(v => `${v.type}: ${v.content}`).join(' | '),
      detectedRedacted: redactViolationsForOwner(body, violations),
      actionTaken: 'blocked', // Schema field is 'actionTaken', not 'action'
      status: 'open',
    },
  });

  // Notify owner via owner inbox
  const ownerThread = await findOrCreateOwnerInboxThread(orgId);
  const redactedContent = redactViolationsForOwner(body, violations);

  // Create notification message for owner
  const ownerNotificationMessage = await (prisma as any).message.create({
    data: {
      threadId: ownerThread.id,
      orgId,
      body: `[Anti-Poaching Alert] Message blocked from ${actorType === 'sitter' ? 'sitter' : 'client'}. Violations: ${violations.map(v => v.type).join(', ')}. Content preview: ${redactedContent.substring(0, 200)}${redactedContent.length > 200 ? '...' : ''}`,
      direction: 'inbound',
      senderType: 'system',
      hasPolicyViolation: false,
    },
  });

  // Update owner inbox thread
  // Thread model has: lastActivityAt, ownerUnreadCount (but not lastInboundAt or lastMessageAt)
  await (prisma as any).thread.update({
    where: { id: ownerThread.id },
    data: {
      lastActivityAt: new Date(),
      ownerUnreadCount: {
        increment: 1,
      },
    },
  });

  // Send warning to sender
  let warningSent = false;
  if (params.provider) {
    const warningMessage = generateAntiPoachingWarning(violations.map(v => v.type));

    try {
      if (params.inboundMessage) {
        // For inbound: send auto-response
        // Note: Provider will use default from number (the number they sent to)
        const result = await sendDirectMessage({
          orgId,
          actor: { role: 'system' },
          toE164: params.inboundMessage.from,
          body: warningMessage,
          threadId,
        });
        warningSent = result.success;
      } else if (params.senderE164) {
        // For outbound: send warning to sender
        // Find the thread's number to send from
        const thread = await (prisma as any).thread.findUnique({
          where: { id: threadId },
          include: { messageNumber: true },
        });

        if (thread?.messageNumber?.e164) {
          // Note: Provider will use default from number
          const result = await sendDirectMessage({
            orgId,
            actor: { role: 'system' },
            toE164: params.senderE164,
            body: warningMessage,
            threadId,
          });
          warningSent = result.success;
        }
      }
    } catch (error) {
      console.error('[anti-poaching] Failed to send warning:', error);
      // Don't fail the block - warning is best-effort
    }
  }

  // Log audit event
  await logEvent('messaging.antiPoachingBlocked', 'success', {
    metadata: {
      threadId,
      messageId: blockedMessage.id,
      policyViolationId: policyViolation.id,
      actorType,
      violationTypes: violations.map(v => v.type),
    },
  });

  return {
    wasBlocked: true,
    messageEventId: blockedMessage.id,
    antiPoachingAttemptId: policyViolation.id,
    warningSent,
    ownerNotified: true,
  };
}

/**
 * Check if message should be blocked due to anti-poaching
 * 
 * Returns detection result. Caller should handle blocking logic.
 * 
 * @param content - Message body text
 * @returns Detection result
 */
export function checkAntiPoaching(content: string): ReturnType<typeof detectAntiPoachingViolations> {
  return detectAntiPoachingViolations(content);
}
