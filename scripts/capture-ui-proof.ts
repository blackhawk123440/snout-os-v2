import { chromium } from '@playwright/test';
import path from 'path';
import { mkdir } from 'fs/promises';

const SCREENSHOTS_DIR = '/Users/leahhudson/Desktop/final form/snout-os/artifacts/ui-proof';
const BASE_URL = 'http://localhost:3000';

const PAGES = [
  { filename: 'owner-dashboard.png', url: '/dashboard', role: 'owner' },
  { filename: 'owner-bookings.png', url: '/bookings', role: 'owner' },
  { filename: 'owner-calendar.png', url: '/calendar', role: 'owner' },
  { filename: 'owner-automations.png', url: '/automations', role: 'owner' },
  { filename: 'client-bookings-new.png', url: '/client/bookings/new', role: 'client' },
  { filename: 'sitter-today.png', url: '/sitter/today', role: 'sitter' },
];

const CREDENTIALS = {
  owner: { email: 'owner@example.com', password: 'e2e-test-password' },
  client: { email: 'client@example.com', password: 'e2e-test-password' },
  sitter: { email: 'sitter@example.com', password: 'e2e-test-password' },
};

async function login(page: any, role: 'owner' | 'client' | 'sitter') {
  const creds = CREDENTIALS[role];
  
  // Navigate to login page
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  
  // Fill in credentials
  await page.fill('input#email', creds.email);
  await page.fill('input#password', creds.password);
  
  // Submit
  await page.click('button[type="submit"]');
  
  // Wait for redirect
  await page.waitForTimeout(3000);
}

async function captureScreenshot(filename: string, url: string, role: 'owner' | 'client' | 'sitter') {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  
  let status = 'SUCCESS';
  let actualUrl = url;
  
  try {
    // Login
    await login(page, role);
    
    // Navigate to target page
    await page.goto(`${BASE_URL}${url}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Extra time for any animations
    
    actualUrl = page.url();
    
    // Check if we got redirected or blocked
    if (actualUrl.includes('/auth/signin') || actualUrl.includes('/unauthorized')) {
      status = 'UNVERIFIED - Access Denied';
    }
    
    // Take screenshot
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    
    console.log(`✓ ${filename}: ${status}`);
    console.log(`  URL: ${actualUrl}`);
    console.log(`  File: ${filepath}`);
    
  } catch (error) {
    status = 'UNVERIFIED - Error';
    console.error(`✗ ${filename}: ${status}`);
    console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // Still save screenshot of error state
    try {
      const filepath = path.join(SCREENSHOTS_DIR, filename);
      await page.screenshot({ path: filepath, fullPage: false });
      console.log(`  File: ${filepath} (error state)`);
    } catch (e) {
      console.error(`  Failed to save screenshot: ${e}`);
    }
  } finally {
    await browser.close();
  }
  
  return { filename, url, actualUrl, status };
}

async function main() {
  // Create directory
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  
  console.log('Starting UI proof capture...\n');
  console.log(`Screenshots will be saved to: ${SCREENSHOTS_DIR}\n`);
  
  const results = [];
  
  for (const page of PAGES) {
    const result = await captureScreenshot(page.filename, page.url, page.role);
    results.push(result);
    console.log('');
  }
  
  console.log('\n=== SUMMARY ===');
  for (const result of results) {
    console.log(`${result.filename}: ${result.status}`);
    console.log(`  Requested: ${result.url}`);
    console.log(`  Actual: ${result.actualUrl}`);
  }
  
  console.log(`\nAll screenshots saved to: ${SCREENSHOTS_DIR}`);
}

main().catch(console.error);
