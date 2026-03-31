/**
 * GET /api/realtime/sitter/today
 * SSE stream for sitter Today updates (check-in/out, delight, assignment).
 * Requires sitter role and sitterId.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit';
import { createSSEResponse, sendSSEEvent } from '@/lib/realtime/sse';
import { subscribe, channels } from '@/lib/realtime/bus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
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
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!ctx.sitterId) {
    return new Response(JSON.stringify({ error: 'Sitter profile required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const channel = channels.sitterToday(ctx.orgId, ctx.sitterId);

  return createSSEResponse({
    initial: { type: 'connected', ts: Date.now() },
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
