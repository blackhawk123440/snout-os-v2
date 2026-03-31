/**
 * GET /api/sitter/bookings/[id]/report
 * Returns the latest report for this booking (for sitter edit flow). Requires SITTER role.
 */

import { NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole } from '@/lib/rbac';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: bookingId } = await params;
  const db = getScopedDb(ctx);

  const booking = await db.booking.findFirst({
    where: { id: bookingId, sitterId: ctx.sitterId },
    select: { id: true },
  });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const report = await db.report.findFirst({
    where: { bookingId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, content: true, mediaUrls: true, createdAt: true },
  });

  if (!report) {
    return NextResponse.json({ report: null });
  }

  const toIso = (d: Date) => (d instanceof Date ? d.toISOString() : String(d));
  const mediaUrls = typeof report.mediaUrls === 'string'
    ? (() => { try { return JSON.parse(report.mediaUrls) as string[]; } catch { return []; } })()
    : [];

  return NextResponse.json({
    report: {
      id: report.id,
      content: report.content,
      mediaUrls,
      createdAt: toIso(report.createdAt),
    },
  });
}
