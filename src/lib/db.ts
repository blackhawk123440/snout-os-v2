import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build";
const prismaUrl =
  process.env.DATABASE_URL ||
  (isBuildPhase ? "file:./build.db" : undefined);

// Create Prisma client with error handling
// Note: This uses the API's Prisma schema to match the database structure
let prismaClient: PrismaClient;

try {
  prismaClient = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(prismaUrl
      ? {
          datasources: {
            db: {
              url: prismaUrl,
            },
          },
        }
      : {}),
  });
  
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaClient;
  }
} catch (error) {
  console.error("Failed to initialize Prisma Client:", error);
  // Create a minimal client that will fail gracefully
  prismaClient = new PrismaClient({
    datasources: {
      db: {
        url: prismaUrl || "file:./dev.db",
      },
    },
  });
}

export const prisma = prismaClient;

// Note: Automation engine is initialized in src/lib/queue.ts (worker) and
// in API routes that use it. Not initialized here to avoid pulling BullMQ
// into Edge Runtime (middleware imports db -> auth-helpers).
