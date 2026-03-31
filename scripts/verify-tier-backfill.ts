/**
 * Verification Script for Tier Backfill
 * 
 * Alternative to SQL verification - runs queries via Prisma and displays results.
 * 
 * Run: tsx scripts/verify-tier-backfill.ts
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
  process.exit(1);
}

const prisma = new PrismaClient();

async function verifyBackfill() {
  console.log('🔍 Verifying tier backfill...\n');

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

  try {
    // 1. Check all sitters have a tier assigned
    console.log('1️⃣ Checking tier assignments...');
    const totalSitters = await prisma.sitter.count();
    const sittersWithTier = await prisma.sitter.count({
      where: { currentTierId: { not: null } },
    });
    const sittersWithoutTier = totalSitters - sittersWithTier;

    console.log(`   Total sitters: ${totalSitters}`);
    console.log(`   Sitters with tier: ${sittersWithTier}`);
    console.log(`   Sitters without tier: ${sittersWithoutTier}`);
    
    if (sittersWithoutTier === 0) {
      console.log('   ✅ All sitters have tiers assigned\n');
    } else {
      console.log(`   ⚠️  ${sittersWithoutTier} sitter(s) still need tier assignment\n`);
    }

    // 2. Show tier distribution
    console.log('2️⃣ Tier distribution:');
    const tierDistribution = await prisma.sitter.groupBy({
      by: ['currentTierId'],
      _count: {
        id: true,
      },
      where: {
        currentTierId: { not: null },
      },
    });

    const tierNames = await prisma.sitterTier.findMany({
      select: {
        id: true,
        name: true,
        priorityLevel: true,
        commissionSplit: true,
      },
    });

    const tierMap = new Map(tierNames.map(t => [t.id, t]));

    for (const group of tierDistribution.sort((a, b) => {
      const aTier = tierMap.get(a.currentTierId!);
      const bTier = tierMap.get(b.currentTierId!);
      return (bTier?.priorityLevel || 0) - (aTier?.priorityLevel || 0);
    })) {
      const tier = tierMap.get(group.currentTierId!);
      if (tier) {
        console.log(`   ${tier.name}: ${group._count.id} sitter(s) (${tier.commissionSplit}% commission)`);
      }
    }
    console.log('');

    // 3. Verify tier history records were created for backfill
    console.log('3️⃣ Checking backfill history records...');
    const backfillHistory = await prisma.sitterTierHistory.findMany({
      where: {
        OR: [
          { reason: { contains: 'backfill' } },
          { metadata: { contains: 'backfill' } },
        ],
      },
    });

    const uniqueSitters = new Set(backfillHistory.map(h => h.sitterId));
    console.log(`   Backfill history records: ${backfillHistory.length}`);
    console.log(`   Unique sitters in history: ${uniqueSitters.size}`);
    
    if (backfillHistory.length > 0) {
      console.log('   ✅ Backfill history records found\n');
    } else {
      console.log('   ⚠️  No backfill history records found\n');
    }

    // 4. Verify event logs were created
    console.log('4️⃣ Checking event logs...');
    const backfillEvents = await prisma.eventLog.findMany({
      where: {
        eventType: 'sitter.tier.changed',
        metadata: { contains: 'backfill' },
      },
    });

    const uniqueEventSitters = new Set(
      backfillEvents
        .map(e => {
          try {
            const meta = JSON.parse(e.metadata || '{}');
            return meta.sitterId;
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    );

    console.log(`   Backfill event logs: ${backfillEvents.length}`);
    console.log(`   Unique sitters in events: ${uniqueEventSitters.size}`);
    
    if (backfillEvents.length > 0) {
      console.log('   ✅ Backfill event logs found\n');
    } else {
      console.log('   ⚠️  No backfill event logs found\n');
    }

    // 5. Show recent tier changes (including backfill)
    console.log('5️⃣ Recent tier changes (last 10):');
    const recentChanges = await prisma.sitterTierHistory.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        sitter: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        tier: {
          select: {
            name: true,
          },
        },
      },
    });

    for (const change of recentChanges) {
      const isBackfill = change.reason?.includes('backfill') || change.metadata?.includes('backfill');
      const backfillFlag = isBackfill ? ' [BACKFILL]' : '';
      console.log(
        `   ${change.sitter.firstName} ${change.sitter.lastName} → ${change.tier.name}${backfillFlag}`
      );
      console.log(`      Reason: ${change.reason || 'N/A'}`);
      console.log(`      Date: ${change.createdAt.toISOString()}`);
    }
    console.log('');

    // 6. Check for any sitters still without tier (should be 0)
    console.log('6️⃣ Sitters without tier:');
    const sittersWithoutTierList = await prisma.sitter.findMany({
      where: { currentTierId: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (sittersWithoutTierList.length === 0) {
      console.log('   ✅ No sitters without tier\n');
    } else {
      console.log(`   ⚠️  Found ${sittersWithoutTierList.length} sitter(s) without tier:`);
      for (const sitter of sittersWithoutTierList) {
        console.log(`      - ${sitter.firstName} ${sitter.lastName} (${sitter.id})`);
      }
      console.log('');
    }

    // 7. Verify commission percentages match tier splits
    console.log('7️⃣ Commission percentage verification:');
    const commissionCheck = await prisma.sitter.findMany({
      where: { currentTierId: { not: null } },
      include: {
        currentTier: {
          select: {
            name: true,
            commissionSplit: true,
          },
        },
      },
    });

    const mismatches = commissionCheck.filter(
      s => s.commissionPercentage !== s.currentTier?.commissionSplit
    );

    if (mismatches.length === 0) {
      console.log('   ✅ All commission percentages match tier splits\n');
    } else {
      console.log(`   ⚠️  Found ${mismatches.length} sitter(s) with mismatched commission:`);
      for (const sitter of mismatches.slice(0, 10)) {
        console.log(
          `      - ${sitter.firstName} ${sitter.lastName}: ${sitter.commissionPercentage}% (should be ${sitter.currentTier?.commissionSplit}%)`
        );
      }
      if (mismatches.length > 10) {
        console.log(`      ... and ${mismatches.length - 10} more`);
      }
      console.log('');
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📊 Verification Summary');
    console.log('='.repeat(60));
    
    const allGood = 
      sittersWithoutTier === 0 &&
      backfillHistory.length > 0 &&
      backfillEvents.length > 0 &&
      mismatches.length === 0;

    if (allGood) {
      console.log('✅ All checks passed! Backfill appears successful.\n');
    } else {
      console.log('⚠️  Some issues found. Review the details above.\n');
    }

  } catch (error: any) {
    console.error('❌ Error during verification:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyBackfill();
