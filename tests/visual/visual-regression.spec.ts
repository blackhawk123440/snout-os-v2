/**
 * UI Constitution V1 - Visual Regression Tests
 * 
 * Visual regression harness for routes at specified breakpoints:
 * - /dashboard
 * - /bookings
 * - /calendar
 * - /clients
 * - /sitters
 * - /automations
 * 
 * Breakpoints: 390px, 768px, 1280px
 */

import { test, expect } from '@playwright/test';

const routes = [
  '/dashboard',
  '/bookings',
  '/calendar',
  '/clients',
  '/sitters',
  '/automations',
];

const breakpoints = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
];

routes.forEach(route => {
  breakpoints.forEach(breakpoint => {
    test(`${route} - ${breakpoint.name} (${breakpoint.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      
      // Navigate to route
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      
      // Wait for page to be fully loaded (with timeout)
      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      } catch {
        // If networkidle never happens, just wait for load
        await page.waitForLoadState('load', { timeout: 5000 });
      }
      
      // Wait a bit for any animations/transitions
      await page.waitForTimeout(500);
      
      // Take screenshot
      await expect(page).toHaveScreenshot(`${route.replace('/', '')}-${breakpoint.name}-${breakpoint.width}px.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });
});
