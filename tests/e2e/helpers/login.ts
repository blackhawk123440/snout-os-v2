/**
 * Deterministic Login Helper
 * 
 * Uses E2E authentication route to establish sessions for tests.
 * Tests should prefer using storageState projects, but these helpers
 * can be used for tests that need to login dynamically.
 */

import { Page, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@example.com';
const SITTER_EMAIL = process.env.SITTER_EMAIL || 'sitter@example.com';
const E2E_AUTH_KEY = process.env.E2E_AUTH_KEY || 'test-e2e-key-change-in-production';

/**
 * Login as owner using E2E auth route
 * 
 * @param page - Playwright page instance
 * @returns Promise that resolves when session is confirmed
 */
export async function loginAsOwner(page: Page): Promise<void> {
  // Use E2E auth route to get session cookie
  const response = await page.request.post(`${BASE_URL}/api/ops/e2e-login`, {
    data: {
      role: 'owner',
      email: OWNER_EMAIL,
    },
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-key': E2E_AUTH_KEY,
    },
  });

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`E2E login failed: ${response.status()} - ${errorText}`);
  }

  // Verify session exists
  await expect.poll(
    async () => {
      const sessionResponse = await page.request.get(`${BASE_URL}/api/auth/session`);
      if (!sessionResponse.ok()) return false;
      const session = await sessionResponse.json();
      return session?.user?.email === OWNER_EMAIL;
    },
    { timeout: 10000, intervals: [500, 1000] }
  ).toBeTruthy();

  // Navigate to dashboard
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });
}

/**
 * Login as sitter using E2E auth route
 * 
 * @param page - Playwright page instance
 * @returns Promise that resolves when session is confirmed
 */
export async function loginAsSitter(page: Page): Promise<void> {
  // Use E2E auth route to get session cookie
  const response = await page.request.post(`${BASE_URL}/api/ops/e2e-login`, {
    data: {
      role: 'sitter',
      email: SITTER_EMAIL,
    },
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-key': E2E_AUTH_KEY,
    },
  });

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`E2E login failed: ${response.status()} - ${errorText}`);
  }

  // Verify session exists
  await expect.poll(
    async () => {
      const sessionResponse = await page.request.get(`${BASE_URL}/api/auth/session`);
      if (!sessionResponse.ok()) return false;
      const session = await sessionResponse.json();
      return session?.user?.email === SITTER_EMAIL;
    },
    { timeout: 10000, intervals: [500, 1000] }
  ).toBeTruthy();

  // Navigate to sitter inbox
  await page.goto(`${BASE_URL}/sitter/inbox`, { waitUntil: 'domcontentloaded', timeout: 15000 });
}
