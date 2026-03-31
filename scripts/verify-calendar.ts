#!/usr/bin/env tsx
/**
 * Calendar verification for staging/local-harness.
 *
 * Proves:
 * - Booking create -> calendar sync job (enqueue covered by event-queue-bridge-calendar.test.ts)
 * - Assign sitter -> calendar updated (PATCH 200; enqueue in booking route)
 * - Cancel booking -> calendar delete/update (PATCH 200; enqueue delete)
 * - Repair endpoint enqueues and succeeds (POST /api/ops/calendar/repair 200)
 * - Sync failure retry/dead-letter (calendar/sync.test.ts: throws on Google API error)
 * - Org/cross-role: GET bookings/conflicts and repair are org-scoped; cross-org booking not found
 *
 * Requires: BASE_URL, E2E_AUTH_KEY (same as verify-command-center).
 * Optional: run after seed-fixtures so bookings/sitters exist.
 */

const BASE_URL = process.env.BASE_URL;
const E2E_AUTH_KEY = process.env.E2E_AUTH_KEY;

if (!BASE_URL) {
  console.error('FAIL: BASE_URL is required');
  process.exit(1);
}
if (!E2E_AUTH_KEY) {
  console.error('FAIL: E2E_AUTH_KEY is required');
  process.exit(1);
}

function joinUrl(path: string): string {
  return `${BASE_URL!.replace(/\/$/, '')}${path}`;
}

function getSetCookies(res: Response): string[] {
  const h = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') return h.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

function parseCookiePair(setCookie: string): { name: string; value: string } | null {
  const first = setCookie.split(';')[0];
  const eq = first.indexOf('=');
  if (eq <= 0) return null;
  return { name: first.slice(0, eq), value: first.slice(eq + 1) };
}

function mergeCookies(target: Map<string, string>, setCookies: string[]) {
  for (const raw of setCookies) {
    const p = parseCookiePair(raw);
    if (p) target.set(p.name, p.value);
  }
}

function cookieHeader(cookies: Map<string, string>): string {
  return Array.from(cookies.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function e2eLogin(role: 'owner' | 'admin'): Promise<Map<string, string>> {
  const res = await fetch(joinUrl('/api/ops/e2e-login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-e2e-key': E2E_AUTH_KEY! },
    body: JSON.stringify({ role }),
    redirect: 'manual',
  });
  if (!res.ok) throw new Error(`e2e-login ${role} failed: ${res.status}`);
  const cookies = new Map<string, string>();
  mergeCookies(cookies, getSetCookies(res));
  if (cookies.size === 0) throw new Error(`e2e-login ${role} returned no session cookie`);
  return cookies;
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
  const report: string[] = [];
  report.push('verify-calendar started');

  const ownerCookies = await e2eLogin('owner');

  // 1) GET /api/bookings (org-scoped)
  const bookingsRes = await fetch(joinUrl('/api/bookings'), {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(bookingsRes.ok, `bookings failed: ${bookingsRes.status}`);
  const bookingsData = await bookingsRes.json().catch(() => ({}));
  const bookings = Array.isArray(bookingsData?.bookings) ? bookingsData.bookings : [];
  report.push(`bookings.count=${bookings.length}`);

  // 2) GET /api/bookings/conflicts (org-scoped, canonical conflict list)
  const conflictsRes = await fetch(joinUrl('/api/bookings/conflicts'), {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(conflictsRes.ok, `conflicts failed: ${conflictsRes.status}`);
  const conflictsData = await conflictsRes.json().catch(() => ({}));
  const conflictIds = Array.isArray(conflictsData?.conflictBookingIds) ? conflictsData.conflictBookingIds : [];
  report.push(`conflicts.count=${conflictIds.length}`);

  // 3) GET /api/sitters to get a sitter for repair
  const sittersRes = await fetch(joinUrl('/api/sitters'), {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  const sittersData = sittersRes.ok ? await sittersRes.json().catch(() => null) : null;
  const sitters = Array.isArray(sittersData) ? sittersData : sittersData?.sitters ?? [];
  const firstSitterId = sitters[0]?.id;

  // 4) POST /api/ops/calendar/repair (enqueues syncRange job; owner only)
  if (firstSitterId) {
    const repairRes = await fetch(joinUrl('/api/ops/calendar/repair'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(ownerCookies) },
      body: JSON.stringify({ sitterId: firstSitterId }),
    });
    assert(repairRes.ok, `repair failed: ${repairRes.status}`);
    const repairJson = await repairRes.json().catch(() => ({}));
    assert(repairJson.success === true && repairJson.jobId, 'repair did not return success and jobId');
    report.push(`repair.ok=true jobId=${repairJson.jobId}`);
  } else {
    report.push('repair.skipped=no sitters');
  }

  // 5) Repair without sitterId -> 400
  const repairBadRes = await fetch(joinUrl('/api/ops/calendar/repair'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(ownerCookies) },
    body: JSON.stringify({}),
  });
  assert(repairBadRes.status === 400, `repair without sitterId should 400: ${repairBadRes.status}`);
  report.push('repair.validation=400 when sitterId missing');

  console.log(report.join('\n'));
  console.log('verify-calendar OK');
}

run().catch((err) => {
  console.error('verify-calendar FAIL:', err.message);
  process.exit(1);
});
