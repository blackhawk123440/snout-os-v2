/**
 * Number to Organization Mapping
 * 
 * Maps Twilio phone numbers to organization IDs for webhook routing.
 * Ensures strict org isolation by deriving orgId ONLY from the "to" number.
 */

import { prisma } from '@/lib/db';
import { NotFoundError } from './errors';
import { normalizeE164 } from './phone-utils';

/**
 * Get organization ID from a Twilio phone number (E.164 format)
 * 
 * Normalizes the input so +12562039373 and 2562039373 both match.
 * 
 * @param toNumberE164 - The "to" phone number (e.g., +12562039373 or 2562039373)
 * @returns Organization ID
 * @throws NotFoundError if the number is not found or inactive
 */
export async function getOrgIdFromNumber(toNumberE164: string): Promise<string> {
  const normalized = normalizeE164(toNumberE164);
  const messageNumber = await prisma.messageNumber.findFirst({
    where: {
      OR: [{ e164: normalized }, { e164: toNumberE164 }],
      status: 'active',
    },
    select: {
      orgId: true,
    },
  });

  if (!messageNumber) {
    throw new NotFoundError(`Phone number ${toNumberE164} not found or inactive`);
  }

  return messageNumber.orgId;
}
