/**
 * Phase 1.5 Proof Script
 * 
 * Runs all Phase 1.5 acceptance checks:
 * 1. Prisma migrate deploy (or db push)
 * 2. Proof Phase 1.4
 * 3. Phase 1.3 integration tests
 * 4. Phase 1.5 hardening tests
 * 
 * Prints PASS if all checks pass.
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

interface ProofResult {
  step: string;
  passed: boolean;
  error?: string;
}

const results: ProofResult[] = [];

function runStep(name: string, command: string): boolean {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Step: ${name}`);
  console.log(`Command: ${command}`);
  console.log('='.repeat(60) + '\n');

  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: resolve(process.cwd()),
    });
    results.push({ step: name, passed: true });
    console.log(`\n✅ ${name} PASSED\n`);
    return true;
  } catch (error: any) {
    const errorMessage = error.message || error.toString();
    results.push({ step: name, passed: false, error: errorMessage });
    console.log(`\n❌ ${name} FAILED: ${errorMessage}\n`);
    return false;
  }
}

async function main() {
  console.log('🔍 Phase 1.5 Proof Script\n');
  console.log('Running all acceptance checks...\n');

  let allPassed = true;

  // Step 1: Prisma migrate deploy (or db push)
  // Check if migrations exist, use deploy, otherwise use push
  try {
    const migrations = execSync('ls prisma/migrations 2>/dev/null | wc -l', {
      encoding: 'utf-8',
    }).trim();
    
    if (parseInt(migrations) > 0) {
      allPassed = runStep(
        'Prisma Migrate Deploy',
        'npx prisma migrate deploy'
      ) && allPassed;
    } else {
      allPassed = runStep(
        'Prisma DB Push',
        'npx prisma db push'
      ) && allPassed;
    }
  } catch (error) {
    // If migrations directory doesn't exist, use db push
    allPassed = runStep(
      'Prisma DB Push',
      'npx prisma db push'
    ) && allPassed;
  }

  // Step 2: Proof Phase 1.4
  allPassed = runStep(
    'Proof Phase 1.4',
    'npm run proof:phase1-4'
  ) && allPassed;

  // Step 3: Phase 1.3 Integration Tests
  allPassed = runStep(
    'Phase 1.3 Integration Tests',
    'npm test -- src/app/api/messages/__tests__/phase-1-3-integration.test.ts'
  ) && allPassed;

  // Step 4: Phase 1.5 Hardening Tests
  allPassed = runStep(
    'Phase 1.5 Hardening Tests',
    'npm test -- src/app/api/messages/__tests__/phase-1-5-hardening.test.ts'
  ) && allPassed;

  // Step 5: Webhook Negative Tests
  allPassed = runStep(
    'Webhook Negative Tests',
    'npm test -- src/app/api/messages/__tests__/webhook-negative.test.ts'
  ) && allPassed;

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('PROOF SUMMARY');
  console.log('='.repeat(60) + '\n');

  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${result.step}: ${status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(60));

  if (allPassed) {
    console.log('✅ ALL CHECKS PASSED');
    console.log('='.repeat(60) + '\n');
    process.exit(0);
  } else {
    console.log('❌ SOME CHECKS FAILED');
    console.log('='.repeat(60) + '\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
