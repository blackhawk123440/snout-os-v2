#!/usr/bin/env node
/**
 * Phase 3 Proof Script
 * 
 * Runs all Phase 3 acceptance checks:
 * - Prisma migrate deploy or db push
 * - Phase 1 proof scripts
 * - Phase 2 proof scripts
 * - Phase 3 integration tests
 * - Prints PASS if all checks pass
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT_DIR = process.cwd();

function runCommand(command: string, description: string): boolean {
  console.log(`\n▶ ${description}...`);
  try {
    execSync(command, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' },
    });
    console.log(`✓ ${description} passed`);
    return true;
  } catch (error) {
    console.error(`\n❌ ${description} failed`);
    return false;
  }
}

async function main() {
  console.log('🔍 Phase 3 Proof Script');
  console.log('=' .repeat(50));

  // Step 1: Prisma migrate deploy or db push
  console.log('\n📦 Step 1: Deploy database migrations...');
  const migrateDeployed = runCommand('npx prisma migrate deploy', 'Deploy Prisma migrations');
  if (!migrateDeployed) {
    // If migrate deploy fails (e.g., P3005 baseline error), use db push instead
    console.log('⚠ Migrate deploy failed, using db push instead');
    const dbPushed = runCommand('npx prisma db push', 'Push Prisma schema to database');
    if (!dbPushed) {
      console.error('❌ Database migration failed');
      process.exit(1);
    }
  }

  // Step 2: Phase 1 proof scripts (if they exist)
  console.log('\n📦 Step 2: Run Phase 1 proof scripts...');
  const phase1ProofScript = join(ROOT_DIR, 'scripts', 'proof-phase-1-5.ts');
  if (existsSync(phase1ProofScript)) {
    const phase1Passed = runCommand('npm run proof:phase1-5', 'Phase 1.5 proof script');
    if (!phase1Passed) {
      console.error('❌ Phase 1 proof scripts failed');
      process.exit(1);
    }
  } else {
    console.log('⚠ Phase 1.5 proof script not found, skipping');
  }

  // Step 3: Phase 2 proof scripts (if they exist)
  console.log('\n📦 Step 3: Run Phase 2 proof scripts...');
  const phase2ProofScript = join(ROOT_DIR, 'scripts', 'proof-phase-2.ts');
  if (existsSync(phase2ProofScript)) {
    const phase2Passed = runCommand('npm run proof:phase2', 'Phase 2 proof script');
    if (!phase2Passed) {
      console.error('❌ Phase 2 proof scripts failed');
      process.exit(1);
    }
  } else {
    console.log('⚠ Phase 2 proof script not found, skipping');
  }

  // Step 4: Phase 3 integration tests
  console.log('\n🧪 Step 4: Run Phase 3 integration tests...');
  const phase3TestsPassed = runCommand(
    'npm test -- src/app/api/messages/__tests__/phase-3-integration.test.ts',
    'Phase 3 integration tests'
  );
  if (!phase3TestsPassed) {
    console.error('❌ Phase 3 integration tests failed');
    process.exit(1);
  }

  // All checks passed
  console.log('\n' + '='.repeat(50));
  console.log('✅ PASS');
  console.log('='.repeat(50));
  console.log('\nPhase 3 acceptance checks complete!');
}

main().catch((error) => {
  console.error('\n❌ Proof script failed:', error);
  process.exit(1);
});
