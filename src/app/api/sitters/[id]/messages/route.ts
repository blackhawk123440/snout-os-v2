/**
 * Sitter Messages API
 *
 * GET: Fetch threads for a specific sitter (sitter-scoped inbox)
 * Returns threads where sitterId === sitterId (enterprise schema: Thread)
 * Owner can view sitter's inbox via this endpoint (read-only visibility)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const resolvedParams = await params;
  const sitterId = resolvedParams.id;

  if (ctx.role === 'sitter' && ctx.sitterId !== sitterId) {
    return NextResponse.json(
      { error: 'Forbidden: You can only view your own messages' },
      { status: 403 }
    );
  }

  try {
    const db = getScopedDb({ orgId: ctx.orgId });
    const threads = await db.messageThread.findMany({
      where: {
        assignedSitterId: sitterId,
        status: { notIn: ['closed', 'archived'] },
      },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
        messageNumber: {
          select: { id: true, e164: true, numberClass: true },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, direction: true, body: true, createdAt: true, actorType: true },
        },
        assignmentWindows: {
          where: { endAt: { gte: new Date() } },
          orderBy: { startAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const transformedThreads = threads.map((thread: any) => ({
      id: thread.id,
      clientName: `${thread.client?.firstName ?? ''} ${thread.client?.lastName ?? ''}`.trim() || 'Unknown Client',
      bookingId: thread.bookingId ?? null,
      booking: thread.bookingId ? { id: thread.bookingId } : null,
      lastMessage: thread.events?.[0]
        ? {
            id: thread.events[0].id,
            body: thread.events[0].body,
            direction: thread.events[0].direction,
            createdAt: thread.events[0].createdAt.toISOString(),
            actorType: thread.events[0].actorType,
          }
        : null,
      lastMessageAt: thread.lastMessageAt?.toISOString() ?? thread.createdAt.toISOString(),
      hasActiveWindow: (thread.assignmentWindows?.length ?? 0) > 0,
      maskedNumber: thread.messageNumber?.e164 ?? null,
      status: thread.status,
    }));

    return NextResponse.json({
      threads: transformedThreads,
      count: transformedThreads.length,
    });
  } catch (error: any) {
    console.error('[Sitter Messages API] Failed to fetch threads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sitter messages', message: error?.message },
      { status: 500 }
    );
  }
}
