/**
 * Mark Thread as Read Route
 * 
 * PATCH /api/messages/threads/[id]/mark-read
 * Proxies to NestJS API to mark a thread as read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { assertMessagingThreadAccess, asMessagingActorRole } from '@/lib/messaging/send';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const threadId = params.id;
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = getScopedDb({ orgId: ctx.orgId });
  try {
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
    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
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
    await db.messageThread.update({
      where: { id: threadId },
      data: { ownerUnreadCount: 0 },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Direct Prisma] Error marking thread as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark thread as read', details: error.message },
      { status: 500 }
    );
  }
}
