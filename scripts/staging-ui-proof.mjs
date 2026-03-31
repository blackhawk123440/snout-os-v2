import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.STAGING_BASE_URL || 'https://snout-os-staging.onrender.com';
const E2E_KEY = process.env.E2E_AUTH_KEY || 'test-e2e-key-change-in-production';
const SITTER_BOOKING_ID = process.env.SITTER_BOOKING_ID || '';
const OUTPUT_DIR = path.resolve(process.cwd(), 'artifacts/ui-proof');

const ACCOUNTS = {
  owner: 'owner@example.com',
  client: 'client@example.com',
  sitter: 'sitter@example.com',
};

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function getE2ECookie(role) {
  const res = await fetch(`${BASE_URL}/api/ops/e2e-login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-e2e-key': E2E_KEY,
    },
    body: JSON.stringify({ role }),
  });
  const setCookie = res.headers.get('set-cookie');
  if (!res.ok || !setCookie) {
    const body = await res.text();
    throw new Error(`e2e-login failed for ${role}: status=${res.status} body=${body}`);
  }
  const firstPair = setCookie.split(';')[0];
  const eqIdx = firstPair.indexOf('=');
  const name = firstPair.slice(0, eqIdx);
  const value = firstPair.slice(eqIdx + 1);
  return { name, value };
}

function getCookieDomain(baseUrl) {
  const { hostname } = new URL(baseUrl);
  return hostname;
}

async function capture(page, role, route, filename, results) {
  const url = `${BASE_URL}${route}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  const fullPath = path.join(OUTPUT_DIR, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  const title = await page.title();
  const currentUrl = page.url();
  const blocked = currentUrl.includes('/login') && !route.startsWith('/login');
  const status = blocked ? 'UNVERIFIED' : 'VERIFIED';
  results.push({ role, route, requestedUrl: url, finalUrl: currentUrl, title, status, screenshot: fullPath });
  console.log(`[ui-proof] ${role} ${route} -> ${status} finalUrl=${currentUrl} screenshot=${fullPath}`);
}

async function run() {
  await ensureOutputDir();
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const ownerCookie = await getE2ECookie('owner');
    await ownerContext.addCookies([
      { name: ownerCookie.name, value: ownerCookie.value, domain: getCookieDomain(BASE_URL), path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ]);
    const ownerPage = await ownerContext.newPage();
    console.log(`[ui-proof] auth set for owner (${ACCOUNTS.owner})`);
    await capture(ownerPage, 'owner', '/dashboard', 'owner-dashboard.png', results);
    await capture(ownerPage, 'owner', '/bookings', 'owner-bookings.png', results);
    await capture(ownerPage, 'owner', '/calendar', 'owner-calendar.png', results);
    await capture(ownerPage, 'owner', '/automations', 'owner-automations.png', results);
    await ownerContext.close();

    const clientContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const clientCookie = await getE2ECookie('client');
    await clientContext.addCookies([
      { name: clientCookie.name, value: clientCookie.value, domain: getCookieDomain(BASE_URL), path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ]);
    const clientPage = await clientContext.newPage();
    console.log(`[ui-proof] auth set for client (${ACCOUNTS.client})`);
    await capture(clientPage, 'client', '/client/home', 'client-home.png', results);
    await capture(clientPage, 'client', '/client/bookings', 'client-bookings.png', results);
    await capture(clientPage, 'client', '/client/bookings/new', 'client-bookings-new.png', results);
    await clientContext.close();

    const sitterContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const sitterCookie = await getE2ECookie('sitter');
    await sitterContext.addCookies([
      { name: sitterCookie.name, value: sitterCookie.value, domain: getCookieDomain(BASE_URL), path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ]);
    const sitterPage = await sitterContext.newPage();
    console.log(`[ui-proof] auth set for sitter (${ACCOUNTS.sitter})`);
    await capture(sitterPage, 'sitter', '/sitter/today', 'sitter-today.png', results);
    await capture(sitterPage, 'sitter', '/sitter/bookings', 'sitter-bookings.png', results);
    if (SITTER_BOOKING_ID) {
      await capture(
        sitterPage,
        'sitter',
        `/sitter/bookings/${SITTER_BOOKING_ID}`,
        'sitter-booking-detail.png',
        results
      );
    }
    await sitterContext.close();

    const reportPath = path.join(OUTPUT_DIR, 'report.json');
    await fs.writeFile(reportPath, JSON.stringify({ baseUrl: BASE_URL, generatedAt: new Date().toISOString(), results }, null, 2));
    console.log(`[ui-proof] report saved: ${reportPath}`);
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('[ui-proof] FAIL', err);
  process.exit(1);
});
