/**
 * Client Portal Visual Snapshots
 * Key client screens for visual regression.
 * Run: npx playwright test tests/e2e/client-snapshots.spec.ts --project=client-mobile --update-snapshots
 *
 * Requires client auth: add client to global-setup.ts and ensure e2e-login supports role: 'client'
 */

import { test, expect } from '@playwright/test';

test.describe('Client Portal Snapshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/client/home');
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('Home page', async ({ page }) => {
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Home').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('client-home.png', { maxDiffPixels: 1000 });
  });

  test('Bookings page', async ({ page }) => {
    await page.goto('/client/bookings');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Bookings').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('client-bookings.png', { maxDiffPixels: 1000 });
  });

  test('Pets page', async ({ page }) => {
    await page.goto('/client/pets');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Pets').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('client-pets.png', { maxDiffPixels: 1000 });
  });

  test('Messages page', async ({ page }) => {
    await page.goto('/client/messages');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Messages').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('client-messages.png', { maxDiffPixels: 1000 });
  });

  test('Profile page', async ({ page }) => {
    await page.goto('/client/profile');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Profile').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('client-profile.png', { maxDiffPixels: 1000 });
  });
});
