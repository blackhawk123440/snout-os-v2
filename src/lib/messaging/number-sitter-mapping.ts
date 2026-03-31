/**
 * Number to Sitter Mapping
 * 
 * Maps Twilio phone numbers to sitter IDs for webhook routing.
 */

import { prisma } from '@/lib/db';
import { normalizeE164 } from './phone-utils';

/**
 * Get sitter ID from Twilio phone number (E.164 format)
 * 
 * Looks up MessageNumber record and returns assignedSitterId if number is assigned to a sitter.
 * 
 * @param toNumberE164 - The "to" phone number in E.164 format (e.g., +15551234567)
 * @returns Sitter ID if number is assigned to a sitter, null otherwise
 */
export async function getSitterIdFromNumber(toNumberE164: string): Promise<string | null> {
  const normalized = normalizeE164(toNumberE164);
  const messageNumber = await (prisma as any).messageNumber.findFirst({
    where: {
      OR: [{ e164: normalized }, { e164: toNumberE164 }],
      status: 'active',
    },
    select: {
      assignedSitterId: true,
      class: true,
    },
  });

  if (!messageNumber) {
    return null;
  }

  // Enterprise schema uses "class" not "numberClass"
  if (messageNumber.class === 'sitter' && messageNumber.assignedSitterId) {
    return messageNumber.assignedSitterId;
  }

  return null;
}

/**
 * Get sitter ID from masked number (same as getSitterIdFromNumber; enterprise schema has no SitterMaskedNumber).
 */
export async function getSitterIdFromMaskedNumber(toNumberE164: string): Promise<string | null> {
  return getSitterIdFromNumber(toNumberE164);
}
