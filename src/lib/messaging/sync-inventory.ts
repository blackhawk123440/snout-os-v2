import { normalizeE164 } from '@/lib/messaging/phone-utils';

type MinimalDb = {
  messageNumber: {
    findFirst: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
  };
};

export async function upsertCanonicalMessageNumbersFromTwilio(
  db: MinimalDb,
  orgId: string,
  numbers: Array<{ sid: string; phoneNumber?: string }>
): Promise<number> {
  // Check if a front_desk number already exists for this org
  const existingFrontDesk = await db.messageNumber.findFirst({
    where: { orgId, numberClass: 'front_desk', status: 'active' },
  });
  const hasFrontDesk = !!existingFrontDesk;
  let assignedFrontDesk = hasFrontDesk;

  for (const n of numbers) {
    const e164 = normalizeE164((n.phoneNumber || '').toString());
    const existing = await db.messageNumber.findFirst({
      where: { orgId, OR: [{ e164 }, { providerNumberSid: n.sid }] },
    });

    // Preserve existing numberClass if the record already exists;
    // only assign front_desk to the first number if none exists yet
    let numberClass: string;
    if (existing) {
      numberClass = existing.numberClass;
    } else if (!assignedFrontDesk) {
      numberClass = 'front_desk';
      assignedFrontDesk = true;
    } else {
      numberClass = 'pool';
    }

    if (existing) {
      await db.messageNumber.update({
        where: { id: existing.id },
        data: {
          e164,
          status: 'active',
          numberClass,
          provider: 'twilio',
          providerNumberSid: n.sid,
        },
      });
    } else {
      await db.messageNumber.create({
        data: {
          orgId,
          e164,
          numberClass,
          status: 'active',
          provider: 'twilio',
          providerNumberSid: n.sid,
        },
      });
    }
  }
  return numbers.length;
}

