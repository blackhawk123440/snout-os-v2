/**
 * Sitter Activity/Logs API
 * GET /api/sitters/:id/activity
 *
 * Returns audit/event stream for Activity tab
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';

/**
 * Get booking IDs for a sitter (for filtering events)
 */
async function getBookingIdsForSitter(db: any, sitterId: string): Promise<string[]> {
  const bookings = await db.booking.findMany({
    where: { sitterId },
    select: { id: true },
  });
  return bookings.map((b: any) => b.id);
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
    const resolvedParams = await params;
    const sitterId = resolvedParams.id;
    const db = getScopedDb(ctx);

    // Fetch events from EventLog model (filtered by sitterId in metadata or bookingId)
    const bookingIds = await getBookingIdsForSitter(db, sitterId);

    const events = await (db as any).eventLog.findMany({
      where: {
        OR: [
          { bookingId: { in: bookingIds } },
          // Include messaging errors for this org (owner-visible)
          {
            eventType: 'messaging.routing_failed',
            metadata: {
              contains: `"orgId":"${ctx.orgId}"`,
            },
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Increased to include messaging errors
    });

    // Filter events that are related to this sitter (check metadata)
    // Also include org-level messaging errors (owner-visible)
    const sitterEvents = events.filter((e: any) => {
      // Include messaging errors for owner visibility
      if (e.eventType === 'messaging.routing_failed') {
        try {
          const metadata = JSON.parse(e.metadata || '{}');
          return metadata.orgId === ctx.orgId;
        } catch {
          return false;
        }
      }

      // Filter by sitterId in metadata
      if (!e.metadata) return false;
      try {
        const metadata = JSON.parse(e.metadata);
        return metadata.sitterId === sitterId;
      } catch {
        return false;
      }
    });

    return NextResponse.json(sitterEvents.map((e: any) => {
      let metadata: any = {};
      try {
        metadata = JSON.parse(e.metadata || '{}');
      } catch {}

      return {
        id: e.id,
        eventType: e.eventType,
        actorType: metadata.actorType || 'system',
        actorId: metadata.actorId || null,
        entityType: metadata.entityType || null,
        entityId: metadata.entityId || null,
        timestamp: e.createdAt.toISOString(),
        payload: metadata,
      };
    }));
  } catch (error: any) {
    console.error('[Activity API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity data', message: error.message },
      { status: 500 }
    );
  }
}
