/**
 * One-off: apply Blocker 2 ALTER on DB pointed by DATABASE_URL, then verify.
 * Usage: npx tsx scripts/run-blocker2-db-fix.ts (loads .env)
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { Prisma } from "@prisma/client";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  console.log("Applying ALTER TABLE MessageThread (clientApprovedAt, sitterApprovedAt)...");
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MessageThread" ADD COLUMN IF NOT EXISTS "clientApprovedAt" TIMESTAMP(3);`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MessageThread" ADD COLUMN IF NOT EXISTS "sitterApprovedAt" TIMESTAMP(3);`
    );
    console.log("ALTER done.");
  } catch (e) {
    console.error("ALTER failed:", e);
    process.exit(1);
  }

  console.log("Verifying columns...");
  const rows = await prisma.$queryRaw<{ column_name: string }[]>(
    Prisma.sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'MessageThread'
        AND column_name IN ('clientApprovedAt', 'sitterApprovedAt')
      ORDER BY column_name
    `
  );
  console.log("Schema proof after fix:", JSON.stringify(rows, null, 2));
  if (rows.length < 2) {
    console.error("Expected 2 rows; got", rows.length);
    process.exit(1);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
