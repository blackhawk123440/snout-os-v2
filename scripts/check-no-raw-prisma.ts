#!/usr/bin/env tsx
/**
 * CI guard: fail if high-risk API routes (messaging, bookings, uploads, payments, ops)
 * import raw prisma. Use getScopedDb(ctx) instead for tenant-scoped access.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const APP_API = join(process.cwd(), 'src', 'app', 'api');
const HIGH_RISK_PREFIXES = ['messages', 'bookings', 'upload', 'payments', 'ops', 'client/billing', 'webhooks/stripe'];
const EXCLUDED_PREFIXES = [
  'messages/debug',
  'messages/process-srs',
  'messages/seed-proof',
  'messages/seed-srs-proof',
  'messages/webhook',
  'ops/messaging-debug',
  'ops/e2e-login',
  'ops/runtime-proof',
  'ops/srs/run-snapshot',
  'ops/srs/run-weekly-eval',
  'ops/command-center/seed-fixtures',  // E2E fixture seeding — bulk raw ops
  'ops/command-center/reset-fixtures', // E2E fixture reset — bulk raw deletes
  'ops/onboarding',                    // Mixed: getScopedDb + raw prisma for non-tenant models (Org, ProviderCredential)
  'ops/schema-check',                  // Uses $queryRaw for schema inspection
];

function isHighRiskPath(filePath: string): boolean {
  const rel = filePath.replace(APP_API + '/', '').replace(process.cwd() + '/', '');
  if (EXCLUDED_PREFIXES.some((p) => rel.startsWith(p))) return false;
  return HIGH_RISK_PREFIXES.some((p) => rel.startsWith(p));
}

function findRouteFiles(dir: string, acc: string[] = []): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__') continue;
      findRouteFiles(full, acc);
    } else if (e.name === 'route.ts' || e.name === 'route.js') {
      acc.push(full);
    }
  }
  return acc;
}

function hasRawPrismaImport(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8');
  return /from\s+['"]@\/lib\/db['"]/.test(content) || /from\s+["']@\/lib\/db["']/.test(content);
}

const routeFiles = findRouteFiles(APP_API);
const highRiskFiles = routeFiles.filter(isHighRiskPath);
const violations = highRiskFiles.filter(hasRawPrismaImport);

if (violations.length > 0) {
  console.error('Tenancy guard: these high-risk API routes must use getScopedDb(ctx) instead of raw prisma:');
  violations.forEach((f) => console.error('  -', f.replace(process.cwd() + '/', '')));
  process.exit(1);
}

console.log('Tenancy guard: no raw prisma imports in high-risk API routes');
process.exit(0);
