/**
 * Choose From Number
 * 
 * Single source of truth for selecting the "from" number when sending messages.
 * Used by owner sends, sitter sends, and automations.
 * 
 * Rules:
 * 1. If active AssignmentWindow exists for thread → use sitter's assigned masked number
 * 2. Else → use thread's default number (front_desk/pool)
 * 
 * This function MUST be used by all sending paths to ensure consistent routing.
 */

import { prisma } from '@/lib/db';
import { getEffectiveNumberForThread } from './dynamic-number-routing';
import { resolveConversationRouting } from './conversation-lifecycle';

export interface ChooseFromNumberResult {
  numberId: string;
  e164: string;
  numberClass: 'front_desk' | 'sitter' | 'pool';
  reason: string;
  windowId?: string; // AssignmentWindow ID if used
  routingTrace: Array<{
    step: number;
    rule: string;
    condition: string;
    result: boolean;
    explanation: string;
  }>;
}

/**
 * Choose the "from" number for sending a message
 * 
 * @param threadId - Thread ID
 * @param orgId - Organization ID
 * @param atTime - Optional timestamp (defaults to now)
 * @returns Chosen number details with routing trace
 */
export async function chooseFromNumber(
  threadId: string,
  orgId: string,
  atTime?: Date
): Promise<ChooseFromNumberResult> {
  const now = atTime || new Date();
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    select: {
      laneType: true,
      activationStage: true,
      lifecycleStatus: true,
      assignedRole: true,
      assignedSitterId: true,
      serviceWindowStart: true,
      serviceWindowEnd: true,
      graceEndsAt: true,
      messageNumber: {
        select: { id: true, e164: true, numberClass: true },
      },
    },
  });
  if (!thread) {
    throw new Error(`Thread ${threadId} not found`);
  }
  const lifecycle = resolveConversationRouting(
    {
      laneType: thread.laneType,
      activationStage: thread.activationStage,
      lifecycleStatus: thread.lifecycleStatus,
      assignedRole: thread.assignedRole,
      assignedSitterId: thread.assignedSitterId,
      serviceWindowStart: thread.serviceWindowStart,
      serviceWindowEnd: thread.serviceWindowEnd,
      graceEndsAt: thread.graceEndsAt,
    },
    now
  );

  if (lifecycle.laneType === 'company') {
    if (thread.messageNumber?.e164 && thread.messageNumber.numberClass === 'front_desk') {
      return {
        numberId: thread.messageNumber.id,
        e164: thread.messageNumber.e164,
        numberClass: 'front_desk',
        reason: lifecycle.reason,
        routingTrace: [
          {
            step: 1,
            rule: 'deterministic_company_lane',
            condition: lifecycle.reason,
            result: true,
            explanation: 'Company lane enforces front desk masked identity',
          },
        ],
      };
    }
    const frontDesk = await prisma.messageNumber.findFirst({
      where: { orgId, status: 'active', numberClass: 'front_desk' },
      select: { id: true, e164: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (frontDesk?.e164) {
      return {
        numberId: frontDesk.id,
        e164: frontDesk.e164,
        numberClass: 'front_desk',
        reason: lifecycle.reason,
        routingTrace: [
          {
            step: 1,
            rule: 'deterministic_company_lane',
            condition: lifecycle.reason,
            result: true,
            explanation: 'Company lane falls back to front desk number',
          },
        ],
      };
    }
  }
  
  // Use existing routing logic
  const routingResult = await getEffectiveNumberForThread(orgId, threadId, now);
  
  // Extract window ID if sitter number was chosen
  let windowId: string | undefined;
  if (routingResult.numberClass === 'sitter') {
    const thread = await prisma.messageThread.findUnique({
      where: { id: threadId },
      include: {
        assignmentWindows: {
          where: {
            startAt: { lte: now },
            endAt: { gte: now },
          },
          orderBy: { startAt: 'desc' },
          take: 1,
        },
      },
    });

    if (thread?.assignmentWindows?.[0]) {
      windowId = thread.assignmentWindows[0].id;
    }
  }
  
  // Log routing decision
  console.log('[chooseFromNumber]', {
    orgId,
    threadId,
    chosenNumberId: routingResult.numberId,
    chosenE164: routingResult.e164,
    numberClass: routingResult.numberClass,
    reason: routingResult.reason,
    windowId,
    timestamp: now.toISOString(),
  });
  
  return {
    numberId: routingResult.numberId,
    e164: routingResult.e164,
    numberClass: routingResult.numberClass,
    reason: routingResult.reason,
    windowId,
    routingTrace: routingResult.routingTrace,
  };
}
