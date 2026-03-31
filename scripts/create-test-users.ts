import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const ownerHash = await bcrypt.hash('password', 10);
  const sitterHash = await bcrypt.hash('password', 10);
  
  const owner = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: { passwordHash: ownerHash, sitterId: null },
    create: {
      email: 'owner@example.com',
      name: 'Test Owner',
      passwordHash: ownerHash,
      emailVerified: new Date(),
      sitterId: null,
    },
  });
  console.log('✅ Owner user:', owner.email);
  
  let sitter = await prisma.sitter.findFirst({ where: { email: 'sitter@example.com' } });
  if (!sitter) {
    sitter = await prisma.sitter.create({
      data: {
        firstName: 'Test',
        lastName: 'Sitter',
        email: 'sitter@example.com',
        phone: '+15551234567',
        active: true,
      },
    });
  }
  
  const sitterUser = await prisma.user.upsert({
    where: { email: 'sitter@example.com' },
    update: { passwordHash: sitterHash, sitterId: sitter.id },
    create: {
      email: 'sitter@example.com',
      name: 'Test Sitter',
      passwordHash: sitterHash,
      emailVerified: new Date(),
      sitterId: sitter.id,
    },
  });
  console.log('✅ Sitter user:', sitterUser.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
