/**
 * Tests that the feature matrix does not overstate completeness.
 *
 * Verifies:
 * - Every route listed as 'live' has a real page file (not just a redirect)
 * - No redirect-only pages are claimed as features
 * - The placeholder component is deleted
 * - No route references non-existent pages
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { FEATURE_MATRIX } from '../feature-matrix';

const APP_DIR = path.join(process.cwd(), 'src/app');

function pageFileExists(route: string): boolean {
  // Convert route to file path: /bookings/[id] → src/app/bookings/[id]/page.tsx
  const segments = route.replace(/^\//, '').split('/');
  const filePath = path.join(APP_DIR, ...segments, 'page.tsx');
  return fs.existsSync(filePath);
}

function isRedirectOnly(route: string): boolean {
  const segments = route.replace(/^\//, '').split('/');
  const filePath = path.join(APP_DIR, ...segments, 'page.tsx');
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf-8');
  // A redirect-only page imports redirect and calls it as its only action
  return content.includes("redirect(") && !content.includes('return (') && !content.includes('useState');
}

describe('feature matrix truthfulness', () => {
  it('every live feature route has a real page file', () => {
    const liveFeatures = FEATURE_MATRIX.filter(f => f.status === 'live');
    const missing: string[] = [];

    for (const feature of liveFeatures) {
      for (const route of feature.routes) {
        if (!pageFileExists(route)) {
          missing.push(`${feature.slug}: ${route}`);
        }
      }
    }

    if (missing.length > 0) {
      console.error('Missing page files for live features:', missing);
    }
    expect(missing).toEqual([]);
  });

  it('no live feature route is a redirect-only page', () => {
    const liveFeatures = FEATURE_MATRIX.filter(f => f.status === 'live');
    const redirects: string[] = [];

    for (const feature of liveFeatures) {
      for (const route of feature.routes) {
        if (isRedirectOnly(route)) {
          redirects.push(`${feature.slug}: ${route} is redirect-only`);
        }
      }
    }

    if (redirects.length > 0) {
      console.error('Redirect-only pages claimed as live features:', redirects);
    }
    expect(redirects).toEqual([]);
  });

  it('OwnerModulePlaceholderPage component does not exist', () => {
    const placeholderPath = path.join(
      process.cwd(),
      'src/components/owner/OwnerModulePlaceholderPage.tsx'
    );
    expect(fs.existsSync(placeholderPath)).toBe(false);
  });

  it('no feature uses phantom routes (/dispatch, /messages, /automation-center)', () => {
    const phantomRoutes = ['/dispatch', '/messages', '/automation-center', '/pricing'];
    const liveFeatures = FEATURE_MATRIX.filter(f => f.status === 'live');

    for (const feature of liveFeatures) {
      for (const route of feature.routes) {
        expect(phantomRoutes).not.toContain(route);
      }
    }
  });

  it('feature matrix header warns about redirect shells', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/feature-matrix.ts'),
      'utf-8'
    );
    expect(source).toContain('Redirect-only routes');
    expect(source).toContain('should NOT be listed as features');
  });

  it('all redirect pages target real destinations', () => {
    // Verify each redirect target is a real page or tab on a real page
    const knownRealPages = [
      '/money', '/dashboard', '/bookings', '/clients', '/sitters',
      '/messaging', '/settings', '/client/home',
    ];

    const redirectFiles = [
      'payments', 'finance', 'reports', 'analytics', 'payroll',
      'growth', 'calendar', 'schedule-grid', 'command-center',
      'waitlist', 'integrations', 'templates', 'bundles',
      'review-settings', 'digest-settings',
    ];

    for (const name of redirectFiles) {
      const filePath = path.join(APP_DIR, name, 'page.tsx');
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      const match = content.match(/redirect\(['"]([^'"?]+)/);
      if (match) {
        const target = match[1];
        const targetExists = knownRealPages.some(p => target.startsWith(p));
        expect(targetExists).toBe(true);
      }
    }
  });
});
