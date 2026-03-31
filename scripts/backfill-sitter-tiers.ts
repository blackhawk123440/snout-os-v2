/**
 * Sitter Tier Backfill Script
 * 
 * One-time script to assign default tier (Trainee) to all existing sitters
 * that don't have a tier assigned, and log tier change events for audit.
 * 
 * Run: tsx scripts/backfill-sitter-tiers.ts
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local or .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

// Check for DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable is not set.');
  console.error('');
  console.error('Please set DATABASE_URL in your .env.local or .env file.');
  console.error('');
  console.error('Example:');
  console.error('  DATABASE_URL="postgresql://user:password@host:5432/database"');
  console.error('');
  console.error('For Supabase:');
  console.error('  DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"');
  console.error('');
  process.exit(1);
}

const prisma = new PrismaClient();

interface BackfillResult {
  sitterId: string;
  sitterName: string;
  previousTier: string | null;
  newTier: string;
  success: boolean;
  error?: string;
}

async function backfillSitterTiers() {
  console.log('🔄 Starting sitter tier backfill...\n');

  // Test database connection first
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful\n');
  } catch (error: any) {
    console.error('❌ Database connection failed:');
    console.error(`   ${error.message}`);
    console.error('');
    console.error('Please check:');
    console.error('  1. DATABASE_URL is set correctly in .env.local or .env');
    console.error('  2. Database credentials are valid');
    console.error('  3. Database server is accessible');
    console.error('');
    process.exit(1);
  }

  // Get the default tier (Trainee)
  const defaultTier = await prisma.sitterTier.findFirst({
    where: { isDefault: true },
  });

  if (!defaultTier) {
    console.error('❌ Error: No default tier found. Please seed tiers first.');
    console.log('   Run: npm run db:seed');
    process.exit(1);
  }

  console.log(`✅ Found default tier: ${defaultTier.name} (ID: ${defaultTier.id})\n`);

  // Get all sitters without a tier
  const sittersWithoutTier = await prisma.sitter.findMany({
    where: {
      OR: [
        { currentTierId: null },
        { currentTier: null },
      ],
    },
    include: {
      currentTier: true,
    },
  });

  if (sittersWithoutTier.length === 0) {
    console.log('✅ All sitters already have tiers assigned. Nothing to backfill.\n');
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`📋 Found ${sittersWithoutTier.length} sitter(s) without tier assignment\n`);

  const results: BackfillResult[] = [];

  // Process each sitter
  for (const sitter of sittersWithoutTier) {
    try {
      const previousTierId = sitter.currentTierId;
      const previousTierName = sitter.currentTier?.name || null;

      // Update sitter with default tier
      const updatedSitter = await prisma.sitter.update({
        where: { id: sitter.id },
        data: {
          currentTierId: defaultTier.id,
          // Update commission percentage based on tier
          commissionPercentage: defaultTier.commissionSplit,
        },
        include: {
          currentTier: true,
        },
      });

      // Log tier change to SitterTierHistory
      await prisma.sitterTierHistory.create({
        data: {
          sitterId: sitter.id,
          tierId: defaultTier.id,
          points: 0, // Will be calculated separately
          periodStart: new Date(),
          changedBy: null, // System backfill
          reason: 'Initial tier assignment (backfill)',
          metadata: JSON.stringify({
            backfill: true,
            previousTierName,
            newTierName: defaultTier.name,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      // Log to EventLog for system-wide audit
      await prisma.eventLog.create({
        data: {
          eventType: 'sitter.tier.changed',
          status: 'success',
          metadata: JSON.stringify({
            sitterId: sitter.id,
            fromTierId: previousTierId,
            toTierId: defaultTier.id,
            reason: 'Initial tier assignment (backfill)',
            changedBy: null,
            backfill: true,
            previousTierName,
            newTierName: defaultTier.name,
          }),
        },
      });

      results.push({
        sitterId: sitter.id,
        sitterName: `${sitter.firstName} ${sitter.lastName}`,
        previousTier: previousTierName || 'none',
        newTier: defaultTier.name,
        success: true,
      });

      console.log(`✅ Assigned ${defaultTier.name} to ${sitter.firstName} ${sitter.lastName}`);
    } catch (error: any) {
      results.push({
        sitterId: sitter.id,
        sitterName: `${sitter.firstName} ${sitter.lastName}`,
        previousTier: sitter.currentTier?.name || 'none',
        newTier: defaultTier.name,
        success: false,
        error: error.message,
      });

      console.error(`❌ Failed to assign tier to ${sitter.firstName} ${sitter.lastName}: ${error.message}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Backfill Summary');
  console.log('='.repeat(60));
  console.log(`Total sitters processed: ${results.length}`);
  console.log(`✅ Successful: ${results.filter(r => r.success).length}`);
  console.log(`❌ Failed: ${results.filter(r => !r.success).length}`);

  if (results.some(r => !r.success)) {
    console.log('\n❌ Failed assignments:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`   - ${r.sitterName} (${r.sitterId}): ${r.error}`);
      });
  }

  console.log('\n✅ Backfill completed!\n');
  await prisma.$disconnect();
}

// Run the backfill
backfillSitterTiers()
  .catch((error) => {
    console.error('❌ Fatal error during backfill:', error);
    process.exit(1);
  });
