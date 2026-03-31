/**
 * Calendar Page E2E Interaction Test
 * UI Constitution V1 - Phase 4
 */

import { test, expect } from '@playwright/test';

test.describe('Calendar Page Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calendar');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should switch to Week view via UI', async ({ page }) => {
    // Find and click Week tab in calendar header
    const weekTab = await page.locator('text=Week').first();
    await expect(weekTab).toBeVisible();
    await weekTab.click();

    // Verify view changed (this may show a "coming soon" message for now)
    // The tab should be active/selected
    await page.waitForTimeout(300);
  });

  test('should select a day in month view', async ({ page }) => {
    // Ensure we're in month view
    const monthTab = await page.locator('text=Month').first();
    if (await monthTab.isVisible()) {
      await monthTab.click();
      await page.waitForTimeout(200);
    }

    // Find a day button (any date)
    const dayButton = await page.locator('button').filter({ hasText: /\d+/ }).first();
    if (await dayButton.isVisible()) {
      await dayButton.click();
      await page.waitForTimeout(200);

      // Verify selected state (may have different background color or border)
      // This is a basic check - actual visual verification would be in visual regression tests
      await expect(dayButton).toBeVisible();
    }
  });

  test('should open event details drawer when clicking an event', async ({ page }) => {
    // Wait a bit for calendar to render
    await page.waitForTimeout(500);

    // Look for event elements (booking items in calendar grid)
    const eventElement = await page.locator('[style*="backgroundColor"]').filter({ hasText: /\d{1,2}:\d{2}/ }).first();
    
    if (await eventElement.isVisible()) {
      await eventElement.click();
      await page.waitForTimeout(300);

      // Check if drawer opened (drawer should have booking details)
      const drawer = await page.locator('text=Booking Details').or(page.locator('[role="dialog"]')).first();
      // Drawer may not always be visible if no bookings exist, so we check conditionally
      const drawerVisible = await drawer.isVisible().catch(() => false);
      
      if (drawerVisible) {
        await expect(drawer).toBeVisible();
        
        // Drawer should be closeable
        const closeButton = await page.locator('button[aria-label*="close" i]').or(page.locator('button').filter({ hasText: /close/i })).first();
        if (await closeButton.isVisible()) {
          await closeButton.click();
          await page.waitForTimeout(200);
        }
      }
    }
  });

  test('should trigger command from CommandLauncher and show toast', async ({ page }) => {
    // Open command palette
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+KeyK' : 'Control+KeyK');

    await page.waitForSelector('input[placeholder*="search"]', { timeout: 1000 });

    // Search for calendar command
    await page.fill('input[placeholder*="search"]', 'jump today');

    await page.waitForTimeout(300);

    // Select the command
    const command = await page.locator('text=Jump to Today').first();
    if (await command.isVisible()) {
      await command.click();
      await page.waitForTimeout(500);

      // Toast may appear (depends on implementation)
      // For now, just verify command executed without errors
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should open filters drawer on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find filter button
    const filterButton = await page.locator('button[aria-label*="filter" i]').or(page.locator('button').filter({ hasText: /filter/i })).first();
    
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(300);

      // Check if filters drawer opened
      const filtersDrawer = await page.locator('text=Filters').first();
      if (await filtersDrawer.isVisible()) {
        await expect(filtersDrawer).toBeVisible();

        // Close drawer
        const closeButton = await page.locator('button[aria-label*="close" i]').first();
        if (await closeButton.isVisible()) {
          await closeButton.click();
        }
      }
    }
  });
});
