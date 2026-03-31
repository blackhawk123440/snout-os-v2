/**
 * Sitter Messages Protection E2E Test
 * 
 * Verifies that sitters are blocked from accessing /messages
 * and redirected to /sitter/inbox
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SITTER_EMAIL = process.env.SITTER_EMAIL || 'sitter@example.com';
const SITTER_PASSWORD = process.env.SITTER_PASSWORD || 'password';

async function loginAsSitter(page: any) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', SITTER_EMAIL);
  await page.fill('input[type="password"]', SITTER_PASSWORD);
  await page.click('button[type="submit"]');
  // Wait for redirect to sitter inbox or dashboard
  await page.waitForURL(/\/(sitter\/inbox|dashboard)/, { timeout: 10000 });
}

test.describe('Sitter Messages Protection', () => {
  test('Sitter attempting to access /messages is redirected to /sitter/inbox', async ({ page }) => {
    await loginAsSitter(page);
    
    // Navigate directly to /messages
    await page.goto(`${BASE_URL}/messages`);
    
    // Should be redirected to /sitter/inbox
    await expect(page).toHaveURL(/\/sitter\/inbox/);
  });

  test('Sitter attempting to call owner messaging API receives 403', async ({ page, request }) => {
    await loginAsSitter(page);
    
    // Get cookies from browser context
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    // Attempt to call owner messaging endpoint
    const response = await request.get(`${BASE_URL}/api/messages/threads`, {
      headers: {
        Cookie: cookieHeader,
      },
    });
    
    // Should receive 403 Forbidden
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('Sitters must use');
  });
});
