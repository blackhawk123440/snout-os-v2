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
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }

  const db = getScopedDb({ orgId: ctx.orgId });
  try {
    const threadId = request.nextUrl.searchParams.get('threadId') ?? undefined;
    const sitterId = request.nextUrl.searchParams.get('sitterId') ?? undefined;
    const status = request.nextUrl.searchParams.get('status') ?? undefined;

    const rows = await db.assignmentWindow.findMany({
      where: {
        orgId: ctx.orgId,
        ...(threadId ? { threadId } : {}),
        ...(sitterId ? { sitterId } : {}),
        ...(status === 'active'
          ? { startAt: { lte: new Date() }, endAt: { gte: new Date() } }
          : status === 'future'
            ? { startAt: { gt: new Date() } }
            : status === 'past'
              ? { endAt: { lt: new Date() } }
              : {}),
      },
      include: {
        thread: { include: { client: { select: { id: true, firstName: true, lastName: true } } } },
        sitter: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    return NextResponse.json(
      rows.map((w) => ({
        id: w.id,
        threadId: w.threadId,
        sitterId: w.sitterId,
        startsAt: w.startAt.toISOString(),
        endsAt: w.endAt.toISOString(),
        bookingRef: w.bookingId,
        status: w.startAt > new Date() ? 'future' : w.endAt < new Date() ? 'past' : 'active',
        thread: {
          id: w.thread.id,
          client: {
            id: w.thread.client?.id ?? '',
            name: `${w.thread.client?.firstName ?? ''} ${w.thread.client?.lastName ?? ''}`.trim() || 'Unknown',
          },
        },
        sitter: {
          id: w.sitter.id,
          name: `${w.sitter.firstName} ${w.sitter.lastName}`.trim(),
        },
      })),
      { status: 200, headers: { 'X-Snout-Route': 'prisma', 'X-Snout-OrgId': ctx.orgId } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load windows' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body?.threadId || !body?.sitterId || !body?.startsAt || !body?.endsAt) {
    return NextResponse.json({ error: 'threadId, sitterId, startsAt, endsAt are required' }, { status: 400 });
  }
  const db = getScopedDb({ orgId: ctx.orgId });
  try {
    const startAt = new Date(body.startsAt);
    const endAt = new Date(body.endsAt);
    if (!(startAt < endAt)) {
      return NextResponse.json({ error: 'startsAt must be before endsAt' }, { status: 400 });
    }
    const thread = await db.messageThread.findFirst({
      where: { id: body.threadId, orgId: ctx.orgId },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const overlapping = await db.assignmentWindow.findFirst({
      where: {
        orgId: ctx.orgId,
        threadId: body.threadId,
        OR: [
          { startAt: { lte: startAt }, endAt: { gt: startAt } },
          { startAt: { lt: endAt }, endAt: { gte: endAt } },
          { startAt: { gte: startAt }, endAt: { lte: endAt } },
        ],
      },
    });
    if (overlapping) {
      return NextResponse.json({ error: 'assignment overlap conflict detected' }, { status: 409 });
    }

    const created = await db.assignmentWindow.create({
      data: {
        orgId: ctx.orgId,
        threadId: body.threadId,
        sitterId: body.sitterId,
        bookingId: body.bookingRef || thread.bookingId || `manual-${thread.id}`,
        startAt,
        endAt,
        status: 'active',
      },
      include: {
        sitter: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    await db.messageThread.update({
      where: { id: thread.id },
      data: { assignedSitterId: created.sitterId, assignmentWindowId: created.id },
    });
    return NextResponse.json({
      id: created.id,
      threadId: created.threadId,
      sitterId: created.sitterId,
      startsAt: created.startAt.toISOString(),
      endsAt: created.endAt.toISOString(),
      status: created.startAt > new Date() ? 'future' : created.endAt < new Date() ? 'past' : 'active',
      thread: {
        id: thread.id,
        client: {
          id: thread.client?.id ?? '',
          name: `${thread.client?.firstName ?? ''} ${thread.client?.lastName ?? ''}`.trim() || 'Unknown',
        },
      },
      sitter: {
        id: created.sitter.id,
        name: `${created.sitter.firstName} ${created.sitter.lastName}`.trim(),
      },
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create assignment window' }, { status: 500 });
  }
}
