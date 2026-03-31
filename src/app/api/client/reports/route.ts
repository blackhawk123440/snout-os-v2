import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

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

  try {
    const db = getScopedDb(ctx);
    const reports = await db.report.findMany({
      where: {
        booking: { clientId: ctx.clientId },
      },
      select: {
        id: true,
        content: true,
        mediaUrls: true,
        personalNote: true,
        visitStarted: true,
        visitCompleted: true,
        createdAt: true,
        clientRating: true,
        sentAt: true,
        bookingId: true,
        booking: {
          select: {
            id: true,
            service: true,
            startAt: true,
            sitter: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const toIso = (d: Date | null) => (d instanceof Date ? d.toISOString() : null);
    const payload = reports.map((r: any) => {
      const sitter = r.booking?.sitter;
      const sitterName = sitter
        ? `${sitter.firstName || ''} ${sitter.lastName || ''}`.trim()
        : null;
      return {
        id: r.id,
        content: r.content,
        mediaUrls: r.mediaUrls,
        personalNote: r.personalNote,
        visitStarted: toIso(r.visitStarted),
        visitCompleted: toIso(r.visitCompleted),
        createdAt: toIso(r.createdAt),
        clientRating: r.clientRating,
        sentAt: toIso(r.sentAt),
        bookingId: r.bookingId,
        sitterName,
        booking: r.booking
          ? { id: r.booking.id, service: r.booking.service, startAt: toIso(r.booking.startAt) }
          : null,
      };
    });

    return NextResponse.json({ reports: payload });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load reports', message },
      { status: 500 }
    );
  }
}
