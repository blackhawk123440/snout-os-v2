import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create Prisma client with error handling
// Note: This uses the API's Prisma schema to match the database structure
let prismaClient: PrismaClient;

try {
  prismaClient = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
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
        url: process.env.DATABASE_URL || "file:./dev.db",
      },
    },
  });
}

export const prisma = prismaClient;

// Note: Automation engine is initialized in src/lib/queue.ts (worker) and
// in API routes that use it. Not initialized here to avoid pulling BullMQ
// into Edge Runtime (middleware imports db -> auth-helpers).