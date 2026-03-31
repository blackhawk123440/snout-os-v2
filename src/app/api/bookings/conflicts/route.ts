/**
 * GET /api/bookings/conflicts
 * Canonical booking conflict list for calendar and command center.
 * Returns booking IDs that have overlapping or insufficient-buffer conflicts.
 * Org-scoped, owner/admin only.
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireAnyRole } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

const TRAVEL_BUFFER_MS = 15 * 60 * 1000; // 15 minutes

function timeRangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && startB < endA;
}

interface ConflictDetail {
  bookingIdA: string;
  bookingIdB: string;
  sitterId: string;
  type: 'overlap' | 'travel_buffer';
  detail?: string;
}

export async function GET() {
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
    const db = getScopedDb(ctx);
    const bookings = await db.booking.findMany({
      where: {
        status: { not: 'cancelled' },
        sitterId: { not: null },
      },
      select: {
        id: true,
        sitterId: true,
        startAt: true,
        endAt: true,
        service: true,
      },
      orderBy: { startAt: 'asc' },
    });

    const conflictIds = new Set<string>();
    const conflicts: ConflictDetail[] = [];

    for (let i = 0; i < bookings.length; i++) {
      const a = bookings[i];
      const sitterA = a.sitterId!;
      const startA = a.startAt instanceof Date ? a.startAt : new Date(a.startAt);
      const endA = a.endAt instanceof Date ? a.endAt : new Date(a.endAt);

      for (let j = i + 1; j < bookings.length; j++) {
        const b = bookings[j];
        if (b.sitterId !== sitterA) continue;
        const startB = b.startAt instanceof Date ? b.startAt : new Date(b.startAt);
        const endB = b.endAt instanceof Date ? b.endAt : new Date(b.endAt);

        // Direct overlap
        if (timeRangesOverlap(startA, endA, startB, endB)) {
          conflictIds.add(a.id);
          conflictIds.add(b.id);
          conflicts.push({
            bookingIdA: a.id,
            bookingIdB: b.id,
            sitterId: sitterA,
            type: 'overlap',
          });
          continue;
        }

        // Travel buffer check: a ends before b starts
        const gapMs = startB.getTime() - endA.getTime();
        if (gapMs >= 0 && gapMs < TRAVEL_BUFFER_MS) {
          conflictIds.add(a.id);
          conflictIds.add(b.id);
          conflicts.push({
            bookingIdA: a.id,
            bookingIdB: b.id,
            sitterId: sitterA,
            type: 'travel_buffer',
            detail: `${Math.round(gapMs / 60000)}min gap (need 15min)`,
          });
        }
      }
    }

    return NextResponse.json(
      {
        conflictBookingIds: Array.from(conflictIds),
        conflicts,
        count: conflictIds.size,
      },
      { status: 200, headers: { 'X-Snout-Route': 'bookings-conflicts', 'X-Snout-OrgId': ctx.orgId } }
    );
  } catch (error: unknown) {
    console.error('[Booking Conflicts API] Failed to load conflicts:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load conflicts', message },
      { status: 500 }
    );
  }
}
