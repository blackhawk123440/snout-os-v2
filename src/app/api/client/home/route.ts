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

  try {
    const db = getScopedDb(ctx);
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [client, upcoming, recent, latestReport, pets] = await Promise.all([
      db.client.findFirst({
        where: { id: ctx.clientId },
        select: { firstName: true, lastName: true },
      }),
      db.booking.findMany({
        where: {
          clientId: ctx.clientId,
          status: { in: ['pending', 'confirmed', 'in_progress'] },
          startAt: { gte: now },
        },
        select: {
          id: true, service: true, startAt: true, status: true,
          sitter: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startAt: 'asc' },
        take: 5,
      }),
      db.booking.findMany({
        where: { clientId: ctx.clientId },
        select: {
          id: true, service: true, startAt: true, status: true,
          sitter: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startAt: 'desc' },
        take: 10,
      }),
      db.report.findFirst({
        where: {
          booking: { clientId: ctx.clientId },
        },
        select: { id: true, content: true, createdAt: true, mediaUrls: true, booking: { select: { service: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      db.pet.findMany({
        where: { clientId: ctx.clientId },
        select: { id: true, name: true, species: true, photoUrl: true },
        take: 10,
      }),
    ]);

    const clientName = client
      ? [client.firstName, client.lastName].filter(Boolean).join(' ') || null
      : null;

    const toIso = (d: Date) => (d instanceof Date ? d.toISOString() : String(d));
    const mapBooking = (b: any) => ({
      id: b.id,
      service: b.service,
      startAt: toIso(b.startAt),
      status: b.status,
      sitterName: b.sitter
        ? [b.sitter.firstName, b.sitter.lastName].filter(Boolean).join(' ') || null
        : null,
    });
    const recentBookings = recent.map(mapBooking);

    const latestReportPayload = latestReport
      ? {
          id: latestReport.id,
          content: latestReport.content?.slice(0, 200) + (latestReport.content?.length > 200 ? '…' : ''),
          createdAt: toIso(latestReport.createdAt),
          service: latestReport.booking?.service,
          mediaUrls: latestReport.mediaUrls ?? null,
        }
      : null;

    return NextResponse.json({
      clientName,
      upcomingCount: upcoming.length,
      upcomingBookings: upcoming.map(mapBooking),
      recentBookings,
      latestReport: latestReportPayload,
      pets: pets.map((p: any) => ({
        id: p.id,
        name: p.name,
        species: p.species,
        photoUrl: p.photoUrl,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load home', message },
      { status: 500 }
    );
  }
}
