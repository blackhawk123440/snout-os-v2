#!/usr/bin/env tsx
/**
 * Pilot Smoke Test
 * 
 * Boots infra, migrates + seeds, starts web+api+workers, runs Playwright e2e,
 * outputs proof-pack artifact locally at proof-pack/
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

const PROOF_PACK_DIR = join(process.cwd(), 'proof-pack');

async function main() {
  console.log('🚀 Starting pilot smoke test...\n');

  // Delete and recreate proof-pack directory (fresh artifacts)
  if (existsSync(PROOF_PACK_DIR)) {
    rmSync(PROOF_PACK_DIR, { recursive: true, force: true });
  }
  mkdirSync(PROOF_PACK_DIR, { recursive: true });

  let testExitCode = 0; // Track test exit code

  try {
    // Step 1: Boot infra (Docker Compose) - optional if docker-compose.yml exists
    const dockerComposePath = join(process.cwd(), 'docker-compose.yml');
    const enterpriseDockerComposePath = join(process.cwd(), 'enterprise-messaging-dashboard', 'docker-compose.yml');
    
    if (existsSync(dockerComposePath) || existsSync(enterpriseDockerComposePath)) {
      console.log('📦 Booting infrastructure (Postgres + Redis)...');
      const composeDir = existsSync(dockerComposePath) 
        ? process.cwd() 
        : join(process.cwd(), 'enterprise-messaging-dashboard');
      
      // Use 'docker compose' (space) instead of 'docker-compose' (hyphen)
      // Change to compose directory and run from there
      execSync('docker compose up -d', { 
        stdio: 'inherit',
        cwd: composeDir,
      });
      console.log('✅ Infrastructure ready\n');
      
      // Wait for services to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('⚠️  No docker-compose.yml found - assuming database/Redis already running\n');
    }

    // Step 2: Migrate + seed
    console.log('🗄️  Running migrations...');
    // Use --accept-data-loss for non-interactive mode (smoke test environment)
    execSync('npx prisma db push --accept-data-loss --skip-generate', { stdio: 'inherit' });
    console.log('✅ Migrations complete\n');

    console.log('🌱 Seeding database...');
    execSync('pnpm db:seed', { stdio: 'inherit' });
    console.log('✅ Seeding complete\n');

    // Step 3: Start web+api+workers in background
    console.log('🌐 Starting application...');
    
    // Check if port 3000 is already in use
    try {
      const { execSync } = await import('child_process');
      const portCheck = execSync('lsof -ti:3000', { encoding: 'utf-8', stdio: 'pipe' }).trim();
      if (portCheck) {
        console.log(`⚠️  Port 3000 is already in use (PID: ${portCheck})`);
        console.log('   Killing existing process...');
        try {
          execSync(`kill -9 ${portCheck}`, { stdio: 'ignore' });
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for port to free
        } catch {
          // Ignore kill errors
        }
      }
    } catch {
      // Port is free, continue
    }
    
    console.log('⚠️  Note: Starting dev server in background. Make sure to stop it manually after tests.\n');
    
    // Use spawn for background process with proper output handling
    const { spawn } = await import('child_process');
    const devProcess = spawn('pnpm', ['dev'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      cwd: process.cwd(),
      env: {
        ...process.env,
        // Ensure required env vars are set
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://snoutos:snoutos_dev_password@localhost:5432/snoutos_messaging',
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'JeBctxnIua976KOMQvZDg9qjF/4Xy3ncp/quiknbXBPKy5nFiOvsErmxIXtq+18a',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
        ENABLE_E2E_AUTH: 'true',
        E2E_AUTH_KEY: process.env.E2E_AUTH_KEY || 'test-e2e-key-change-in-production',
        ENABLE_OPS_SEED: 'true',
        NEXT_PUBLIC_ENABLE_MESSAGING_V1: 'true',
      },
    });
    
    // Collect all output for debugging
    let devOutput = '';
    let devErrors = '';
    
    devProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      devOutput += output;
      // Log important messages
      if (output.includes('Ready') || output.includes('started server') || output.includes('Local:')) {
        console.log('   Dev server:', output.trim());
      }
    });
    
    devProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      devErrors += output;
      // Log errors immediately
      if (output.includes('error') || output.includes('Error') || output.includes('Failed')) {
        console.error('   Dev server error:', output.trim());
      }
    });
    
    devProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`   Dev server exited with code ${code}`);
        console.error('   Last output:', devOutput.slice(-500));
        console.error('   Last errors:', devErrors.slice(-500));
      }
    });
    
    devProcess.unref();
    
    // Wait for app to be ready (check multiple times)
    console.log('⏳ Waiting for application to start...');
    let appReady = false;
    for (let i = 0; i < 60; i++) { // Increase to 60 attempts (2 minutes)
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        const response = await fetch('http://localhost:3000', {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok || response.status === 404 || response.status === 500) { 
          // Any HTTP response means server is running
          appReady = true;
          console.log(`   Server responded with status ${response.status}`);
          break;
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // Timeout - server not ready yet
          process.stdout.write('.');
        } else {
          // Other error - might be connection refused, continue
          process.stdout.write('.');
        }
      }
    }
    console.log(''); // New line after dots
    
    if (!appReady) {
      console.error('❌ Application failed to start after 2 minutes');
      console.error('\n   Debugging information:');
      console.error('   - Last dev server output:', devOutput.slice(-500) || '(none)');
      console.error('   - Last dev server errors:', devErrors.slice(-500) || '(none)');
      console.error('\n   Troubleshooting:');
      console.error('   1. Check if DATABASE_URL is set: echo $DATABASE_URL');
      console.error('   2. Check if port 3000 is in use: lsof -i:3000');
      console.error('   3. Try running manually: pnpm dev');
      console.error('   4. Check for errors in the output above');
      process.exit(1);
    }
    console.log('✅ Application ready\n');

    // Step 4: Run Playwright smoke tests (ONLY smoke suite, no snapshots)
    console.log('🧪 Running Playwright smoke tests...');
    try {
      // Generate E2E auth key if not set
      const e2eAuthKey = process.env.E2E_AUTH_KEY || 'test-e2e-key-change-in-production';
      // Use provided secret or fallback for tests
      const nextAuthSecret = process.env.NEXTAUTH_SECRET || 'JeBctxnIua976KOMQvZDg9qjF/4Xy3ncp/quiknbXBPKy5nFiOvsErmxIXtq+18a';
      
      execSync('pnpm test:ui:smoke', {
        stdio: 'inherit',
        env: {
          ...process.env,
          BASE_URL: 'http://localhost:3000',
          OWNER_EMAIL: 'owner@example.com',
          SITTER_EMAIL: 'sitter@example.com',
          ENABLE_E2E_AUTH: 'true',
          E2E_AUTH_KEY: e2eAuthKey,
          NEXTAUTH_SECRET: nextAuthSecret,
          NEXTAUTH_URL: 'http://localhost:3000',
          ENABLE_OPS_SEED: 'true',
          NEXT_PUBLIC_ENABLE_MESSAGING_V1: 'true',
        },
      });
      console.log('✅ Smoke tests complete\n');
    } catch (error: any) {
      testExitCode = error.status || 1;
      console.error('❌ Smoke tests failed\n');
      // Continue to capture artifacts even if tests fail
    }

    // Step 5: Capture screenshots and HTML report
    console.log('📸 Capturing screenshots and reports...');
    const testResultsDir = join(process.cwd(), 'test-results');
    const playwrightReportDir = join(PROOF_PACK_DIR, 'playwright-report');
    
    // Copy HTML report if it exists
    const htmlReportPath = join(process.cwd(), 'playwright-report');
    if (existsSync(htmlReportPath)) {
      if (!existsSync(playwrightReportDir)) {
        mkdirSync(playwrightReportDir, { recursive: true });
      }
      execSync(`cp -r ${htmlReportPath}/* ${playwrightReportDir}/ 2>/dev/null || true`, {
        stdio: 'ignore',
      });
    }
    
    // Copy screenshots from test-results
    if (existsSync(testResultsDir)) {
      const screenshotsDir = join(PROOF_PACK_DIR, 'screenshots');
      if (!existsSync(screenshotsDir)) {
        mkdirSync(screenshotsDir, { recursive: true });
      }
      execSync(`find ${testResultsDir} -name "*.png" -exec cp {} ${screenshotsDir}/ \\; 2>/dev/null || true`, {
        stdio: 'ignore',
      });
    }
    console.log('✅ Screenshots and reports captured\n');

    // Step 6: Generate proof-pack summary
    console.log('📋 Generating proof-pack summary...');
    const summary = {
      timestamp: new Date().toISOString(),
      commit: execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim(),
      branch: execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim(),
      tests: {
        e2e: 'See playwright-report/index.html',
        screenshots: 'See screenshots/',
      },
    };
    writeFileSync(
      join(PROOF_PACK_DIR, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );
    console.log('✅ Proof-pack generated at proof-pack/\n');

    // Final status
    if (testExitCode === 0) {
      console.log('✅ Pilot smoke test complete!');
      console.log(`📦 Proof-pack available at: ${PROOF_PACK_DIR}`);
    } else {
      console.error('❌ Pilot smoke test failed (tests had failures)');
      console.log(`📦 Proof-pack available at: ${PROOF_PACK_DIR} (for debugging)`);
    }

  } catch (error: any) {
    console.error('❌ Pilot smoke test failed:', error?.message || String(error));
    process.exit(1);
  } finally {
    // Cleanup: stop background processes
    console.log('\n🧹 Cleaning up...');
    try {
      // Kill dev server process
      execSync('pkill -f "next dev" || true', { stdio: 'ignore' });
      
      // Stop Docker Compose if we started it
      const dockerComposePath = join(process.cwd(), 'docker-compose.yml');
      const enterpriseDockerComposePath = join(process.cwd(), 'enterprise-messaging-dashboard', 'docker-compose.yml');
      if (existsSync(dockerComposePath) || existsSync(enterpriseDockerComposePath)) {
        const composeDir = existsSync(dockerComposePath) 
          ? process.cwd() 
          : join(process.cwd(), 'enterprise-messaging-dashboard');
        execSync('docker compose down', { 
          stdio: 'ignore',
          cwd: composeDir,
        });
      }
      console.log('✅ Cleanup complete');
    } catch (cleanupError: any) {
      // Ignore cleanup errors but log them
      console.error('⚠️  Cleanup warning:', cleanupError?.message || String(cleanupError));
    }
  }
  
  // Exit with test exit code (non-zero if tests failed)
  if (typeof testExitCode !== 'undefined' && testExitCode !== 0) {
    process.exit(testExitCode);
  }
}

main().catch((error: any) => {
  console.error('❌ Fatal error:', error?.message || String(error));
  process.exit(1);
});
