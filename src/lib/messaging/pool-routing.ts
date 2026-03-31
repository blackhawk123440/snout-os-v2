/**
 * Pool Number Routing Helpers
 * 
 * Phase 1.3.1: Pool Mismatch Behavior
 * 
 * Handles pool number routing mismatches according to Messaging Master Spec V1:
 * - Route inbound message to owner inbox
 * - Send immediate auto-response to sender
 * - Record audit event
 */

import { prisma } from '@/lib/db';
import type { InboundMessage, MessagingProvider } from './provider';
import { getDefaultOrgId } from './org-helpers';
import { logEvent } from '../event-logger';
import { findOrCreateOwnerInboxThread } from './owner-inbox-routing';
import { env } from '@/lib/env';
import { sendDirectMessage } from './send';

/**
 * Handle pool number routing mismatch
 * 
 * When a pool number receives an inbound from a sender who is not mapped
 * to an active thread, we must:
 * 1. Route message to owner inbox
 * 2. Send auto-response to sender
 * 3. Record audit event
 */
export async function handlePoolNumberMismatch(
  messageNumberId: string,
  inboundMessage: InboundMessage,
  orgId: string,
  _provider: MessagingProvider
): Promise<{
  ownerThreadId: string;
  autoResponseSent: boolean;
  auditEventId: string;
}> {
  // Step 1: Find or create owner inbox thread
  // Owner inbox is a special thread for routing messages that don't belong to specific client threads
  const ownerThread = await findOrCreateOwnerInboxThread(orgId);

  // Step 2: Create inbound message in owner inbox
  // Note: messageEvent model doesn't exist - using Message instead
  const message = await (prisma as any).message.create({
    data: {
      threadId: ownerThread.id,
      orgId,
      direction: 'inbound',
      senderType: 'client', // Message model uses senderType, not actorType
      providerMessageSid: inboundMessage.messageSid,
      body: inboundMessage.body,
      // Note: Message model doesn't have mediaJson, deliveryStatus, or metadataJson fields
      createdAt: inboundMessage.timestamp,
    },
  });

  // Step 3: Send auto-response to sender
  // Phase 1.3.1: Auto-response must be configurable via env/settings
  const autoResponseText = await getPoolMismatchAutoResponse(orgId);

  let autoResponseSent = false;
  try {
    // Get the pool number's e164 for sending response
    const messageNumber = await prisma.messageNumber.findUnique({
      where: { id: messageNumberId },
    });

    if (messageNumber && messageNumber.providerNumberSid) {
      // Send auto-response from the pool number (or front desk number)
      const responseResult = await sendDirectMessage({
        orgId,
        actor: { role: 'system' },
        toE164: inboundMessage.from,
        fromE164: messageNumber.e164 ?? undefined,
        body: autoResponseText,
        threadId: ownerThread.id,
      });

      if (responseResult.success) {
        autoResponseSent = true;
      }
    }
  } catch (error) {
    console.error('[pool-routing] Failed to send auto-response:', error);
    // Continue - auto-response failure shouldn't block message storage
  }

  // Step 4: Record audit event
  try {
    await logEvent(
      'messaging.poolNumberMismatch',
      'success',
      {
        metadata: {
          messageNumberId,
          senderE164: inboundMessage.from,
          ownerThreadId: ownerThread.id,
          messageId: message.id,
          autoResponseSent,
          reason: 'Sender not mapped to active thread on pool number',
        },
      }
    );
  } catch (error) {
    console.error('[pool-routing] Failed to log audit event:', error);
    // Continue - audit logging failure shouldn't block message storage
  }

  return {
    ownerThreadId: ownerThread.id,
    autoResponseSent,
    auditEventId: message.id, // Use message.id as audit reference
  };
}

/**
 * Get pool mismatch auto-response text from config
 * 
 * Pulls from env or settings:
 * - MESSAGING_POOL_MISMATCH_AUTO_RESPONSE (env, full text)
 * - Or constructs from MESSAGING_BOOKING_LINK and front desk number
 * 
 * Fallback to default message if not configured
 */
async function getPoolMismatchAutoResponse(orgId: string): Promise<string> {
  // Check for explicit auto-response text in env
  const explicitText = process.env.MESSAGING_POOL_MISMATCH_AUTO_RESPONSE;
  if (explicitText) {
    return explicitText;
  }

  // Note: Setting model not available in API schema
  // Use default message

  // Construct from booking link and front desk number
  const bookingLink = process.env.MESSAGING_BOOKING_LINK || 
    await getSetting('links.booking') ||
    env.PUBLIC_BASE_URL + '/booking';

  // Get front desk number for contact info
  const frontDeskNumber = await (prisma as any).messageNumber.findFirst({
    where: {
      orgId,
      numberClass: 'front_desk',
      status: 'active',
    },
  });

  const frontDeskContact = frontDeskNumber 
    ? `front desk at ${frontDeskNumber.e164}` 
    : 'our front desk';

  // Construct message
  if (bookingLink) {
    return `Hi, this is Snout Services. To book again, please contact ${frontDeskContact} or use the booking link: ${bookingLink}`;
  }

  // Fallback to default message
  return `Hi, this is Snout Services. To book again, please contact ${frontDeskContact} or use the booking link.`;
}

/**
 * Helper to get setting value
 */
async function getSetting(key: string): Promise<string | null> {
  // Note: Setting model not available in API schema
  return null;
  // Original code (commented out - Setting model not available):
  // try {
  //   const setting = await prisma.setting.findUnique({
  //     where: { key },
  //   });
  //   return setting?.value || null;
  // } catch {
  //   return null;
  // }
}
