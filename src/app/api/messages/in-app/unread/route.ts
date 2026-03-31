/**
 * In-App Unread Message Count API
 *
 * GET /api/messages/in-app/unread - Returns unread in-app message count
 *   for the current user across all threads.
 *
 * "Unread" is defined as in-app messages NOT sent by the current user,
 * received after the thread's last mark-read timestamp (approximated
 * by ownerUnreadCount > 0 for owners, or messages directed inbound
 * for clients/sitters).
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb({ orgId: ctx.orgId });

    // Build a thread filter based on the user's role so we only count
    // threads the user participates in.
    const threadWhere: Record<string, unknown> = {};
    if (ctx.role === 'client' && ctx.clientId) {
      threadWhere.clientId = ctx.clientId;
    } else if (ctx.role === 'sitter' && ctx.sitterId) {
      threadWhere.assignedSitterId = ctx.sitterId;
    }
    // owners/admins see all threads (no additional filter)

    const threads = await db.messageThread.findMany({
      where: threadWhere,
      select: { id: true },
    });

    if (threads.length === 0) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const threadIds = threads.map((t: any) => t.id);

    // Count in-app messages in those threads that were NOT sent by the current user.
    // This provides a simple unread approximation without a dedicated read-cursor table.
    const unreadCount = await db.messageEvent.count({
      where: {
        threadId: { in: threadIds },
        metadataJson: { contains: '"channel":"in_app"' },
        ...(ctx.userId ? { NOT: { actorUserId: ctx.userId } } : {}),
      },
    });

    return NextResponse.json({ unreadCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to count unread messages', message }, { status: 500 });
  }
}
