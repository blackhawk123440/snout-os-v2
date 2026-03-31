#!/usr/bin/env tsx
/**
 * Reset smoke DB: down -v, up, wait for ready, db push, seed
 * Loads .env.smoke for DATABASE_URL
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const ENV_SMOKE = path.join(ROOT, '.env.smoke');

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function loadEnv(): Record<string, string> {
  if (!fs.existsSync(ENV_SMOKE)) {
    console.error('.env.smoke not found. Copy from .env.smoke.example');
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

function run(cmd: string, env: Record<string, string>) {
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, env });
}

function checkDocker() {
  try {
    execSync('docker info', { stdio: 'pipe', cwd: ROOT });
  } catch {
    console.error('[db:smoke:reset] Docker is not running. Start Docker Desktop and try again.');
    process.exit(1);
  }
}

async function main() {
  const env = loadEnv();
  checkDocker();

  console.log('[db:smoke:reset] Down -v...');
  run('docker compose -f docker-compose.smoke.yml down -v', env);

  console.log('[db:smoke:reset] Up...');
  run('docker compose -f docker-compose.smoke.yml up -d', env);

  console.log('[db:smoke:reset] Waiting for Postgres...');
  for (let i = 0; i < 30; i++) {
    try {
      execSync('docker compose -f docker-compose.smoke.yml exec -T postgres pg_isready -U postgres', {
        stdio: 'pipe',
        cwd: ROOT,
      });
      break;
    } catch {
      if (i === 29) {
        console.error('Postgres did not become ready');
        process.exit(1);
      }
      await sleep(1000);
    }
  }

  console.log('[db:smoke:reset] Prisma db push...');
  run('pnpm prisma db push --accept-data-loss', env);

  console.log('[db:smoke:reset] Prisma seed...');
  run('pnpm prisma db seed', { ...env, NODE_ENV: 'development' });

  console.log('[db:smoke:reset] Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
