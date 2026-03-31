/**
 * Send Message Route
 * 
 * POST /api/messages/send
 * Legacy compatibility endpoint. Uses canonical send service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { sendThreadMessage, asMessagingActorRole } from '@/lib/messaging/send';

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const threadId = String(body.threadId ?? '');
    const messageBody = String(body.body ?? body.text ?? '').trim();
    if (!threadId || !messageBody) {
      return NextResponse.json({ error: 'threadId and body are required' }, { status: 400 });
    }
    const role = asMessagingActorRole(ctx.role);
    if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      forceSend: Boolean(body.forceSend),
      correlationId: ctx.correlationId,
    });
    if (result.deliveryStatus === 'failed') {
      return NextResponse.json(
        { messageId: result.event.id, error: result.providerErrorMessage, errorCode: result.providerErrorCode },
        { status: 500 }
      );
    }
    return NextResponse.json({ messageId: result.event.id, providerMessageSid: result.providerMessageSid });
  } catch (error: any) {
    console.error('[messages/send] Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message', message: error.message },
      { status: 500 }
    );
  }
}
