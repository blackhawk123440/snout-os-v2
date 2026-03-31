/**
 * GET /api/sitter/reports
 * Returns list of reports submitted by the current sitter. Requires SITTER role.
 */

import { NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole } from '@/lib/rbac';

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
    return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });
  }

  try {
    const db = getScopedDb(ctx);

    const reports = await db.report.findMany({
      where: { sitterId: ctx.sitterId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        bookingId: true,
        content: true,
        walkDuration: true,
        personalNote: true,
        mediaUrls: true,
        clientRating: true,
        createdAt: true,
        booking: {
          select: {
            service: true,
            startAt: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({
      reports: reports.map((r: any) => ({
        id: r.id,
        bookingId: r.bookingId,
        service: r.booking?.service ?? null,
        clientName: r.booking ? `${r.booking.firstName} ${r.booking.lastName}`.trim() : null,
        visitDate: r.booking?.startAt?.toISOString() ?? null,
        preview: (r.personalNote || r.content || '').slice(0, 120),
        hasPhotos: !!(r.mediaUrls && r.mediaUrls !== '[]' && r.mediaUrls !== ''),
        walkDuration: r.walkDuration,
        clientRating: r.clientRating,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 });
  }
}
