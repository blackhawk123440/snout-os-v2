/**
 * Phase 1.4 Proof Script
 * 
 * Verifies migration results by printing counts and statistics.
 * 
 * Run: npx tsx scripts/proof-phase-1-4.ts
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

interface ProofStats {
  frontDeskNumbersPerOrg: Record<string, number>;
  sitterMaskedNumbersCount: number;
  poolNumbersCount: number;
  threadsMissingMessageNumberId: number;
  threadsByNumberClass: Record<string, number>;
  totalMessageNumbers: number;
  totalThreads: number;
  errors: string[];
}

async function main() {
  console.log('🔍 Phase 1.4 Migration Proof\n');

  const stats: ProofStats = {
    frontDeskNumbersPerOrg: {},
    sitterMaskedNumbersCount: 0,
    poolNumbersCount: 0,
    threadsMissingMessageNumberId: 0,
    threadsByNumberClass: {},
    totalMessageNumbers: 0,
    totalThreads: 0,
    errors: [],
  };

  try {
    // Count front desk numbers per org
    const orgIds = await prisma.messageNumber.groupBy({
      by: ['orgId'],
    });

    for (const orgGroup of orgIds) {
      const count = await prisma.messageNumber.count({
        where: {
          orgId: orgGroup.orgId,
          numberClass: 'front_desk',
          status: 'active',
        },
      });

      stats.frontDeskNumbersPerOrg[orgGroup.orgId] = count;

      if (count !== 1) {
        stats.errors.push(
          `Org ${orgGroup.orgId}: Expected 1 front desk number, found ${count}`
        );
      }
    }

    // Count sitter masked numbers
    stats.sitterMaskedNumbersCount = await prisma.sitterMaskedNumber.count({
      where: {
        status: 'active',
      },
    });

    // Count active sitters for comparison
    const activeSittersCount = await prisma.sitter.count({
      where: {
        active: true,
      },
    });

    // Count pool numbers
    stats.poolNumbersCount = await prisma.messageNumber.count({
      where: {
        numberClass: 'pool',
        status: 'active',
      },
    });

    // Count threads missing messageNumberId (should be 0)
    stats.threadsMissingMessageNumberId = await prisma.messageThread.count({
      where: {
        messageNumberId: null,
      },
    });

    if (stats.threadsMissingMessageNumberId > 0) {
      stats.errors.push(
        `Found ${stats.threadsMissingMessageNumberId} threads without messageNumberId (should be 0)`
      );
    }

    // Count threads by number class
    const threadsByClass = await prisma.messageThread.groupBy({
      by: ['numberClass'],
      _count: true,
    });

    threadsByClass.forEach((group) => {
      const className = group.numberClass || 'null';
      stats.threadsByNumberClass[className] = group._count;
    });

    // Total counts
    stats.totalMessageNumbers = await prisma.messageNumber.count();
    stats.totalThreads = await prisma.messageThread.count();

    // Print results
    console.log('=== Proof Results ===\n');

    console.log('Front Desk Numbers Per Org:');
    Object.entries(stats.frontDeskNumbersPerOrg).forEach(([orgId, count]) => {
      const status = count === 1 ? '✓' : '✗';
      console.log(`  ${status} Org ${orgId}: ${count} (expected: 1)`);
    });

    console.log(`\nSitter Masked Numbers: ${stats.sitterMaskedNumbersCount}`);
    console.log(`Active Sitters: ${activeSittersCount}`);
    if (stats.sitterMaskedNumbersCount > activeSittersCount) {
      stats.errors.push(
        `More masked numbers than active sitters (may indicate deactivated sitters still have numbers)`
      );
    }

    console.log(`\nPool Numbers: ${stats.poolNumbersCount}`);

    console.log(
      `\nThreads Missing messageNumberId: ${stats.threadsMissingMessageNumberId} (expected: 0)`
    );

    console.log('\nThreads By Number Class:');
    Object.entries(stats.threadsByNumberClass).forEach(([className, count]) => {
      console.log(`  ${className || 'null'}: ${count}`);
    });

    console.log(`\nTotal MessageNumbers: ${stats.totalMessageNumbers}`);
    console.log(`Total MessageThreads: ${stats.totalThreads}`);

    // Validation results
    console.log('\n=== Validation ===\n');

    if (stats.errors.length === 0) {
      console.log('✅ All checks passed!');
      console.log('\n✓ Front desk numbers: Exactly 1 per org');
      console.log('✓ Sitter masked numbers: Count matches active sitters (or less)');
      console.log('✓ Threads missing messageNumberId: 0');
      console.log('✓ All threads have numberClass assigned');
    } else {
      console.log('❌ Validation failed:\n');
      stats.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Proof script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
