/**
 * Vitest Setup File
 * 
 * Ensures DATABASE_URL is set for tests that use Prisma
 */

// Set DATABASE_URL if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./test.db';
}

// Ensure Prisma client is initialized
import { prisma } from '@/lib/db';

// Export prisma for use in tests
export { prisma };
