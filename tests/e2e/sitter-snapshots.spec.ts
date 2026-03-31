/**
 * Sitter Dashboard Visual Snapshots
 * Key sitter screens for visual regression.
 * Run: npx playwright test tests/e2e/sitter-snapshots.spec.ts --update-snapshots
 */

import { test, expect } from '@playwright/test';

test.describe('Sitter Snapshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sitter/today');
    // Wait for auth redirect or content
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('Today page', async ({ page }) => {
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Today').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('today.png', { maxDiffPixels: 1000 });
  });

  test('Inbox page', async ({ page }) => {
    await page.goto('/sitter/inbox');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Inbox').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('inbox.png', { maxDiffPixels: 1000 });
  });

  test('Earnings page', async ({ page }) => {
    await page.goto('/sitter/earnings');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Earnings').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('earnings.png', { maxDiffPixels: 1000 });
  });

  test('Calendar page', async ({ page }) => {
    await page.goto('/sitter/calendar');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Calendar').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('calendar.png', { maxDiffPixels: 1000 });
  });
});
