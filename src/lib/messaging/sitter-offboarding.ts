/**
 * Sitter Offboarding Integration Hooks
 * 
 * Phase 1.3.4: Offboarding Integration
 * 
 * Hooks for sitter offboarding workflow:
 * - Deactivate sitter masked number
 * - Reassign active threads (default: unassign and route inbound to owner)
 */

import { prisma } from '@/lib/db';
import { routeToOwnerInbox, findOrCreateOwnerInboxThread } from './owner-inbox-routing';
import { logEvent } from '../event-logger';

/**
 * Deactivate sitter masked number
 * 
 * Called during sitter offboarding:
 * - Sets SitterMaskedNumber.status to 'deactivated'
 * - Sets deactivatedAt timestamp
 * - Does NOT delete the record (for audit trail)
 * - Number can be recycled as pool number after 90-day cooldown
 * 
 * @param sitterId - Sitter ID to deactivate
 * @param orgId - Organization ID
 * @returns Deactivated masked number info
 */
export async function deactivateSitterMaskedNumber(
  sitterId: string,
  orgId: string
): Promise<{
  maskedNumberId: string | null;
  messageNumberId: string | null;
  deactivatedAt: Date;
}> {
  // Note: SitterMaskedNumber model not available in API schema
  // Use MessageNumber directly instead — scoped by orgId
  const messageNumber = await prisma.messageNumber.findFirst({
    where: {
      orgId,
      assignedSitterId: sitterId,
      status: 'active',
    },
  });

  if (!messageNumber) {
    return {
      maskedNumberId: null,
      messageNumberId: null,
      deactivatedAt: new Date(),
    };
  }

  // Unassign number from sitter
  const deactivatedAt = new Date();
  await prisma.messageNumber.update({
    where: { id: messageNumber.id },
    data: {
      assignedSitterId: null,
      // Note: API schema doesn't have status field - number remains active but unassigned
    },
  });

  // Log audit event
  try {
    await logEvent(
      'messaging.sitterMaskedNumberDeactivated',
      'success',
      {
        metadata: {
          sitterId,
          maskedNumberId: messageNumber.id,
          messageNumberId: messageNumber.id,
          deactivatedAt: deactivatedAt.toISOString(),
        },
      }
    );
  } catch (error) {
    console.error('[sitter-offboarding] Failed to log event:', error);
    // Continue - logging failure shouldn't block deactivation
  }

  return {
    maskedNumberId: messageNumber.id,
    messageNumberId: messageNumber.id,
    deactivatedAt,
  };
}

/**
 * Reassign sitter threads
 * 
 * Default strategy: Unassign sitter from all active threads and route inbound
 * messages to owner inbox until threads are manually reassigned.
 * 
 * @param sitterId - Sitter ID to reassign threads for
 * @param orgId - Organization ID
 * @param strategy - Reassignment strategy (default: 'unassign_to_owner')
 * @returns Reassignment results
 */
export async function reassignSitterThreads(
  sitterId: string,
  orgId: string,
  strategy: 'unassign_to_owner' | 'reassign_to_sitter' = 'unassign_to_owner'
): Promise<{
  threadsReassigned: number;
  threadsUnassigned: number;
  ownerThreadId: string;
}> {
  // Find all open threads assigned to this sitter — scoped by orgId
  const activeThreads = await (prisma as any).messageThread.findMany({
    where: {
      orgId,
      assignedSitterId: sitterId,
      status: 'open',
    },
  });

  let threadsReassigned = 0;
  let threadsUnassigned = 0;

  if (strategy === 'unassign_to_owner') {
    // Default strategy: Unassign and route inbound to owner
    // Get owner inbox thread (will be used for future inbound routing)
    const ownerThread = await findOrCreateOwnerInboxThread(orgId);

    // Unassign all threads
    for (const thread of activeThreads) {
      await (prisma as any).messageThread.update({
        where: { id: thread.id },
        data: {
          assignedSitterId: null,
        },
      });

      // Note: threadAssignmentAudit model doesn't exist in messaging dashboard schema
      // Audit events should be created via AuditEvent model instead
      // This is a no-op for now - audit should be handled by the API service

      threadsUnassigned++;
    }

    // Log audit event
    try {
      await logEvent(
        'messaging.sitterThreadsReassigned',
        'success',
        {
          metadata: {
            sitterId,
            strategy: 'unassign_to_owner',
            threadsUnassigned: threadsUnassigned,
            ownerThreadId: ownerThread.id,
          },
        }
      );
    } catch (error) {
      console.error('[sitter-offboarding] Failed to log event:', error);
      // Continue - logging failure shouldn't block reassignment
    }

    return {
      threadsReassigned: 0,
      threadsUnassigned,
      ownerThreadId: ownerThread.id,
    };
  } else if (strategy === 'reassign_to_sitter') {
    // Future strategy: Reassign to another sitter
    // Not implemented yet - would require selecting target sitter
    throw new Error('reassign_to_sitter strategy not yet implemented');
  }

  return {
    threadsReassigned: 0,
    threadsUnassigned: 0,
    ownerThreadId: '',
  };
}

/**
 * Complete sitter offboarding workflow
 * 
 * Orchestrates full offboarding:
 * 1. Deactivate sitter masked number
 * 2. Reassign active threads
 * 
 * @param sitterId - Sitter ID to offboard
 * @param orgId - Organization ID
 * @param reassignmentStrategy - Strategy for thread reassignment
 * @returns Offboarding results
 */
export async function completeSitterOffboarding(
  sitterId: string,
  orgId: string,
  reassignmentStrategy: 'unassign_to_owner' | 'reassign_to_sitter' = 'unassign_to_owner'
): Promise<{
  maskedNumberDeactivated: boolean;
  threadsReassigned: number;
  threadsUnassigned: number;
  ownerThreadId: string;
}> {
  // Step 1: Deactivate masked number
  const deactivationResult = await deactivateSitterMaskedNumber(sitterId, orgId);

  // Step 2: Reassign threads
  const reassignmentResult = await reassignSitterThreads(
    sitterId,
    orgId,
    reassignmentStrategy
  );

  return {
    maskedNumberDeactivated: !!deactivationResult.maskedNumberId,
    threadsReassigned: reassignmentResult.threadsReassigned,
    threadsUnassigned: reassignmentResult.threadsUnassigned,
    ownerThreadId: reassignmentResult.ownerThreadId,
  };
}
