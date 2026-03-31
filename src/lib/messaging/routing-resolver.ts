/**
 * Routing Resolver — DEAD SCAFFOLDING
 *
 * WARNING: This module is NOT used by any production code path.
 * The actual inbound routing happens directly in the webhook handlers
 * (twilio/route.ts and openphone/route.ts) via direct Prisma calls.
 *
 * Functions `resolveInboundSms` and `resolveOutboundMessage` are only
 * referenced in test mocks. Several helper functions return hardcoded
 * null/throw due to schema mismatches (Booking model not available).
 *
 * Do not rely on this module for production routing.
 */

import { prisma } from '@/lib/db';
import type { MessagingProvider } from './provider';
// Helper functions for booking/assignment queries
async function getActiveBookingForClient(
  orgId: string,
  clientId: string,
  now: Date
): Promise<{ id: string; sitterId: string | null } | null> {
  // Note: Client model doesn't have phone field - use ClientContact instead
  // Note: Booking model doesn't exist in messaging dashboard schema
  // This functionality should be handled by the API service
  return null;
}

async function getActiveAssignment(
  orgId: string,
  bookingId: string,
  sitterUserId: string,
  now: Date
): Promise<{ id: string } | null> {
  // Find sitter by user relation
  // Note: User model doesn't have sitterId field - use sitter relation instead
  const user = await prisma.user.findFirst({
    where: { id: sitterUserId },
    include: { sitter: { select: { id: true } } },
  });
  
  const sitterId = user?.sitter?.id || sitterUserId;
  
  // Note: AssignmentWindow model doesn't have bookingId or status fields
  // Field names are: startAt, endAt
  const assignment = await (prisma as any).assignmentWindow.findFirst({
    where: {
      orgId,
      sitterId,
      startAt: { lte: now },
      endAt: { gte: now },
      // Note: AssignmentWindow doesn't have status field
    },
    select: { id: true },
  });
  
  return assignment;
}
import { findOrCreateOwnerInboxThread } from './owner-inbox-routing';

export interface InboundRoutingResult {
  threadId: string;
  threadType: 'RELATIONSHIP' | 'JOB' | 'BROADCAST_INTERNAL';
  deliverTo: {
    owner: boolean;
    sitterUserIds: string[];
  };
  autoResponse?: string;
  fromNumberToUse?: string;
}

export interface OutboundRoutingResult {
  allowed: boolean;
  fromNumberToUse: string;
  reasonIfBlocked?: string;
}

/**
 * Resolve routing for inbound SMS message
 * 
 * Determines which thread the message should be delivered to and who should receive it.
 * 
 * @param params - Routing parameters
 * @param provider - Messaging provider instance
 * @returns Routing result with thread ID and delivery targets
 */
export async function resolveInboundSms(
  params: {
    orgId: string;
    toNumberE164: string;
    fromNumberE164: string;
    now: Date;
  },
  provider: MessagingProvider
): Promise<InboundRoutingResult> {
  const { orgId, toNumberE164, fromNumberE164, now } = params;

  // Find client by phone (raw SQL to avoid ClientContact.orgld bug)
  const { findClientContactByPhone } = await import('./client-contact-lookup');
  const clientContactRow = await findClientContactByPhone(orgId, fromNumberE164);
  const client = clientContactRow
    ? await (prisma as any).client.findUnique({ where: { id: clientContactRow.clientId } })
    : null;

  if (!client) {
    // No client found - route to owner inbox
    const ownerThread = await findOrCreateOwnerInboxThread(orgId);
    return {
      threadId: ownerThread.id,
      threadType: 'RELATIONSHIP',
      deliverTo: {
        owner: true,
        sitterUserIds: [],
      },
    };
  }

  // Check for active booking
  const activeBooking = await getActiveBookingForClient(orgId, client.id, now);

  if (!activeBooking || !activeBooking.sitterId) {
    // No active booking - route to relationship thread or owner inbox
    // Find or create relationship thread
    // Note: Thread model doesn't have 'scope' field - use threadType instead
    let thread = await (prisma as any).thread.findFirst({
      where: {
        orgId,
        clientId: client.id,
        threadType: 'other', // Use 'other' for internal/relationship threads
      },
    });

    if (!thread) {
      // Thread model requires: orgId, clientId, numberId, threadType, status
      // We need a numberId - this should be handled by the API service
      // For now, return error or use placeholder
      throw new Error('Thread creation requires numberId - this should be handled by the API service');
    }

    return {
      threadId: thread.id,
      threadType: 'RELATIONSHIP',
      deliverTo: {
        owner: true,
        sitterUserIds: [],
      },
    };
  }

  // Active booking exists - find or create JOB thread
  // Note: Thread model doesn't have bookingId or scope - use threadType='assignment'
  let jobThread = await (prisma as any).thread.findFirst({
    where: {
      orgId,
      clientId: client.id,
      sitterId: activeBooking.sitterId,
      threadType: 'assignment', // Use 'assignment' for job threads
    },
  });

  if (!jobThread) {
    // Thread model requires: orgId, clientId, numberId, threadType, status
    // We need a numberId - this should be handled by the API service
    throw new Error('Thread creation requires numberId - this should be handled by the API service');
  }

  // Check for active assignment window
  // Sitter model doesn't have userId - need to find via User relation
  // Note: User model doesn't have sitterId field - use sitter relation instead
  const user = await prisma.user.findFirst({
    where: { sitter: { id: activeBooking.sitterId } },
    select: { id: true },
  });

  const sitterUserId = user?.id || null;

  if (sitterUserId) {
    const activeAssignment = await getActiveAssignment(
      orgId,
      activeBooking.id,
      sitterUserId,
      now
    );

    if (activeAssignment) {
      // Active window - deliver to sitter
      return {
        threadId: jobThread.id,
        threadType: 'JOB',
        deliverTo: {
          owner: false,
          sitterUserIds: [sitterUserId],
        },
      };
    }
  }

  // No active window - route to owner inbox
  return {
    threadId: jobThread.id,
    threadType: 'JOB',
    deliverTo: {
      owner: true,
      sitterUserIds: [],
    },
  };
}

/**
 * Resolve routing for outbound message
 * 
 * Determines if the message can be sent and which number to use.
 * 
 * @param params - Outbound routing parameters
 * @returns Routing result with send permission and from number
 */
export async function resolveOutboundMessage(
  params: {
    orgId: string;
    senderUserId: string;
    threadId: string;
    now: Date;
  }
): Promise<OutboundRoutingResult> {
  const { orgId, senderUserId, threadId, now } = params;

  // Get thread
  const thread = await (prisma as any).thread.findUnique({
    where: {
      id: threadId,
      orgId,
    },
    include: {
      messageNumber: true,
    },
  });

  if (!thread) {
    return {
      allowed: false,
      fromNumberToUse: '',
      reasonIfBlocked: 'Thread not found',
    };
  }

  // Get from number
  const fromNumber = thread.messageNumber?.e164 || '';

  // For now, allow all outbound messages
  // Window gating and other checks are handled elsewhere
  return {
    allowed: true,
    fromNumberToUse: fromNumber,
  };
}
