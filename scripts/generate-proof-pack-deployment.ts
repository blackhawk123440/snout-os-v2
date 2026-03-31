#!/usr/bin/env tsx
/**
 * Deployment Proof Pack Generator
 * 
 * Generates proof that the canonical architecture is deployed correctly.
 */

import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';

const WEB_PUBLIC_URL = process.env.WEB_PUBLIC_URL || 'https://snout-os-staging.onrender.com';
let API_PUBLIC_URL = process.env.API_PUBLIC_URL || '';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@example.com';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'password123';

const PROOF_PACK_DIR = join(process.cwd(), 'proof-pack');
const SCREENSHOTS_DIR = join(PROOF_PACK_DIR, 'screenshots');

// Try to infer API_PUBLIC_URL from WEB_PUBLIC_URL if not set
if (!API_PUBLIC_URL) {
  if (WEB_PUBLIC_URL.includes('snout-os-staging')) {
    API_PUBLIC_URL = WEB_PUBLIC_URL.replace('snout-os-staging', 'snout-os-api');
    console.log(`⚠️  API_PUBLIC_URL not set, inferring: ${API_PUBLIC_URL}`);
  } else if (WEB_PUBLIC_URL.includes('snout-os-web')) {
    API_PUBLIC_URL = WEB_PUBLIC_URL.replace('snout-os-web', 'snout-os-api');
    console.log(`⚠️  API_PUBLIC_URL not set, inferring: ${API_PUBLIC_URL}`);
  } else {
    console.error('❌ API_PUBLIC_URL is required');
    console.error('Usage: API_PUBLIC_URL=https://snout-os-api.onrender.com WEB_PUBLIC_URL=https://snout-os-staging.onrender.com pnpm proof:deployment');
    console.error('\nOr set API_PUBLIC_URL environment variable.');
    process.exit(1);
  }
}

async function curlCommand(url: string, method: string = 'GET', headers: Record<string, string> = {}): Promise<string> {
  const headerArgs = Object.entries(headers).map(([k, v]) => `-H "${k}: ${v}"`).join(' ');
  const methodArg = method !== 'GET' ? `-X ${method}` : '';
  return `curl -i ${methodArg} ${headerArgs} "${url}"`;
}

async function fetchWithCurl(url: string, method: string = 'GET', headers: Record<string, string> = {}): Promise<{ status: number; headers: Headers; body: string }> {
  try {
    const response = await fetch(url, { method, headers });
    const body = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      body,
    };
  } catch (error: any) {
    return {
      status: 0,
      headers: new Headers(),
      body: error.message,
    };
  }
}

async function loginAsOwner(page: Page): Promise<boolean> {
  try {
    await page.goto(`${WEB_PUBLIC_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const emailInput = document.querySelector('#email');
      const passwordInput = document.querySelector('#password');
      const submitButton = document.querySelector('button[type="submit"]');
      return emailInput && passwordInput && submitButton;
    }, { timeout: 30000 });

    await page.fill('#email', OWNER_EMAIL);
    await page.fill('#password', OWNER_PASSWORD);
    
    // Wait for navigation after clicking submit
    const navigationPromise = page.waitForURL((url) => {
      return url.pathname === '/dashboard' || url.pathname === '/sitter/inbox';
    }, { timeout: 30000 }).catch(() => null);
    
    await page.click('button[type="submit"]');
    
    // Wait for either navigation or session to be established
    await Promise.race([
      navigationPromise,
      page.waitForFunction(() => {
        return (window as any).__lastSignInResult !== undefined;
      }, { timeout: 10000 }).catch(() => null),
    ]);

    // Check session with retries
    let sessionEstablished = false;
    for (let i = 0; i < 10; i++) {
      const sessionResponse = await page.request.get(`${WEB_PUBLIC_URL}/api/auth/session`);
      if (sessionResponse.ok()) {
        const sessionData = await sessionResponse.json();
        if (sessionData?.user?.email === OWNER_EMAIL) {
          sessionEstablished = true;
          break;
        }
      }
      await page.waitForTimeout(500);
    }

    // If session is established but not navigated, wait a bit more or navigate manually
    if (sessionEstablished) {
      const currentUrl = page.url();
      if (!currentUrl.includes('/dashboard') && !currentUrl.includes('/sitter/inbox')) {
        // Wait a bit more for navigation
        await page.waitForTimeout(2000);
        // If still not navigated, try navigating manually
        if (!page.url().includes('/dashboard') && !page.url().includes('/sitter/inbox')) {
          await page.goto(`${WEB_PUBLIC_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
        }
      }
      return true;
    }

    return false;
  } catch (error: any) {
    console.error(`Login failed: ${error.message}`);
    return false;
  }
}

async function getAPIToken(page: Page, orgId?: string): Promise<string | null> {
  try {
    // Get session from Next.js
    const sessionResponse = await page.request.get(`${WEB_PUBLIC_URL}/api/auth/session`);
    if (!sessionResponse.ok()) return null;
    const session = await sessionResponse.json();
    if (!session?.user) return null;

    // Generate JWT token for NestJS API (requires JWT_SECRET env var)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.warn('⚠️  JWT_SECRET not set - cannot generate API token for direct API calls');
      return null;
    }

    try {
      const jose = await import('jose');
      const secret = new TextEncoder().encode(jwtSecret);
      const payload = {
        sub: session.user.id,
        orgId: orgId || session.user.orgId || '',
        email: session.user.email || '',
        role: session.user.sitterId ? 'sitter' : 'owner',
      };
      const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);
      return token;
    } catch (error) {
      console.error('Failed to generate API token:', error);
      return null;
    }
  } catch {
    return null;
  }
}

async function main() {
  console.log('🔍 Generating Deployment Proof Pack\n');
  console.log(`Web: ${WEB_PUBLIC_URL}`);
  console.log(`API: ${API_PUBLIC_URL}\n`);

  // Clean and create directories
  if (existsSync(PROOF_PACK_DIR)) {
    rmSync(PROOF_PACK_DIR, { recursive: true, force: true });
  }
  mkdirSync(PROOF_PACK_DIR, { recursive: true });
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  // PROOF 1: API Health Check
  console.log('📸 PROOF 1: API Health Check...');
  const healthResponse = await fetchWithCurl(`${API_PUBLIC_URL}/health`);
  const healthCurl = await curlCommand(`${API_PUBLIC_URL}/health`);
  const healthOutput = `${healthCurl}\n\nStatus: ${healthResponse.status}\n\n${healthResponse.body}`;
  writeFileSync(join(PROOF_PACK_DIR, 'curl-health.txt'), healthOutput);
  
  if (healthResponse.status === 200) {
    console.log('✅ API health: 200');
  } else {
    console.log(`❌ API health: ${healthResponse.status}`);
  }

  // PROOF 2: CORS Verification
  console.log('📸 PROOF 2: CORS Verification...');
  const corsResponse = await fetch(`${API_PUBLIC_URL}/api/messages/threads`, {
    method: 'OPTIONS',
    headers: {
      'Origin': WEB_PUBLIC_URL,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Authorization',
    },
  });
  const corsHeaders: Record<string, string> = {};
  corsResponse.headers.forEach((value, key) => {
    corsHeaders[key] = value;
  });
  const corsCurl = `curl -H "Origin: ${WEB_PUBLIC_URL}" \\
  -H "Access-Control-Request-Method: GET" \\
  -H "Access-Control-Request-Headers: Authorization" \\
  -X OPTIONS \\
  ${API_PUBLIC_URL}/api/messages/threads`;
  const corsOutput = `${corsCurl}\n\nStatus: ${corsResponse.status}\n\nHeaders:\n${JSON.stringify(corsHeaders, null, 2)}`;
  writeFileSync(join(PROOF_PACK_DIR, 'curl-cors.txt'), corsOutput);
  
  const corsAllowed = corsHeaders['access-control-allow-origin'] === WEB_PUBLIC_URL || 
                      corsHeaders['access-control-allow-origin'] === '*';
  if (corsAllowed) {
    console.log(`✅ CORS: ${corsHeaders['access-control-allow-origin']}`);
  } else {
    console.log(`❌ CORS: ${corsHeaders['access-control-allow-origin'] || 'missing'}`);
  }

  // PROOF 3: Web Shadow Route Check
  console.log('📸 PROOF 2: Web Shadow Route Check...');
  const shadowResponse = await fetchWithCurl(`${WEB_PUBLIC_URL}/api/messages/threads`, 'HEAD');
  const shadowCurl = await curlCommand(`${WEB_PUBLIC_URL}/api/messages/threads`, 'HEAD');
  const shadowOutput = `${shadowCurl}\n\nStatus: ${shadowResponse.status}\n\n${shadowResponse.body.substring(0, 500)}`;
  writeFileSync(join(PROOF_PACK_DIR, 'curl-web-shadow.txt'), shadowOutput);
  
  const shadowValid = shadowResponse.status === 404 || shadowResponse.status === 503 || shadowResponse.status === 401 || shadowResponse.status === 403;
  if (shadowValid) {
    console.log(`✅ Web shadow route: ${shadowResponse.status} (acceptable)`);
  } else {
    console.log(`❌ Web shadow route: ${shadowResponse.status} (should be 404/503/401/403)`);
  }

  // PROOF 4: Browser Network Tab (HAR)
  console.log('📸 PROOF 4: Browser Network Tab (HAR)...');
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let networkHar: any = null;

  try {
    browser = await chromium.launch();
    context = await browser.newContext({
      baseURL: WEB_PUBLIC_URL,
      recordHar: { path: join(PROOF_PACK_DIR, 'network.har'), mode: 'minimal' },
    });
    page = await context.newPage();

    const loggedIn = await loginAsOwner(page);
    if (loggedIn) {
      await page.goto(`${WEB_PUBLIC_URL}/messages`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      // Save HAR
      await context.close();
      if (existsSync(join(PROOF_PACK_DIR, 'network.har'))) {
        const harContent = readFileSync(join(PROOF_PACK_DIR, 'network.har'), 'utf-8');
        networkHar = JSON.parse(harContent);
        
        // Extract API hostname (without protocol)
        const apiHost = new URL(API_PUBLIC_URL).hostname;
        const webHost = new URL(WEB_PUBLIC_URL).hostname;
        
        // Check for API_PUBLIC_URL requests (host must be API, not WEB)
        const apiRequests = networkHar.log?.entries?.filter((entry: any) => {
          const url = entry.request?.url || '';
          try {
            const urlObj = new URL(url);
            return urlObj.hostname === apiHost && urlObj.pathname.startsWith('/api/');
          } catch {
            return false;
          }
        }) || [];

        // Check for WEB shadow requests (should NOT exist)
        const webShadowRequests = networkHar.log?.entries?.filter((entry: any) => {
          const url = entry.request?.url || '';
          try {
            const urlObj = new URL(url);
            return urlObj.hostname === webHost && urlObj.pathname.startsWith('/api/messages/');
          } catch {
            return false;
          }
        }) || [];

        const networkAnalysis = `Network HAR Analysis\n\n` +
          `API Host: ${apiHost}\n` +
          `Web Host: ${webHost}\n\n` +
          `API Requests (to ${apiHost}): ${apiRequests.length}\n` +
          `Web Shadow Requests (to ${webHost}/api/*): ${webShadowRequests.length}\n\n` +
          `API Request URLs:\n${apiRequests.slice(0, 5).map((e: any) => e.request?.url).join('\n')}\n\n` +
          `Web Shadow Request URLs:\n${webShadowRequests.slice(0, 5).map((e: any) => e.request?.url).join('\n')}\n`;

        writeFileSync(join(PROOF_PACK_DIR, 'network-analysis.txt'), networkAnalysis);

        if (apiRequests.length > 0 && webShadowRequests.length === 0) {
          console.log(`✅ Network HAR: ${apiRequests.length} API requests found, 0 shadow requests`);
        } else if (webShadowRequests.length > 0) {
          console.log(`❌ Network HAR: ${webShadowRequests.length} shadow requests found (should be 0)`);
        } else {
          console.log('❌ Network HAR: No API requests found');
        }
      }
    } else {
      console.log('❌ Network HAR: Login failed');
    }
  } catch (error: any) {
    console.error(`Network HAR error: ${error.message}`);
  } finally {
    if (browser) await browser.close();
  }

  // PROOF 5: /ops/proof Page
  console.log('📸 PROOF 5: /ops/proof Page...');
  try {
    browser = await chromium.launch();
    context = await browser.newContext({ baseURL: WEB_PUBLIC_URL });
    page = await context.newPage();

    const loggedIn = await loginAsOwner(page);
    if (loggedIn) {
      await page.goto(`${WEB_PUBLIC_URL}/ops/proof`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const runButton = page.locator('button:has-text("Run"), button:has-text("Test")').first();
      if (await runButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await runButton.click();
        await page.waitForTimeout(5000);
      }

      await page.screenshot({ path: join(SCREENSHOTS_DIR, 'ops-proof.png'), fullPage: true });
      console.log('✅ /ops/proof screenshot captured');
    } else {
      console.log('❌ /ops/proof: Login failed');
    }
  } catch (error: any) {
    console.error(`/ops/proof error: ${error.message}`);
  } finally {
    if (browser) await browser.close();
  }

  // PROOF 6: Worker Evidence (Trigger Retry Job)
  console.log('📸 PROOF 6: Worker Evidence (Trigger Retry Job)...');
  try {
    browser = await chromium.launch();
    context = await browser.newContext({ baseURL: WEB_PUBLIC_URL });
    page = await context.newPage();

    const loggedIn = await loginAsOwner(page);
    if (loggedIn) {
      // Navigate to messages page
      await page.goto(`${WEB_PUBLIC_URL}/messages`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Find a failed message with retry button
      const retryButton = page.locator('button:has-text("Retry"), button[aria-label*="retry" i]').first();
      const retryButtonVisible = await retryButton.isVisible({ timeout: 5000 }).catch(() => false);

      let retryTriggered = false;
      let auditEventFound = null;

      if (retryButtonVisible) {
        // Get API token for direct API calls
        const apiToken = await getAPIToken(page);

        // Get initial audit count (call NestJS API directly)
        const initialAuditResponse = apiToken ? await fetch(`${API_PUBLIC_URL}/api/audit/events?limit=100`, {
          headers: { 'Authorization': `Bearer ${apiToken}` },
        }).catch(() => null) : null;
        const initialAuditData = initialAuditResponse ? await initialAuditResponse.json().catch(() => ({})) : {};
        const initialEventIds = new Set((initialAuditData.events || []).map((e: any) => e.id));

        // Click retry button
        await retryButton.click();
        await page.waitForTimeout(5000); // Wait for job to execute

        // Check for new audit event (call NestJS API directly)
        const newAuditResponse = apiToken ? await fetch(`${API_PUBLIC_URL}/api/audit/events?limit=100`, {
          headers: { 'Authorization': `Bearer ${apiToken}` },
        }).catch(() => null) : null;
        const newAuditData = newAuditResponse ? await newAuditResponse.json().catch(() => ({})) : {};
        const newEvents = (newAuditData.events || []).filter((e: any) => 
          !initialEventIds.has(e.id) && (
            e.eventType?.includes('retry') || 
            e.eventType?.includes('message.outbound.retry')
          )
        );

        if (newEvents.length > 0) {
          retryTriggered = true;
          auditEventFound = newEvents[0];
        }
      }

      // Get API token and check existing audit events (call NestJS API directly)
      const apiToken = await getAPIToken(page);
      const auditResponse = apiToken ? await fetch(`${API_PUBLIC_URL}/api/audit/events?limit=100`, {
        headers: { 'Authorization': `Bearer ${apiToken}` },
      }).catch(() => null) : null;
      const auditData = auditResponse ? await auditResponse.json().catch(() => ({})) : {};
      
      const workerEvents = (auditData.events || []).filter((e: any) => 
        e.eventType?.includes('retry') || 
        e.eventType?.includes('automation') || 
        e.eventType?.includes('pool') ||
        e.eventType?.includes('message.outbound.retry')
      );

      const workerProof = `Worker Evidence Check\n\n` +
        `Retry Button Found: ${retryButtonVisible}\n` +
        `Retry Triggered: ${retryTriggered}\n` +
        `Audit Events Found: ${auditData.events?.length || 0}\n` +
        `Worker-Related Events: ${workerEvents.length}\n\n` +
        (auditEventFound ? `✅ NEW RETRY EVENT TRIGGERED:\n${JSON.stringify(auditEventFound, null, 2)}\n\n` : '') +
        `Recent Worker Events:\n${JSON.stringify(workerEvents.slice(0, 5), null, 2)}\n\n` +
        `Note: If no retry events found, check Render worker logs for job execution (not just "workers started").`;

      writeFileSync(join(PROOF_PACK_DIR, 'worker-proof.txt'), workerProof);
      
      if (auditEventFound || workerEvents.length > 0) {
        console.log(`✅ Worker evidence: ${auditEventFound ? 'NEW retry event triggered' : `${workerEvents.length} existing events found`}`);
      } else {
        console.log('⚠️ Worker evidence: No retry events found (check Render worker logs for job execution)');
      }
    } else {
      writeFileSync(join(PROOF_PACK_DIR, 'worker-proof.txt'), 'Worker Evidence: Login failed - cannot check audit events');
      console.log('❌ Worker evidence: Login failed');
    }
  } catch (error: any) {
    writeFileSync(join(PROOF_PACK_DIR, 'worker-proof.txt'), `Worker Evidence Error: ${error.message}\n\nStack: ${error.stack}`);
    console.error(`Worker evidence error: ${error.message}`);
  } finally {
    if (browser) await browser.close();
  }

  // Generate summary
  const summary = `Deployment Proof Pack Summary\n\n` +
    `Generated: ${new Date().toISOString()}\n` +
    `WEB_PUBLIC_URL: ${WEB_PUBLIC_URL}\n` +
    `API_PUBLIC_URL: ${API_PUBLIC_URL}\n\n` +
    `Files Generated:\n` +
    `- curl-health.txt\n` +
    `- curl-cors.txt\n` +
    `- curl-web-shadow.txt\n` +
    `- network.har\n` +
    `- network-analysis.txt\n` +
    `- screenshots/ops-proof.png\n` +
    `- worker-proof.txt\n`;

  writeFileSync(join(PROOF_PACK_DIR, 'SUMMARY.txt'), summary);
  console.log(`\n✅ Proof pack generated: ${PROOF_PACK_DIR}`);
}

main().catch(console.error);
