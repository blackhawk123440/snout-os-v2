#!/usr/bin/env tsx

type AttentionItem = {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low' | string;
  subtitle?: string;
  bookingId?: string;
  entityId?: string;
  actionEntityId?: string | null;
};

type AttentionPayload = {
  alerts: AttentionItem[];
  staffing: AttentionItem[];
};

type Role = 'owner' | 'sitter' | 'client';

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
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-key': E2E_AUTH_KEY!,
    },
    body: JSON.stringify({ role }),
    redirect: 'manual',
  });

  if (!res.ok) {
    throw new Error(`e2e-login ${role} failed: ${res.status}`);
  }

  const cookies = new Map<string, string>();
  mergeCookies(cookies, getSetCookies(res));
  if (cookies.size === 0) {
    throw new Error(`e2e-login ${role} returned no session cookie`);
  }
  return cookies;
}

async function login(role: Role): Promise<Map<string, string>> {
  return e2eLogin(role);
}

function flattenAttention(payload: AttentionPayload): AttentionItem[] {
  return [...(payload.alerts || []), ...(payload.staffing || [])];
}

function countBy<T extends string>(items: AttentionItem[], key: (i: AttentionItem) => T): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function run() {
  const report: string[] = [];
  const runId = `verify-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  report.push(`runId=${runId}`);

  // 1) Health
  const { res: healthRes, json: health } = await fetchJson('/api/health');
  assert(healthRes.ok, `health failed: ${healthRes.status}`);
  report.push(`health.commitSha=${health?.commitSha ?? 'unknown'}`);
  report.push(`health.envName=${health?.envName ?? 'unknown'}`);
  report.push(`health.redis=${health?.redis ?? 'unknown'}`);

  // 2) Reset fixtures/state first (best effort), then seed fixtures.
  await fetchJson('/api/ops/command-center/reset-fixtures', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-key': E2E_AUTH_KEY!,
    },
    body: JSON.stringify({ runId }),
  });

  // 3) Seed fixtures (e2e-key path)
  const { res: seedRes, json: seed } = await fetchJson('/api/ops/command-center/seed-fixtures', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-key': E2E_AUTH_KEY!,
    },
    body: JSON.stringify({ runId }),
  });
  assert(seedRes.ok, `seed-fixtures failed: ${seedRes.status} ${JSON.stringify(seed)}`);
  report.push(`seed.ok=${seed?.ok === true}`);
  report.push(`seed.runId=${seed?.runId ?? 'unknown'}`);
  report.push(`seed.expectedItemKeys=${Array.isArray(seed?.expectedItemKeys) ? seed.expectedItemKeys.length : 0}`);

  // 4) Owner attention readout
  const ownerCookies = await login('owner');
  const { res: attRes, json: attention } = await fetchJson('/api/ops/command-center/attention', {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(attRes.ok, `attention fetch failed: ${attRes.status}`);

  const payload: AttentionPayload = {
    alerts: Array.isArray(attention?.alerts) ? attention.alerts : [],
    staffing: Array.isArray(attention?.staffing) ? attention.staffing : [],
  };
  const allItems = flattenAttention(payload);
  const typeCounts = countBy(allItems, (i) => i.type || 'unknown');
  const severityCounts = countBy(allItems, (i) => (i.severity as string) || 'unknown');
  report.push(`attention.total=${allItems.length}`);
  report.push(`attention.byType=${JSON.stringify(typeCounts)}`);
  report.push(`attention.bySeverity=${JSON.stringify(severityCounts)}`);
  report.push(`attention.first10Ids=${JSON.stringify(allItems.slice(0, 10).map((i) => i.id))}`);

  // 5) One-click fix actions: automation + calendar + payout
  const automationCandidates =
    (payload.alerts || []).filter(
      (i) => i.type === 'automation_failure' && (i.subtitle || '').includes(`[run:${runId}]`)
    ).length > 0
      ? (payload.alerts || []).filter(
          (i) => i.type === 'automation_failure' && (i.subtitle || '').includes(`[run:${runId}]`)
        )
      : (payload.alerts || []).filter((i) => i.type === 'automation_failure');
  const calendarRepair =
    (payload.alerts || []).find(
      (i) => i.type === 'calendar_repair' && (i.subtitle || '').includes(`[run:${runId}]`)
    ) || (payload.alerts || []).find((i) => i.type === 'calendar_repair');
  assert(automationCandidates.length > 0, 'no automation_failure item found for fix action');
  assert(!!calendarRepair, 'no calendar_repair item found for fix action');
  const payoutFailure =
    (payload.alerts || []).find(
      (i) => i.type === 'payout_failure' && (i.subtitle || '').includes(`[run:${runId}]`)
    ) || (payload.alerts || []).find((i) => i.type === 'payout_failure');
  assert(!!payoutFailure, 'no payout_failure item found for fix action');

  let automationFailure: AttentionItem | null = null;
  let fixAutomationJson: any = null;
  let lastAutomationError = '';
  for (const candidate of automationCandidates) {
    if (!candidate.actionEntityId) {
      continue;
    }
    const fixAutomationRes = await fetch(
      joinUrl(`/api/ops/automation-failures/${encodeURIComponent(candidate.actionEntityId)}/retry`),
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader(ownerCookies),
      },
      }
    );
    const attemptJson = await fixAutomationRes.json().catch(() => ({}));
    if (fixAutomationRes.ok) {
      const markHandledRes = await fetch(joinUrl('/api/ops/command-center/attention/actions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader(ownerCookies),
        },
        body: JSON.stringify({ id: candidate.id, action: 'mark_handled' }),
      });
      if (!markHandledRes.ok) {
        lastAutomationError = `mark handled failed: ${markHandledRes.status}`;
        continue;
      }
      automationFailure = candidate;
      fixAutomationJson = attemptJson;
      break;
    }
    lastAutomationError = `${fixAutomationRes.status} ${JSON.stringify(attemptJson)}`;
  }
  assert(
    !!automationFailure && !!fixAutomationJson,
    `automation fix failed for all candidates: ${lastAutomationError}`
  );
  report.push(
    `fix.automation={"itemId":"${automationFailure.id}","actionEntityId":"${automationFailure.actionEntityId}"}`
  );

  const fixCalendarRes = await fetch(joinUrl('/api/ops/command-center/attention/fix'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(ownerCookies),
    },
    body: JSON.stringify({ itemId: calendarRepair!.id }),
  });
  const fixCalendarJson = await fixCalendarRes.json().catch(() => ({}));
  assert(fixCalendarRes.ok, `calendar fix failed: ${fixCalendarRes.status} ${JSON.stringify(fixCalendarJson)}`);
  assert(
    typeof fixCalendarJson.actionEventLogId === 'string' && fixCalendarJson.actionEventLogId.length > 0,
    'calendar fix missing actionEventLogId'
  );
  report.push(
    `fix.calendar={"itemId":"${calendarRepair!.id}","eventLogId":"${fixCalendarJson.actionEventLogId}"}`
  );

  const fixPayoutRes = await fetch(joinUrl('/api/ops/command-center/attention/fix'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(ownerCookies),
    },
    body: JSON.stringify({ itemId: payoutFailure!.id }),
  });
  const fixPayoutJson = await fixPayoutRes.json().catch(() => ({}));
  assert(fixPayoutRes.ok, `payout fix failed: ${fixPayoutRes.status} ${JSON.stringify(fixPayoutJson)}`);
  assert(
    typeof fixPayoutJson.actionEventLogId === 'string' && fixPayoutJson.actionEventLogId.length > 0,
    'payout fix missing actionEventLogId'
  );
  report.push(
    `fix.payout={"itemId":"${payoutFailure!.id}","eventLogId":"${fixPayoutJson.actionEventLogId}"}`
  );

  const { res: attAfterFixRes, json: attAfterFix } = await fetchJson('/api/ops/command-center/attention', {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(attAfterFixRes.ok, `attention fetch after fixes failed: ${attAfterFixRes.status}`);
  const afterFixItems = flattenAttention({
    alerts: Array.isArray(attAfterFix?.alerts) ? attAfterFix.alerts : [],
    staffing: Array.isArray(attAfterFix?.staffing) ? attAfterFix.staffing : [],
  });
  const afterFixIds = new Set(afterFixItems.map((i) => i.id));
  assert(!afterFixIds.has(automationFailure!.id), `fixed automation item still present: ${automationFailure!.id}`);
  assert(!afterFixIds.has(calendarRepair!.id), `fixed calendar item still present: ${calendarRepair!.id}`);
  assert(!afterFixIds.has(payoutFailure!.id), `fixed payout item still present: ${payoutFailure!.id}`);

  if (automationFailure?.entityId) {
    const automationEventsRes = await fetch(
      joinUrl(`/api/bookings/${automationFailure.entityId}/events?type=ops.automation.retry_queued`),
      { headers: { Cookie: cookieHeader(ownerCookies) } }
    );
    const automationEventsJson = await automationEventsRes.json().catch(() => ({}));
    assert(automationEventsRes.ok, `automation event verification failed: ${automationEventsRes.status}`);
    const hasRetryEvent = Array.isArray(automationEventsJson?.items)
      ? automationEventsJson.items.some((item: { type?: string }) => item.type === 'ops.automation.retry_queued')
      : false;
    assert(hasRetryEvent, 'ops.automation.retry_queued event missing');
  }

  // 6) Staffing resolve: assign + notify + rollback
  const staffingUnassigned = (payload.staffing || []).find((i) => i.type === 'unassigned');
  assert(!!staffingUnassigned, 'no unassigned staffing item found for resolve flow');

  const resolveRes = await fetch(joinUrl('/api/ops/command-center/staffing/resolve'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(ownerCookies),
    },
    body: JSON.stringify({
      itemId: staffingUnassigned!.id,
      action: 'assign_notify',
    }),
  });
  const resolveJson = await resolveRes.json().catch(() => ({}));
  assert(resolveRes.ok, `staffing assign_notify failed: ${resolveRes.status} ${JSON.stringify(resolveJson)}`);
  assert(typeof resolveJson.assignmentId === 'string' && resolveJson.assignmentId.length > 0, 'missing assignmentId');
  assert(typeof resolveJson.sitterId === 'string' && resolveJson.sitterId.length > 0, 'missing sitterId');
  assert(resolveJson.notifySent === true, 'notifySent expected true');
  assert(typeof resolveJson.rollbackToken === 'string' && resolveJson.rollbackToken.length > 0, 'missing rollbackToken');
  report.push(
    `staffing.assign={"assignmentId":"${resolveJson.assignmentId}","bookingId":"${resolveJson.bookingId}","sitterId":"${resolveJson.sitterId}","notifySent":${resolveJson.notifySent}}`
  );

  const { res: attAfterAssignRes, json: attAfterAssign } = await fetchJson('/api/ops/command-center/attention', {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(attAfterAssignRes.ok, `attention fetch after assign failed: ${attAfterAssignRes.status}`);
  const afterAssignItems = flattenAttention({
    alerts: Array.isArray(attAfterAssign?.alerts) ? attAfterAssign.alerts : [],
    staffing: Array.isArray(attAfterAssign?.staffing) ? attAfterAssign.staffing : [],
  });
  const afterAssignIds = new Set(afterAssignItems.map((i) => i.id));
  assert(!afterAssignIds.has(staffingUnassigned!.id), `assigned item still present: ${staffingUnassigned!.id}`);

  const bookingAfterAssign = await fetch(joinUrl(`/api/bookings/${resolveJson.bookingId}`), {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  const bookingAfterAssignJson = await bookingAfterAssign.json().catch(() => ({}));
  assert(bookingAfterAssign.ok, `booking detail after assign failed: ${bookingAfterAssign.status}`);
  assert(
    bookingAfterAssignJson?.booking?.sitter?.id === resolveJson.sitterId,
    `booking sitter mismatch after assign: expected ${resolveJson.sitterId}`
  );

  const bookingEventsRes = await fetch(
    joinUrl(`/api/bookings/${resolveJson.bookingId}/events?type=message.sent`),
    {
      headers: { Cookie: cookieHeader(ownerCookies) },
    }
  );
  const bookingEventsJson = await bookingEventsRes.json().catch(() => ({}));
  assert(bookingEventsRes.ok, `booking events after assign failed: ${bookingEventsRes.status}`);
  const hasMessageEvent = Array.isArray(bookingEventsJson?.items)
    ? bookingEventsJson.items.some((item: { type?: string }) => item.type === 'message.sent')
    : false;
  assert(hasMessageEvent, 'message.sent event missing after assign_notify');

  const rollbackRes = await fetch(joinUrl('/api/ops/command-center/staffing/resolve'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(ownerCookies),
    },
    body: JSON.stringify({
      itemId: staffingUnassigned!.id,
      action: 'rollback',
      rollbackToken: resolveJson.rollbackToken,
    }),
  });
  const rollbackJson = await rollbackRes.json().catch(() => ({}));
  assert(rollbackRes.ok, `staffing rollback failed: ${rollbackRes.status} ${JSON.stringify(rollbackJson)}`);

  const { res: attAfterRollbackRes, json: attAfterRollback } = await fetchJson('/api/ops/command-center/attention', {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(attAfterRollbackRes.ok, `attention fetch after rollback failed: ${attAfterRollbackRes.status}`);
  const afterRollbackItems = flattenAttention({
    alerts: Array.isArray(attAfterRollback?.alerts) ? attAfterRollback.alerts : [],
    staffing: Array.isArray(attAfterRollback?.staffing) ? attAfterRollback.staffing : [],
  });
  const afterRollbackIds = new Set(afterRollbackItems.map((i) => i.id));
  assert(afterRollbackIds.has(staffingUnassigned!.id), `rolled back item missing: ${staffingUnassigned!.id}`);
  report.push(`staffing.rollback={"assignmentId":"${resolveJson.assignmentId}","restored":true}`);

  // 7) Snooze + handled then verify removed
  const allItemsForActions = afterFixItems;
  assert(allItemsForActions.length >= 2, 'need at least 2 attention items to test actions');
  const snoozeTarget = allItemsForActions[0];
  const handledTarget = allItemsForActions[1];
  const snoozeRes = await fetch(joinUrl('/api/ops/command-center/attention/actions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(ownerCookies),
    },
    body: JSON.stringify({ id: snoozeTarget.id, action: 'snooze_1h' }),
  });
  assert(snoozeRes.ok, `snooze action failed: ${snoozeRes.status}`);

  const handledRes = await fetch(joinUrl('/api/ops/command-center/attention/actions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(ownerCookies),
    },
    body: JSON.stringify({ id: handledTarget.id, action: 'mark_handled' }),
  });
  assert(handledRes.ok, `handled action failed: ${handledRes.status}`);

  const { res: attRes2, json: attention2 } = await fetchJson('/api/ops/command-center/attention', {
    headers: { Cookie: cookieHeader(ownerCookies) },
  });
  assert(attRes2.ok, `attention re-fetch failed: ${attRes2.status}`);
  const allAfter = flattenAttention({
    alerts: Array.isArray(attention2?.alerts) ? attention2.alerts : [],
    staffing: Array.isArray(attention2?.staffing) ? attention2.staffing : [],
  });
  const afterIds = new Set(allAfter.map((i) => i.id));
  assert(!afterIds.has(snoozeTarget.id), `snoozed item still present: ${snoozeTarget.id}`);
  assert(!afterIds.has(handledTarget.id), `handled item still present: ${handledTarget.id}`);
  report.push(`actions.removed=[${snoozeTarget.id},${handledTarget.id}]`);

  // 8) Sitter/client access checks
  for (const role of ['sitter', 'client'] as const) {
    const roleCookies = await login(role);
    const apiRes = await fetch(joinUrl('/api/ops/command-center/attention'), {
      headers: { Cookie: cookieHeader(roleCookies) },
      redirect: 'manual',
    });
    assert([401, 403].includes(apiRes.status), `${role} API access expected 401/403, got ${apiRes.status}`);

    const pageRes = await fetch(joinUrl('/command-center'), {
      headers: { Cookie: cookieHeader(roleCookies) },
      redirect: 'manual',
    });
    assert(
      [302, 307, 403, 404].includes(pageRes.status),
      `${role} page access expected blocked status (302/307/403/404), got ${pageRes.status}`
    );
    report.push(`${role}.apiStatus=${apiRes.status}`);
    report.push(`${role}.pageStatus=${pageRes.status}`);
  }

  console.log('=== Command Center Verification Report ===');
  for (const line of report) console.log(line);
  console.log('RESULT: PASS');
}

run().catch((error) => {
  console.error('RESULT: FAIL');
  console.error((error as Error).message);
  process.exit(1);
});

