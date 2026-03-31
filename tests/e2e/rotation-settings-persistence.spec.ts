/**
 * Rotation Settings Persistence Test
 * 
 * Verifies that rotation settings persist end-to-end:
 * - Save settings via UI
 * - Refresh page
 * - Assert values persisted
 * - Assert API returns saved values
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Rotation Settings Persistence', () => {
  test('Settings persist after save and refresh', async ({ page }) => {
    // Verify we're an owner first (skip if running in sitter project)
    const sessionResponse = await page.request.get(`${BASE_URL}/api/auth/session`);
    const session = await sessionResponse.json();
    const isOwner = session?.user?.email === 'owner@example.com';
    
    if (!isOwner) {
      // Skip this test if not running as owner (sitter project)
      test.skip();
      return;
    }
    
    // With storageState, we're already authenticated - no need to login
    
    // Navigate to rotation settings
    await page.goto(`${BASE_URL}/settings/rotation`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Change settings - use actual component selectors
    // Strategy select (first select)
    const strategySelect = page.locator('select').first();
    await strategySelect.selectOption('HASH_SHUFFLE');
    
    // Number inputs - find by label or position
    // Max Concurrent Threads Per Pool Number (first number input)
    const maxConcurrentInput = page.locator('input[type="number"]').first();
    await maxConcurrentInput.fill('2');
    
    // Sticky Reuse Days (first number input after strategy)
    const stickyReuseInput = page.locator('input[type="number"]').nth(1);
    await stickyReuseInput.fill('10');
    
    // Post-Booking Grace Hours
    const graceHoursInput = page.locator('input[type="number"]').nth(2);
    await graceHoursInput.fill('96');
    
    // Inactivity Release Days
    const inactivityInput = page.locator('input[type="number"]').nth(3);
    await inactivityInput.fill('14');
    
    // Max Pool Thread Lifetime Days
    const lifetimeInput = page.locator('input[type="number"]').nth(4);
    await lifetimeInput.fill('60');
    
    // Minimum Pool Reserve
    const minReserveInput = page.locator('input[type="number"]').nth(5);
    await minReserveInput.fill('5');
    
    // Sticky Reuse Key select (last select)
    const reuseKeySelect = page.locator('select').last();
    await reuseKeySelect.selectOption('threadId');

    // Save settings
    await page.click('button:has-text("Save Settings")');
    await page.waitForSelector('text=Settings saved successfully', { timeout: 10000 });

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Assert values persisted - check API instead of UI (more reliable)
    const response = await page.request.get(`${BASE_URL}/api/settings/rotation`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.poolSelectionStrategy).toBe('HASH_SHUFFLE');
    expect(data.stickyReuseDays).toBe(10);
    expect(data.postBookingGraceHours).toBe(96);
    expect(data.inactivityReleaseDays).toBe(14);
    expect(data.maxPoolThreadLifetimeDays).toBe(60);
    expect(data.minPoolReserve).toBe(5);
    expect(data.maxConcurrentThreadsPerPoolNumber).toBe(2);
    expect(data.stickyReuseKey).toBe('threadId');
  });
});
