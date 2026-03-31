#!/usr/bin/env tsx

type Role = 'owner' | 'sitter' | 'client';
type StageResult = {
  stage: number;
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
};

const BASE_URL = process.env.BASE_URL || 'https://snout-os-staging.onrender.com';
const E2E_AUTH_KEY = process.env.E2E_AUTH_KEY || 'test-e2e-key-change-in-production';

const TEST_PHONE = process.env.SMOKE_TEST_PHONE || '+14155550101';

function joinUrl(path: string) {
  return `${BASE_URL.replace(/\/$/, '')}${path}`;
}

function stage(name: string, stageNumber: number) {
  return {
    start: () => console.log(`\n[STAGE ${stageNumber}] ${name}`),
    pass: (details: string): StageResult => ({ stage: stageNumber, name, status: 'PASS', details }),
    fail: (details: string): StageResult => ({ stage: stageNumber, name, status: 'FAIL', details }),
  };
}

function parseCookiePair(setCookie: string): { name: string; value: string } | null {
  const first = setCookie.split(';')[0];
  const idx = first.indexOf('=');
  if (idx <= 0) return null;
  return { name: first.slice(0, idx), value: first.slice(idx + 1) };
}

function getSetCookies(res: Response): string[] {
  const maybe = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof maybe.getSetCookie === 'function') return maybe.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

function cookieHeader(cookies: Map<string, string>) {
  return Array.from(cookies.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function e2eLogin(role: Role): Promise<Map<string, string>> {
  const res = await fetch(joinUrl('/api/ops/e2e-login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-key': E2E_AUTH_KEY,
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`e2e-login ${role} failed: ${res.status} ${text}`);
  }
  const cookies = new Map<string, string>();
  for (const raw of getSetCookies(res)) {
    const parsed = parseCookiePair(raw);
    if (parsed) cookies.set(parsed.name, parsed.value);
  }
  if (cookies.size === 0) {
    throw new Error(`e2e-login ${role} returned no cookies`);
  }
  return cookies;
}

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(joinUrl(path), init);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, text, json };
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const results: StageResult[] = [];

  const ownerCookies = await e2eLogin('owner');
  const sitterCookies = await e2eLogin('sitter');
  const clientCookies = await e2eLogin('client');

  const sitterSession = await fetchJson('/api/auth/session', {
    headers: { Cookie: cookieHeader(sitterCookies) },
  });
  const sitterId = sitterSession.json?.user?.sitterId as string | undefined;
  if (!sitterId) {
    throw new Error(`missing sitterId in sitter session: ${sitterSession.text}`);
  }

  const statsBefore = await fetchJson('/api/ops/stats?range=7d', {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  const bookingsCreatedBefore = Number(statsBefore.json?.bookingsCreated ?? 0);
  const visitsCompletedBefore = Number(statsBefore.json?.visitsCompleted ?? 0);

  const now = new Date();
  const startAt = new Date(now.getTime() + 30 * 60 * 1000);
  const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
  const isoDate = startAt.toISOString().slice(0, 10);
  const payload = {
    firstName: 'Smoke',
    lastName: 'Client',
    phone: TEST_PHONE,
    email: 'client@example.com',
    address: '123 Smoke Test St',
    service: 'Dog Walking',
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    minutes: 30,
    quantity: 1,
    pets: [{ name: 'Milo', species: 'Dog' }],
    selectedDates: [isoDate],
    dateTimes: {
      [isoDate]: [{ time: '9:00 AM', duration: 30 }],
    },
    notes: 'Full system smoke test booking',
    createdFrom: 'Client Portal',
  };

  let bookingId: string | null = null;

  // 1) client creates booking
  {
    const s = stage('client creates booking', 1);
    s.start();
    const created = await fetchJson('/api/client/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader(clientCookies),
      },
      body: JSON.stringify(payload),
    });
    bookingId = created.json?.booking?.id ?? null;
    if (created.res.ok && bookingId) {
      const r = s.pass(`bookingId=${bookingId}`);
      results.push(r);
      console.log(`[PASS] ${r.details}`);
    } else {
      const r = s.fail(`status=${created.res.status} body=${created.text}`);
      results.push(r);
      console.log(`[FAIL] ${r.details}`);
    }
  }

  if (!bookingId) {
    printSummary(results);
    process.exit(1);
  }

  // 2) owner sees booking
  {
    const s = stage('owner sees booking', 2);
    s.start();
    const ownerRead = await fetchJson(`/api/bookings/${bookingId}`, {
      headers: { Cookie: cookieHeader(ownerCookies) },
    });
    if (ownerRead.res.ok && ownerRead.json?.booking?.id === bookingId) {
      const r = s.pass(`owner booking read ok id=${ownerRead.json.booking.id}`);
      results.push(r);
      console.log(`[PASS] ${r.details}`);
    } else {
      const r = s.fail(`status=${ownerRead.res.status} body=${ownerRead.text}`);
      results.push(r);
      console.log(`[FAIL] ${r.details}`);
    }
  }

  // 3) owner assigns sitter
  {
    const s = stage('owner assigns sitter', 3);
    s.start();
    const assign = await fetchJson(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader(ownerCookies),
      },
      body: JSON.stringify({ sitterId, status: 'confirmed' }),
    });
    if (assign.res.ok) {
      const assignedSitter = assign.json?.booking?.sitterId;
      if (assignedSitter === sitterId) {
        const r = s.pass(`assigned sitterId=${assignedSitter}`);
        results.push(r);
        console.log(`[PASS] ${r.details}`);
      } else {
        const r = s.fail(`assignment response missing sitterId; body=${assign.text}`);
        results.push(r);
        console.log(`[FAIL] ${r.details}`);
      }
    } else {
      const r = s.fail(`status=${assign.res.status} body=${assign.text}`);
      results.push(r);
      console.log(`[FAIL] ${r.details}`);
    }
  }

  // 4) sitter sees booking
  {
    const s = stage('sitter sees booking', 4);
    s.start();
    const sitterRead = await fetchJson(`/api/sitter/bookings/${bookingId}`, {
      headers: { Cookie: cookieHeader(sitterCookies) },
    });
    if (sitterRead.res.ok && sitterRead.json?.id === bookingId) {
      const r = s.pass(`sitter booking read ok id=${sitterRead.json.id}`);
      results.push(r);
      console.log(`[PASS] ${r.details}`);
    } else {
      const r = s.fail(`status=${sitterRead.res.status} body=${sitterRead.text}`);
      results.push(r);
      console.log(`[FAIL] ${r.details}`);
    }
  }

  // 5) sitter checks in
  {
    const s = stage('sitter checks in', 5);
    s.start();
    const checkIn = await fetchJson(`/api/bookings/${bookingId}/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader(sitterCookies),
      },
      body: JSON.stringify({ lat: 33.75, lng: -84.39 }),
    });
    if (checkIn.res.ok && checkIn.json?.status === 'in_progress') {
      const r = s.pass(`status=${checkIn.json.status}`);
      results.push(r);
      console.log(`[PASS] ${r.details}`);
    } else {
      const r = s.fail(`status=${checkIn.res.status} body=${checkIn.text}`);
      results.push(r);
      console.log(`[FAIL] ${r.details}`);
    }
  }

  // 6) sitter checks out
  {
    const s = stage('sitter checks out', 6);
    s.start();
    const checkOut = await fetchJson(`/api/bookings/${bookingId}/check-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader(sitterCookies),
      },
      body: JSON.stringify({ lat: 33.75, lng: -84.39 }),
    });
    if (checkOut.res.ok && checkOut.json?.status === 'completed') {
      const r = s.pass(`status=${checkOut.json.status}`);
      results.push(r);
      console.log(`[PASS] ${r.details}`);
    } else {
      const r = s.fail(`status=${checkOut.res.status} body=${checkOut.text}`);
      results.push(r);
      console.log(`[FAIL] ${r.details}`);
    }
  }

  // 7) report is created
  {
    const s = stage('report is created', 7);
    s.start();
    const reportRes = await fetchJson(`/api/bookings/${bookingId}/daily-delight`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader(sitterCookies),
      },
      body: JSON.stringify({
        report: `Smoke test report ${new Date().toISOString()}`,
      }),
    });
    const reportId = reportRes.json?.reportId;
    if (reportRes.res.ok && typeof reportId === 'string' && reportId.length > 0) {
      const r = s.pass(`reportId=${reportId}`);
      results.push(r);
      console.log(`[PASS] ${r.details}`);
    } else {
      const r = s.fail(`status=${reportRes.res.status} body=${reportRes.text}`);
      results.push(r);
      console.log(`[FAIL] ${r.details}`);
    }
  }

  // 8) automation fires (test-message path)
  {
    const s = stage('automation fires (test-message path)', 8);
    s.start();
    const autoRes = await fetchJson('/api/automations/test-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader(ownerCookies),
      },
      body: JSON.stringify({
        template: `Smoke automation ping ${new Date().toISOString()}`,
        phoneNumber: TEST_PHONE,
      }),
    });
    if (autoRes.res.ok && autoRes.json?.success === true) {
      const r = s.pass('test-message returned success=true');
      results.push(r);
      console.log(`[PASS] ${r.details}`);
    } else {
      const r = s.fail(`status=${autoRes.res.status} body=${autoRes.text}`);
      results.push(r);
      console.log(`[FAIL] ${r.details}`);
    }
  }

  // 9) payroll reflects booking (sitter transfer for booking)
  {
    const s = stage('payroll reflects booking', 9);
    s.start();
    const deadline = Date.now() + 90_000;
    let matchedTransfer: any = null;
    while (Date.now() < deadline) {
      const transfers = await fetchJson('/api/sitter/transfers', {
        headers: { Cookie: cookieHeader(sitterCookies) },
      });
      if (transfers.res.ok && Array.isArray(transfers.json?.transfers)) {
        matchedTransfer = transfers.json.transfers.find((t: any) => t?.bookingId === bookingId);
        if (matchedTransfer) break;
      }
      await sleep(5000);
    }
    if (matchedTransfer) {
      const r = s.pass(
        `transferId=${matchedTransfer.id} bookingId=${matchedTransfer.bookingId} status=${matchedTransfer.status}`
      );
      results.push(r);
      console.log(`[PASS] ${r.details}`);
    } else {
      const r = s.fail(`no sitter transfer found for bookingId=${bookingId} within 90s`);
      results.push(r);
      console.log(`[FAIL] ${r.details}`);
    }
  }

  // 10) analytics updates
  {
    const s = stage('analytics updates', 10);
    s.start();
    const statsAfter = await fetchJson('/api/ops/stats?range=7d', {
      headers: { Cookie: cookieHeader(ownerCookies) },
    });
    const bookingsCreatedAfter = Number(statsAfter.json?.bookingsCreated ?? 0);
    const visitsCompletedAfter = Number(statsAfter.json?.visitsCompleted ?? 0);
    if (statsAfter.res.ok && bookingsCreatedAfter > bookingsCreatedBefore) {
      const r = s.pass(
        `bookingsCreated before=${bookingsCreatedBefore} after=${bookingsCreatedAfter}; visitsCompleted before=${visitsCompletedBefore} after=${visitsCompletedAfter}`
      );
      results.push(r);
      console.log(`[PASS] ${r.details}`);
    } else {
      const r = s.fail(
        `stats status=${statsAfter.res.status}; bookingsCreated before=${bookingsCreatedBefore} after=${bookingsCreatedAfter}`
      );
      results.push(r);
      console.log(`[FAIL] ${r.details}`);
    }
  }

  printSummary(results);

  const failed = results.filter((r) => r.status === 'FAIL').length;
  if (failed > 0) process.exit(1);
}

function printSummary(results: StageResult[]) {
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log('\n=== FULL SYSTEM SMOKE SUMMARY ===');
  for (const r of results) {
    console.log(`[${r.status}] Stage ${r.stage}: ${r.name} -- ${r.details}`);
  }
  console.log(`TOTAL: ${passed} passed, ${failed} failed, ${results.length} stages`);
}

main().catch((err) => {
  console.error('[full-system-smoke-test] FATAL', err);
  process.exit(1);
});
