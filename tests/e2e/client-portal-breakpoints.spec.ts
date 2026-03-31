/**
 * Client portal breakpoint consistency: sidebar at >=1024px, bottom nav at <1024px.
 * Viewport 1280x800: sidebar visible, bottom nav hidden.
 * Viewport 390x844: bottom nav visible, sidebar hidden.
 */
import { test, expect } from '@playwright/test';

test.describe('Client portal breakpoints', () => {
  test('desktop 1280x800: sidebar visible, bottom nav hidden', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/client/home');
    await page.waitForLoadState('networkidle').catch(() => {});

    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    const sidebar = page.locator('aside[aria-label="Client portal navigation"]');
    await expect(sidebar).toBeVisible();

    const bottomNav = page.locator('nav.fixed.bottom-0');
    await expect(bottomNav).toBeHidden();
  });

  test('mobile 390x844: bottom nav visible, sidebar hidden', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/client/home');
    await page.waitForLoadState('networkidle').catch(() => {});

    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    const sidebar = page.locator('aside[aria-label="Client portal navigation"]');
    await expect(sidebar).toBeHidden();

    const bottomNav = page.locator('nav.fixed.bottom-0');
    await expect(bottomNav).toBeVisible();
  });
});
