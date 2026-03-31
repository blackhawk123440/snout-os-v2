import { prisma } from '../src/lib/db';

async function backfillPetClientId() {
  const pets = await prisma.pet.findMany({
    where: { clientId: null, bookingId: { not: null } },
    select: { id: true, bookingId: true },
  });

  console.log(`Found ${pets.length} pets with null clientId to backfill...`);

  let updated = 0;
  for (const pet of pets) {
    if (!pet.bookingId) continue;

    const booking = await prisma.booking.findUnique({
      where: { id: pet.bookingId },
      select: { clientId: true },
    });

    if (booking?.clientId) {
      await prisma.pet.update({
        where: { id: pet.id },
        data: { clientId: booking.clientId },
      });
      updated++;
    }
  }

  console.log(`✅ Backfill complete — updated ${updated} of ${pets.length} pets.`);
}

backfillPetClientId()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
