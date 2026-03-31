/**
 * In-App Chat Channel API
 *
 * GET  /api/messages/in-app?threadId=... - Returns in-app messages for a thread
 * POST /api/messages/in-app              - Sends an in-app message
 *
 * Uses the existing MessageEvent infrastructure with metadataJson
 * to store channel information ({ channel: "in_app" }).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { publish } from '@/lib/realtime/bus';

function deriveActorType(ctx: { role: string; sitterId: string | null; clientId: string | null }): string {
  if (ctx.role === 'client' && ctx.clientId) return 'client';
  if (ctx.role === 'sitter' && ctx.sitterId) return 'sitter';
  return 'owner';
}

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get('threadId');

  if (!threadId) {
    return NextResponse.json({ error: 'threadId query parameter is required' }, { status: 400 });
  }

  try {
    const db = getScopedDb({ orgId: ctx.orgId });

    // Verify thread exists and belongs to this org
    const thread = await db.messageThread.findFirst({
      where: { id: threadId },
      select: { id: true },
    });

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Fetch all message events for this thread, then filter in-app ones
    const events = await db.messageEvent.findMany({
      where: {
        threadId,
        metadataJson: { contains: '"channel":"in_app"' },
      },
      orderBy: { createdAt: 'asc' },
    });

    const messages = events.map((ev: any) => ({
      id: ev.id,
      threadId: ev.threadId,
      direction: ev.direction,
      senderType: ev.actorType,
      senderId: ev.actorUserId,
      body: ev.body,
      deliveryStatus: ev.deliveryStatus,
      createdAt: ev.createdAt instanceof Date ? ev.createdAt.toISOString() : ev.createdAt,
    }));

    return NextResponse.json({ messages });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load in-app messages', message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { threadId?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const threadId = body.threadId?.trim();
  const messageBody = body.body?.trim();

  if (!threadId || !messageBody) {
    return NextResponse.json({ error: 'threadId and body are required' }, { status: 400 });
  }

  try {
    const db = getScopedDb({ orgId: ctx.orgId });

    // Verify thread exists
    const thread = await db.messageThread.findFirst({
      where: { id: threadId },
      select: { id: true },
    });

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const actorType = deriveActorType(ctx);
    const metadata = JSON.stringify({ channel: 'in_app' });

    const event = await db.messageEvent.create({
      data: {
        threadId,
        orgId: ctx.orgId,
        direction: 'outbound',
        actorType,
        actorUserId: ctx.userId,
        body: messageBody,
        deliveryStatus: 'delivered',
        metadataJson: metadata,
      },
    });

    // Update thread timestamps
    await db.messageThread.update({
      where: { id: threadId },
      data: {
        lastMessageAt: new Date(),
        lastOutboundAt: new Date(),
      },
    });

    // Publish realtime update (fire-and-forget)
    publish(`org:${ctx.orgId}:messages:thread:${threadId}`, {
      type: 'in_app_message',
      threadId,
      messageId: event.id,
      senderType: actorType,
      senderId: ctx.userId,
      body: messageBody,
      createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : event.createdAt,
    }).catch(() => {});

    return NextResponse.json(
      {
        messageId: event.id,
        threadId,
        senderType: actorType,
        deliveryStatus: 'delivered',
        createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : event.createdAt,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to send in-app message', message }, { status: 500 });
  }
}
