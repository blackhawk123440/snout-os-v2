/**
 * Message Event Wrapper
 * 
 * Wraps MessageEvent creation to automatically process for SRS
 * Use this instead of direct prisma.messageEvent.create
 */

import { prisma } from '@/lib/db';
import { onMessageEventCreated } from './event-hooks';

/**
 * Create MessageEvent and process for SRS
 */
export async function createMessageEventWithSRS(data: {
  orgId: string;
  threadId: string;
  direction: string;
  actorType: string;
  body: string;
  hasPolicyViolation?: boolean;
  providerMessageSid?: string;
  createdAt?: Date;
  [key: string]: any;
}): Promise<any> {
  const messageEvent = await (prisma as any).messageEvent.create({
    data: {
      ...data,
      createdAt: data.createdAt || new Date(),
    },
  });

  // Process for SRS (async, don't block)
  onMessageEventCreated(
    data.orgId,
    data.threadId,
    messageEvent.id,
    {
      direction: data.direction,
      actorType: data.actorType,
      body: data.body,
      hasPolicyViolation: data.hasPolicyViolation || false,
      createdAt: messageEvent.createdAt,
    }
  ).catch((error) => {
    console.error('[SRS] Failed to process message event:', error);
  });

  return messageEvent;
}
