/**
 * GET /api/realtime/messages/threads/[id]
 * SSE stream for message thread updates. Requires auth, org scoping, thread membership.
 */

import { NextRequest } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit';
import { createSSEResponse, sendSSEEvent } from '@/lib/realtime/sse';
import { subscribe, channels } from '@/lib/realtime/bus';
import { getRequestContext } from '@/lib/request-context';
import { assertMessagingThreadAccess, asMessagingActorRole } from '@/lib/messaging/send';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const threadId = params.id;

  const id = getRateLimitIdentifier(request);
  const rl = await checkRateLimit(id, {
    keyPrefix: 'sse-connect',
    limit: 10,
    windowSec: 60,
  });
  if (!rl.success) {
    return new Response(
      JSON.stringify({ error: 'Too many connections', retryAfter: rl.retryAfter }),
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
    );
  }

  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const orgId = ctx.orgId;

  const db = getScopedDb({ orgId });
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
    return new Response(JSON.stringify({ error: 'Thread not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const role = asMessagingActorRole(ctx.role);
  if (!role) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    assertMessagingThreadAccess(
      thread,
      { role, userId: ctx.userId, sitterId: ctx.sitterId, clientId: ctx.clientId },
      false
    );
  } catch {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const channel = channels.messagesThread(orgId, threadId);

  return createSSEResponse({
    initial: { type: 'connected', threadId, ts: Date.now() },
    onConnect(controller) {
      return subscribe(channel, (payload) => {
        try {
          sendSSEEvent(controller, payload, 'update');
        } catch {
          // Client disconnected
        }
      });
    },
  });
}
