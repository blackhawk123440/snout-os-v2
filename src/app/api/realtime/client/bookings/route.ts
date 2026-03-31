/**
 * GET /api/realtime/client/bookings
 *
 * SSE stream for client-facing booking updates:
 * - Visit started (sitter checked in)
 * - Visit completed (sitter checked out)
 * - Report posted
 * - Sitter changed
 * - Running late
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getSessionSafe } from '@/lib/auth-helpers';
import { subscribe, channels } from '@/lib/realtime/bus';
import { createSSEResponse, sendSSEEvent } from '@/lib/realtime/sse';

export async function GET() {
  const session = await getSessionSafe();
  if (!session?.user?.id || !session.user.clientId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const orgId = session.user.orgId ?? 'default';
  const clientId = session.user.clientId;

  return createSSEResponse({
    initial: { type: 'connected', ts: Date.now() },
    onConnect(ctrl) {
      const unsub = subscribe(
        channels.clientBooking(orgId, clientId),
        (payload) => {
          try { sendSSEEvent(ctrl, payload, 'update'); } catch { /* client disconnected */ }
        }
      );
      return typeof unsub === 'function' ? unsub : () => {};
    },
  });
}
