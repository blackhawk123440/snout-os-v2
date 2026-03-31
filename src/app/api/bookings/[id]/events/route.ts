import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireAnyRole } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

type Item = {
  id: string;
  source: 'status' | 'event';
  type: string;
  status?: string | null;
  message: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const db = getScopedDb(ctx);
    const { searchParams } = new URL(request.url);
    const typeFilter = (searchParams.get('type') || 'all').toLowerCase();

    const [statusHistory, eventLogs] = await Promise.all([
      db.bookingStatusHistory.findMany({
        where: { bookingId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.eventLog.findMany({
        where: { bookingId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    let items: Item[] = [
      ...statusHistory.map((s) => ({
        id: `status:${s.id}`,
        source: 'status' as const,
        type: 'status_change',
        status: s.toStatus,
        message: `${s.fromStatus || 'new'} -> ${s.toStatus}`,
        createdAt: s.createdAt.toISOString(),
        metadata: parseMetadata(s.metadata),
      })),
      ...eventLogs.map((e) => ({
        id: `event:${e.id}`,
        source: 'event' as const,
        type: e.eventType || 'event',
        status: e.status,
        message: e.error || e.eventType || 'Event',
        createdAt: e.createdAt.toISOString(),
        metadata: parseMetadata(e.metadata),
      })),
    ];

    if (typeFilter !== 'all') {
      items = items.filter((i) => i.type.toLowerCase().includes(typeFilter));
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ items: items.slice(0, 50) });
  } catch (error: unknown) {
    console.error('[Booking Events API] Failed to load events:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load events', message }, { status: 500 });
  }
}

