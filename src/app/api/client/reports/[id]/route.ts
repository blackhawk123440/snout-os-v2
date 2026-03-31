import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  try {
    const db = getScopedDb(ctx);
    const report = await db.report.findFirst({
      where: {
        id,
        booking: { clientId: ctx.clientId },
      },
      include: {
        booking: {
          select: {
            id: true,
            service: true,
            startAt: true,
            endAt: true,
            sitter: { select: { firstName: true, lastName: true } },
            pets: { select: { name: true, species: true } },
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const toIso = (d: Date | null) => (d instanceof Date ? d.toISOString() : null);
    const sitter = report.booking?.sitter;
    const sitterName = sitter
      ? `${sitter.firstName || ''} ${sitter.lastName || ''}`.trim()
      : null;

    return NextResponse.json({
      id: report.id,
      content: report.content,
      mediaUrls: report.mediaUrls,
      walkDuration: report.walkDuration,
      pottyNotes: report.pottyNotes,
      foodNotes: report.foodNotes,
      waterNotes: report.waterNotes,
      medicationNotes: report.medicationNotes,
      behaviorNotes: report.behaviorNotes,
      personalNote: report.personalNote,
      visitStarted: toIso(report.visitStarted),
      visitCompleted: toIso(report.visitCompleted),
      checkInLat: report.checkInLat,
      checkInLng: report.checkInLng,
      checkOutLat: report.checkOutLat,
      checkOutLng: report.checkOutLng,
      clientRating: report.clientRating,
      clientFeedback: report.clientFeedback,
      ratedAt: toIso(report.ratedAt),
      sentAt: toIso(report.sentAt),
      createdAt: toIso(report.createdAt),
      sitterName,
      booking: report.booking
        ? {
            id: report.booking.id,
            service: report.booking.service,
            startAt: toIso(report.booking.startAt),
            endAt: toIso(report.booking.endAt),
            pets: report.booking.pets?.map((p: any) => ({
              name: p.name || '',
              species: p.species || '',
            })) ?? [],
          }
        : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load report', message },
      { status: 500 }
    );
  }
}
