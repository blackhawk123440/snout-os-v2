/**
 * Messaging Invariants
 * 
 * Enforces critical system invariants for messaging operations.
 * These invariants must NEVER be violated in production.
 */

import { prisma } from "@/lib/db";
import { logMessagingEvent } from "./audit-trail";

export interface InvariantViolation {
  invariant: string;
  violation: string;
  context: Record<string, any>;
}

/**
 * INVARIANT 1: Outbound messages must be thread-bound
 * 
 * Every outbound message MUST have a valid threadId.
 * The thread must exist and belong to the organization.
 */
export async function enforceThreadBoundSending(
  threadId: string,
  orgId: string
): Promise<{ valid: boolean; violation?: InvariantViolation }> {
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    select: { id: true, orgId: true },
  });

  if (!thread) {
    return {
      valid: false,
      violation: {
        invariant: 'thread-bound-sending',
        violation: 'Thread does not exist',
        context: { threadId, orgId },
      },
    };
  }

  if (thread.orgId !== orgId) {
    return {
      valid: false,
      violation: {
        invariant: 'thread-bound-sending',
        violation: 'Thread does not belong to organization',
        context: { threadId, orgId, threadOrgId: thread.orgId },
      },
    };
  }

  return { valid: true };
}

/**
 * INVARIANT 2: from_number always equals thread.messageNumber
 * 
 * When sending an outbound message, the from_number MUST match
 * the thread's assigned messageNumber.e164.
 */
export async function enforceFromNumberMatchesThread(
  threadId: string,
  fromNumberE164: string
): Promise<{ valid: boolean; violation?: InvariantViolation; expectedNumber?: string }> {
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: {
      messageNumber: {
        select: { e164: true },
      },
    },
  });

  if (!thread) {
    return {
      valid: false,
      violation: {
        invariant: 'from-number-matches-thread',
        violation: 'Thread does not exist',
        context: { threadId, fromNumberE164 },
      },
    };
  }

  if (!thread.messageNumber) {
    return {
      valid: false,
      violation: {
        invariant: 'from-number-matches-thread',
        violation: 'Thread has no assigned message number',
        context: { threadId, fromNumberE164 },
      },
    };
  }

  const expectedNumber = thread.messageNumber.e164;
  if (fromNumberE164 !== expectedNumber) {
    return {
      valid: false,
      violation: {
        invariant: 'from-number-matches-thread',
        violation: 'from_number does not match thread.messageNumber.e164',
        context: { threadId, expectedNumber: expectedNumber ? '***' + expectedNumber.slice(-4) : undefined },
      },
      expectedNumber,
    };
  }

  return { valid: true, expectedNumber };
}

/**
 * INVARIANT 3: Pool inbound unknown sender → owner inbox + alert
 * 
 * When an inbound message arrives at a pool number from an unknown sender
 * (no existing thread), it MUST be routed to owner inbox and an alert created.
 */
export async function enforcePoolUnknownSenderRouting(
  messageNumberId: string,
  fromNumberE164: string,
  orgId: string
): Promise<{ valid: boolean; violation?: InvariantViolation; routedToOwner: boolean }> {
  const messageNumber = await prisma.messageNumber.findUnique({
    where: { id: messageNumberId },
    select: { id: true, numberClass: true, orgId: true },
  });

  if (!messageNumber) {
    return {
      valid: false,
      violation: {
        invariant: 'pool-unknown-sender-routing',
        violation: 'Message number does not exist',
        context: { messageNumberId, fromNumberE164, orgId },
      },
      routedToOwner: false,
    };
  }

  if (messageNumber.orgId !== orgId) {
    return {
      valid: false,
      violation: {
        invariant: 'pool-unknown-sender-routing',
        violation: 'Message number does not belong to organization',
        context: { messageNumberId, fromNumberE164, orgId, numberOrgId: messageNumber.orgId },
      },
      routedToOwner: false,
    };
  }

  // Check if this is a pool number
  if (messageNumber.numberClass !== 'pool') {
    // Not a pool number - invariant doesn't apply
    return { valid: true, routedToOwner: false };
  }

  const existingThread = await prisma.messageThread.findFirst({
    where: {
      orgId,
      participants: {
        some: {
          role: 'client',
          realE164: fromNumberE164,
        },
      },
    },
    select: { id: true },
  });

  if (existingThread) {
    // Thread exists - not an unknown sender
    return { valid: true, routedToOwner: false };
  }

  // Unknown sender to pool number - must route to owner
  // This is a validation check - actual routing happens in webhook handler
  return { valid: true, routedToOwner: true };
}

/**
 * Log invariant violation to audit trail
 */
export async function logInvariantViolation(
  violation: InvariantViolation,
  orgId: string
): Promise<void> {
  await logMessagingEvent({
    orgId,
    eventType: 'invariant.violation' as any, // invariant.violation not in MessagingAuditEventType, but needed for audit
    metadata: {
      invariant: violation.invariant,
      violation: violation.violation,
      context: violation.context,
    },
  });
}

/**
 * Check all invariants for outbound message
 */
export async function checkOutboundInvariants(
  threadId: string,
  orgId: string,
  fromNumberE164: string
): Promise<{ valid: boolean; violations: InvariantViolation[] }> {
  const violations: InvariantViolation[] = [];

  // Check thread-bound sending
  const threadBound = await enforceThreadBoundSending(threadId, orgId);
  if (!threadBound.valid && threadBound.violation) {
    violations.push(threadBound.violation);
  }

  // Check from_number matches thread
  const fromNumberMatch = await enforceFromNumberMatchesThread(threadId, fromNumberE164);
  if (!fromNumberMatch.valid && fromNumberMatch.violation) {
    violations.push(fromNumberMatch.violation);
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
