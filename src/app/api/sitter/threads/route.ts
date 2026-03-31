/**
 * Sitter Threads Route
 * 
 * GET /api/sitter/threads
 * Returns threads for the authenticated sitter with active assignment windows
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'sitter' || !ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter access required' }, { status: 403 });
  }
  const orgId = ctx.orgId;
  const sitterId = ctx.sitterId;
  const now = new Date();

  try {
    // Find threads with active assignment windows for this sitter
    const db = getScopedDb({ orgId });
    const threads = await db.messageThread.findMany({
      where: {
        assignedSitterId: sitterId,
        status: { notIn: ['closed', 'archived'] },
        assignmentWindows: {
          some: {
            sitterId,
            startAt: { lte: now },
            endAt: { gte: now },
          },
        },
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        messageNumber: {
          select: {
            id: true,
            e164: true,
            numberClass: true,
            status: true,
          },
        },
        assignmentWindows: {
          where: {
            sitterId,
            startAt: { lte: now },
            endAt: { gte: now },
          },
          orderBy: { startAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const toIso = (d: Date | null | undefined) => (d instanceof Date ? d.toISOString() : d ? new Date(d).toISOString() : null);

    // Sitter never sees client phone (no contacts included); expose lastActivityAt + ownerUnreadCount; normalize window fields for frontend
    const transformedThreads = threads.map((thread: any) => ({
      ...thread,
      lastActivityAt: toIso(thread.lastMessageAt ?? thread.createdAt) ?? new Date().toISOString(),
      ownerUnreadCount: thread.ownerUnreadCount ?? 0,
      assignmentWindows: (thread.assignmentWindows ?? []).map((w: any) => ({
        id: w.id,
        startsAt: w.startAt,
        endsAt: w.endAt,
      })),
      client: {
        id: thread.client?.id ?? '',
        name: `${thread.client?.firstName ?? ''} ${thread.client?.lastName ?? ''}`.trim() || 'Client',
        contacts: [],
      },
      messageNumber: thread.messageNumber
        ? {
            id: thread.messageNumber.id,
            e164: thread.messageNumber.e164,
            class: thread.messageNumber.numberClass,
            status: thread.messageNumber.status,
          }
        : { id: '', e164: '', class: 'front_desk', status: 'active' },
    }));

    return NextResponse.json(transformedThreads, { status: 200 });
  } catch (error: any) {
    console.error('[Sitter Threads] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch threads', details: error.message },
      { status: 500 }
    );
  }
}
