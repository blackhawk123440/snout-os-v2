/**
 * Message Event Instrumentation
 * 
 * Determines requiresResponse and links responses for SRS responsiveness tracking
 */

import { prisma } from '@/lib/db';

/**
 * Determine if a message requires response
 */
export function requiresResponse(message: {
  direction: string;
  actorType: string;
  body: string;
  hasPolicyViolation?: boolean;
}): boolean {
  // System messages never require response
  if (message.actorType === 'system' || message.actorType === 'automation') {
    return false;
  }

  // Only inbound client messages require response
  if (message.direction !== 'inbound' || message.actorType !== 'client') {
    return false;
  }

  // Policy violations are redacted and don't require response
  if (message.hasPolicyViolation) {
    return false;
  }

  // Webhook status callbacks don't require response (check body patterns)
  const statusPatterns = [
    /delivery receipt/i,
    /read receipt/i,
    /status update/i,
    /webhook/i,
  ];
  if (statusPatterns.some(pattern => pattern.test(message.body))) {
    return false;
  }

  return true;
}

/**
 * Link a response to the most recent unanswered requiring message
 * Idempotent and deterministic
 */
export async function linkResponseToRequiringMessage(
  orgId: string,
  threadId: string,
  responseEventId: string,
  responseActorType: string,
  responseCreatedAt: Date
): Promise<string | null> {
  // Only sitter/owner responses count
  if (responseActorType !== 'sitter' && responseActorType !== 'owner') {
    return null;
  }

  // Find the most recent unanswered requiring message (FIFO)
  const requiringMessage = await (prisma as any).messageEvent.findFirst({
    where: {
      orgId,
      threadId,
      direction: 'inbound',
      actorType: 'client',
      requiresResponse: true,
      answeredAt: null,
      createdAt: { lt: responseCreatedAt },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!requiringMessage) {
    return null;
  }

  // Check if link already exists (idempotent)
  const existingLink = await (prisma as any).messageResponseLink.findUnique({
    where: { requiresResponseEventId: requiringMessage.id },
  });

  if (existingLink) {
    return existingLink.id;
  }

  // Check if response is within assignment window
  const assignmentWindow = await (prisma as any).assignmentWindow.findFirst({
    where: {
      orgId,
      threadId,
      startAt: { lte: responseCreatedAt },
      endAt: { gte: responseCreatedAt },
      status: 'active',
    },
  });

  const withinAssignmentWindow = !!assignmentWindow;

  // Calculate response time in minutes
  const responseTime = responseCreatedAt.getTime() - new Date(requiringMessage.createdAt).getTime();
  const responseMinutes = Math.floor(responseTime / (1000 * 60));

  // Create response link
  const link = await (prisma as any).messageResponseLink.create({
    data: {
      orgId,
      threadId,
      requiresResponseEventId: requiringMessage.id,
      responseEventId,
      responseMinutes,
      withinAssignmentWindow,
      excluded: false,
    },
  });

  // Mark requiring message as answered
  await (prisma as any).messageEvent.update({
    where: { id: requiringMessage.id },
    data: { answeredAt: responseCreatedAt },
  });

  return link.id;
}

/**
 * Process a new message event and update requiresResponse/response links
 * Call this when a message is created
 */
export async function processMessageEvent(
  orgId: string,
  threadId: string,
  messageEventId: string,
  message: {
    direction: string;
    actorType: string;
    body: string;
    hasPolicyViolation?: boolean;
    createdAt: Date;
  }
): Promise<void> {
  // Update requiresResponse flag
  const needsResponse = requiresResponse(message);
  if (needsResponse) {
    await (prisma as any).messageEvent.update({
      where: { id: messageEventId },
      data: { requiresResponse: true },
    });
  }

  // If this is a response (sitter/owner), link it
  if (message.actorType === 'sitter' || message.actorType === 'owner') {
    await linkResponseToRequiringMessage(
      orgId,
      threadId,
      messageEventId,
      message.actorType,
      message.createdAt
    );
  }
}

/**
 * Exclude response links for time off periods
 */
export async function excludeTimeOffResponses(
  orgId: string,
  sitterId: string,
  timeOff: { startsAt: Date; endsAt: Date }
): Promise<number> {
  const result = await (prisma as any).messageResponseLink.updateMany({
    where: {
      orgId,
      thread: {
        assignedSitterId: sitterId,
      },
      requiresResponseEvent: {
        createdAt: {
          gte: timeOff.startsAt,
          lte: timeOff.endsAt,
        },
      },
      excluded: false,
    },
    data: {
      excluded: true,
      excludedReason: 'Time off period',
    },
  });

  return result.count;
}

/**
 * Exclude response links for system outages
 */
export async function excludeSystemOutageResponses(
  orgId: string,
  startsAt: Date,
  endsAt: Date,
  reason: string
): Promise<number> {
  const result = await (prisma as any).messageResponseLink.updateMany({
    where: {
      orgId,
      requiresResponseEvent: {
        createdAt: {
          gte: startsAt,
          lte: endsAt,
        },
      },
      excluded: false,
    },
    data: {
      excluded: true,
      excludedReason: `System outage: ${reason}`,
    },
  });

  return result.count;
}
