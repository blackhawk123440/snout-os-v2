#!/usr/bin/env tsx
/**
 * Local smoke/a11y harness: db reset → build → start server → run playwright → teardown
 * Usage: tsx scripts/smoke-local.ts [--a11y]
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const ENV_SMOKE = path.join(ROOT, '.env.smoke');
const ENV_SMOKE_EXAMPLE = path.join(ROOT, '.env.smoke.example');

function run(cmd: string, opts?: { cwd?: string; env?: NodeJS.ProcessEnv }) {
  execSync(cmd, { stdio: 'inherit', cwd: opts?.cwd ?? ROOT, env: opts?.env ?? process.env });
}

function hasEnvSmoke(): boolean {
  return fs.existsSync(ENV_SMOKE);
}

function loadEnvSmoke(): Record<string, string> {
  if (!hasEnvSmoke()) {
    console.error('[smoke] .env.smoke not found. Copy from .env.smoke.example:');
    console.error('  cp .env.smoke.example .env.smoke');
    process.exit(1);
  }
  const content = fs.readFileSync(ENV_SMOKE, 'utf-8');
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        env[key] = val;
      }
    }
  }
  return env;
}

async function waitForHealth(baseUrl: string, timeoutMs: number = 120000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) {
        const data = await res.json();
        if (data?.status === 'ok' || data?.db !== undefined) return true;
      }
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  console.log('[smoke] Local smoke harness starting...\n');

  const env = loadEnvSmoke();
  env.SMOKE = 'true';
  env.CI = ''; // clear CI so Playwright starts webServer

  // 1. DB reset
  console.log('[smoke] 1. Resetting DB...');
  run('pnpm db:smoke:reset', { env });

  // 2. Build (required for pnpm start)
  console.log('[smoke] 2. Building...');
  run('pnpm build', { env });

  // 3. Start server in background
  console.log('[smoke] 3. Starting Next.js server...');
  const server = spawn('pnpm', ['start'], {
    cwd: ROOT,
    env: { ...env, PORT: env.PORT || '3000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverExited = false;
  server.on('exit', (code) => {
    serverExited = true;
    if (code !== 0 && code !== null) {
      console.error("[smoke] Server exited with code", code);
    }
  });

  const baseUrl = env.NEXTAUTH_URL || env.BASE_URL || 'http://localhost:3000';

  // 4. Wait for /api/health
  console.log('[smoke] 4. Waiting for /api/health...');
  const healthy = await waitForHealth(baseUrl);
  if (!healthy) {
    server.kill('SIGTERM');
    console.error('[smoke] Server did not become healthy in time');
    process.exit(1);
  }
  console.log('[smoke] Server ready.\n');

  // 5. Run Playwright
  const isA11y = process.argv.includes('--a11y');
  const playwrightCmd = isA11y
    ? 'pnpm exec playwright test tests/e2e/a11y-smoke.spec.ts --config=playwright.smoke.config.ts'
    : 'pnpm exec playwright test --config=playwright.smoke.config.ts';
  console.log(`[smoke] 5. Running Playwright ${isA11y ? 'a11y' : 'smoke'} tests...`);
  try {
    run(playwrightCmd, {
      env: {
        ...env,
        CI: 'true', // reuse server we started
        BASE_URL: baseUrl,
        SMOKE_REUSE_SERVER: 'true',
      },
    });
  } finally {
    // 6. Teardown
    console.log('[smoke] 6. Stopping server...');
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 2000));
    if (!serverExited) server.kill('SIGKILL');
  }

  console.log('\n[smoke] Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
