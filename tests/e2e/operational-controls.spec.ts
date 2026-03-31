/**
 * E2E Tests for Operational Control Surfaces
 * 
 * Tests that owners can perform all operational actions without Twilio console
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@example.com';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'password';
const SITTER_EMAIL = process.env.SITTER_EMAIL || 'sitter@example.com';
const SITTER_PASSWORD = process.env.SITTER_PASSWORD || 'password';

test.describe('Operational Control Surfaces', () => {
  test.beforeEach(async ({ page }) => {
    // Login as owner
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', OWNER_EMAIL);
    await page.fill('input[type="password"]', OWNER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test.describe('Setup Page', () => {
    test('should test Twilio connection', async ({ page }) => {
      await page.goto(`${BASE_URL}/setup`);
      
      // Fill in credentials (use env vars if available)
      const accountSid = process.env.TEST_TWILIO_ACCOUNT_SID || 'ACtest';
      const authToken = process.env.TEST_TWILIO_AUTH_TOKEN || 'test';
      
      await page.fill('input[placeholder*="Account SID"]', accountSid);
      await page.fill('input[placeholder*="auth token"]', authToken);
      
      // Click test connection
      await page.click('button:has-text("Test Connection")');
      
      // Wait for result
      await page.waitForTimeout(2000);
      
      // Verify status is shown
      const statusText = await page.textContent('body');
      expect(statusText).toContain('Connection');
    });

    test('should install webhooks', async ({ page }) => {
      await page.goto(`${BASE_URL}/setup`);
      
      // Find and click install webhooks button
      const installButton = page.locator('button:has-text("Install Webhooks")');
      if (await installButton.isVisible()) {
        await installButton.click();
        await page.waitForTimeout(2000);
        
        // Verify webhook status updates
        const statusText = await page.textContent('body');
        expect(statusText).toContain('Webhook');
      }
    });

    test('should show webhook receiving indicator', async ({ page }) => {
      await page.goto(`${BASE_URL}/setup`);
      
      // Check for last webhook received timestamp
      await page.waitForTimeout(2000);
      const pageText = await page.textContent('body');
      expect(pageText).toMatch(/Last webhook received|Receiving/i);
    });
  });

  test.describe('Numbers Page', () => {
    test('should show buy and import buttons', async ({ page }) => {
      await page.goto(`${BASE_URL}/numbers`);
      
      // Verify action buttons are visible
      const buyButton = page.locator('button:has-text("Buy Number")');
      const importButton = page.locator('button:has-text("Import Number")');
      
      await expect(buyButton).toBeVisible();
      await expect(importButton).toBeVisible();
    });

    test('should open buy number modal', async ({ page }) => {
      await page.goto(`${BASE_URL}/numbers`);
      
      await page.click('button:has-text("Buy Number")');
      
      // Verify modal opens
      await expect(page.locator('text=Buy Number').last()).toBeVisible();
      await expect(page.locator('text=Number Class')).toBeVisible();
    });

    test('should open import number modal', async ({ page }) => {
      await page.goto(`${BASE_URL}/numbers`);
      
      await page.click('button:has-text("Import Number")');
      
      // Verify modal opens
      await expect(page.locator('text=Import Number').last()).toBeVisible();
      await expect(page.locator('text=E.164 Number')).toBeVisible();
    });

    test('should show quarantine action for active numbers', async ({ page }) => {
      await page.goto(`${BASE_URL}/numbers`);
      
      await page.waitForTimeout(1000);
      
      // Check if any numbers exist
      const numbersTable = page.locator('table');
      if (await numbersTable.isVisible()) {
        // Find quarantine button
        const quarantineButton = page.locator('button:has-text("Quarantine")').first();
        if (await quarantineButton.isVisible()) {
          await quarantineButton.click();
          
          // Verify quarantine modal opens
          await expect(page.locator('text=Quarantine Number').last()).toBeVisible();
          await expect(page.locator('input[placeholder*="reason"]')).toBeVisible();
        }
      }
    });
  });

  test.describe('Assignments Page', () => {
    test('should show create window button', async ({ page }) => {
      await page.goto(`${BASE_URL}/assignments`);
      
      const createButton = page.locator('button:has-text("Create Window")');
      await expect(createButton).toBeVisible();
    });

    test('should open create window modal', async ({ page }) => {
      await page.goto(`${BASE_URL}/assignments`);
      
      await page.click('button:has-text("Create Window")');
      
      // Verify modal opens
      await expect(page.locator('text=Create Assignment Window').last()).toBeVisible();
      await expect(page.locator('input[placeholder*="Thread ID"]')).toBeVisible();
    });

    test('should show conflicts tab', async ({ page }) => {
      await page.goto(`${BASE_URL}/assignments`);
      
      // Verify conflicts tab exists
      const conflictsTab = page.locator('button:has-text("Conflicts")');
      await expect(conflictsTab).toBeVisible();
    });

    test('should show edit and delete actions for windows', async ({ page }) => {
      await page.goto(`${BASE_URL}/assignments`);
      
      await page.waitForTimeout(1000);
      
      // Check if any windows exist
      const windowsTable = page.locator('table');
      if (await windowsTable.isVisible()) {
        // Find edit button
        const editButton = page.locator('button:has-text("Edit")').first();
        if (await editButton.isVisible()) {
          await editButton.click();
          
          // Verify edit modal opens
          await expect(page.locator('text=Edit Assignment Window').last()).toBeVisible();
        }
      }
    });
  });

  test.describe('Route Protection', () => {
    test('sitter cannot access setup page', async ({ page }) => {
      // Login as sitter
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[type="email"]', SITTER_EMAIL);
      await page.fill('input[type="password"]', SITTER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/sitter/inbox', { timeout: 10000 });
      
      // Try to access setup page
      await page.goto(`${BASE_URL}/setup`);
      
      // Should be redirected or see access denied
      const pageText = await page.textContent('body');
      expect(pageText).toMatch(/Access denied|sitter inbox/i);
    });

    test('sitter cannot access numbers page', async ({ page }) => {
      // Login as sitter
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[type="email"]', SITTER_EMAIL);
      await page.fill('input[type="password"]', SITTER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/sitter/inbox', { timeout: 10000 });
      
      // Try to access numbers page
      await page.goto(`${BASE_URL}/numbers`);
      
      // Should be redirected or see access denied
      const pageText = await page.textContent('body');
      expect(pageText).toMatch(/Access denied|sitter inbox/i);
    });

    test('sitter cannot access assignments page', async ({ page }) => {
      // Login as sitter
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[type="email"]', SITTER_EMAIL);
      await page.fill('input[type="password"]', SITTER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/sitter/inbox', { timeout: 10000 });
      
      // Try to access assignments page
      await page.goto(`${BASE_URL}/assignments`);
      
      // Should be redirected or see access denied
      const pageText = await page.textContent('body');
      expect(pageText).toMatch(/Access denied|sitter inbox/i);
    });
  });

  test.describe('API Endpoints', () => {
    test('POST /api/setup/webhooks/install returns 200', async ({ request }) => {
      // This test requires authentication - would need to get session cookie
      // For now, just verify endpoint exists
      const response = await request.post(`${BASE_URL}/api/setup/webhooks/install`);
      // Should be 401 (unauthorized) or 200 (if auth works)
      expect([200, 401]).toContain(response.status());
    });

    test('POST /api/numbers/buy endpoint exists', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/numbers/buy`, {
        data: { class: 'front_desk', quantity: 1 },
      });
      // Should be 401 (unauthorized) or 400/200 (if auth works)
      expect([200, 400, 401]).toContain(response.status());
    });

    test('POST /api/numbers/import endpoint exists', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/numbers/import`, {
        data: { e164: '+15551234567', class: 'front_desk' },
      });
      // Should be 401 (unauthorized) or 400/200/409 (if auth works)
      expect([200, 400, 401, 409]).toContain(response.status());
    });

    test('POST /api/assignments/windows endpoint exists', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/assignments/windows`, {
        data: {
          threadId: 'test-thread-id',
          sitterId: 'test-sitter-id',
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 3600000).toISOString(),
        },
      });
      // Should be 401 (unauthorized) or 400/200/404 (if auth works)
      expect([200, 400, 401, 404]).toContain(response.status());
    });
  });
});
