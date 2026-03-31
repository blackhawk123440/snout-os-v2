/**
 * Owner Portal Visual Snapshots
 * Key owner screens for visual regression.
 * Run: pnpm playwright test tests/e2e/owner-snapshots.spec.ts --project=owner-desktop --update-snapshots
 *
 * Uses frozen time (UTC) and stable fixtures to avoid flake.
 * Requires owner auth: global-setup.ts creates owner.json
 */

import { test, expect } from '@playwright/test';

// Freeze Date to avoid "Starts in 5 min" / "Today" flake
const FROZEN_DATE = '2025-02-28T12:00:00.000Z';
test.beforeEach(async ({ page }) => {
  await page.addInitScript((iso: string) => {
    const frozen = new Date(iso).getTime();
    const OriginalDate = globalThis.Date;
    (globalThis as any).Date = class extends OriginalDate {
      static now() {
        return frozen;
      }
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(iso);
        } else {
          super(...args);
        }
      }
    };
  }, FROZEN_DATE);
});

test.use({
  timezoneId: 'UTC',
  locale: 'en-US',
});

test.describe('Owner Portal Snapshots', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for stable counts/rows (stub data)
    await page.route('**/api/ops/metrics**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          activeVisitsCount: 3,
          openBookingsCount: 12,
          revenueYTD: 24580,
          retentionRate: 92,
          timestamp: FROZEN_DATE,
        }),
      });
    });
    await page.route('**/api/bookings**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bookings: [
            { id: '1', firstName: 'Jane', lastName: 'Doe', status: 'confirmed', startAt: FROZEN_DATE, totalPrice: 85 },
            { id: '2', firstName: 'Bob', lastName: 'Smith', status: 'pending', startAt: FROZEN_DATE, totalPrice: 120 },
          ],
        }),
      });
    });
    await page.route('**/api/clients**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clients: [
            { id: '1', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '555-0100' },
            { id: '2', firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com', phone: '555-0101', petCount: 1, totalBookings: 3 },
          ],
        }),
      });
    });
    await page.route('**/api/sitters**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sitters: [
            { id: '1', firstName: 'Sarah', lastName: 'M.', email: 'sarah@example.com', phone: '555-0200', isActive: true, commissionPercentage: 80, createdAt: FROZEN_DATE, currentTier: { id: 't1', name: 'Lead', priorityLevel: 3 } },
            { id: '2', firstName: 'Alex', lastName: 'K.', email: 'alex@example.com', phone: '555-0201', isActive: true, commissionPercentage: 75, createdAt: FROZEN_DATE, currentTier: { id: 't2', name: 'Standard', priorityLevel: 2 } },
          ],
        }),
      });
    });
    await page.route('**/api/sitter-tiers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tiers: [{ id: 't1', name: 'Lead' }, { id: 't2', name: 'Standard' }] }),
      });
    });
    await page.route('**/api/settings**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            settings: { businessName: 'Snout Services', businessPhone: '', businessEmail: '', automation: {} },
          }),
        });
      } else {
        await route.fallback();
      }
    });
    await page.route('**/api/integrations/test/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ working: false, status: 'not_configured', message: 'Not configured' }),
      });
    });
    // Navigate to command center (canonical owner home)
    await page.goto('/command-center');
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('Command Center', async ({ page }) => {
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Command Center').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('owner-command-center.png', { maxDiffPixels: 1000 });
  });

  test('Bookings', async ({ page }) => {
    await page.goto('/bookings');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Bookings').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('owner-bookings.png', { maxDiffPixels: 1500 });
  });

  test('Calendar', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Calendar').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('owner-calendar.png', { maxDiffPixels: 1500 });
  });

  test('Dispatch', async ({ page }) => {
    await page.goto('/dispatch');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Dispatch').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('owner-dispatch.png', { maxDiffPixels: 1000 });
  });

  test('Sitters', async ({ page }) => {
    await page.goto('/bookings/sitters');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Sitters').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('owner-sitters.png', { maxDiffPixels: 1500 });
  });

  test('Clients', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Clients').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('owner-clients.png', { maxDiffPixels: 1500 });
  });

  test('Finance', async ({ page }) => {
    await page.goto('/finance');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Finance').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('owner-finance.png', { maxDiffPixels: 1000 });
  });

  test('Analytics', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Analytics').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('owner-analytics.png', { maxDiffPixels: 1000 });
  });

  test('Messages', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Messages').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('owner-messages.png', { maxDiffPixels: 1500 });
  });

  test('Automations', async ({ page }) => {
    await page.goto('/automation');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Automations').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('owner-automations.png', { maxDiffPixels: 1500 });
  });

  test('Integrations', async ({ page }) => {
    await page.goto('/integrations');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Integrations').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('owner-integrations.png', { maxDiffPixels: 1500 });
  });

  test('Settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('/login')) test.skip();
    await page.locator('text=Settings').first().waitFor({ timeout: 10000 }).catch(() => {});
    await expect(page).toHaveScreenshot('owner-settings.png', { maxDiffPixels: 1500 });
  });
});
