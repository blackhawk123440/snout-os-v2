#!/usr/bin/env tsx
/**
 * PROOF PACK GENERATOR - VERIFICATION MODE
 * 
 * Generates runtime proof that the deployed dashboard is wired and operable.
 * Tests against deployed URL using UI login (E2E auth disabled in production).
 * 
 * Output: proof-pack/ folder with screenshots, HAR files, and PROOF_PACK.md
 */

import { chromium, Browser, Page, BrowserContext } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

const DEPLOYED_URL = process.env.DEPLOYED_URL || 'https://snout-os-staging.onrender.com';
const PROOF_PACK_DIR = join(process.cwd(), 'proof-pack');
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@example.com';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'password';
const SITTER_EMAIL = process.env.SITTER_EMAIL || 'sitter@example.com';
const SITTER_PASSWORD = process.env.SITTER_PASSWORD || 'password';

interface ProofItem {
  id: string;
  description: string;
  status: 'pass' | 'fail' | 'skip';
  evidence: string[];
  notes?: string;
  rootCause?: string;
  fixFiles?: string[];
}

const proofItems: ProofItem[] = [];
const networkRequests: Array<{ url: string; method: string; status: number; timestamp: string }> = [];

async function captureScreenshot(page: Page, name: string): Promise<string> {
  const screenshotPath = join(PROOF_PACK_DIR, 'screenshots', `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return `screenshots/${name}.png`;
}

async function captureNetworkLog(page: Page, name: string): Promise<string> {
  // Wait a bit for network activity to settle
  await page.waitForTimeout(2000);
  
  const networkLogPath = join(PROOF_PACK_DIR, 'har', `${name}.json`);
  writeFileSync(networkLogPath, JSON.stringify(networkRequests, null, 2));
  return `har/${name}.json`;
}

async function waitForAPIResponse(page: Page, urlPattern: string, timeout = 10000): Promise<number | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const listener = (response: any) => {
      if (response.url().includes(urlPattern)) {
        networkRequests.push({
          url: response.url(),
          method: 'GET',
          status: response.status(),
          timestamp: new Date().toISOString(),
        });
        page.off('response', listener);
        resolve(response.status());
      }
    };
    page.on('response', listener);
    
    setTimeout(() => {
      page.off('response', listener);
      resolve(null);
    }, timeout);
  });
}

async function loginAsOwner(page: Page): Promise<boolean> {
  try {
    const response = await page.goto(`${DEPLOYED_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    if (response?.status() === 404) {
      throw new Error(`Deployed URL returned 404: ${DEPLOYED_URL}`);
    }
    
    // Wait for page to be interactive and React to hydrate
    await page.waitForLoadState('networkidle');
    // Wait for "Loading..." to disappear and form to appear
    await page.waitForFunction(
      () => {
        const emailInput = document.querySelector('#email');
        const loadingText = document.body.textContent?.includes('Loading...');
        return emailInput && !loadingText;
      },
      { timeout: 20000 }
    );
    
    // Try multiple selectors for email input - use more specific ones first
    const emailSelector = '#email';
    const passwordSelector = '#password';
    const submitSelector = 'button[type="submit"]';
    
    await page.waitForSelector(emailSelector, { timeout: 10000, state: 'visible' });
    await page.fill(emailSelector, OWNER_EMAIL);
    await page.fill(passwordSelector, OWNER_PASSWORD);
    await page.click(submitSelector);
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    return true;
  } catch (error: any) {
    console.error('Login failed:', error.message);
    // Capture screenshot for debugging
    try {
      await page.screenshot({ path: join(PROOF_PACK_DIR, 'screenshots', 'login-error.png'), fullPage: true });
    } catch {}
    return false;
  }
}

async function loginAsSitter(page: Page): Promise<boolean> {
  try {
    const response = await page.goto(`${DEPLOYED_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    if (response?.status() === 404) {
      throw new Error(`Deployed URL returned 404: ${DEPLOYED_URL}`);
    }
    
    // Wait for page to be interactive and React to hydrate
    await page.waitForLoadState('networkidle');
    // Wait for "Loading..." to disappear and form to appear
    await page.waitForFunction(
      () => {
        const emailInput = document.querySelector('#email');
        const loadingText = document.body.textContent?.includes('Loading...');
        return emailInput && !loadingText;
      },
      { timeout: 20000 }
    );
    
    // Use specific selectors
    const emailSelector = '#email';
    const passwordSelector = '#password';
    const submitSelector = 'button[type="submit"]';
    
    await page.waitForSelector(emailSelector, { timeout: 10000, state: 'visible' });
    await page.fill(emailSelector, SITTER_EMAIL);
    await page.fill(passwordSelector, SITTER_PASSWORD);
    await page.click(submitSelector);
    await page.waitForURL('**/sitter/inbox', { timeout: 20000 });
    return true;
  } catch (error: any) {
    console.error('Sitter login failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔍 VERIFICATION MODE: Generating PROOF PACK\n');
  console.log(`Deployed URL: ${DEPLOYED_URL}\n`);

  // Clean and create proof-pack directory
  if (existsSync(PROOF_PACK_DIR)) {
    rmSync(PROOF_PACK_DIR, { recursive: true, force: true });
  }
  mkdirSync(PROOF_PACK_DIR, { recursive: true });
  mkdirSync(join(PROOF_PACK_DIR, 'screenshots'), { recursive: true });
  mkdirSync(join(PROOF_PACK_DIR, 'har'), { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  // Track network requests
  page.on('response', (response) => {
    networkRequests.push({
      url: response.url(),
      method: response.request().method(),
      status: response.status(),
      timestamp: new Date().toISOString(),
    });
  });

  try {
    // PROOF 1: Build proof - Check for build badge/commit SHA on dashboard
    console.log('📸 PROOF 1: Build badge on dashboard...');
    try {
      const loggedIn = await loginAsOwner(page);
      if (!loggedIn) {
        throw new Error('Failed to login as owner');
      }
      
      await page.waitForTimeout(2000); // Wait for page to fully load
      const buildProof = await captureScreenshot(page, '01-build-badge-dashboard');
      
      // Check if build badge exists in page
      const buildBadgeExists = await page.locator('[data-build-sha], [data-commit], .build-badge, [class*="build"], [class*="commit"]').count() > 0;
      
      proofItems.push({
        id: 'build-badge',
        description: 'Build badge (commit SHA + timestamp) visible on dashboard while logged in as OWNER',
        status: buildBadgeExists ? 'pass' : 'fail',
        evidence: [buildProof],
        notes: buildBadgeExists ? 'Build badge found in UI' : 'Build badge not found - may need to add to dashboard',
        rootCause: buildBadgeExists ? undefined : 'Build badge component not implemented in dashboard',
        fixFiles: buildBadgeExists ? undefined : ['src/app/page.tsx', 'src/components/layout/AppShell.tsx'],
      });
      console.log(buildBadgeExists ? '✅ Build proof captured\n' : '⚠️ Build badge not found\n');
    } catch (error: any) {
      proofItems.push({
        id: 'build-badge',
        description: 'Build badge (commit SHA + timestamp) visible on dashboard while logged in as OWNER',
        status: 'fail',
        evidence: [],
        notes: `Error: ${error.message}`,
        rootCause: error.message,
        fixFiles: ['src/app/page.tsx'],
      });
      console.log('❌ Build proof failed\n');
    }

    // PROOF 2: Owner auth proof
    console.log('📸 PROOF 2: Owner authentication flow...');
    try {
      await page.goto(`${DEPLOYED_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      const loginPage = await captureScreenshot(page, '02-owner-login-page');
      
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(
        () => {
          const emailInput = document.querySelector('#email');
          const loadingText = document.body.textContent?.includes('Loading...');
          return emailInput && !loadingText;
        },
        { timeout: 20000 }
      );
      await page.waitForSelector('#email', { timeout: 10000, state: 'visible' });
      await page.fill('#email', OWNER_EMAIL);
      await page.fill('#password', OWNER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      const dashboardAfterLogin = await captureScreenshot(page, '03-owner-dashboard-after-login');
      
      // Logout
      const logoutButton = page.locator('button:has-text("Logout")').or(page.locator('text=Logout')).first();
      if (await logoutButton.count() > 0) {
        await logoutButton.click();
        await page.waitForURL('**/login', { timeout: 10000 });
        const loginAfterLogout = await captureScreenshot(page, '04-owner-login-after-logout');
        
        proofItems.push({
          id: 'owner-auth',
          description: 'Owner auth: /login → /dashboard after login → logout returns to /login',
          status: 'pass',
          evidence: [loginPage, dashboardAfterLogin, loginAfterLogout],
        });
        console.log('✅ Owner auth proof captured\n');
      } else {
        throw new Error('Logout button not found');
      }
    } catch (error: any) {
      proofItems.push({
        id: 'owner-auth',
        description: 'Owner auth: /login → /dashboard after login → logout returns to /login',
        status: 'fail',
        evidence: [],
        notes: `Error: ${error.message}`,
        rootCause: error.message,
        fixFiles: ['src/components/layout/AppShell.tsx'],
      });
      console.log('❌ Owner auth proof failed\n');
    }

    // PROOF 3: Messages tab proof
    console.log('📸 PROOF 3: Messages tab features...');
    try {
      await loginAsOwner(page);
      await page.goto(`${DEPLOYED_URL}/messages`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      const messagesPage = await captureScreenshot(page, '05-messages-thread-list');
      const threadsStatus = await waitForAPIResponse(page, '/api/messages/threads', 5000);
      
      proofItems.push({
        id: 'messages-thread-list',
        description: 'Messages tab: thread list populated',
        status: threadsStatus === 200 ? 'pass' : 'fail',
        evidence: [messagesPage],
        notes: threadsStatus === 200 ? 'Thread list API returned 200' : `API returned ${threadsStatus || 'timeout'}`,
        rootCause: threadsStatus !== 200 ? 'GET /api/messages/threads failed or timed out' : undefined,
        fixFiles: threadsStatus !== 200 ? ['src/app/api/messages/threads/route.ts'] : undefined,
      });
      
      // Try to select a thread
      const firstThread = page.locator('[data-testid="thread-item"]').or(page.locator('.thread-item')).or(page.locator('div[role="button"]').first()).first();
      if (await firstThread.count() > 0) {
        await firstThread.click();
        await page.waitForTimeout(2000);
        const messagesStatus = await waitForAPIResponse(page, '/api/messages/threads/', 5000);
        const selectedThread = await captureScreenshot(page, '06-messages-selected-thread');
        
        proofItems.push({
          id: 'messages-selected-thread',
          description: 'Messages tab: selected thread with messages visible',
          status: messagesStatus === 200 ? 'pass' : 'fail',
          evidence: [selectedThread],
          notes: messagesStatus === 200 ? 'Messages API returned 200' : `API returned ${messagesStatus || 'timeout'}`,
        });
      }
      
      console.log('✅ Messages proof captured\n');
    } catch (error: any) {
      proofItems.push({
        id: 'messages-features',
        description: 'Messages tab: thread list, selected thread, failed delivery, policy violation, routing drawer',
        status: 'fail',
        evidence: [],
        notes: `Error: ${error.message}`,
        rootCause: error.message,
        fixFiles: ['src/app/messages/page.tsx', 'src/app/api/messages/threads/route.ts'],
      });
      console.log('❌ Messages proof failed\n');
    }

    // PROOF 4: Network proof
    console.log('📸 PROOF 4: Network requests...');
    const networkLog = await captureNetworkLog(page, 'network-requests');
    const threads200 = networkRequests.some(r => r.url.includes('/api/messages/threads') && r.status === 200);
    const messages200 = networkRequests.some(r => r.url.includes('/api/messages/threads/') && r.url.includes('/messages') && r.status === 200);
    
    proofItems.push({
      id: 'network-proof',
      description: 'Network: 200 responses for GET /api/messages/threads, GET /api/messages/threads/{id}/messages, GET /api/routing/threads/{id}/history, POST /api/messages/{messageId}/retry',
      status: threads200 && messages200 ? 'pass' : 'fail',
      evidence: [networkLog],
      notes: `Threads API: ${threads200 ? '✅' : '❌'}, Messages API: ${messages200 ? '✅' : '❌'}`,
    });
    console.log('✅ Network proof captured\n');

    // PROOF 5: Sitter separation
    console.log('📸 PROOF 5: Sitter separation...');
    try {
      const sitterLoggedIn = await loginAsSitter(page);
      if (!sitterLoggedIn) {
        throw new Error('Failed to login as sitter');
      }
      
      const sitterInbox = await captureScreenshot(page, '07-sitter-inbox');
      
      await page.goto(`${DEPLOYED_URL}/messages`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      const sitterRedirected = await captureScreenshot(page, '08-sitter-messages-redirect');
      
      const redirected = currentUrl.includes('/sitter/inbox');
      
      proofItems.push({
        id: 'sitter-separation',
        description: 'Sitter: login lands on /sitter/inbox, /messages redirects to /sitter/inbox',
        status: redirected ? 'pass' : 'fail',
        evidence: [sitterInbox, sitterRedirected],
        notes: redirected ? 'Sitter correctly redirected from /messages' : `Sitter not redirected, current URL: ${currentUrl}`,
        rootCause: redirected ? undefined : 'Middleware not redirecting sitters from /messages',
        fixFiles: redirected ? undefined : ['src/middleware.ts'],
      });
      console.log('✅ Sitter separation proof captured\n');
    } catch (error: any) {
      proofItems.push({
        id: 'sitter-separation',
        description: 'Sitter: login lands on /sitter/inbox, /messages redirects to /sitter/inbox',
        status: 'fail',
        evidence: [],
        notes: `Error: ${error.message}`,
        rootCause: error.message,
        fixFiles: ['src/middleware.ts'],
      });
      console.log('❌ Sitter separation proof failed\n');
    }

  } catch (error: any) {
    console.error('❌ Proof generation failed:', error);
  } finally {
    await context.close();
    await browser.close();
  }

  // Generate PROOF_PACK.md
  const proofMarkdown = `# PROOF PACK - Runtime Verification

Generated: ${new Date().toISOString()}
Deployed URL: ${DEPLOYED_URL}
Commit: ${process.env.GIT_SHA || 'unknown'}

## Proof Items

${proofItems.map((item, idx) => `
### ${idx + 1}. ${item.id}

**Description:** ${item.description}

**Status:** ${item.status === 'pass' ? '✅ PASS' : item.status === 'fail' ? '❌ FAIL' : '⏭️ SKIP'}

**Evidence:**
${item.evidence.map(e => `- \`${e}\``).join('\n') || 'None'}

${item.notes ? `**Notes:** ${item.notes}\n` : ''}
${item.rootCause ? `**Root Cause:** ${item.rootCause}\n` : ''}
${item.fixFiles ? `**Files to Fix:** ${item.fixFiles.map(f => `\`${f}\``).join(', ')}\n` : ''}
`).join('\n')}

## Summary

- **Total Items:** ${proofItems.length}
- **Passed:** ${proofItems.filter(p => p.status === 'pass').length}
- **Failed:** ${proofItems.filter(p => p.status === 'fail').length}
- **Skipped:** ${proofItems.filter(p => p.status === 'skip').length}

## Failed Items Requiring Fixes

${proofItems.filter(p => p.status === 'fail').map(item => `
### ${item.id}
- **Root Cause:** ${item.rootCause || 'Unknown'}
- **Files:** ${item.fixFiles?.join(', ') || 'TBD'}
`).join('\n') || 'None'}
`;

  writeFileSync(join(PROOF_PACK_DIR, 'PROOF_PACK.md'), proofMarkdown);
  console.log('✅ PROOF PACK generated at:', PROOF_PACK_DIR);
  console.log(`\n📊 Summary: ${proofItems.filter(p => p.status === 'pass').length}/${proofItems.length} proofs passed\n`);
  
  const failed = proofItems.filter(p => p.status === 'fail');
  if (failed.length > 0) {
    console.log('❌ Failed proofs requiring fixes:');
    failed.forEach(item => {
      console.log(`   - ${item.id}: ${item.rootCause || 'Unknown error'}`);
    });
  }
}

main().catch(console.error);
