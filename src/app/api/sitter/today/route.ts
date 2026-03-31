import { NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireAnyRole } from '@/lib/rbac';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['sitter']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter profile missing on session' }, { status: 403 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  try {
    const db = getScopedDb(ctx);
    const bookings = await (db as any).booking.findMany({
      where: {
        sitterId: ctx.sitterId,
        startAt: { gte: todayStart, lt: tomorrowStart },
      },
      include: {
        pets: {
          select: {
            id: true,
            name: true,
            species: true,
          },
        },
        client: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    const bookingIds = bookings.map((booking: any) => booking.id);
    const threadMap = new Map<string, string>();
    const visitMap = new Map<string, { checkInAt: Date | null; checkOutAt: Date | null }>();
    const reportMap = new Map<string, { hasReport: boolean; latestReportId: string | null }>();

    if (bookingIds.length > 0) {
      const threads = await db.messageThread.findMany({
        where: {
          bookingId: { in: bookingIds },
          assignedSitterId: ctx.sitterId,
        },
        select: {
          id: true,
          bookingId: true,
        },
      });

      for (const thread of threads) {
        if (thread.bookingId) {
          threadMap.set(thread.bookingId, thread.id);
        }
      }

      const visitEvents = await db.visitEvent.findMany({
        where: {
          bookingId: { in: bookingIds },
          sitterId: ctx.sitterId,
        },
        orderBy: { createdAt: 'desc' },
        select: { bookingId: true, checkInAt: true, checkOutAt: true },
      });
      for (const v of visitEvents) {
        if (!visitMap.has(v.bookingId)) {
          visitMap.set(v.bookingId, { checkInAt: v.checkInAt ?? null, checkOutAt: v.checkOutAt ?? null });
        }
      }

      const reports = await db.report.findMany({
        where: {
          bookingId: { in: bookingIds },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, bookingId: true },
      });
      for (const report of reports) {
        if (report.bookingId && !reportMap.has(report.bookingId)) {
          reportMap.set(report.bookingId, { hasReport: true, latestReportId: report.id });
        }
      }
    }

    const toIso = (d: Date) => (d instanceof Date ? d.toISOString() : String(d));
    const payload = bookings.map((booking: any) => ({
      id: booking.id,
      status: booking.status,
      service: booking.service,
      startAt: toIso(booking.startAt),
      endAt: toIso(booking.endAt),
      address: booking.address,
      clientName:
        `${booking.client?.firstName || booking.firstName || ''} ${booking.client?.lastName || booking.lastName || ''}`.trim() ||
        'Client',
      pets: booking.pets || [],
      threadId: threadMap.get(booking.id) || null,
      clientPhone: booking.client?.phone || booking.phone || null,
      checkedInAt: visitMap.get(booking.id)?.checkInAt ? toIso(visitMap.get(booking.id)!.checkInAt as Date) : null,
      checkedOutAt: visitMap.get(booking.id)?.checkOutAt ? toIso(visitMap.get(booking.id)!.checkOutAt as Date) : null,
      hasReport: reportMap.get(booking.id)?.hasReport ?? false,
      latestReportId: reportMap.get(booking.id)?.latestReportId ?? null,
      mapLink: booking.address
        ? {
            apple: `https://maps.apple.com/?q=${encodeURIComponent(booking.address)}`,
            google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`,
          }
        : null,
    }));

    return NextResponse.json({ bookings: payload }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to load today bookings', message: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
