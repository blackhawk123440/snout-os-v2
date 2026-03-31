import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';
import { sendThreadMessage } from '@/lib/messaging/send';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext(_request);
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const db = getScopedDb(ctx);
  try {
    const thread = await db.messageThread.findFirst({
      where: { id, clientId: ctx.clientId },
      include: {
        sitter: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    let booking = null;
    if (thread?.bookingId) {
      const b = await db.booking.findFirst({
        where: { id: thread.bookingId },
        select: { id: true, service: true, startAt: true },
      });
      booking = b;
    }

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const events = await db.messageEvent.findMany({
      where: { threadId: id },
      select: { id: true, body: true, direction: true, actorType: true, createdAt: true, metadataJson: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    const toIso = (d: Date) => (d instanceof Date ? d.toISOString() : String(d));
    const messages = events.map((e: any) => {
      const meta = e.metadataJson ? (() => { try { return JSON.parse(e.metadataJson); } catch { return null; } })() : null;
      return {
        id: e.id,
        body: e.body,
        direction: e.direction,
        actorType: e.actorType,
        createdAt: toIso(e.createdAt),
        isFromClient: e.actorType === 'client' || e.direction === 'inbound',
        channel: meta?.channel || 'sms',
      };
    });

    return NextResponse.json({
      id: thread.id,
      status: thread.status,
      sitter: thread.sitter
        ? { id: thread.sitter.id, name: [thread.sitter.firstName, thread.sitter.lastName].filter(Boolean).join(' ').trim() || 'Sitter' }
        : null,
      booking: booking
        ? { id: booking.id, service: booking.service, startAt: toIso(booking.startAt) }
        : null,
      messages,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load thread', message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: { body?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const messageBody = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!messageBody) {
    return NextResponse.json({ error: 'Message body cannot be empty' }, { status: 400 });
  }

  const db = getScopedDb(ctx);
  try {
    const thread = await db.messageThread.findFirst({
      where: { id, clientId: ctx.clientId },
    });

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Send via SMS (existing flow)
    const result = await sendThreadMessage({
      orgId: ctx.orgId,
      threadId: id,
      actor: {
        role: 'client',
        userId: ctx.userId,
        clientId: ctx.clientId,
      },
      body: messageBody,
      correlationId: ctx.correlationId,
    });

    // Also create an in-app message event for real-time delivery
    try {
      await (db.messageEvent as any).create({
        data: {
          threadId: id,
          direction: 'outbound',
          actorType: 'client',
          actorUserId: ctx.userId,
          actorClientId: ctx.clientId,
          body: messageBody,
          deliveryStatus: 'delivered',
          metadataJson: JSON.stringify({ channel: 'in_app' }),
        },
      });
    } catch {
      // In-app message creation is non-blocking
    }

    const toIso = (d: Date) => (d instanceof Date ? d.toISOString() : String(d));
    return NextResponse.json({
      id: result.event.id,
      body: result.event.body,
      direction: result.event.direction,
      actorType: result.event.actorType,
      createdAt: result.event.createdAt ? toIso(result.event.createdAt) : new Date().toISOString(),
      isFromClient: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to send message', message },
      { status: 500 }
    );
  }
}
