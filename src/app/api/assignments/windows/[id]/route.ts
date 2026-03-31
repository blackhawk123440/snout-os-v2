import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }

  const params = await context.params;
  const windowId = params.id;
  const db = getScopedDb({ orgId: ctx.orgId });
  try {
    const existing = await db.assignmentWindow.findFirst({
      where: { id: windowId, orgId: ctx.orgId },
      select: { id: true, startAt: true, endAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Window not found' }, { status: 404 });
    }
    await db.assignmentWindow.delete({ where: { id: windowId } });
    const now = new Date();
    const wasActive = existing.startAt <= now && existing.endAt >= now;
    return NextResponse.json({ success: true, wasActive, message: 'Assignment window deleted' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete window' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }
  const params = await context.params;
  const payload = await request.json().catch(() => null);
  const db = getScopedDb({ orgId: ctx.orgId });
  try {
    const existing = await db.assignmentWindow.findFirst({
      where: { id: params.id, orgId: ctx.orgId },
      include: {
        thread: { include: { client: { select: { id: true, firstName: true, lastName: true } } } },
        sitter: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Window not found' }, { status: 404 });
    }
    const startAt = payload?.startsAt ? new Date(payload.startsAt) : existing.startAt;
    const endAt = payload?.endsAt ? new Date(payload.endsAt) : existing.endAt;
    if (!(startAt < endAt)) {
      return NextResponse.json({ error: 'startsAt must be before endsAt' }, { status: 400 });
    }
    const updated = await db.assignmentWindow.update({
      where: { id: existing.id },
      data: {
        sitterId: payload?.sitterId ?? existing.sitterId,
        bookingId: payload?.bookingRef ?? existing.bookingId,
        startAt,
        endAt,
      },
      include: { sitter: { select: { id: true, firstName: true, lastName: true } } },
    });
    return NextResponse.json({
      id: updated.id,
      threadId: updated.threadId,
      sitterId: updated.sitterId,
      startsAt: updated.startAt.toISOString(),
      endsAt: updated.endAt.toISOString(),
      bookingRef: updated.bookingId,
      status: updated.startAt > new Date() ? 'future' : updated.endAt < new Date() ? 'past' : 'active',
      thread: {
        id: existing.thread.id,
        client: {
          id: existing.thread.client?.id ?? '',
          name: `${existing.thread.client?.firstName ?? ''} ${existing.thread.client?.lastName ?? ''}`.trim() || 'Unknown',
        },
      },
      sitter: {
        id: updated.sitter.id,
        name: `${updated.sitter.firstName} ${updated.sitter.lastName}`.trim(),
      },
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update window' }, { status: 500 });
  }
}
