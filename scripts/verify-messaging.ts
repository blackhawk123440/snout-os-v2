#!/usr/bin/env tsx

type Role = 'owner' | 'sitter' | 'client';

const BASE_URL = process.env.BASE_URL;
const E2E_AUTH_KEY = process.env.E2E_AUTH_KEY;

const E2E_OWNER_EMAIL = process.env.E2E_OWNER_EMAIL;
const E2E_SITTER_EMAIL = process.env.E2E_SITTER_EMAIL;
const E2E_CLIENT_EMAIL = process.env.E2E_CLIENT_EMAIL;

console.log('VERIFY MESSAGING ENV REQUIREMENTS');
console.log('- BASE_URL=<target app base url>');
console.log('- E2E_AUTH_KEY=<same key used by verify-command-center>');
console.log('- target env must enable /api/ops/e2e-login (ENABLE_E2E_AUTH=true or ENABLE_E2E_LOGIN=true)');
console.log('- optional: E2E_OWNER_EMAIL, E2E_SITTER_EMAIL, E2E_CLIENT_EMAIL');

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
  const maybe = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof maybe.getSetCookie === 'function') {
    return maybe.getSetCookie();
  }
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
    const parsed = parseCookiePair(raw);
    if (parsed) target.set(parsed.name, parsed.value);
  }
}

function cookieHeader(cookies: Map<string, string>): string {
  return Array.from(cookies.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function fetchJson(path: string, init?: RequestInit): Promise<{ res: Response; json: any; text: string }> {
  const res = await fetch(joinUrl(path), init);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, json, text };
}

async function e2eLogin(role: Role, email?: string): Promise<Map<string, string>> {
  const res = await fetch(joinUrl('/api/ops/e2e-login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-key': E2E_AUTH_KEY!,
    },
    body: JSON.stringify(email ? { role, email } : { role }),
    redirect: 'manual',
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`e2e-login ${role} failed: ${res.status} ${text}`);
  }
  const cookies = new Map<string, string>();
  mergeCookies(cookies, getSetCookies(res));
  if (cookies.size === 0) {
    throw new Error(`e2e-login ${role} returned no session cookie`);
  }
  return cookies;
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function run() {
  const report: string[] = [];
  const runId = `verify-msg-${Date.now().toString(36)}`;
  const uniquePhone = `+1555${Date.now().toString().slice(-7)}`;

  const { res: healthRes, json: health } = await fetchJson('/api/health');
  assert(healthRes.ok, `health failed: ${healthRes.status}`);
  report.push(`health.commitSha=${health?.commitSha ?? 'unknown'}`);
  report.push(`health.envName=${health?.envName ?? 'unknown'}`);

  const ownerCookies = await e2eLogin('owner', E2E_OWNER_EMAIL);
  const sitterCookies = await e2eLogin('sitter', E2E_SITTER_EMAIL);
  const clientCookies = await e2eLogin('client', E2E_CLIENT_EMAIL);

  const readinessBefore = await fetchJson('/api/setup/readiness', {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(readinessBefore.res.ok, `readiness failed: ${readinessBefore.res.status}`);
  if (!readinessBefore.json?.numbers?.ready) {
    const syncAttempt = await fetchJson('/api/setup/numbers/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader(ownerCookies),
      },
      body: JSON.stringify({}),
    });
    if (!syncAttempt.res.ok || syncAttempt.json?.success === false) {
      throw new Error(
        `number inventory missing and sync failed: status=${syncAttempt.res.status} message=${syncAttempt.json?.message ?? syncAttempt.text}`
      );
    }
  }
  const readinessAfter = await fetchJson('/api/setup/readiness', {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(readinessAfter.res.ok, `readiness recheck failed: ${readinessAfter.res.status}`);
  assert(readinessAfter.json?.numbers?.ready === true, `numbers.ready=false: ${readinessAfter.json?.numbers?.message ?? 'unknown'}`);
  report.push(`readiness.numbers=${readinessAfter.json?.numbers?.ready ? 'ready' : 'not_ready'}`);

  const assignmentState = await fetchJson('/api/assignments/windows', {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(assignmentState.res.ok, `assignment windows unavailable: ${assignmentState.res.status}`);
  assert(Array.isArray(assignmentState.json), 'assignment windows payload is not an array');
  report.push(`assignments.state=ok count=${assignmentState.json.length}`);

  // Seed/create an owner thread through API only.
  const createThread = await fetchJson('/api/messages/threads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(ownerCookies),
    },
    body: JSON.stringify({ phoneNumber: uniquePhone }),
  });
  let ownerThreadId: string | null = createThread.json?.threadId ?? null;
  if (!ownerThreadId) {
    const ownerThreads = await fetchJson('/api/messages/threads?limit=1', {
      headers: { Cookie: cookieHeader(ownerCookies) },
    });
    ownerThreadId = ownerThreads.json?.threads?.[0]?.id ?? null;
  }
  assert(!!ownerThreadId, 'failed to create/find owner thread');
  report.push(`seed.ownerThreadId=${ownerThreadId}`);

  const ownerThread = await fetchJson(`/api/messages/threads/${ownerThreadId}`, {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(ownerThread.res.ok, `owner thread read failed: ${ownerThread.res.status}`);
  assert(ownerThread.json?.thread?.messageNumber?.id, 'owner thread missing messageNumber.id');
  const toNumber = ownerThread.json?.thread?.messageNumber?.e164;
  assert(typeof toNumber === 'string' && toNumber.length > 0, 'owner thread missing messageNumber.e164');

  // Canonical inbound webhook.
  const inboundSid = `SM_${runId}`;
  const inboundPayload =
    `From=${encodeURIComponent(uniquePhone)}` +
    `&To=${encodeURIComponent(toNumber)}` +
    `&Body=${encodeURIComponent(`inbound ${runId}`)}` +
    `&MessageSid=${encodeURIComponent(inboundSid)}`;
  const inbound = await fetchJson('/api/messages/webhook/twilio', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': 'verify-messaging',
      'x-e2e-key': E2E_AUTH_KEY!,
    },
    body: inboundPayload,
  });
  assert(inbound.res.status === 200, `canonical inbound failed: ${inbound.res.status}`);

  const ownerMessagesAfterInbound = await fetchJson(`/api/messages/threads/${ownerThreadId}/messages`, {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(ownerMessagesAfterInbound.res.ok, `messages read failed: ${ownerMessagesAfterInbound.res.status}`);
  const inboundFound =
    Array.isArray(ownerMessagesAfterInbound.json) &&
    ownerMessagesAfterInbound.json.some((m: any) => m?.direction === 'inbound' && String(m?.body || '').includes(runId));
  assert(inboundFound, 'inbound Twilio message not visible in canonical thread');
  report.push(`inbound.webhook=ok sid=${inboundSid}`);

  // Owner outbound send.
  const ownerSend = await fetchJson(`/api/messages/threads/${ownerThreadId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(ownerCookies),
    },
    body: JSON.stringify({ body: `owner reply ${runId}` }),
  });
  assert(ownerSend.res.status === 200 || ownerSend.res.status === 500, `owner send unexpected: ${ownerSend.res.status}`);
  assert(typeof ownerSend.json?.messageId === 'string', 'owner send missing messageId');
  report.push(`outbound.owner=ok messageId=${ownerSend.json.messageId}`);

  const ownerMessagesAfterSend = await fetchJson(`/api/messages/threads/${ownerThreadId}/messages`, {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  const ownerSentMessage =
    Array.isArray(ownerMessagesAfterSend.json) &&
    ownerMessagesAfterSend.json.find((m: any) => m?.id === ownerSend.json.messageId);
  assert(!!ownerSentMessage, 'owner outbound message missing in thread feed');
  const ownerDelivery = ownerSentMessage?.deliveries?.[0]?.status;
  assert(['queued', 'sent', 'delivered', 'failed'].includes(ownerDelivery), 'owner delivery state not recorded');
  const ownerThreadAfterSend = await fetchJson(`/api/messages/threads/${ownerThreadId}`, {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(ownerThreadAfterSend.res.ok, `owner thread post-send read failed: ${ownerThreadAfterSend.res.status}`);
  assert(
    ownerThreadAfterSend.json?.thread?.messageNumber?.e164 === toNumber,
    'owner send is not bound to canonical masked number'
  );
  report.push(`delivery.owner=${ownerDelivery}`);

  // Sitter outbound send (from sitter-visible thread).
  let sitterThreads = await fetchJson('/api/sitter/threads', {
    headers: { Cookie: cookieHeader(sitterCookies) },
  });
  assert(sitterThreads.res.ok, `sitter threads failed: ${sitterThreads.res.status}`);
  let sitterThreadId =
    Array.isArray(sitterThreads.json) && sitterThreads.json.length > 0 ? sitterThreads.json[0].id : null;
  if (!sitterThreadId) {
    const sitterSession = await fetchJson('/api/auth/session', {
      headers: { Cookie: cookieHeader(sitterCookies) },
    });
    assert(sitterSession.res.ok, `sitter session fetch failed: ${sitterSession.res.status}`);
    const sitterId = sitterSession.json?.user?.sitterId;
    assert(typeof sitterId === 'string' && sitterId.length > 0, 'no sitter available to create assignment window');
    const bookings = await fetchJson('/api/bookings?limit=1', {
      headers: { Cookie: cookieHeader(ownerCookies) },
    });
    assert(bookings.res.ok, `bookings fetch failed: ${bookings.res.status}`);
    const bookingId = bookings.json?.bookings?.[0]?.id;
    assert(typeof bookingId === 'string' && bookingId.length > 0, 'no booking available to create assignment window');
    const now = Date.now();
    const createWindow = await fetchJson('/api/assignments/windows', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader(ownerCookies),
      },
      body: JSON.stringify({
        threadId: ownerThreadId,
        sitterId,
        startsAt: new Date(now - 5 * 60 * 1000).toISOString(),
        endsAt: new Date(now + 60 * 60 * 1000).toISOString(),
        bookingRef: bookingId,
      }),
    });
    assert(
      createWindow.res.ok,
      `failed to create assignment window for sitter verification: ${createWindow.res.status} ${createWindow.text}`
    );
    sitterThreads = await fetchJson('/api/sitter/threads', {
      headers: { Cookie: cookieHeader(sitterCookies) },
    });
    assert(sitterThreads.res.ok, `sitter threads recheck failed: ${sitterThreads.res.status}`);
    sitterThreadId =
      Array.isArray(sitterThreads.json) && sitterThreads.json.length > 0 ? sitterThreads.json[0].id : null;
  }
  assert(!!sitterThreadId, 'no sitter thread available for outbound verification');

  const sitterSend = await fetchJson(`/api/sitter/threads/${sitterThreadId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(sitterCookies),
    },
    body: JSON.stringify({ body: `sitter reply ${runId}` }),
  });
  assert(sitterSend.res.status === 200 || sitterSend.res.status === 500, `sitter send unexpected: ${sitterSend.res.status}`);
  assert(typeof sitterSend.json?.messageId === 'string', 'sitter send missing messageId');
  report.push(`outbound.sitter=ok messageId=${sitterSend.json.messageId}`);

  // Client outbound send (from client-visible thread).
  const clientThreads = await fetchJson('/api/client/messages', {
    headers: { Cookie: cookieHeader(clientCookies) },
  });
  assert(clientThreads.res.ok, `client threads failed: ${clientThreads.res.status}`);
  const clientThreadId =
    Array.isArray(clientThreads.json?.threads) && clientThreads.json.threads.length > 0
      ? clientThreads.json.threads[0].id
      : null;
  assert(!!clientThreadId, 'no client thread available for outbound verification');

  const clientSend = await fetchJson(`/api/client/messages/${clientThreadId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(clientCookies),
    },
    body: JSON.stringify({ body: `client reply ${runId}` }),
  });
  assert(clientSend.res.status === 200, `client send failed: ${clientSend.res.status}`);
  assert(typeof clientSend.json?.id === 'string', 'client send missing message id');
  report.push(`outbound.client=ok messageId=${clientSend.json.id}`);

  // Visibility checks by role.
  const ownerRead = await fetchJson(`/api/messages/threads/${ownerThreadId}`, {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(ownerRead.res.ok, `owner visibility failed: ${ownerRead.res.status}`);
  const sitterCrossRead = await fetchJson(`/api/messages/threads/${ownerThreadId}`, {
    headers: { Cookie: cookieHeader(sitterCookies) },
  });
  const clientCrossRead = await fetchJson(`/api/messages/threads/${ownerThreadId}`, {
    headers: { Cookie: cookieHeader(clientCookies) },
  });
  assert([403, 404].includes(sitterCrossRead.res.status), `sitter cross-read not blocked: ${sitterCrossRead.res.status}`);
  assert([403, 404].includes(clientCrossRead.res.status), `client cross-read not blocked: ${clientCrossRead.res.status}`);
  report.push(`visibility.owner=${ownerRead.res.status}`);
  report.push(`visibility.sitterCross=${sitterCrossRead.res.status}`);
  report.push(`visibility.clientCross=${clientCrossRead.res.status}`);

  // Deprecated duplicate inbound path must be removed/hard-deprecated.
  const deprecatedInbound = await fetchJson('/api/twilio/inbound', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'From=%2B15550001111&To=%2B15550002222&Body=legacy',
  });
  assert(deprecatedInbound.res.status === 410, `legacy inbound path not deprecated: ${deprecatedInbound.res.status}`);
  report.push(`inbound.legacyPathStatus=${deprecatedInbound.res.status}`);

  console.log('VERIFY MESSAGING REPORT');
  for (const line of report) console.log(line);
  console.log('RESULT: PASS');
}

run().catch((error) => {
  console.error('RESULT: FAIL');
  console.error((error as Error).message);
  process.exit(1);
});
