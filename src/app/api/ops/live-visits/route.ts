/**
 * GET /api/ops/live-visits
 *
 * Returns all currently in-progress visits with GPS data.
 * Used by owner dashboard to show a live map of active visits.
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);

    const activeVisits = await db.booking.findMany({
      where: {
        status: 'in_progress',
      },
      select: {
        id: true,
        service: true,
        firstName: true,
        lastName: true,
        address: true,
        startAt: true,
        endAt: true,
        updatedAt: true,
        sitter: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const visits = activeVisits.map((v: any) => ({
      bookingId: v.id,
      service: v.service,
      clientName: `${v.firstName} ${v.lastName}`.trim(),
      address: v.address,
      startAt: v.startAt,
      checkedInAt: v.updatedAt,
      elapsedMinutes: Math.floor((Date.now() - new Date(v.updatedAt).getTime()) / 60000),
      sitter: v.sitter
        ? { id: v.sitter.id, name: `${v.sitter.firstName} ${v.sitter.lastName}`.trim() }
        : null,
    }));

    return NextResponse.json({
      activeCount: visits.length,
      visits,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load live visits' }, { status: 500 });
  }
}
