/**
 * Accessibility Smoke Tests
 * Wave 3 - Automated axe-core checks on core pages per role.
 * Fails on serious/critical violations. Uses existing E2E auth.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const OWNER_PAGES = [
  '/command-center',
  '/ops/ai',
  '/ops/payouts',
  '/ops/finance/reconciliation',
  '/ops/calendar-repair',
  '/finance',
];

const SITTER_PAGES = [
  '/sitter/today',
  '/sitter/profile',
  '/sitter/earnings',
];

const CLIENT_PAGES = [
  '/client/home',
  '/client/messages',
  '/client/reports',
  '/client/billing',
];

function runAxeAndAssert(page: import('@playwright/test').Page, url: string) {
  return test.step(`Run axe on ${url}`, async () => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['region']) // Often too strict for dynamic layouts
      .analyze();

    const serious = results.violations.filter((v) => v.impact === 'serious');
    const critical = results.violations.filter((v) => v.impact === 'critical');
    const allSevere = [...critical, ...serious];

    if (allSevere.length > 0) {
      const report = allSevere
        .map(
          (v) =>
            `[${v.impact}] ${v.id}: ${v.help}\n` +
            `  ${v.description}\n` +
            `  Nodes: ${v.nodes.map((n) => n.html).join('; ').slice(0, 200)}...`
        )
        .join('\n\n');
      throw new Error(`A11y violations on ${url}:\n\n${report}`);
    }

    expect(allSevere.length).toBe(0);
  });
}

test.describe('A11y Smoke - Owner', () => {
  test.use({ storageState: 'tests/.auth/owner.json' });

  for (const path of OWNER_PAGES) {
    test(`owner ${path} has no serious/critical violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await runAxeAndAssert(page, path);
    });
  }
});

test.describe('A11y Smoke - Sitter', () => {
  test.use({ storageState: 'tests/.auth/sitter.json' });

  for (const path of SITTER_PAGES) {
    test(`sitter ${path} has no serious/critical violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await runAxeAndAssert(page, path);
    });
  }
});

test.describe('A11y Smoke - Client', () => {
  test.use({ storageState: 'tests/.auth/client.json' });

  for (const path of CLIENT_PAGES) {
    test(`client ${path} has no serious/critical violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await runAxeAndAssert(page, path);
    });
  }
});
