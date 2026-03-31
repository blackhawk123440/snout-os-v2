/**
 * Migration Script: Manual Dispatch Flags
 * 
 * Migrates legacy [MANUAL_DISPATCH] flags from notes to first-class dispatchStatus field.
 * 
 * Run with: npx tsx scripts/migrate-manual-dispatch-flags.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting manual dispatch flag migration...');

  // Find all bookings with [MANUAL_DISPATCH] in notes
  const bookings = await (prisma as any).booking.findMany({
    where: {
      notes: {
        contains: '[MANUAL_DISPATCH]',
      },
      // Only migrate bookings that aren't already migrated
      OR: [
        { dispatchStatus: null },
        { dispatchStatus: 'auto' },
      ],
    },
    select: {
      id: true,
      notes: true,
      dispatchStatus: true,
    },
  });

  console.log(`Found ${bookings.length} bookings with legacy manual dispatch flags`);

  let migrated = 0;
  let errors = 0;

  for (const booking of bookings) {
    try {
      // Extract reason from notes
      const match = booking.notes?.match(/\[MANUAL_DISPATCH\][^\n]*\s*(.+?)(?:\n|$)/);
      const reason = match ? match[1].trim() : 'Legacy manual dispatch flag (migrated)';

      // Update to new field structure
      await (prisma as any).booking.update({
        where: { id: booking.id },
        data: {
          dispatchStatus: 'manual_required',
          manualDispatchReason: reason,
          manualDispatchAt: new Date(),
        },
      });

      // Clean up notes (remove the flag, keep other notes)
      const cleanedNotes = booking.notes
        ?.replace(/\[MANUAL_DISPATCH\][^\n]*\n?/g, '')
        .trim() || null;

      if (cleanedNotes !== booking.notes) {
        await (prisma as any).booking.update({
          where: { id: booking.id },
          data: {
            notes: cleanedNotes,
          },
        });
      }

      migrated++;
      if (migrated % 10 === 0) {
        console.log(`Migrated ${migrated} bookings...`);
      }
    } catch (error: any) {
      console.error(`Failed to migrate booking ${booking.id}:`, error.message);
      errors++;
    }
  }

  console.log(`\nMigration complete:`);
  console.log(`  - Migrated: ${migrated}`);
  console.log(`  - Errors: ${errors}`);
  console.log(`  - Total: ${bookings.length}`);
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
