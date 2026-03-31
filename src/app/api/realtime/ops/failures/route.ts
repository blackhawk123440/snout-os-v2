/**
 * GET /api/realtime/ops/failures
 * SSE stream for ops failures (automation, message, calendar).
 * Requires owner/admin role.
 */

import { NextRequest } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
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
    requireAnyRole(ctx, ['owner', 'admin']);
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

  const channel = channels.opsFailures(ctx.orgId);

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
