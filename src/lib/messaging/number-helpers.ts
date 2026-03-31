/**
 * Number Assignment Helpers
 * 
 * Phase 1.2: Number Infrastructure
 * 
 * Manages assignment of Front Desk, Sitter Masked, and Pool Numbers
 * according to Messaging Master Spec V1.
 */

import { prisma } from '@/lib/db';
import { getOrgIdFromContext } from './org-helpers';
import type { MessagingProvider } from './provider';

export type NumberClass = 'front_desk' | 'sitter' | 'pool';

/**
 * Get or create Front Desk number
 * 
 * There is exactly one Front Desk number per org.
 * Used for:
 * - Booking inquiries and general questions
 * - Scheduling and changes outside active booking windows
 * - Billing and payment links
 * - Meet and greet coordination before approval
 */
export async function getOrCreateFrontDeskNumber(
  orgId: string,
  provider: MessagingProvider
): Promise<{ numberId: string; e164: string }> {
  // Check for existing Front Desk number
  const existing = await prisma.messageNumber.findFirst({
    where: {
      orgId,
      numberClass: 'front_desk',
      status: 'active',
    },
  });

  if (existing) {
    return {
      numberId: existing.id,
      e164: existing.e164,
    };
  }

  // If no Front Desk number exists, we need to create one
  // In production, this would purchase/provision a number via the provider
  // For now, we'll throw an error requiring manual setup
  throw new Error(
    'Front Desk number not configured. Please create a MessageNumber record with numberClass="front_desk"'
  );
}

/**
 * Assign masked number to sitter
 * 
 * Creates a SitterMaskedNumber linking sitter to a dedicated MessageNumber.
 * Used for all service communication during active assignment windows.
 * 
 * Guardrails:
 * - Must not reassign to another sitter after offboarding (90-day cooldown)
 * - Number is deactivated on sitter offboarding
 */
export async function assignSitterMaskedNumber(
  orgId: string,
  sitterId: string,
  provider: MessagingProvider
): Promise<{ numberId: string; sitterMaskedNumberId: string; e164: string }> {
  // Note: SitterMaskedNumber model not available in API schema
  // Use MessageNumber directly instead
  // Check if sitter already has an assigned number
  let messageNumber = await prisma.messageNumber.findFirst({
    where: {
      orgId,
      assignedSitterId: sitterId,
      status: 'active',
    },
  });

  if (messageNumber) {
    return {
      numberId: messageNumber.id,
      sitterMaskedNumberId: messageNumber.id, // Use numberId as fallback
      e164: messageNumber.e164,
    };
  }

  // Find available sitter-class number
  messageNumber = await prisma.messageNumber.findFirst({
    where: {
      orgId,
      numberClass: 'sitter',
      assignedSitterId: null,
      status: 'active',
    },
  });

  if (!messageNumber) {
    throw new Error(
      `No available sitter number for sitter ${sitterId}. Please create a MessageNumber with numberClass="sitter".`
    );
  }

  // Assign number to sitter
  await prisma.messageNumber.update({
    where: { id: messageNumber.id },
    data: {
      assignedSitterId: sitterId,
    },
  });

  // Note: SitterMaskedNumber model doesn't exist - return MessageNumber ID
  return {
    numberId: messageNumber.id,
    sitterMaskedNumberId: messageNumber.id,
    e164: messageNumber.e164,
  };
  
}

/**
 * Get pool number for assignment
 * 
 * Selects a pool number from the rotating pool using configured strategy.
 * Used for:
 * - One-time bookings or overflow before sitter assignment
 * - Temporary coverage for short jobs
 * 
 * Pool number rotation strategies:
 * - LRU: Least Recently Used (minimizes churn)
 * - FIFO: First In First Out (oldest first)
 * - HASH_SHUFFLE: Deterministic hash-based selection (same input = same output)
 */
export async function getPoolNumber(
  orgId: string,
  excludeNumberIds?: string[],
  context?: {
    clientId?: string | null;
    threadId?: string;
    stickyReuseKey?: 'clientId' | 'threadId';
  }
): Promise<{ numberId: string; e164: string } | null> {
  // Note: Setting model not available in API schema
  // Use default settings
  const settings: Record<string, string> = {
    poolSelectionStrategy: 'LRU',
    stickyReuseKey: 'clientId',
  };

  const strategy = (settings.poolSelectionStrategy as 'LRU' | 'FIFO' | 'HASH_SHUFFLE') || 'LRU';
  const stickyReuseKey = (settings.stickyReuseKey as 'clientId' | 'threadId') || 'clientId';

  // Find available pool numbers
  const whereClause: any = {
    orgId,
    numberClass: 'pool',
    status: 'active',
  };

  if (excludeNumberIds && excludeNumberIds.length > 0) {
    whereClause.id = {
      notIn: excludeNumberIds,
    };
  }

  let poolNumbers = await prisma.messageNumber.findMany({
    where: whereClause,
  });

  if (poolNumbers.length === 0) {
    // No pool numbers available
    return null;
  }

  // ENFORCE maxConcurrentThreadsPerPoolNumber: Check capacity for each pool number
  const maxConcurrent = parseInt(settings.maxConcurrentThreadsPerPoolNumber || '1', 10) || 1;
  
  // Get thread counts for each pool number
  const numberIds = poolNumbers.map((n: any) => n.id);
  const threadCounts = await prisma.messageThread.groupBy({
    by: ['messageNumberId'],
    where: {
      orgId,
      messageNumberId: { in: numberIds },
      status: 'open',
    },
    _count: {
      id: true,
    },
  });

  const countMap = new Map<string, number>();
  for (const tc of threadCounts) {
    if (tc.messageNumberId) {
      countMap.set(tc.messageNumberId, tc._count.id);
    }
  }

  // Filter out numbers at capacity (deterministic: always skip at-capacity numbers)
  const availableNumbers = poolNumbers.filter((num: any) => {
    const currentCount = countMap.get(num.id) || 0;
    return currentCount < maxConcurrent;
  });

  if (availableNumbers.length === 0) {
    // All pool numbers are at capacity - pool exhausted
    // Create alert and log audit event
    const { createAlert } = await import('./alert-helpers');
    const { logMessagingEvent } = await import('./audit-trail');
    
    const activeThreadCount = Array.from(countMap.values()).reduce((sum, count) => sum + count, 0);
    const minPoolReserve = parseInt(settings.minPoolReserve || '3', 10) || 3;
    const recommendedMinPoolSize = Math.max(minPoolReserve, Math.ceil(activeThreadCount / maxConcurrent) + 2);

    await createAlert({
      orgId,
      severity: 'critical',
      type: 'pool.exhausted',
      title: 'Pool Numbers Exhausted',
      description: `All pool numbers are at capacity. Inbound messages will be routed to owner inbox.`,
      entityType: 'pool',
      metadata: {
        currentPoolSize: poolNumbers.length,
        activeThreadCount,
        maxConcurrentThreadsPerPoolNumber: maxConcurrent,
        settings: {
          poolSelectionStrategy: strategy,
          maxConcurrentThreadsPerPoolNumber: maxConcurrent,
          minPoolReserve,
        },
        recommendedMinimumPoolSize: recommendedMinPoolSize,
      },
    });

    await logMessagingEvent({
      orgId,
      eventType: 'pool.exhausted' as any, // pool.exhausted not in MessagingAuditEventType, but needed for audit
      metadata: {
        currentPoolSize: poolNumbers.length,
        activeThreadCount,
        maxConcurrent,
        recommendedMinPoolSize,
      },
    });

    // Return null to signal pool exhausted
    return null;
  }

  // Apply selection strategy to available (non-at-capacity) numbers only
  let selected: typeof poolNumbers[0];

  if (strategy === 'HASH_SHUFFLE') {
    // Deterministic hash-based selection
    // Same input (clientId/threadId) always produces same pool number
    const hashKey = stickyReuseKey === 'clientId' 
      ? (context?.clientId || context?.threadId || 'default')
      : (context?.threadId || context?.clientId || 'default');
    
    // Simple hash function for deterministic selection
    let hash = 0;
    for (let i = 0; i < hashKey.length; i++) {
      const char = hashKey.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Use hash to select from available (non-at-capacity) pool numbers
    const index = Math.abs(hash) % availableNumbers.length;
    selected = availableNumbers[index];
  } else if (strategy === 'FIFO') {
    // First In First Out - oldest first (from available numbers only)
    availableNumbers.sort((a: any, b: any) => {
      const aTime = a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.getTime() || 0;
      return aTime - bTime;
    });
    selected = availableNumbers[0];
  } else {
    // LRU: Least Recently Used (default) - from available numbers only
    // Note: MessageNumber model doesn't have lastAssignedAt field
    // Use creation time for LRU sorting
    availableNumbers.sort((a: any, b: any) => {
      const aCreated = a.createdAt?.getTime() || 0;
      const bCreated = b.createdAt?.getTime() || 0;
      return aCreated - bCreated;
    });
    selected = availableNumbers[0];
  }

  await prisma.messageNumber.update({
    where: { id: selected.id },
    data: {
      lastAssignedAt: new Date(),
    },
  });

  // Log audit event for pool assignment
  const { logMessagingEvent } = await import('./audit-trail');
  await logMessagingEvent({
    orgId,
    eventType: 'pool.number.assigned' as any, // pool.number.assigned not in MessagingAuditEventType, but needed for audit
    metadata: {
      numberId: selected.id,
      e164: selected.e164,
      strategy,
      capacityCheck: {
        maxConcurrent,
        currentCount: countMap.get(selected.id) || 0,
        availableCount: availableNumbers.length,
        totalPoolCount: poolNumbers.length,
    },
      context: {
        clientId: context?.clientId,
        threadId: context?.threadId,
        stickyReuseKey,
      },
    },
  });

  return {
    numberId: selected.id,
    e164: selected.e164,
  };
}

/**
 * Determine number class for a thread based on context
 * 
 * Rules:
 * - If thread has assignedSitterId and isMeetAndGreet=false: use sitter masked number
 * - If thread isMeetAndGreet=true: use front desk number
 * - If thread isOneTimeClient=true: use pool number
 * - Otherwise: use front desk number
 */
export async function determineThreadNumberClass(
  thread: {
    assignedSitterId?: string | null;
    isMeetAndGreet?: boolean;
    isOneTimeClient?: boolean;
  }
): Promise<NumberClass> {
  // Meet and greet threads use Front Desk
  if (thread.isMeetAndGreet) {
    return 'front_desk';
  }

  // One-time clients use Pool
  if (thread.isOneTimeClient) {
    return 'pool';
  }

  // Threads with assigned sitter use Sitter masked number
  if (thread.assignedSitterId) {
    return 'sitter';
  }

  // Default: Front Desk for general inquiries
  return 'front_desk';
}

/**
 * Assign number to thread based on number class
 * 
 * This ensures MessageThread.numberClass always derives from its assigned MessageNumber.
 * 
 * Guardrails:
 * - Thread.numberClass must match MessageNumber.numberClass
 * - Pool number inbound routing must validate sender identity
 */
export async function assignNumberToThread(
  threadId: string,
  numberClass: NumberClass,
  orgId: string,
  provider: MessagingProvider,
  context?: {
    sitterId?: string;
    isOneTimeClient?: boolean;
    isMeetAndGreet?: boolean;
  }
): Promise<{ numberId: string; e164: string; numberClass: NumberClass }> {
  let numberId: string;
  let e164: string;

  switch (numberClass) {
    case 'front_desk':
      const frontDesk = await getOrCreateFrontDeskNumber(orgId, provider);
      numberId = frontDesk.numberId;
      e164 = frontDesk.e164;
      break;

    case 'sitter':
      if (!context?.sitterId) {
        throw new Error('Sitter ID required for sitter number assignment');
      }
      const sitterNumber = await assignSitterMaskedNumber(orgId, context.sitterId, provider);
      numberId = sitterNumber.numberId;
      e164 = sitterNumber.e164;
      break;

    case 'pool':
      const poolNumber = await getPoolNumber(orgId, undefined, {
        clientId: context?.isOneTimeClient ? 'one-time' : null,
        threadId: threadId,
      });
      if (!poolNumber) {
        // Pool exhausted - DO NOT silently fallback
        // Thread numberClass stays "pool" - owner must explicitly confirm fallback
        throw new Error('POOL_EXHAUSTED');
      }
      numberId = poolNumber.numberId;
      e164 = poolNumber.e164;
      break;

    default:
      throw new Error(`Invalid number class: ${numberClass}`);
  }

  // Update thread with number assignment
  // Ensure thread.numberClass matches MessageNumber.numberClass
  const messageNumber = await prisma.messageNumber.findUnique({
    where: { id: numberId },
  });

  if (!messageNumber) {
    throw new Error(`MessageNumber ${numberId} not found`);
  }

  const numClass = messageNumber.numberClass ?? 'front_desk';
  if (numClass !== numberClass) {
    throw new Error(
      `Number class mismatch: MessageNumber has ${numClass}, expected ${numberClass}`
    );
  }

  await prisma.messageThread.update({
    where: { id: threadId },
    data: {
      messageNumberId: numberId,
      numberClass: numClass,
      maskedNumberE164: e164,
    },
  });

  return {
    numberId,
    e164,
    numberClass: numClass as NumberClass,
  };
}

/**
 * Validate pool number inbound routing
 * 
 * Pool number routing safeguard:
 * - If sender is not mapped to an active thread on this number, route to owner + auto-response
 * - Prevents leakage between different clients using the same pool number
 */
export async function validatePoolNumberRouting(
  numberId: string,
  senderE164: string,
  orgId: string
): Promise<{
  isValid: boolean;
  threadId?: string;
  reason?: string;
}> {
  const messageNumber = await prisma.messageNumber.findUnique({
    where: { id: numberId },
  });

  if (!messageNumber || messageNumber.numberClass !== 'pool') {
    return {
      isValid: false,
      reason: 'Number is not a pool number',
    };
  }

  const activeThreads = await prisma.messageThread.findMany({
    where: {
      orgId,
      messageNumberId: numberId,
      status: 'open',
    },
    include: {
      participants: {
        where: {
          role: 'client',
          realE164: senderE164,
        },
      },
    },
  });

  const matchingThread = activeThreads.find(
    (thread) => thread.participants.length > 0
  );

  if (matchingThread) {
    return {
      isValid: true,
      threadId: matchingThread.id,
    };
  }

  // Sender is not mapped to an active thread
  // Must route to owner + auto-response
  return {
    isValid: false,
    reason: 'Sender not mapped to active thread on this pool number',
  };
}
