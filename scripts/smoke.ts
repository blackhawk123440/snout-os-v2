#!/usr/bin/env tsx
/**
 * Single entry point for smoke and a11y tests.
 * - CI: run Playwright only (server started by workflow)
 * - Local: run full harness (db reset → build → server → playwright → teardown)
 *
 * Usage:
 *   pnpm test:ui:smoke     → smoke suite (default)
 *   pnpm test:e2e:a11y     → a11y suite (--a11y)
 */

import { execSync } from 'child_process';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const isA11y = process.argv.includes('--a11y');

const playwrightCmd = isA11y
  ? 'pnpm exec playwright test tests/e2e/a11y-smoke.spec.ts --config=playwright.smoke.config.ts'
  : 'pnpm exec playwright test --config=playwright.smoke.config.ts';

function dockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', cwd: ROOT });
    return true;
  } catch {
    return false;
  }
}

function run(cmd: string) {
  execSync(cmd, {
    stdio: 'inherit',
    cwd: ROOT,
    env: process.env,
  });
}

if (process.env.CI === 'true') {
  run(playwrightCmd);
} else {
  const mode = process.env.SMOKE_MODE || 'auto';
  const hasDocker = dockerAvailable();

  // Local full harness stays the default when Docker is available.
  if (mode === 'full' || (mode === 'auto' && hasDocker)) {
    run(`tsx scripts/smoke-local.ts ${isA11y ? '--a11y' : ''}`);
  } else if (mode === 'playwright' || mode === 'no-db' || (mode === 'auto' && !hasDocker)) {
    // CI-safe fallback: no DB reset, only shell/auth-boundary checks against a running server.
    run(`tsx scripts/smoke-no-db.ts ${isA11y ? '--a11y' : ''}`);
  } else {
    console.error(`[smoke] Unsupported SMOKE_MODE: ${mode}`);
    process.exit(1);
  }
}
