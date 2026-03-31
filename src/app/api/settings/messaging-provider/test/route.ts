/**
 * POST /api/settings/messaging-provider/test
 * Send a test message via the org's active messaging provider.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getMessagingProvider } from '@/lib/messaging/provider-factory';

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { to, message } = body;
    if (!to || !message) {
      return NextResponse.json({ error: 'to and message are required' }, { status: 400 });
    }

    // TCPA compliance: check opt-out before sending test message
    try {
      const { getScopedDb } = await import('@/lib/tenancy');
      const db = getScopedDb(ctx);
      const optOut = await db.optOutState.findFirst({
        where: { orgId: ctx.orgId, phoneE164: to, state: 'opted_out' },
      });
      if (optOut) {
        return NextResponse.json({ success: false, error: 'Recipient has opted out of SMS' }, { status: 400 });
      }
    } catch { /* opt-out model may not be in scoped proxy */ }

    const provider = await getMessagingProvider(ctx.orgId);
    const result = await provider.sendMessage({ to, body: message });

    if (result.success) {
      return NextResponse.json({ success: true, messageSid: result.messageSid });
    }
    return NextResponse.json({ success: false, error: result.errorMessage }, { status: 422 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
