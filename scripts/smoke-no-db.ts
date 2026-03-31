#!/usr/bin/env tsx
/**
 * No-DB smoke checks for CI/dev environments without Docker.
 * Verifies page shells and auth boundaries against an already-running server.
 */

import { chromium, request } from 'playwright';

const BASE_URL = process.env.BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

async function ensureServerReachable() {
  const rc = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
  try {
    const res = await rc.get('/api/health');
    if (!res.ok()) {
      throw new Error(`/api/health returned ${res.status()}`);
    }
    const body = await res.json().catch(() => ({}));
    console.log('[smoke:no-db] health', JSON.stringify({
      status: body?.status,
      commitSha: body?.commitSha ?? null,
      envName: body?.envName ?? null,
    }));
  } finally {
    await rc.dispose();
  }
}

async function runShellAndBoundaryChecks() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const checks: Array<{ path: string; expected: string }> = [
    { path: '/login', expected: 'public' },
    { path: '/command-center', expected: 'auth-boundary' },
    { path: '/bookings', expected: 'auth-boundary' },
    { path: '/finance', expected: 'auth-boundary' },
    { path: '/payments', expected: 'auth-boundary' },
  ];

  for (const check of checks) {
    const response = await page.goto(check.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const url = page.url();
    const status = response?.status() ?? 0;

    if (check.expected === 'public') {
      if (status >= 400) {
        throw new Error(`[smoke:no-db] ${check.path} failed with status ${status}`);
      }
    } else {
      const redirectedToLogin = url.includes('/login');
      const blockedStatus = status === 401 || status === 403 || status === 404;
      if (!redirectedToLogin && !blockedStatus) {
        throw new Error(
          `[smoke:no-db] ${check.path} did not enforce auth boundary (status=${status}, url=${url})`
        );
      }
    }

    console.log('[smoke:no-db] page', JSON.stringify({ path: check.path, status, url }));
  }

  await context.close();
  await browser.close();
}

async function main() {
  console.log(`[smoke:no-db] Running against ${BASE_URL}`);
  await ensureServerReachable();
  await runShellAndBoundaryChecks();
  console.log('[smoke:no-db] PASS');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[smoke:no-db] FAIL:', message);
  process.exit(1);
});

