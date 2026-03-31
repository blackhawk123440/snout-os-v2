/**
 * Playwright Global Setup
 * 
 * Generates storageState files for owner and sitter authentication.
 * These files contain the NextAuth session cookies needed for E2E tests.
 */

import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const E2E_AUTH_KEY = process.env.E2E_AUTH_KEY || 'test-e2e-key-change-in-production';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@example.com';
const SITTER_EMAIL = process.env.SITTER_EMAIL || 'sitter@example.com';
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || 'client@example.com';

async function globalSetup(config: FullConfig) {
  // Create .auth directory if it doesn't exist
  // config.rootDir is the testDir (./tests), so we need to go up one level
  const rootDir = config.rootDir ? path.dirname(config.rootDir) : process.cwd();
  const authDir = path.join(rootDir, 'tests', '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Wait for server to be ready (retry up to 60 times, 1 second apart)
  console.log('[Global Setup] Waiting for server to be ready...');
  let serverReady = false;
  for (let i = 0; i < 60; i++) {
    try {
      // Try the E2E login endpoint (will return 400/404 if server is up but endpoint not ready)
      // Or try a simple GET to root
      const response = await fetch(`${BASE_URL}/`, {
        signal: AbortSignal.timeout(1000),
        method: 'GET',
      });
      // Any response (even 404) means server is running
      serverReady = true;
      console.log(`[Global Setup] Server is ready (attempt ${i + 1})`);
      break;
    } catch (error: any) {
      // ECONNREFUSED means server not ready
      if (i % 10 === 9) {
        console.log(`[Global Setup] Still waiting for server... (${i + 1}/60)`);
      }
    }
    if (i < 59) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!serverReady) {
    throw new Error(`Server at ${BASE_URL} is not ready after 60 seconds. Make sure the dev server is running.`);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Authenticate as owner using browser context request (so cookies go to browser context)
    console.log('[Global Setup] Authenticating as owner...');
    console.log(`[Global Setup] BASE_URL=${BASE_URL} OWNER_EMAIL=${OWNER_EMAIL} E2E_AUTH_KEY=${E2E_AUTH_KEY ? '[set]' : '[missing]'}`);
    const ownerResponse = await context.request.post(`${BASE_URL}/api/ops/e2e-login`, {
      data: {
        role: 'owner',
        email: OWNER_EMAIL,
      },
      headers: {
        'Content-Type': 'application/json',
        'x-e2e-key': E2E_AUTH_KEY,
      },
    });

    if (!ownerResponse.ok()) {
      const errorText = await ownerResponse.text();
      console.error('[Global Setup] Owner e2e-login response status:', ownerResponse.status());
      console.error('[Global Setup] Owner e2e-login response body:', errorText);
      throw new Error(`Owner authentication failed: ${ownerResponse.status()} - ${errorText}`);
    }

    // Extract cookies from Set-Cookie header and add to browser context
    // Playwright's request context doesn't automatically share cookies with browser context
    const setCookieHeader = ownerResponse.headers()['set-cookie'];
    if (setCookieHeader) {
      const cookieStrings = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
      const cookies = cookieStrings.map(cookieStr => {
        const parts = cookieStr.split(';').map(p => p.trim());
        const [nameValue] = parts;
        const [name, value] = nameValue.split('=');
        
        const cookie: any = {
          name: name.trim(),
          value: value.trim(),
          domain: new URL(BASE_URL).hostname,
          path: '/',
        };
        
        // Parse additional attributes
        for (const part of parts.slice(1)) {
          const lower = part.toLowerCase();
          if (lower.startsWith('max-age=')) {
            const maxAge = parseInt(part.split('=')[1]);
            cookie.expires = Math.floor(Date.now() / 1000) + maxAge;
          } else if (lower === 'httponly') {
            cookie.httpOnly = true;
          } else if (lower === 'secure') {
            cookie.secure = true;
          } else if (lower.startsWith('samesite=')) {
            const sameSiteValue = part.split('=')[1] || 'Lax';
            // Playwright requires capitalized: Strict, Lax, or None
            cookie.sameSite = sameSiteValue.charAt(0).toUpperCase() + sameSiteValue.slice(1).toLowerCase() as 'Strict' | 'Lax' | 'None';
          }
        }
        return cookie;
      });
      
      if (cookies.length > 0) {
        await context.addCookies(cookies);
        console.log(`[Global Setup] Added ${cookies.length} cookie(s) to owner context`);
      }
    } else {
      console.warn('[Global Setup] No Set-Cookie header in owner response');
    }
    
    // Save owner storage state
    await context.storageState({ path: path.join(authDir, 'owner.json') });
    console.log('[Global Setup] Owner storage state saved');

    // Create new context for sitter
    await context.close();
    const sitterContext = await browser.newContext();
    const sitterPage = await sitterContext.newPage();

    // Authenticate as sitter using browser context request (so cookies go to browser context)
    console.log('[Global Setup] Authenticating as sitter...');
    const sitterResponse = await sitterContext.request.post(`${BASE_URL}/api/ops/e2e-login`, {
      data: {
        role: 'sitter',
        email: SITTER_EMAIL,
      },
      headers: {
        'Content-Type': 'application/json',
        'x-e2e-key': E2E_AUTH_KEY,
      },
    });

    if (!sitterResponse.ok()) {
      const errorText = await sitterResponse.text();
      throw new Error(`Sitter authentication failed: ${sitterResponse.status()} - ${errorText}`);
    }

    // Extract cookies from Set-Cookie header and add to browser context
    const sitterSetCookieHeader = sitterResponse.headers()['set-cookie'];
    if (sitterSetCookieHeader) {
      const cookieStrings = Array.isArray(sitterSetCookieHeader) ? sitterSetCookieHeader : [sitterSetCookieHeader];
      const cookies = cookieStrings.map(cookieStr => {
        const parts = cookieStr.split(';').map(p => p.trim());
        const [nameValue] = parts;
        const [name, value] = nameValue.split('=');
        
        const cookie: any = {
          name: name.trim(),
          value: value.trim(),
          domain: new URL(BASE_URL).hostname,
          path: '/',
        };
        
        // Parse additional attributes
        for (const part of parts.slice(1)) {
          const lower = part.toLowerCase();
          if (lower.startsWith('max-age=')) {
            const maxAge = parseInt(part.split('=')[1]);
            cookie.expires = Math.floor(Date.now() / 1000) + maxAge;
          } else if (lower === 'httponly') {
            cookie.httpOnly = true;
          } else if (lower === 'secure') {
            cookie.secure = true;
          } else if (lower.startsWith('samesite=')) {
            const sameSiteValue = part.split('=')[1] || 'Lax';
            // Playwright requires capitalized: Strict, Lax, or None
            cookie.sameSite = sameSiteValue.charAt(0).toUpperCase() + sameSiteValue.slice(1).toLowerCase() as 'Strict' | 'Lax' | 'None';
          }
        }
        return cookie;
      });
      
      if (cookies.length > 0) {
        await sitterContext.addCookies(cookies);
        console.log(`[Global Setup] Added ${cookies.length} cookie(s) to sitter context`);
      }
    } else {
      console.warn('[Global Setup] No Set-Cookie header in sitter response');
    }
    
    // Save sitter storage state
    await sitterContext.storageState({ path: path.join(authDir, 'sitter.json') });
    console.log('[Global Setup] Sitter storage state saved');

    await sitterContext.close();

    // Create new context for client
    const clientContext = await browser.newContext();

    // Authenticate as client
    console.log('[Global Setup] Authenticating as client...');
    const clientResponse = await clientContext.request.post(`${BASE_URL}/api/ops/e2e-login`, {
      data: {
        role: 'client',
        email: CLIENT_EMAIL,
      },
      headers: {
        'Content-Type': 'application/json',
        'x-e2e-key': E2E_AUTH_KEY,
      },
    });

    if (clientResponse.ok()) {
      const clientSetCookieHeader = clientResponse.headers()['set-cookie'];
      if (clientSetCookieHeader) {
        const cookieStrings = Array.isArray(clientSetCookieHeader) ? clientSetCookieHeader : [clientSetCookieHeader];
        const cookies = cookieStrings.map(cookieStr => {
          const parts = cookieStr.split(';').map(p => p.trim());
          const [nameValue] = parts;
          const [name, value] = nameValue.split('=');
          const cookie: any = {
            name: name.trim(),
            value: value.trim(),
            domain: new URL(BASE_URL).hostname,
            path: '/',
          };
          for (const part of parts.slice(1)) {
            const lower = part.toLowerCase();
            if (lower.startsWith('max-age=')) {
              const maxAge = parseInt(part.split('=')[1]);
              cookie.expires = Math.floor(Date.now() / 1000) + maxAge;
            } else if (lower === 'httponly') cookie.httpOnly = true;
            else if (lower === 'secure') cookie.secure = true;
            else if (lower.startsWith('samesite=')) {
              const sameSiteValue = part.split('=')[1] || 'Lax';
              cookie.sameSite = sameSiteValue.charAt(0).toUpperCase() + sameSiteValue.slice(1).toLowerCase() as 'Strict' | 'Lax' | 'None';
            }
          }
          return cookie;
        });
        if (cookies.length > 0) {
          await clientContext.addCookies(cookies);
          console.log(`[Global Setup] Added ${cookies.length} cookie(s) to client context`);
        }
      }
      await clientContext.storageState({ path: path.join(authDir, 'client.json') });
      console.log('[Global Setup] Client storage state saved');
    } else {
      console.warn('[Global Setup] Client authentication failed (client user may not exist) - client snapshots will skip');
      await clientContext.storageState({ path: path.join(authDir, 'client.json') });
    }

    await clientContext.close();
  } catch (error) {
    console.error('[Global Setup] Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
