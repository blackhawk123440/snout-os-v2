/**
 * verify-schema.js
 *
 * Run after `prisma migrate deploy` to confirm that every column declared in schema.prisma
 * is actually present in the database. Exits 1 if any critical column is missing,
 * which blocks the app from starting with a broken schema.
 *
 * Usage (in render.yaml startCommand):
 *   npx prisma migrate deploy && node scripts/verify-schema.js && pnpm run start
 */

const { PrismaClient } = require("@prisma/client");

// Critical columns that have previously been missing from the live DB.
// Format: { table, column } — uses information_schema for portability.
const REQUIRED_COLUMNS = [
  // Sitter
  { table: "Sitter", column: "respectGoogleBusy" },
  { table: "Sitter", column: "onboardingStatus" },
  // Client
  { table: "Client", column: "stripeCustomerId" },
  // Booking
  { table: "Booking", column: "stripeCheckoutSessionId" },
  { table: "Booking", column: "stripePaymentIntentId" },
  { table: "Booking", column: "depositAmount" },
  { table: "Booking", column: "cancellationReason" },
  { table: "Booking", column: "cancelledAt" },
  // User
  { table: "User", column: "welcomeToken" },
  { table: "User", column: "clientId" },
];

async function main() {
  const prisma = new PrismaClient();
  const missing = [];

  try {
    for (const { table, column } of REQUIRED_COLUMNS) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        table,
        column
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        missing.push(`${table}.${column}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  if (missing.length > 0) {
    console.error("[verify-schema] FATAL: The following columns are declared in schema.prisma but absent from the database:");
    for (const col of missing) {
      console.error(`  - ${col}`);
    }
    console.error("[verify-schema] Run the safety-net migration manually or check that prisma migrate deploy completed successfully.");
    process.exit(1);
  }

  console.log(`[verify-schema] OK — all ${REQUIRED_COLUMNS.length} required columns present.`);
}

main().catch((err) => {
  console.error("[verify-schema] Verification failed with error:", err.message);
  process.exit(1);
});
