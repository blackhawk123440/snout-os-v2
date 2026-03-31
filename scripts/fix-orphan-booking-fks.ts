/**
 * One-time: fix orphaned FKs so prisma db push can add foreign keys.
 * - Booking: set sitterId/clientId to null where referenced row missing
 * - BookingSitterPool: delete rows where sitter missing (sitterId required)
 */
import { prisma } from '../src/lib/db';

async function main() {
  const sitterIds = new Set((await prisma.sitter.findMany({ select: { id: true } })).map(s => s.id));
  const clientIds = new Set((await prisma.client.findMany({ select: { id: true } })).map(c => c.id));
  const messageNumberIds = new Set((await prisma.messageNumber.findMany({ select: { id: true } })).map(m => m.id));

  const bookings = await prisma.booking.findMany({ select: { id: true, sitterId: true, clientId: true } });
  let bookingUpdated = 0;
  for (const b of bookings) {
    const needSitter = b.sitterId != null && !sitterIds.has(b.sitterId);
    const needClient = b.clientId != null && !clientIds.has(b.clientId);
    if (needSitter || needClient) {
      await prisma.booking.update({
        where: { id: b.id },
        data: {
          ...(needSitter ? { sitterId: null } : {}),
          ...(needClient ? { clientId: null } : {}),
        },
      });
      bookingUpdated++;
    }
  }
  console.log(`Fixed ${bookingUpdated} bookings with orphaned sitter/client FKs.`);

  const poolRows = await prisma.bookingSitterPool.findMany({ select: { id: true, sitterId: true } });
  let poolDeleted = 0;
  for (const p of poolRows) {
    if (!sitterIds.has(p.sitterId)) {
      await prisma.bookingSitterPool.delete({ where: { id: p.id } });
      poolDeleted++;
    }
  }
  console.log(`Deleted ${poolDeleted} BookingSitterPool rows with orphaned sitterId.`);

  const threads = await prisma.messageThread.findMany({ select: { id: true, clientId: true, assignedSitterId: true, messageNumberId: true } });
  let threadUpdated = 0;
  for (const t of threads) {
    const needClient = t.clientId != null && !clientIds.has(t.clientId);
    const needSitter = t.assignedSitterId != null && !sitterIds.has(t.assignedSitterId);
    const needNumber = t.messageNumberId != null && !messageNumberIds.has(t.messageNumberId);
    if (needClient || needSitter || needNumber) {
      await prisma.messageThread.update({
        where: { id: t.id },
        data: {
          ...(needClient ? { clientId: null } : {}),
          ...(needSitter ? { assignedSitterId: null } : {}),
          ...(needNumber ? { messageNumberId: null } : {}),
        },
      });
      threadUpdated++;
    }
  }
  console.log(`Fixed ${threadUpdated} MessageThread rows with orphaned clientId/assignedSitterId/messageNumberId.`);

  const masked = await prisma.sitterMaskedNumber.findMany({ select: { id: true, sitterId: true, messageNumberId: true } });
  let maskedDeleted = 0;
  for (const m of masked) {
    if (!sitterIds.has(m.sitterId) || !messageNumberIds.has(m.messageNumberId)) {
      await prisma.sitterMaskedNumber.delete({ where: { id: m.id } });
      maskedDeleted++;
    }
  }
  console.log(`Deleted ${maskedDeleted} SitterMaskedNumber rows with orphaned sitterId/messageNumberId.`);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
