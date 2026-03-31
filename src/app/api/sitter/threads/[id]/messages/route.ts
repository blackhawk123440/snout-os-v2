/**
 * Sitter Thread Messages Route
 * 
 * GET /api/sitter/threads/:id/messages - Get messages
 * POST /api/sitter/threads/:id/messages - Send message
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { sendThreadMessage, assertMessagingThreadAccess, asMessagingActorRole } from '@/lib/messaging/send';

function mapEvent(ev: any) {
  return {
    id: ev.id,
    threadId: ev.threadId,
    direction: ev.direction,
    senderType: ev.actorType,
    senderId: ev.actorUserId ?? null,
    body: ev.body,
    redactedBody: null,
    hasPolicyViolation: false,
    createdAt: ev.createdAt,
    deliveries: [
      {
        id: ev.id,
        attemptNo: ev.attemptCount ?? 1,
        status: ev.deliveryStatus,
        providerErrorCode: ev.providerErrorCode ?? ev.failureCode ?? null,
        providerErrorMessage: ev.providerErrorMessage ?? ev.failureDetail ?? null,
        createdAt: ev.createdAt,
      },
    ],
    policyViolations: [],
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'sitter' || !ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter access required' }, { status: 403 });
  }
  const params = await context.params;
  const threadId = params.id;

  try {
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

    if (!thread || thread.orgId !== ctx.orgId) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }
    const role = asMessagingActorRole(ctx.role);
    if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
      assertMessagingThreadAccess(
        thread,
        { role, userId: ctx.userId, sitterId: ctx.sitterId, clientId: ctx.clientId },
        false
      );
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const messages = await db.messageEvent.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(messages.map((ev) => mapEvent(ev)), { status: 200 });
  } catch (error: any) {
    console.error('[Sitter Messages GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'sitter' || !ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter access required' }, { status: 403 });
  }
  const params = await context.params;
  const threadId = params.id;

  let body: { body: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const messageBody = body.body?.trim();
  if (!messageBody) {
    return NextResponse.json(
      { error: 'Message body is required' },
      { status: 400 }
    );
  }

  try {
    const result = await sendThreadMessage({
      orgId: ctx.orgId,
      threadId,
      actor: {
        role: 'sitter',
        userId: ctx.userId,
        sitterId: ctx.sitterId,
      },
      body: messageBody,
      correlationId: ctx.correlationId,
    });
    if (result.deliveryStatus === 'failed') {
      return NextResponse.json(
        {
          messageId: result.event.id,
          error: result.providerErrorMessage || 'Failed to send message',
          errorCode: result.providerErrorCode,
          twilioError: { code: result.providerErrorCode, message: result.providerErrorMessage },
        },
        { status: 500 }
      );
    }
    return NextResponse.json({
      messageId: result.event.id,
      providerMessageSid: result.providerMessageSid,
    }, { status: 200 });

  } catch (error: any) {
    const msg = String(error?.message ?? '');
    if (msg.startsWith('Forbidden')) return NextResponse.json({ error: msg, code: 'WINDOW_NOT_ACTIVE' }, { status: 403 });
    if (msg.includes('not found')) return NextResponse.json({ error: msg }, { status: 404 });
    if (msg.includes('required') || msg.includes('empty')) return NextResponse.json({ error: msg }, { status: 400 });
    console.error('[Sitter Send] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send message', details: error.message },
      { status: 500 }
    );
  }
}
