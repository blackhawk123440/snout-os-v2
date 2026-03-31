/**
 * Dynamic Number Routing
 * 
 * ONE THREAD PER CLIENT PER ORG
 * 
 * Computes the effective "from number" for a thread based on current operational state.
 * This is called at send-time to ensure correct number selection.
 * 
 * Rules (priority order):
 * 1. If there is an active assignment window for a sitter → use that sitter's dedicated number
 * 2. Else if client is "one-time / unassigned" → use pool number
 * 3. Else → front desk
 */

import { prisma } from '@/lib/db';

export interface EffectiveNumberResult {
  numberId: string;
  e164: string;
  numberClass: 'front_desk' | 'sitter' | 'pool';
  reason: string; // For routing trace
  routingTrace: Array<{
    step: number;
    rule: string;
    condition: string;
    result: boolean;
    explanation: string;
  }>;
}

/**
 * Compute effective number for a thread at send-time
 * 
 * This is the source of truth for "which number should this message send from"
 */
export async function getEffectiveNumberForThread(
  orgId: string,
  threadId: string,
  atTime?: Date
): Promise<EffectiveNumberResult> {
  const now = atTime || new Date();
  const trace: EffectiveNumberResult['routingTrace'] = [];

  // Load thread with relationships
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: {
      messageNumber: true,
      assignmentWindows: {
        where: {
          startAt: { lte: now },
          endAt: { gte: now },
        },
        include: {
          sitter: {
            include: {
              maskedNumber: {
                include: {
                  messageNumber: true,
                },
              },
            },
          },
        },
        orderBy: { startAt: 'desc' },
        take: 1, // Get most recent active window
      },
    },
  });

  if (!thread) {
    throw new Error(`Thread ${threadId} not found`);
  }

  // Step 1: Check for active assignment window with sitter
  if (thread.assignmentWindows && thread.assignmentWindows.length > 0) {
    const activeWindow = thread.assignmentWindows[0];
    const sitterNumber = activeWindow.sitter?.maskedNumber?.messageNumber;
    if (sitterNumber && sitterNumber.status === 'active') {
      const sitterName = activeWindow.sitter
        ? `${activeWindow.sitter.firstName} ${activeWindow.sitter.lastName}`.trim() || 'Sitter'
        : 'Sitter';
      trace.push({
        step: 1,
        rule: 'Active assignment window with sitter',
        condition: `Window active: ${activeWindow.startAt} <= ${now} <= ${activeWindow.endAt}`,
        result: true,
        explanation: `Active window for sitter ${sitterName} - using sitter's dedicated number`,
      });

      return {
        numberId: sitterNumber.id,
        e164: sitterNumber.e164 ?? '',
        numberClass: 'sitter',
        reason: `Active assignment window for sitter ${sitterName}`,
        routingTrace: trace,
      };
    }
  }

  trace.push({
    step: 1,
    rule: 'Active assignment window with sitter',
    condition: 'No active window or no sitter number',
    result: false,
    explanation: 'No active assignment window found',
  });

  // Step 2: Use thread's default number (front_desk/pool)
  // This is the number assigned to the thread when it was created
  if (thread.messageNumber) {
    const numClass = thread.messageNumber.numberClass ?? 'front_desk';
    trace.push({
      step: 2,
      rule: 'Thread default number',
      condition: 'No active window, using thread default',
      result: true,
      explanation: `Using thread's default number: ${numClass}`,
    });

    return {
      numberId: thread.messageNumber.id,
      e164: thread.messageNumber.e164 ?? '',
      numberClass: numClass as 'front_desk' | 'sitter' | 'pool',
      reason: `No active assignment window - using thread's default ${numClass} number`,
      routingTrace: trace,
    };
  }

  trace.push({
    step: 2,
    rule: 'Thread default number',
    condition: 'Thread has no assigned number',
    result: false,
    explanation: 'Thread has no assigned message number',
  });

  // Fallback: Try to find any available number (shouldn't happen in normal operation)
  const fallbackNumber = await prisma.messageNumber.findFirst({
    where: {
      orgId,
      status: 'active',
    },
  });

  if (fallbackNumber) {
    const numClass = fallbackNumber.numberClass ?? 'front_desk';
    trace.push({
      step: 3,
      rule: 'Fallback number',
      condition: 'Thread has no number, using any available',
      result: true,
      explanation: `Using fallback number: ${numClass}`,
    });

    return {
      numberId: fallbackNumber.id,
      e164: fallbackNumber.e164 ?? '',
      numberClass: numClass as 'front_desk' | 'sitter' | 'pool',
      reason: `Thread has no assigned number - using fallback ${numClass} number`,
      routingTrace: trace,
    };
  }

  throw new Error(`No available messaging numbers for org ${orgId}. Please configure numbers in Messages → Numbers.`);
}
