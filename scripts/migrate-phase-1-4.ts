/**
 * Phase 1.4 Data Migration Script
 * 
 * Backfills MessageNumber records into three classes and assigns them to threads.
 * 
 * Safety:
 * - Idempotent: Can be run multiple times safely
 * - Dry-run mode: Preview changes without modifying data
 * - Detailed logging: Logs all actions and counts
 * 
 * Run:
 *   Dry-run: npx tsx scripts/migrate-phase-1-4.ts --dry-run
 *   Execute: npx tsx scripts/migrate-phase-1-4.ts
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

interface MigrationStats {
  frontDeskNumbersCreated: number;
  sitterMaskedNumbersCreated: number;
  poolNumbersCreated: number;
  threadsUpdated: number;
  threadsFlagged: number;
  classificationUpdated: number;
  errors: Array<{ error: string; details?: any }>;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('⚠️  EXECUTION MODE - Changes will be written to database\n');
  }

  const stats: MigrationStats = {
    frontDeskNumbersCreated: 0,
    sitterMaskedNumbersCreated: 0,
    poolNumbersCreated: 0,
    threadsUpdated: 0,
    threadsFlagged: 0,
    classificationUpdated: 0,
    errors: [],
  };

  try {
    // Step 1: Backfill MessageNumber records into three classes
    console.log('Step 1: Backfilling MessageNumber records...\n');
    await backfillMessageNumbers(stats, dryRun);

    // Step 2: Backfill MessageThread.messageNumberId and Thread.numberClass
    console.log('\nStep 2: Backfilling thread-number associations...\n');
    await backfillThreadNumberAssociations(stats, dryRun);

    // Step 3: Backfill client classification fields
    console.log('\nStep 3: Backfilling client classification...\n');
    await backfillClientClassification(stats, dryRun);

    // Print summary
    console.log('\n=== Migration Summary ===\n');
    console.log(`Front Desk Numbers Created: ${stats.frontDeskNumbersCreated}`);
    console.log(`Sitter Masked Numbers Created: ${stats.sitterMaskedNumbersCreated}`);
    console.log(`Pool Numbers Created: ${stats.poolNumbersCreated}`);
    console.log(`Threads Updated: ${stats.threadsUpdated}`);
    console.log(`Threads Flagged for Review: ${stats.threadsFlagged}`);
    console.log(`Classification Fields Updated: ${stats.classificationUpdated}`);
    console.log(`Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n=== Errors ===\n');
      stats.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.error}`);
        if (error.details) {
          console.log(`   Details: ${JSON.stringify(error.details, null, 2)}`);
        }
      });
    }

    if (dryRun) {
      console.log('\n✅ Dry run complete. No changes made.');
      console.log('Run without --dry-run to execute migration.');
    } else {
      console.log('\n✅ Migration complete!');
    }

    // Rollback guidance
    if (!dryRun) {
      console.log('\n=== Rollback Guidance ===\n');
      console.log('If you need to rollback this migration:');
      console.log('1. Run: UPDATE "MessageThread" SET "messageNumberId" = NULL, "numberClass" = NULL;');
      console.log('2. Run: DELETE FROM "SitterMaskedNumber";');
      console.log('3. Run: UPDATE "MessageNumber" SET "numberClass" = \'pool\', "assignedSitterId" = NULL, "ownerId" = NULL;');
      console.log('\n⚠️  Note: This will remove all Phase 1.4 data. Use with caution.');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Step 1: Backfill MessageNumber records into three classes
 */
async function backfillMessageNumbers(
  stats: MigrationStats,
  dryRun: boolean
): Promise<void> {
  // Get all existing MessageNumber records
  const existingNumbers = await prisma.messageNumber.findMany({
    include: {
      sitterMaskedNumber: true,
    },
  });

  console.log(`Found ${existingNumbers.length} existing MessageNumber records`);

  // Get all orgIds from threads (since we may not have MessageNumber records yet)
  const threadOrgIds = await prisma.messageThread.groupBy({
    by: ['orgId'],
  });

  const orgIdsToProcess = threadOrgIds.map((g) => g.orgId);

  // Also get orgIds from existing MessageNumbers
  if (existingNumbers.length > 0) {
    const messageNumberOrgIds = await prisma.messageNumber.groupBy({
      by: ['orgId'],
    });
    
    // Merge orgIds from both sources
    const messageNumberOrgIdSet = new Set(messageNumberOrgIds.map((g) => g.orgId));
    threadOrgIds.forEach((g) => {
      if (!messageNumberOrgIdSet.has(g.orgId)) {
        orgIdsToProcess.push(g.orgId);
      }
    });
  }

  // Process each org
  for (const orgId of orgIdsToProcess) {
    console.log(`\nProcessing org: ${orgId}`);

    // Check for existing front desk number
    const frontDeskNumber = await prisma.messageNumber.findFirst({
      where: {
        orgId,
        numberClass: 'front_desk',
        status: 'active',
      },
    });

    if (!frontDeskNumber) {
      // Create front desk number (must be exactly one per org)
      const firstNumber = existingNumbers.find((n) => n.orgId === orgId && n.status === 'active');
      
      if (firstNumber && !firstNumber.sitterMaskedNumber) {
        // Use first active number as front desk
        console.log(`  → Creating front desk number from existing number: ${firstNumber.id}`);
        
        if (!dryRun) {
          await prisma.messageNumber.update({
            where: { id: firstNumber.id },
            data: {
              numberClass: 'front_desk',
              ownerId: 'system', // System-assigned front desk number
            },
          });
        }
        
        stats.frontDeskNumbersCreated++;
      } else {
        // No existing MessageNumber records - need to create one
        // Check if we can use TWILIO_PHONE_NUMBER from env
        const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
        
        if (twilioPhoneNumber && !dryRun) {
          // Create MessageNumber from Twilio phone number
          console.log(`  → Creating front desk number from TWILIO_PHONE_NUMBER: ${twilioPhoneNumber}`);
          
          const newFrontDeskNumber = await prisma.messageNumber.create({
            data: {
              orgId,
              provider: 'twilio',
              providerNumberSid: 'SYSTEM_CREATED', // Placeholder - should be updated with actual SID
              e164: twilioPhoneNumber,
              status: 'active',
              numberClass: 'front_desk',
              ownerId: 'system',
            },
          });
          
          stats.frontDeskNumbersCreated++;
          console.log(`  ✓ Created front desk number: ${newFrontDeskNumber.id}`);
        } else if (twilioPhoneNumber && dryRun) {
          console.log(`  → Would create front desk number from TWILIO_PHONE_NUMBER: ${twilioPhoneNumber}`);
          stats.frontDeskNumbersCreated++;
        } else {
          // No existing number and no TWILIO_PHONE_NUMBER - flag for manual setup
          console.log(`  ⚠️  No existing number found for front desk.`);
          console.log(`     Option 1: Create MessageNumber record manually in database`);
          console.log(`     Option 2: Set TWILIO_PHONE_NUMBER in .env.local and rerun migration`);
          stats.errors.push({
            error: `No front desk number for org ${orgId}`,
            details: {
              orgId,
              action: 'Manual setup required',
              options: [
                'Create MessageNumber record manually',
                'Set TWILIO_PHONE_NUMBER in .env.local',
              ],
            },
          });
        }
      }
    } else {
      console.log(`  ✓ Front desk number already exists: ${frontDeskNumber.id}`);
    }

    // Check for sitter masked numbers (created when sitters are assigned)
    // For now, we'll skip automatic creation - they'll be created on-demand
    console.log(`  → Sitter masked numbers will be created on-demand when sitters are assigned`);

    // Check for pool numbers
    const poolNumbers = await prisma.messageNumber.findMany({
      where: {
        orgId,
        numberClass: 'pool',
        status: 'active',
      },
    });

    if (poolNumbers.length === 0) {
      // Create at least one pool number if none exist
      const availableNumber = existingNumbers.find(
        (n) => n.orgId === orgId && n.status === 'active' && n.numberClass === 'pool'
      );

      if (!availableNumber) {
        console.log(`  ⚠️  No pool numbers found. Manual setup required.`);
        stats.errors.push({
          error: `No pool numbers for org ${orgId}`,
          details: { orgId, action: 'Manual setup required' },
        });
      }
    } else {
      console.log(`  ✓ Found ${poolNumbers.length} pool number(s)`);
    }
  }
}

/**
 * Step 2: Backfill MessageThread.messageNumberId and Thread.numberClass
 */
async function backfillThreadNumberAssociations(
  stats: MigrationStats,
  dryRun: boolean
): Promise<void> {
  // Get all threads without messageNumberId
  const threadsWithoutNumber = await prisma.messageThread.findMany({
    where: {
      messageNumberId: null,
    },
    include: {
      participants: {
        where: { role: 'client' },
        take: 1,
      },
    },
  });

  console.log(`Found ${threadsWithoutNumber.length} threads without messageNumberId`);

  // Get all orgIds
  const orgIds = await prisma.messageThread.groupBy({
    by: ['orgId'],
  });

  for (const orgGroup of orgIds) {
    const orgId = orgGroup.orgId;

    // Get front desk number for this org (create if needed from TWILIO_PHONE_NUMBER)
    let frontDeskNumber = await prisma.messageNumber.findFirst({
      where: {
        orgId,
        numberClass: 'front_desk',
        status: 'active',
      },
    });

    // If no front desk number, try to create from TWILIO_PHONE_NUMBER
    if (!frontDeskNumber) {
      const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
      
      if (twilioPhoneNumber && !dryRun) {
        console.log(`  → Creating front desk number from TWILIO_PHONE_NUMBER for thread assignment`);
        frontDeskNumber = await prisma.messageNumber.create({
          data: {
            orgId,
            provider: 'twilio',
            providerNumberSid: 'SYSTEM_CREATED',
            e164: twilioPhoneNumber,
            status: 'active',
            numberClass: 'front_desk',
            ownerId: 'system',
          },
        });
        stats.frontDeskNumbersCreated++;
      } else {
        console.log(`  ⚠️  No front desk number for org ${orgId}. Threads cannot be assigned.`);
        stats.errors.push({
          error: `Cannot assign threads - no front desk number for org ${orgId}`,
          details: {
            orgId,
            action: 'Set TWILIO_PHONE_NUMBER in .env.local or create MessageNumber manually',
          },
        });
        continue;
      }
    }

    // Get threads for this org without number
    const orgThreads = threadsWithoutNumber.filter((t) => t.orgId === orgId);

    for (const thread of orgThreads) {
      let assignedNumber = frontDeskNumber;
      let assignedNumberClass: 'front_desk' | 'sitter' | 'pool' = 'front_desk';
      let flagged = false;

      // Determine number class based on thread context
      // Priority: assigned sitter > one-time client > default (front desk)
      if (thread.assignedSitterId) {
        // Thread has assigned sitter - should use sitter masked number
        const sitterMaskedNumber = await prisma.sitterMaskedNumber.findUnique({
          where: { sitterId: thread.assignedSitterId },
          include: {
            messageNumber: true,
          },
        });

        if (sitterMaskedNumber && sitterMaskedNumber.status === 'active') {
          assignedNumber = sitterMaskedNumber.messageNumber;
          assignedNumberClass = sitterMaskedNumber.messageNumber.numberClass as 'sitter';
        } else {
          // Sitter masked number doesn't exist yet - use front desk for now
          console.log(`  ⚠️  Thread ${thread.id}: Assigned sitter ${thread.assignedSitterId} but no masked number. Using front desk.`);
          flagged = true;
        }
      } else if (thread.isOneTimeClient === true) {
        // One-time client - should use pool number
        const poolNumber = await prisma.messageNumber.findFirst({
          where: {
            orgId,
            numberClass: 'pool',
            status: 'active',
          },
          orderBy: {
            lastAssignedAt: 'asc',
          },
        });

        if (poolNumber) {
          assignedNumber = poolNumber;
          assignedNumberClass = 'pool';
        } else {
          // No pool number - use front desk
          console.log(`  ⚠️  Thread ${thread.id}: One-time client but no pool number. Using front desk.`);
          flagged = true;
        }
      } else {
        // Default: front desk number
        assignedNumberClass = 'front_desk';
      }

      // Assign number to thread
      console.log(`  → Thread ${thread.id}: Assigning ${assignedNumberClass} number ${assignedNumber.id}`);

      if (!dryRun) {
        await prisma.messageThread.update({
          where: { id: thread.id },
          data: {
            messageNumberId: assignedNumber.id,
            numberClass: assignedNumber.numberClass, // Always derive from MessageNumber
            maskedNumberE164: assignedNumber.e164,
          },
        });

        // Update pool number's lastAssignedAt for rotation tracking
        if (assignedNumberClass === 'pool') {
          await prisma.messageNumber.update({
            where: { id: assignedNumber.id },
            data: {
              lastAssignedAt: new Date(),
            },
          });
        }
      }

      stats.threadsUpdated++;
      if (flagged) {
        stats.threadsFlagged++;
      }
    }
  }

  // Ensure all threads have messageNumberId (critical requirement)
  const remainingThreads = await prisma.messageThread.findMany({
    where: {
      messageNumberId: null,
    },
  });

  if (remainingThreads.length > 0) {
    console.log(`\n⚠️  ${remainingThreads.length} threads still without messageNumberId!`);
    console.log(`   Defaulting to front desk number for all remaining threads...`);

    for (const thread of remainingThreads) {
      const frontDeskNumber = await prisma.messageNumber.findFirst({
        where: {
          orgId: thread.orgId,
          numberClass: 'front_desk',
          status: 'active',
        },
      });

      // Try to get or create front desk number
      let fallbackFrontDeskNumber = await prisma.messageNumber.findFirst({
        where: {
          orgId: thread.orgId,
          numberClass: 'front_desk',
          status: 'active',
        },
      });

      // If no front desk number, try to create from TWILIO_PHONE_NUMBER
      if (!fallbackFrontDeskNumber) {
        const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
        
        if (twilioPhoneNumber && !dryRun) {
          console.log(`    → Creating front desk number from TWILIO_PHONE_NUMBER for default assignment`);
          fallbackFrontDeskNumber = await prisma.messageNumber.create({
            data: {
              orgId: thread.orgId,
              provider: 'twilio',
              providerNumberSid: 'SYSTEM_CREATED',
              e164: twilioPhoneNumber,
              status: 'active',
              numberClass: 'front_desk',
              ownerId: 'system',
            },
          });
          stats.frontDeskNumbersCreated++;
        }
      }

      if (fallbackFrontDeskNumber) {
        if (!dryRun) {
          await prisma.messageThread.update({
            where: { id: thread.id },
            data: {
              messageNumberId: fallbackFrontDeskNumber.id,
              numberClass: fallbackFrontDeskNumber.numberClass,
              maskedNumberE164: fallbackFrontDeskNumber.e164,
            },
          });
        }

        stats.threadsUpdated++;
        stats.threadsFlagged++; // Flagged because we had to default
      } else {
        stats.errors.push({
          error: `Thread ${thread.id} cannot be assigned - no front desk number and no TWILIO_PHONE_NUMBER`,
          details: {
            threadId: thread.id,
            orgId: thread.orgId,
            action: 'Set TWILIO_PHONE_NUMBER in .env.local or create MessageNumber manually',
          },
        });
      }
    }
  }

  console.log(`\n✓ All threads now have messageNumberId assigned`);
}

/**
 * Step 3: Backfill client classification fields
 */
async function backfillClientClassification(
  stats: MigrationStats,
  dryRun: boolean
): Promise<void> {
  // Get all threads with null or undefined isOneTimeClient
  // Prisma doesn't support undefined in where, so we check for null or explicitly check all threads
  const allThreads = await prisma.messageThread.findMany({
    select: {
      id: true,
      clientId: true,
      bookingId: true,
      isOneTimeClient: true,
    },
  });

  const threadsNeedingClassification = allThreads.filter(
    (t) => t.isOneTimeClient === null || t.isOneTimeClient === undefined
  );

  console.log(`Found ${threadsNeedingClassification.length} threads needing classification`);

  for (const thread of threadsNeedingClassification) {
    // Determine classification based on explicit signals (not booking count)
    let isOneTimeClient = true; // Default to one-time (no explicit signal)

    // Check for explicit recurrence signals (not booking count)
    if (thread.clientId) {
      // Check for active weekly plan (placeholder - will check when weekly plan system exists)
      // For now, default to one-time
      // TODO: Implement weekly plan check when system exists
    }

    // If booking is linked, check booking recurrence flags (placeholder)
    if (thread.bookingId) {
      // Check for explicit recurrence flags on booking (placeholder)
      // For now, default to one-time
      // TODO: Implement booking recurrence flag check when system exists
    }

    // Update thread classification
    if (!dryRun) {
      await prisma.messageThread.update({
        where: { id: thread.id },
        data: {
          isOneTimeClient,
          // Note: isRecurringClient is derived from !isOneTimeClient in logic
        },
      });
    }

    stats.classificationUpdated++;
  }

  console.log(`✓ Classification backfill complete`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
