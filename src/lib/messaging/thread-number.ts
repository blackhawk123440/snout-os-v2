import { getScopedDb } from '@/lib/tenancy';

export async function ensureThreadHasMessageNumber(orgId: string, threadId: string): Promise<void> {
  const db = getScopedDb({ orgId });
  const thread = await db.messageThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      messageNumberId: true,
      maskedNumberE164: true,
      numberClass: true,
      assignedSitterId: true,
    },
  });
  if (!thread || thread.messageNumberId) return;

  let chosenNumber = null as null | { id: string; e164: string; numberClass: string };
  if (thread.maskedNumberE164) {
    chosenNumber = await db.messageNumber.findFirst({
      where: { orgId, status: 'active', e164: thread.maskedNumberE164 },
      select: { id: true, e164: true, numberClass: true },
    });
  }
  if (!chosenNumber && thread.assignedSitterId) {
    chosenNumber = await db.messageNumber.findFirst({
      where: {
        orgId,
        status: 'active',
        assignedSitterId: thread.assignedSitterId,
        numberClass: 'sitter',
      },
      select: { id: true, e164: true, numberClass: true },
    });
  }
  if (!chosenNumber) {
    chosenNumber = await db.messageNumber.findFirst({
      where: { orgId, status: 'active', numberClass: 'front_desk' },
      select: { id: true, e164: true, numberClass: true },
    });
  }
  if (!chosenNumber) {
    chosenNumber = await db.messageNumber.findFirst({
      where: { orgId, status: 'active' },
      select: { id: true, e164: true, numberClass: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
  if (!chosenNumber) return;

  await db.messageThread.update({
    where: { id: threadId },
    data: {
      messageNumberId: chosenNumber.id,
      maskedNumberE164: chosenNumber.e164,
      numberClass: chosenNumber.numberClass,
    },
  });
}

