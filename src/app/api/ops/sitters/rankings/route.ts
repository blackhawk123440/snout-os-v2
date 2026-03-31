import { NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getScopedDb(ctx);

  try {
    const sitters = await db.sitter.findMany({
      where: { active: true, deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true, commissionPercentage: true,
        currentTierId: true,
        currentTier: { select: { name: true } },
      },
    });

    const sitterIds = sitters.map((s: any) => s.id);

    // Batch all count and data queries (6 queries total instead of 5N+1)
    const [
      totalOfferCounts,
      acceptedOfferCounts,
      totalBookingCounts,
      completedBookingCounts,
      allVisitEvents,
    ] = await Promise.all([
      db.offerEvent.groupBy({
        by: ['sitterId'],
        where: { sitterId: { in: sitterIds } },
        _count: { _all: true },
      }),
      db.offerEvent.groupBy({
        by: ['sitterId'],
        where: { sitterId: { in: sitterIds }, status: 'accepted' },
        _count: { _all: true },
      }),
      db.booking.groupBy({
        by: ['sitterId'],
        where: { sitterId: { in: sitterIds } },
        _count: { _all: true },
      }),
      db.booking.groupBy({
        by: ['sitterId'],
        where: { sitterId: { in: sitterIds }, status: 'completed' },
        _count: { _all: true },
      }),
      db.visitEvent.findMany({
        where: { sitterId: { in: sitterIds }, excluded: false },
        select: { sitterId: true, checkInAt: true, scheduledStart: true, status: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Build O(1) lookup Maps
    const totalOfferMap = new Map(totalOfferCounts.map((r: any) => [r.sitterId, r._count._all]));
    const acceptedOfferMap = new Map(acceptedOfferCounts.map((r: any) => [r.sitterId, r._count._all]));
    const totalBookingMap = new Map(totalBookingCounts.map((r: any) => [r.sitterId, r._count._all]));
    const completedBookingMap = new Map(completedBookingCounts.map((r: any) => [r.sitterId, r._count._all]));

    // Group visit events by sitterId, keeping only the latest 100 per sitter
    const visitEventMap = new Map<string, typeof allVisitEvents>();
    for (const ve of allVisitEvents) {
      const list = visitEventMap.get(ve.sitterId);
      if (list) {
        if (list.length < 100) list.push(ve);
      } else {
        visitEventMap.set(ve.sitterId, [ve]);
      }
    }

    const rankings = sitters.map((s: any) => {
      const totalOffers = totalOfferMap.get(s.id) ?? 0;
      const acceptedOffers = acceptedOfferMap.get(s.id) ?? 0;
      const totalBookings = totalBookingMap.get(s.id) ?? 0;
      const completedBookings = completedBookingMap.get(s.id) ?? 0;
      const visitEvents = visitEventMap.get(s.id) ?? [];

      const acceptanceRate = totalOffers > 0 ? Math.round((acceptedOffers / totalOffers) * 100) : 0;
      const completionRate = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0;

      const onTimeEvents = visitEvents.filter((ve: any) => {
        if (!ve.checkInAt || !ve.scheduledStart) return false;
        return new Date(ve.checkInAt).getTime() - new Date(ve.scheduledStart).getTime() <= 15 * 60 * 1000;
      });
      const onTimeRate = visitEvents.length > 0 ? Math.round((onTimeEvents.length / visitEvents.length) * 100) : 100;

      const tierName = s.currentTier?.name ?? 'Entry';

      const compositeScore = (acceptanceRate * 0.25) + (completionRate * 0.25) + (onTimeRate * 0.3) + Math.min(completedBookings, 20) * 1;

      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        tier: tierName,
        commissionPct: s.commissionPercentage ?? 80,
        acceptanceRate,
        completionRate,
        onTimeRate,
        totalBookings,
        completedBookings,
        compositeScore: Math.round(compositeScore),
      };
    });

    rankings.sort((a, b) => b.compositeScore - a.compositeScore);

    return NextResponse.json({ rankings }, {
      headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}
