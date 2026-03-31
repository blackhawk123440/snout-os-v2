/**
 * Diagnostic Script: Check Tier Badge Visibility
 * 
 * Checks if sitters have tiers assigned and if tier data is being returned correctly.
 * 
 * Run: tsx scripts/check-tier-visibility.ts
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function checkTierVisibility() {
  console.log('🔍 Checking tier badge visibility...\n');

  try {
    // 1. Check if tiers exist
    console.log('1️⃣ Checking if tiers are seeded...');
    const tiers = await prisma.sitterTier.findMany({
      orderBy: { priorityLevel: 'desc' },
    });
    
    if (tiers.length === 0) {
      console.log('   ❌ No tiers found in database!');
      console.log('   Solution: Run `npm run db:seed` to create tiers\n');
    } else {
      console.log(`   ✅ Found ${tiers.length} tier(s):`);
      tiers.forEach(tier => {
        console.log(`      - ${tier.name} (Priority: ${tier.priorityLevel}, Default: ${tier.isDefault})`);
      });
      console.log('');
    }

    // 2. Check sitters with/without tiers
    console.log('2️⃣ Checking sitter tier assignments...');
    const totalSitters = await prisma.sitter.count();
    const sittersWithTier = await prisma.sitter.count({
      where: { currentTierId: { not: null } },
    });
    const sittersWithoutTier = totalSitters - sittersWithTier;

    console.log(`   Total sitters: ${totalSitters}`);
    console.log(`   Sitters with tier: ${sittersWithTier}`);
    console.log(`   Sitters without tier: ${sittersWithoutTier}`);
    
    if (sittersWithoutTier > 0) {
      console.log(`   ⚠️  ${sittersWithoutTier} sitter(s) need tier assignment!`);
      console.log('   Solution: Run `npm run backfill:tiers`\n');
      
      // Show sitters without tiers
      const sittersNeedingTier = await prisma.sitter.findMany({
        where: { currentTierId: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
        take: 5,
      });
      
      if (sittersNeedingTier.length > 0) {
        console.log('   Sitters without tier (first 5):');
        sittersNeedingTier.forEach(s => {
          console.log(`      - ${s.firstName} ${s.lastName} (${s.id})`);
        });
        console.log('');
      }
    } else {
      console.log('   ✅ All sitters have tiers assigned\n');
    }

    // 3. Check tier data completeness
    console.log('3️⃣ Checking tier data completeness...');
    const sittersWithTierData = await prisma.sitter.findMany({
      where: { currentTierId: { not: null } },
      include: {
        currentTier: true,
      },
      take: 3,
    });

    if (sittersWithTierData.length > 0) {
      console.log('   Sample sitter tier data:');
      sittersWithTierData.forEach(sitter => {
        const tier = sitter.currentTier;
        if (tier) {
          console.log(`      ${sitter.firstName} ${sitter.lastName}:`);
          console.log(`         Tier: ${tier.name}`);
          console.log(`         Has badgeColor: ${!!tier.badgeColor}`);
          console.log(`         Has badgeStyle: ${!!tier.badgeStyle}`);
          console.log(`         Has description: ${!!tier.description}`);
          console.log(`         Has commissionSplit: ${!!tier.commissionSplit}`);
        }
      });
      console.log('');
    }

    // 4. Check API response structure
    console.log('4️⃣ API Response Check:');
    console.log('   The following APIs should return tier data:');
    console.log('   - GET /api/sitters/[id] - Should include currentTier with all fields');
    console.log('   - GET /api/sitter/[id]/bookings - Should include currentTier');
    console.log('   - GET /api/bookings - Should include sitter.currentTier');
    console.log('   - GET /api/sitters - Should include currentTier for all sitters');
    console.log('');

    // Summary
    console.log('='.repeat(60));
    console.log('📊 Summary');
    console.log('='.repeat(60));
    
    const issues: string[] = [];
    if (tiers.length === 0) {
      issues.push('No tiers seeded - run `npm run db:seed`');
    }
    if (sittersWithoutTier > 0) {
      issues.push(`${sittersWithoutTier} sitter(s) need tier assignment - run \`npm run backfill:tiers\``);
    }

    if (issues.length === 0) {
      console.log('✅ All checks passed! Tier badges should be visible.\n');
      console.log('If badges still don\'t show:');
      console.log('   1. Check browser console for errors');
      console.log('   2. Verify API responses include currentTier');
      console.log('   3. Check that SitterTierBadge component is imported correctly');
    } else {
      console.log('⚠️  Issues found:\n');
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
      console.log('');
    }

  } catch (error: any) {
    console.error('❌ Error during check:', error.message);
    if (error.message.includes('DATABASE_URL')) {
      console.error('\n   Please set DATABASE_URL in .env.local');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkTierVisibility();
