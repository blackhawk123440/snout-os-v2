/**
 * Create Admin User Script (Gate B Phase 2.2)
 * 
 * Utility script to create an admin user with password.
 * Usage: tsx scripts/create-admin-user.ts <email> <password>
 */

import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || "Admin User";

  if (!email || !password) {
    console.error("Usage: tsx scripts/create-admin-user.ts <email> <password> [name]");
    process.exit(1);
  }

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create or update user
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        name,
        emailVerified: new Date(),
      },
      create: {
        email,
        name,
        passwordHash,
        emailVerified: new Date(),
      },
    });

    console.log(`✅ Admin user created/updated:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   ID: ${user.id}`);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

