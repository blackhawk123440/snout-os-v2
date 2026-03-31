import { NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';

/**
 * GET /api/sitter/calendar
 * Returns upcoming bookings for the current sitter. Requires SITTER role.
 */
export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter profile missing on session' }, { status: 403 });
  }

  try {
    const db = getScopedDb(ctx);
    const now = new Date();
    const bookings = await db.booking.findMany({
      where: {
        sitterId: ctx.sitterId,
        status: { in: ['confirmed', 'pending', 'in_progress'] },
        startAt: { gte: now },
      },
      include: {
        pets: { select: { id: true, name: true, species: true } },
        client: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startAt: 'asc' },
      take: 50,
    });

    const threadMap = new Map<string, string>();
    if (bookings.length > 0) {
      const threads = await db.messageThread.findMany({
        where: {
          bookingId: { in: bookings.map((b) => b.id) },
          assignedSitterId: ctx.sitterId,
        },
        select: { id: true, bookingId: true },
      });
      for (const t of threads) {
        if (t.bookingId) threadMap.set(t.bookingId, t.id);
      }
    }

    const payload = bookings.map((b) => ({
      id: b.id,
      status: b.status,
      service: b.service,
      startAt: typeof b.startAt === 'object' ? (b.startAt as Date).toISOString() : b.startAt,
      endAt: typeof b.endAt === 'object' ? (b.endAt as Date).toISOString() : b.endAt,
      address: b.address,
      clientName:
        `${b.client?.firstName || ''} ${b.client?.lastName || ''}`.trim() || 'Client',
      pets: b.pets,
      threadId: threadMap.get(b.id) ?? null,
    }));

    return NextResponse.json({ bookings: payload });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load calendar', message },
      { status: 500 }
    );
  }
}
