import { NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';

export async function GET() {
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

  const db = getScopedDb(ctx);
  try {
    const threads = await db.messageThread.findMany({
      where: { orgId: ctx.orgId, clientId: ctx.clientId },
      select: {
        id: true,
        status: true,
        lastMessageAt: true,
        createdAt: true,
        bookingId: true,
        sitter: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
    });

    const threadIds = threads.map((t: any) => t.id);
    const bookingIds = [...new Set(threads.map((t: any) => t.bookingId).filter(Boolean))];
    const [bookings, latestEvents] = await Promise.all([
      bookingIds.length > 0
        ? db.booking.findMany({
            where: { id: { in: bookingIds } },
            select: { id: true, service: true, startAt: true },
          })
        : [],
      threadIds.length > 0
        ? db.messageEvent.findMany({
            where: { threadId: { in: threadIds } },
            select: { threadId: true, body: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          })
        : [],
    ]);
    const bookingMap = Object.fromEntries(bookings.map((b: any) => [b.id, b]));
    const previewByThread: Record<string, string> = {};
    for (const ev of latestEvents) {
      if (ev.threadId && ev.body != null && !(ev.threadId in previewByThread)) {
        previewByThread[ev.threadId] = String(ev.body).trim();
      }
    }

    const toIso = (d: Date | null) => (d instanceof Date ? d.toISOString() : null);
    const payload = threads.map((t: any) => ({
      id: t.id,
      status: t.status,
      lastActivityAt: toIso(t.lastMessageAt) ?? toIso(t.createdAt),
      sitter: t.sitter
        ? { id: t.sitter.id, name: [t.sitter.firstName, t.sitter.lastName].filter(Boolean).join(' ').trim() || 'Sitter' }
        : null,
      booking: t.bookingId && bookingMap[t.bookingId]
        ? { id: bookingMap[t.bookingId].id, service: bookingMap[t.bookingId].service, startAt: toIso(bookingMap[t.bookingId].startAt) }
        : null,
      preview: previewByThread[t.id] ?? null,
    }));

    return NextResponse.json({ threads: payload });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load messages', message },
      { status: 500 }
    );
  }
}
