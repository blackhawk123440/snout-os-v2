import { prisma } from '../src/lib/db';

async function backfillClients() {
  const clients = await prisma.client.findMany({ select: { id: true, orgId: true, phone: true } });

  console.log(`Found ${clients.length} clients to backfill...`);

  for (let i = 0; i < clients.length; i++) {
    const c = clients[i];
    const newPhone = c.phone && c.phone !== ''
      ? `${c.phone}-${i + 1}`
      : `+1555-TEST-${1000 + i}`;

    await prisma.client.update({
      where: { id: c.id },
      data: { phone: newPhone },
    });

    console.log(`Updated client ${c.id} → phone: ${newPhone}`);
  }

  console.log('✅ Backfill complete — all (orgId, phone) are now unique.');
}

backfillClients()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
