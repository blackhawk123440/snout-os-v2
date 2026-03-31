/**
 * Staging Authentication E2E Test
 * 
 * Verifies login flow and session persistence on staging.
 * Run with: npx playwright test tests/e2e/staging-auth.spec.ts
 */

import { test, expect } from '@playwright/test';

// Set these in CI or .env
const STAGING_WEB_URL = process.env.STAGING_WEB_URL || 'https://snout-os-web.onrender.com';
const STAGING_API_URL = process.env.STAGING_API_URL || 'https://snout-os-api.onrender.com';
const TEST_EMAIL = process.env.TEST_EMAIL || 'owner@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password';

// Skip if STAGING_WEB_URL is not set (env-gated)
const shouldSkip = !process.env.STAGING_WEB_URL;

test.describe.skip(shouldSkip, 'Staging Authentication', () => {
  test('should login and establish session', async ({ page }) => {
    // Step 1: Check auth health
    const healthResponse = await page.request.get(`${STAGING_WEB_URL}/api/auth/health`);
    expect(healthResponse.ok()).toBeTruthy();
    
    const healthData = await healthResponse.json();
    expect(healthData.env.NEXTAUTH_SECRET_PRESENT).toBe(true);
    expect(healthData.env.NEXTAUTH_SECRET_VALID).toBe(true);
    expect(healthData.env.NEXT_PUBLIC_API_URL).toBe(STAGING_API_URL);

    // Step 2: Navigate to login
    await page.goto(`${STAGING_WEB_URL}/login`);
    await expect(page.locator('h2')).toContainText('Sign in');

    // Step 3: Fill and submit login form
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Step 4: Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');

    // Step 5: Verify session exists
    const sessionResponse = await page.request.get(`${STAGING_WEB_URL}/api/auth/session`);
    expect(sessionResponse.ok()).toBeTruthy();
    
    const sessionData = await sessionResponse.json();
    expect(sessionData.user).toBeTruthy();
    expect(sessionData.user.email).toBe(TEST_EMAIL);

    // Step 6: Refresh and verify still logged in
    await page.reload();
    await page.waitForURL('**/dashboard', { timeout: 5000 });
    expect(page.url()).toContain('/dashboard');

    // Step 7: Check cookies
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => 
      c.name === '__Secure-next-auth.session-token' || 
      c.name === 'next-auth.session-token'
    );
    expect(sessionCookie).toBeTruthy();
  });

  test('should load messages page and fetch threads', async ({ page }) => {
    // Login first
    await page.goto(`${STAGING_WEB_URL}/login`);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to messages
    await page.goto(`${STAGING_WEB_URL}/messages`);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if diagnostics panel is visible (owner-only)
    const diagnosticsPanel = page.locator('text=Auth Debug Panel').or(page.locator('text=Ops / Diagnostics'));
    const hasDiagnostics = await diagnosticsPanel.count() > 0;

    if (hasDiagnostics) {
      // Verify API base URL is correct
      const apiBaseUrlText = await page.textContent('body');
      expect(apiBaseUrlText).toContain(STAGING_API_URL);
    }

    // Verify threads API endpoint is accessible
    // First, get the session cookie
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => 
      c.name === '__Secure-next-auth.session-token' || 
      c.name === 'next-auth.session-token'
    );

    if (sessionCookie) {
      // Try to fetch threads directly
      const threadsResponse = await page.request.get(`${STAGING_API_URL}/api/messages/threads`, {
        headers: {
          'Cookie': `${sessionCookie.name}=${sessionCookie.value}`,
        },
      });

      // Should not be 401 (unauthorized) or 404 (not found)
      expect([401, 404]).not.toContain(threadsResponse.status());
      
      if (threadsResponse.ok()) {
        const threadsData = await threadsResponse.json();
        expect(Array.isArray(threadsData)).toBe(true);
      }
    }

    // Verify page loaded without errors
    const errorMessages = await page.locator('text=/error|Error|401|404|500/i').count();
    expect(errorMessages).toBe(0);
  });

  test('should verify API connectivity from web service', async ({ page }) => {
    // Login
    await page.goto(`${STAGING_WEB_URL}/login`);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Check that web service can reach API service
    const apiHealthResponse = await page.request.get(`${STAGING_API_URL}/api/health`);
    expect(apiHealthResponse.ok()).toBeTruthy();

    // Verify messaging endpoints exist
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => 
      c.name === '__Secure-next-auth.session-token' || 
      c.name === 'next-auth.session-token'
    );

    if (sessionCookie) {
      const threadsResponse = await page.request.get(`${STAGING_API_URL}/api/messages/threads`, {
        headers: {
          'Cookie': `${sessionCookie.name}=${sessionCookie.value}`,
        },
      });

      // Should not be 404 (route doesn't exist)
      expect(threadsResponse.status()).not.toBe(404);
      
      // If 401, that's an auth issue but route exists
      // If 200, great - API is working
      expect([200, 401]).toContain(threadsResponse.status());
    }
  });
});
