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
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }
  const db = getScopedDb({ orgId: ctx.orgId });
  const windows = await db.assignmentWindow.findMany({
    where: { orgId: ctx.orgId },
    include: {
      thread: { include: { client: { select: { id: true, firstName: true, lastName: true } } } },
      sitter: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ threadId: 'asc' }, { startAt: 'asc' }],
  });

  const conflicts: any[] = [];
  for (let i = 0; i < windows.length; i++) {
    for (let j = i + 1; j < windows.length; j++) {
      const a = windows[i];
      const b = windows[j];
      if (a.threadId !== b.threadId) continue;
      if (a.id === b.id) continue;
      const overlapStart = a.startAt > b.startAt ? a.startAt : b.startAt;
      const overlapEnd = a.endAt < b.endAt ? a.endAt : b.endAt;
      if (overlapStart >= overlapEnd) continue;
      conflicts.push({
        conflictId: `${a.id}:${b.id}`,
        windowA: {
          id: a.id,
          threadId: a.threadId,
          sitterId: a.sitterId,
          startsAt: a.startAt.toISOString(),
          endsAt: a.endAt.toISOString(),
          bookingRef: a.bookingId,
          status: a.startAt > new Date() ? 'future' : a.endAt < new Date() ? 'past' : 'active',
          thread: {
            id: a.thread.id,
            client: {
              id: a.thread.client?.id ?? '',
              name: `${a.thread.client?.firstName ?? ''} ${a.thread.client?.lastName ?? ''}`.trim() || 'Unknown',
            },
          },
          sitter: { id: a.sitter.id, name: `${a.sitter.firstName} ${a.sitter.lastName}`.trim() },
        },
        windowB: {
          id: b.id,
          threadId: b.threadId,
          sitterId: b.sitterId,
          startsAt: b.startAt.toISOString(),
          endsAt: b.endAt.toISOString(),
          bookingRef: b.bookingId,
          status: b.startAt > new Date() ? 'future' : b.endAt < new Date() ? 'past' : 'active',
          thread: {
            id: b.thread.id,
            client: {
              id: b.thread.client?.id ?? '',
              name: `${b.thread.client?.firstName ?? ''} ${b.thread.client?.lastName ?? ''}`.trim() || 'Unknown',
            },
          },
          sitter: { id: b.sitter.id, name: `${b.sitter.firstName} ${b.sitter.lastName}`.trim() },
        },
        thread: {
          id: a.thread.id,
          client: {
            id: a.thread.client?.id ?? '',
            name: `${a.thread.client?.firstName ?? ''} ${a.thread.client?.lastName ?? ''}`.trim() || 'Unknown',
          },
        },
        overlapStart: overlapStart.toISOString(),
        overlapEnd: overlapEnd.toISOString(),
      });
    }
  }

  return NextResponse.json(conflicts, {
    status: 200,
    headers: { 'X-Snout-Route': 'prisma', 'X-Snout-OrgId': ctx.orgId },
  });
}

