#!/usr/bin/env tsx
/**
 * Reports / Analytics verification.
 * Lightweight contract check: health, canonical KPIs, trend payload shapes, owner auth / sitter blocked.
 * Usage: BASE_URL=<url> E2E_AUTH_KEY=<key> npx tsx scripts/verify-reports-analytics.ts
 */

const BASE_URL = process.env.BASE_URL;
const E2E_AUTH_KEY = process.env.E2E_AUTH_KEY;

type Role = 'owner' | 'sitter' | 'client';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function joinUrl(path: string): string {
  return `${BASE_URL!.replace(/\/$/, '')}${path}`;
}

function getSetCookies(res: Response): string[] {
  const h = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') return h.getSetCookie();
  const s = res.headers.get('set-cookie');
  return s ? [s] : [];
}

function parseCookie(pair: string): { name: string; value: string } | null {
  const first = pair.split(';')[0];
  const eq = first.indexOf('=');
  if (eq <= 0) return null;
  return { name: first.slice(0, eq), value: first.slice(eq + 1) };
}

function mergeCookies(target: Map<string, string>, setCookies: string[]) {
  for (const raw of setCookies) {
    const p = parseCookie(raw);
    if (p) target.set(p.name, p.value);
  }
}

function cookieHeader(cookies: Map<string, string>): string {
  return Array.from(cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function fetchJson(path: string, init?: RequestInit): Promise<{ res: Response; json: any }> {
  const res = await fetch(joinUrl(path), init);
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { res, json };
}

async function e2eLogin(role: Role): Promise<Map<string, string>> {
  const res = await fetch(joinUrl('/api/ops/e2e-login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-e2e-key': E2E_AUTH_KEY! },
    body: JSON.stringify({ role }),
    redirect: 'manual',
  });
  assert(res.ok, `e2e-login ${role} failed: ${res.status}`);
  const cookies = new Map<string, string>();
  mergeCookies(cookies, getSetCookies(res));
  assert(cookies.size > 0, `e2e-login ${role} returned no session cookie`);
  return cookies;
}

const CANONICAL_KPI_KEYS = [
  'range', 'periodStart', 'periodEnd', 'revenueToday', 'revenueWeek', 'revenueMonth',
  'revenue', 'bookingsToday', 'bookingsWeek', 'bookingsMonth', 'bookings',
  'activeClients', 'activeSitters', 'utilization', 'cancellationRate',
  'failedPaymentCount', 'automationFailureCount', 'payoutVolume',
  'averageBookingValue', 'repeatBookingRate', 'messageResponseLag',
];

async function run() {
  const report: string[] = [];
  report.push('verify-reports-analytics');

  if (!BASE_URL) {
    console.error('FAIL: BASE_URL is required');
    process.exit(1);
  }
  if (!E2E_AUTH_KEY) {
    console.error('FAIL: E2E_AUTH_KEY is required');
    process.exit(1);
  }

  const { res: healthRes, json: health } = await fetchJson('/api/health');
  assert(healthRes.ok, `health failed: ${healthRes.status}`);
  report.push(`health.ok commitSha=${health?.commitSha ?? 'unknown'}`);

  const ownerCookies = await e2eLogin('owner');

  const { res: kpisRes, json: kpis } = await fetchJson('/api/analytics/kpis?range=30d', {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(kpisRes.ok, `kpis failed: ${kpisRes.status} ${JSON.stringify(kpis?.error ?? kpis?.message ?? '')}`);
  for (const key of CANONICAL_KPI_KEYS) {
    assert(kpis && key in kpis, `kpis missing field: ${key}`);
  }
  report.push(`kpis.ok range=${kpis?.range} revenue.value=${kpis?.revenue?.value}`);

  const trendEndpoints = [
    '/api/analytics/trends/revenue?range=30d',
    '/api/analytics/trends/bookings?range=30d',
    '/api/analytics/trends/payout-volume?range=30d',
    '/api/analytics/trends/automation-failures?range=30d',
  ];
  for (const path of trendEndpoints) {
    const { res: trendRes, json: trend } = await fetchJson(path, {
      headers: { Cookie: cookieHeader(ownerCookies) },
    });
    assert(trendRes.ok, `trend ${path} failed: ${trendRes.status}`);
    assert(Array.isArray(trend?.daily), `trend ${path} missing daily array`);
    assert(typeof trend?.range === 'string', `trend ${path} missing range`);
    report.push(`trend.ok ${path.split('?')[0]} daily.length=${trend?.daily?.length ?? 0}`);
  }

  const sitterCookies = await e2eLogin('sitter');
  const { res: sitterKpisRes, json: sitterKpis } = await fetchJson('/api/analytics/kpis?range=30d', {
    headers: { Cookie: cookieHeader(sitterCookies) },
  });
  assert(sitterKpisRes.status === 403, `sitter must be forbidden: got ${sitterKpisRes.status}`);
  assert(sitterKpis?.error === 'Forbidden', `sitter kpis error body: ${JSON.stringify(sitterKpis?.error)}`);
  report.push('auth.sitter_blocked=ok');

  const clientCookies = await e2eLogin('client');
  const { res: clientKpisRes } = await fetchJson('/api/analytics/kpis?range=30d', {
    headers: { Cookie: cookieHeader(clientCookies) },
  });
  assert(clientKpisRes.status === 403, `client must be forbidden: got ${clientKpisRes.status}`);
  report.push('auth.client_blocked=ok');

  console.log(report.join('\n'));
  console.log('PASS: reports-analytics verification');
}

run().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
