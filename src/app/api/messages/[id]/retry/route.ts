/**
 * Retry Message Route
 *
 * POST /api/messages/[id]/retry
 * When NEXT_PUBLIC_API_URL is set: proxies to NestJS API.
 * Otherwise: re-sends via provider, updates MessageEvent, logs EventLog.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { asMessagingActorRole, retryThreadMessage } from '@/lib/messaging/send';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const messageId = params.id;
  let ctx;
  try {
    ctx = await getRequestContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const role = asMessagingActorRole(ctx.role);
    if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const result = await retryThreadMessage({
      orgId: ctx.orgId,
      messageId,
      actor: {
        role,
        userId: ctx.userId,
        sitterId: ctx.sitterId,
        clientId: ctx.clientId,
      },
      correlationId: ctx.correlationId,
    });
    return NextResponse.json(
      { success: result.success, attemptNo: result.attemptNo },
      {
        status: 200,
        headers: { 'X-Snout-Route': 'prisma', 'X-Snout-OrgId': ctx.orgId },
      }
    );
  } catch (error: any) {
    const msg = String(error?.message ?? '');
    if (msg.includes('not found')) return NextResponse.json({ error: msg }, { status: 404 });
    if (msg.includes('already')) return NextResponse.json({ error: msg }, { status: 409 });
    if (msg.startsWith('Forbidden')) return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg || 'Failed to retry message' }, { status: 400 });
  }
}
