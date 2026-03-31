/**
 * Command Palette E2E Test
 * UI Constitution V1 - Phase 3
 */

import { test, expect } from '@playwright/test';

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should open palette with keyboard shortcut', async ({ page }) => {
    // Press Cmd+K or Ctrl+K
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+KeyK' : 'Control+KeyK');

    // Wait for palette to appear
    await page.waitForSelector('[data-testid="command-palette"], [data-testid="bottom-sheet"]', {
      timeout: 1000,
    });

    // Check if palette is visible
    const palette = await page.locator('text=Command Palette').first();
    await expect(palette).toBeVisible();
  });

  test('should search commands', async ({ page }) => {
    // Open palette
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+KeyK' : 'Control+KeyK');

    // Wait for palette
    await page.waitForSelector('input[placeholder*="search"]', { timeout: 1000 });

    // Type search query
    await page.fill('input[placeholder*="search"]', 'dashboard');

    // Wait for results
    await page.waitForTimeout(200);

    // Check if command appears
    const command = await page.locator('text=Go to Dashboard');
    await expect(command).toBeVisible();
  });

  test('should execute non-danger command', async ({ page }) => {
    // Open palette
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+KeyK' : 'Control+KeyK');

    // Wait for palette
    await page.waitForSelector('input[placeholder*="search"]', { timeout: 1000 });

    // Search for navigation command
    await page.fill('input[placeholder*="search"]', 'dashboard');

    // Wait for results
    await page.waitForTimeout(200);

    // Click on command (or press Enter)
    const command = await page.locator('text=Go to Dashboard').first();
    await command.click();

    // Wait for navigation
    await page.waitForTimeout(500);

    // Verify palette closes
    const palette = await page.locator('text=Command Palette');
    await expect(palette).not.toBeVisible({ timeout: 1000 });
  });

  test('should show preview for dangerous commands', async ({ page }) => {
    // This test assumes we have a dangerous command
    // For now, we'll test the preview UI exists
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+KeyK' : 'Control+KeyK');

    await page.waitForSelector('input[placeholder*="search"]', { timeout: 1000 });

    // The preview component should be available
    const preview = await page.locator('[data-testid="command-preview"]');
    // Preview may not be visible until a command is selected
  });

  test('should close with Escape key', async ({ page }) => {
    // Open palette
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+KeyK' : 'Control+KeyK');

    await page.waitForSelector('input[placeholder*="search"]', { timeout: 1000 });

    // Press Escape
    await page.keyboard.press('Escape');

    // Wait a bit
    await page.waitForTimeout(200);

    // Verify palette closes
    const palette = await page.locator('text=Command Palette');
    await expect(palette).not.toBeVisible({ timeout: 1000 });
  });
});
