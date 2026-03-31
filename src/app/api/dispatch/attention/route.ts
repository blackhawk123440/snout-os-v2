/**
 * Dispatch Attention API
 * 
 * GET: Fetch bookings requiring dispatch attention
 * Returns bookings that need manual dispatch or are unassigned in auto mode
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  let orgId: string;
  try {
    const ctx = await getRequestContext(request);
    if (ctx.role !== 'owner' && ctx.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }
    orgId = ctx.orgId;
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {

    // Fetch bookings requiring dispatch attention:
    // 1. dispatchStatus = manual_required
    // 2. OR unassigned bookings in auto mode (sitterId is null, dispatchStatus = auto or null)
    const manualRequiredBookings = await (prisma as any).booking.findMany({
      where: {
        orgId,
        dispatchStatus: 'manual_required',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        service: true,
        startAt: true,
        endAt: true,
        status: true,
        dispatchStatus: true,
        manualDispatchReason: true,
        manualDispatchAt: true,
        sitterId: true,
      },
      orderBy: {
        manualDispatchAt: 'desc', // Most recent first
      },
    });

    const unassignedAutoBookings = await (prisma as any).booking.findMany({
      where: {
        orgId,
        sitterId: null,
        status: 'pending',
        OR: [
          { dispatchStatus: 'auto' },
          { dispatchStatus: null },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        service: true,
        startAt: true,
        endAt: true,
        status: true,
        dispatchStatus: true,
        manualDispatchReason: true,
        manualDispatchAt: true,
        sitterId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Combine and deduplicate bookings
    const allBookings = [...manualRequiredBookings, ...unassignedAutoBookings];
    const uniqueBookings = Array.from(
      new Map(allBookings.map((b: any) => [b.id, b])).values()
    );

    const bookingIds = uniqueBookings.map((b: any) => b.id);

    // Batch-fetch all offer events for all bookings in one query
    const allOfferEvents = bookingIds.length > 0
      ? await (prisma as any).offerEvent.findMany({
          where: {
            orgId,
            bookingId: { in: bookingIds },
            excluded: false,
          },
          select: {
            id: true,
            bookingId: true,
            sitterId: true,
            status: true,
            expiresAt: true,
            offeredAt: true,
            acceptedAt: true,
            declinedAt: true,
          },
          orderBy: {
            offeredAt: 'desc',
          },
        })
      : [];

    // Build maps: bookingId -> attempt count, bookingId -> latest offer
    const attemptCountMap = new Map<string, number>();
    const latestOfferMap = new Map<string, any>();

    for (const offer of allOfferEvents) {
      // Count attempts per booking
      attemptCountMap.set(
        offer.bookingId,
        (attemptCountMap.get(offer.bookingId) || 0) + 1
      );

      // Track latest offer per booking (results are ordered by offeredAt desc,
      // so the first one we see for each bookingId is the latest)
      if (!latestOfferMap.has(offer.bookingId)) {
        latestOfferMap.set(offer.bookingId, offer);
      }
    }

    // Enrich bookings using the pre-fetched maps (no additional queries)
    const enrichedBookings = uniqueBookings.map((booking: any) => {
      const attemptCount = attemptCountMap.get(booking.id) || 0;
      const lastOffer = latestOfferMap.get(booking.id) || null;

      return {
        bookingId: booking.id,
        clientName: `${booking.firstName} ${booking.lastName}`,
        service: booking.service,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        status: booking.status,
        dispatchStatus: booking.dispatchStatus || 'auto',
        manualDispatchReason: booking.manualDispatchReason,
        manualDispatchAt: booking.manualDispatchAt?.toISOString() || null,
        attemptCount,
        lastOffer: lastOffer ? {
          id: lastOffer.id,
          sitterId: lastOffer.sitterId,
          status: lastOffer.status,
          expiresAt: lastOffer.expiresAt?.toISOString() || null,
          offeredAt: lastOffer.offeredAt.toISOString(),
          acceptedAt: lastOffer.acceptedAt?.toISOString() || null,
          declinedAt: lastOffer.declinedAt?.toISOString() || null,
        } : null,
      };
    });

    // Sort by priority: manual_required first, then by manualDispatchAt/createdAt
    enrichedBookings.sort((a, b) => {
      if (a.dispatchStatus === 'manual_required' && b.dispatchStatus !== 'manual_required') {
        return -1;
      }
      if (a.dispatchStatus !== 'manual_required' && b.dispatchStatus === 'manual_required') {
        return 1;
      }
      // Both same priority, sort by date
      const aDate = a.manualDispatchAt || a.startAt;
      const bDate = b.manualDispatchAt || b.startAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    return NextResponse.json({
      bookings: enrichedBookings,
      count: enrichedBookings.length,
    });
  } catch (error: any) {
    console.error('[Dispatch Attention API] Failed to fetch bookings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dispatch attention bookings', message: error.message },
      { status: 500 }
    );
  }
}
