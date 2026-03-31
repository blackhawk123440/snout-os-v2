/**
 * Get Messages for Thread Route
 *
 * GET /api/messages/threads/[id]/messages
 * When NEXT_PUBLIC_API_URL is set: proxies to NestJS API.
 * Otherwise: reads from Prisma MessageEvent (source of truth).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit';
import { getRequestContext } from '@/lib/request-context';
import { sendThreadMessage, assertMessagingThreadAccess, asMessagingActorRole, type MessageIntakeStepProfile } from '@/lib/messaging/send';
import { getOutboundQueuePressure, isOutboundQueueAvailable } from '@/lib/messaging/outbound-queue';
import { parseDate, parsePage, parsePageSize } from '@/lib/pagination';

/** Map MessageEvent to Message shape expected by InboxView (deliveries array) */
function messageEventToMessage(ev: {
  id: string;
  threadId: string;
  direction: string;
  actorType: string;
  actorUserId: string | null;
  body: string;
  deliveryStatus: string;
  providerMessageSid: string | null;
  failureCode: string | null;
  failureDetail: string | null;
  providerErrorCode: string | null;
  providerErrorMessage: string | null;
  routingDisposition: string;
  createdAt: Date;
}) {
  const delivery = {
    id: ev.id,
    attemptNo: 1,
    status: ev.deliveryStatus as 'queued' | 'sent' | 'delivered' | 'failed',
    providerErrorCode: ev.providerErrorCode ?? ev.failureCode,
    providerErrorMessage: ev.providerErrorMessage ?? ev.failureDetail,
    createdAt: ev.createdAt.toISOString(),
  };
  return {
    id: ev.id,
    threadId: ev.threadId,
    direction: ev.direction as 'inbound' | 'outbound',
    senderType: ev.actorType as 'client' | 'sitter' | 'owner' | 'system' | 'automation',
    senderId: ev.actorUserId,
    body: ev.body,
    redactedBody: null as string | null,
    hasPolicyViolation: false,
    routingDisposition: ev.routingDisposition ?? 'normal',
    createdAt: ev.createdAt.toISOString(),
    deliveries: [delivery],
    policyViolations: [],
  };
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const MESSAGE_ACCEPT_RATE_LIMIT_PER_MINUTE = Number(process.env.MESSAGE_ACCEPT_RATE_LIMIT_PER_MINUTE || "6000");
const MESSAGE_FRONTDOOR_MAX_INFLIGHT = Number(process.env.MESSAGE_FRONTDOOR_MAX_INFLIGHT || "120");
const MESSAGE_FRONTDOOR_PRESSURE_CHECK_INFLIGHT = Number(process.env.MESSAGE_FRONTDOOR_PRESSURE_CHECK_INFLIGHT || "80");
const MESSAGE_FRONTDOOR_SHED_QUEUE_WAITING_THRESHOLD = Number(process.env.MESSAGE_FRONTDOOR_SHED_QUEUE_WAITING_THRESHOLD || "320");
const MESSAGE_FRONTDOOR_SHED_QUEUE_ACTIVE_THRESHOLD = Number(process.env.MESSAGE_FRONTDOOR_SHED_QUEUE_ACTIVE_THRESHOLD || "24");
const MESSAGE_FRONTDOOR_PREHANDOFF_BUDGET_MS = Number(process.env.MESSAGE_FRONTDOOR_PREHANDOFF_BUDGET_MS || "2200");
let messagePostInFlight = 0;

function overloadResponse(reason: string, retryAfterSec = 1) {
  return NextResponse.json(
    { accepted: false, queued: false, error: 'Message intake overloaded', reason },
    { status: 503, headers: { 'Retry-After': String(retryAfterSec) } }
  );
}

function buildServerTiming(parts: Array<[string, number | undefined]>): string {
  return parts
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => `${k};dur=${Math.max(0, Number(v ?? 0)).toFixed(1)}`)
    .join(', ');
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const threadId = params.id;
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = getScopedDb({ orgId: ctx.orgId });
  const thread = await db.messageThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      orgId: true,
      clientId: true,
      assignedSitterId: true,
      assignmentWindows: {
        where: { startAt: { lte: new Date() }, endAt: { gte: new Date() } },
        orderBy: { startAt: 'desc' },
        take: 1,
        select: { id: true, sitterId: true, startAt: true, endAt: true },
      },
    },
  });

  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  }
  const getRole = asMessagingActorRole(ctx.role);
  if (!getRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    assertMessagingThreadAccess(
      thread,
      { role: getRole, userId: ctx.userId, sitterId: ctx.sitterId, clientId: ctx.clientId },
      false
    );
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = (request as NextRequest).nextUrl ?? new URL(request.url);
  const paramsSearch = url.searchParams;
  const page = parsePage(paramsSearch.get('page'), 1);
  const pageSize = parsePageSize(paramsSearch.get('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const from = parseDate(paramsSearch.get('from'));
  const to = parseDate(paramsSearch.get('to'));
  const direction = paramsSearch.get('direction');

  const where: Record<string, any> = { threadId };
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }
  if (direction === 'inbound' || direction === 'outbound') {
    where.direction = direction;
  }

  const [total, events] = await Promise.all([
    db.messageEvent.count({ where }),
    db.messageEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const messages = events.map((ev) => messageEventToMessage(ev)).reverse();

  return NextResponse.json(
    {
      items: messages,
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      sort: { field: 'createdAt', direction: 'desc' },
      filters: {
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
        direction: direction ?? null,
      },
    },
    {
      status: 200,
      headers: { 'X-Snout-Route': 'prisma', 'X-Snout-OrgId': ctx.orgId },
    }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  const wantProfile = request.headers.get('x-message-intake-profile') === '1';
  const profile: MessageIntakeStepProfile = {};
  const params = await context.params;
  const threadId = params.id;

  if (!isOutboundQueueAvailable()) {
    return overloadResponse('queue_unavailable', 2);
  }

  if (messagePostInFlight >= Math.max(1, MESSAGE_FRONTDOOR_MAX_INFLIGHT)) {
    return overloadResponse('inflight_limit', 1);
  }

  if (messagePostInFlight >= Math.max(1, MESSAGE_FRONTDOOR_PRESSURE_CHECK_INFLIGHT)) {
    const pressure = await getOutboundQueuePressure();
    if (
      pressure.available &&
      pressure.waiting >= Math.max(1, MESSAGE_FRONTDOOR_SHED_QUEUE_WAITING_THRESHOLD) &&
      pressure.active >= Math.max(1, MESSAGE_FRONTDOOR_SHED_QUEUE_ACTIVE_THRESHOLD)
    ) {
      return overloadResponse('queue_pressure', 2);
    }
  }

  messagePostInFlight += 1;
  try {
  const authStartedAt = Date.now();
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const authMs = Date.now() - authStartedAt;

  const id = getRateLimitIdentifier(request);
  const scopedIdentifier = ctx.userId ? `${id}:${ctx.orgId}:${ctx.userId}` : id;
  const rateLimitStartedAt = Date.now();
  const rl = await checkRateLimit(scopedIdentifier, {
    keyPrefix: 'messages-accept',
    limit: Math.max(300, MESSAGE_ACCEPT_RATE_LIMIT_PER_MINUTE),
    windowSec: 60,
  });
  const rateLimitMs = Date.now() - rateLimitStartedAt;
  if (!rl.success) {
    return NextResponse.json(
      { accepted: false, queued: false, error: 'Too many requests', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
    );
  }

  let body: { body: string; forceSend?: boolean };
  const parseBodyStartedAt = Date.now();
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { accepted: false, queued: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
  const parseBodyMs = Date.now() - parseBodyStartedAt;

  const messageBody = body.body?.trim();
  if (!messageBody) {
    return NextResponse.json(
      { accepted: false, queued: false, error: 'Message body cannot be empty' },
      { status: 400 }
    );
  }

  if (Date.now() - startedAt > Math.max(300, MESSAGE_FRONTDOOR_PREHANDOFF_BUDGET_MS)) {
    return overloadResponse('prehandoff_budget_exhausted', 1);
  }

  try {
    const sendStartedAt = Date.now();
    const role = asMessagingActorRole(ctx.role);
    if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const idempotencyKey = request.headers.get('Idempotency-Key') ?? request.headers.get('idempotency-key') ?? undefined;
    const result = await sendThreadMessage({
      orgId: ctx.orgId,
      threadId,
      actor: {
        role,
        userId: ctx.userId,
        sitterId: ctx.sitterId,
        clientId: ctx.clientId,
      },
      body: messageBody,
      forceSend: body.forceSend,
      idempotencyKey,
      intakeProfile: profile,
    });
    const sendMs = Date.now() - sendStartedAt;

    const response = NextResponse.json(
      {
        accepted: result.accepted,
        queued: result.queued,
        replay: result.replay,
        messageId: result.event.id,
        messageEventId: result.messageEventId,
        providerMessageSid: result.providerMessageSid,
        hasPolicyViolation: false,
        handoff: result.handoffMeta?.mode ?? (result.queued ? 'async' : 'sync'),
        handoffMeta: result.handoffMeta ?? null,
      },
      {
        status: result.accepted ? (result.queued ? 202 : 200) : 503,
        headers: { 'X-Snout-Route': 'prisma', 'X-Snout-OrgId': ctx.orgId },
      }
    );
    if (wantProfile) {
      const serverTiming = buildServerTiming([
        ['auth', authMs],
        ['rate_limit', rateLimitMs],
        ['parse_body', parseBodyMs],
        ['thread_lookup', profile.threadLookupMs],
        ['idempotency', profile.idempotencyLookupMs],
        ['queue_probe', profile.queuePressureProbeMs],
        ['provider_probe', profile.providerPressureProbeMs],
        ['persist', profile.intentPersistMs],
        ['thread_update', profile.threadUpdateMs],
        ['enqueue', profile.enqueueMs],
        ['send_total', sendMs],
        ['total', Date.now() - startedAt],
      ]);
      if (serverTiming) {
        response.headers.set('Server-Timing', serverTiming);
      }
    }
    return response;
  } catch (error: any) {
    const message = String(error?.message ?? '');
    if (message.startsWith('Forbidden')) {
      return NextResponse.json({ accepted: false, queued: false, error: message }, { status: 403 });
    }
    if (message.includes('not found')) {
      return NextResponse.json({ accepted: false, queued: false, error: message }, { status: 404 });
    }
    if (message.includes('cannot be empty') || message.includes('contact') || message.includes('no client')) {
      return NextResponse.json({ accepted: false, queued: false, error: message }, { status: 400 });
    }
    if (message.includes('idempotency key reused')) {
      return NextResponse.json({ accepted: false, queued: false, error: message }, { status: 409 });
    }
    if (message.includes('queue unavailable') || message.includes('queue enqueue failed')) {
      return NextResponse.json(
        { accepted: false, queued: false, error: 'Message handoff unavailable', reason: message },
        { status: 503 }
      );
    }
    console.error('[Messaging Send] Error:', error);
    return NextResponse.json(
      { accepted: false, queued: false, error: 'Failed to send message', details: error.message },
      { status: 500 }
    );
  }
  } finally {
    messagePostInFlight = Math.max(0, messagePostInFlight - 1);
  }
}
