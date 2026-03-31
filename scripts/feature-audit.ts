#!/usr/bin/env tsx
/**
 * Feature Completion Gate — Audit script
 *
 * Scans repo for:
 * - Route files exist under src/app/.../page.tsx
 * - API routes exist under src/app/api/.../route.ts
 * - Required tests exist (snapshot names in playwright)
 *
 * Run: pnpm feature:audit
 * CI: must pass for "implemented" to be measurable
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  FEATURE_MATRIX,
  routeToPagePath,
  apiToRoutePath,
} from '../src/lib/feature-matrix';

const ROOT = path.resolve(__dirname, '..');

interface AuditResult {
  slug: string;
  portal: string;
  routeChecks: { route: string; path: string; exists: boolean }[];
  apiChecks: { api: string; path: string; exists: boolean }[];
  testChecks: { type: string; name?: string; exists: boolean }[];
  passed: boolean;
  errors: string[];
}

function fileExists(relPath: string): boolean {
  const fullPath = path.join(ROOT, relPath);
  return fs.existsSync(fullPath);
}

/** Check if a route has a matching page (supports [param] segments) */
function routeHasPage(route: string): boolean {
  const pagePath = routeToPagePath(route);
  return fileExists(pagePath);
}

/** Check if API has a matching route file (supports [param] segments) */
function apiHasRoute(api: string): boolean {
  const routePath = apiToRoutePath(api);
  return fileExists(routePath);
}

/** Check if snapshot test exists (by name substring in owner/sitter/client specs) */
function snapshotTestExists(snapshotName: string): boolean {
  const specs = [
    'tests/e2e/owner-snapshots.spec.ts',
    'tests/e2e/sitter-snapshots.spec.ts',
    'tests/e2e/client-snapshots.spec.ts',
  ];
  for (const spec of specs) {
    const content = fs.readFileSync(path.join(ROOT, spec), 'utf-8');
    // Match 'owner-command-center' or 'owner-command-center.png'
    if (content.includes(snapshotName)) return true;
  }
  return false;
}

function auditFeature(entry: (typeof FEATURE_MATRIX)[0]): AuditResult {
  const errors: string[] = [];
  const routeChecks = entry.routes.map((route) => {
    const pagePath = routeToPagePath(route);
    const exists = fileExists(pagePath);
    if (!exists) errors.push(`Missing route: ${pagePath}`);
    return { route, path: pagePath, exists };
  });
  const apiChecks = entry.apis.map((api) => {
    const routePath = apiToRoutePath(api);
    const exists = fileExists(routePath);
    if (!exists) errors.push(`Missing API: ${routePath}`);
    return { api, path: routePath, exists };
  });
  const testChecks: { type: string; name?: string; exists: boolean }[] = [];
  if (entry.tests.snapshot) {
    const exists = snapshotTestExists(entry.tests.snapshot);
    if (!exists) errors.push(`Missing snapshot: ${entry.tests.snapshot}`);
    testChecks.push({ type: 'snapshot', name: entry.tests.snapshot, exists });
  }
  const passed = errors.length === 0;
  return {
    slug: entry.slug,
    portal: entry.portal,
    routeChecks,
    apiChecks,
    testChecks,
    passed,
    errors,
  };
}

function main() {
  console.log('Feature Completion Gate — Audit\n');
  const results = FEATURE_MATRIX.map(auditFeature);
  const failed = results.filter((r) => !r.passed);
  const passed = results.filter((r) => r.passed);

  // Skip coming_soon features from hard failure (they're allowed to be incomplete)
  const requiredFailed = results.filter(
    (r) => !r.passed && r.status !== 'coming_soon'
  );

  for (const r of results) {
    const icon = r.passed ? '✓' : '✗';
    const status = r.passed ? 'PASS' : 'FAIL';
    console.log(`${icon} [${status}] ${r.slug}`);
    if (!r.passed && r.errors.length > 0) {
      r.errors.forEach((e) => console.log(`    ${e}`));
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Passed: ${passed.length}`);
  console.log(`Failed: ${failed.length}`);

  if (requiredFailed.length > 0) {
    console.log('\nRequired features missing:');
    requiredFailed.forEach((r) => console.log(`  - ${r.slug}: ${r.errors.join('; ')}`));
    process.exit(1);
  }

  console.log('\nFeature audit passed.');
  process.exit(0);
}

main();
