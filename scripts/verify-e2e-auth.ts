#!/usr/bin/env tsx
/**
 * Quick verification script for E2E auth
 * Run this to test if E2E login route works before running full tests
 * 
 * Prerequisites:
 * - Server must be running (pnpm dev)
 * - Database must be seeded (pnpm db:seed)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const E2E_AUTH_KEY = process.env.E2E_AUTH_KEY || 'test-e2e-key-change-in-production';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@example.com';
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'JeBctxnIua976KOMQvZDg9qjF/4Xy3ncp/quiknbXBPKy5nFiOvsErmxIXtq+18a';

async function verify() {
  console.log('🔍 Verifying E2E auth endpoint...');
  console.log(`   BASE_URL: ${BASE_URL}`);
  console.log(`   E2E_AUTH_KEY: ${E2E_AUTH_KEY.substring(0, 10)}...`);
  
  try {
    // Test owner login
    const response = await fetch(`${BASE_URL}/api/ops/e2e-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-e2e-key': E2E_AUTH_KEY,
      },
      body: JSON.stringify({
        role: 'owner',
        email: OWNER_EMAIL,
      }),
    });

    console.log(`   Status: ${response.status}`);
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`   ❌ Failed: ${text}`);
      try {
        const json = JSON.parse(text);
        if (json.message) {
          console.error(`   Error message: ${json.message}`);
        }
        if (json.stack) {
          console.error(`   Stack trace: ${json.stack.substring(0, 200)}...`);
        }
      } catch {
        // Not JSON, already printed
      }
      process.exit(1);
    }

    // Get all Set-Cookie headers (NextAuth may set multiple cookies)
    const setCookieHeaders = response.headers.getSetCookie();
    if (!setCookieHeaders || setCookieHeaders.length === 0) {
      console.error(`   ❌ No Set-Cookie header in response`);
      process.exit(1);
    }

    // Find the session token cookie (next-auth.session-token or authjs.session-token)
    const sessionCookie = setCookieHeaders.find(cookie => 
      cookie.includes('next-auth.session-token') || cookie.includes('authjs.session-token')
    );
    
    if (!sessionCookie) {
      console.error(`   ❌ No session token cookie found`);
      console.error(`   Found cookies: ${setCookieHeaders.map(c => c.split(';')[0]).join(', ')}`);
      process.exit(1);
    }

    console.log(`   ✅ Success! Session cookie present`);
    console.log(`   Cookie: ${sessionCookie.split(';')[0].substring(0, 50)}...`);

    // Test session endpoint - use all cookies
    const allCookies = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
    const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: {
        'Cookie': allCookies,
      },
    });

    if (sessionResponse.ok) {
      const session = await sessionResponse.json();
      if (session?.user) {
        console.log(`   ✅ Session verified: ${session.user.email}`);
      } else {
        console.error(`   ❌ Session missing user object`);
        process.exit(1);
      }
    } else {
      console.error(`   ❌ Session check failed: ${sessionResponse.status}`);
      process.exit(1);
    }

    console.log('\n✅ E2E auth is working correctly!');
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    if (error.code === 'ECONNREFUSED' || error.message.includes('fetch failed')) {
      console.error(`\n   ⚠️  Server is not running at ${BASE_URL}`);
      console.error(`   Start it in another terminal with:`);
      console.error(`   ENABLE_E2E_AUTH=true E2E_AUTH_KEY='test-e2e-key-change-in-production' NEXTAUTH_SECRET='test-secret-for-smoke-tests-minimum-64-characters-required-for-nextauth-jwt-encoding' pnpm dev`);
      console.error(`\n   Then run this verification script again.`);
    }
    process.exit(1);
  }
}

verify();
