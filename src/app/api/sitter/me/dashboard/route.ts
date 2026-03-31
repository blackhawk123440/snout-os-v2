/**
 * Sitter Dashboard API Route (Self-Scoped)
 * 
 * GET: Fetch dashboard data for the authenticated sitter
 * Returns: pending requests, upcoming bookings, completed bookings, performance metrics, tier info
 * 
 * Uses OfferEvent model for pending requests (in-app booking flow)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScopedDb } from '@/lib/tenancy';
import { getCurrentSitterId } from '@/lib/sitter-helpers';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const sitterId = await getCurrentSitterId(request);
    if (!sitterId) {
      return NextResponse.json(
        { error: 'Sitter not found' },
        { status: 404 }
      );
    }

    const orgId = (session.user as any).orgId;
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 400 }
      );
    }

    const db = getScopedDb({ orgId });

    // Fetch sitter (findFirst instead of findUnique — scoped db injects orgId)
    const sitter = await (db as any).sitter.findFirst({
      where: { id: sitterId },
      include: {
        currentTier: true,
      },
    });

    if (!sitter) {
      return NextResponse.json(
        { error: 'Sitter not found' },
        { status: 404 }
      );
    }

    const now = new Date();

    // Fetch pending requests from OfferEvent (status = sent, expiresAt > now)
    const pendingOffers = await (db as any).offerEvent.findMany({
      where: {
        sitterId,
        status: 'sent',
        expiresAt: { gt: now },
        excluded: false,
      },
      include: {
        booking: {
          include: {
            pets: true,
            client: true,
          },
        },
      },
      orderBy: [
        { expiresAt: 'asc' }, // Earliest expiry first
        { offeredAt: 'desc' }, // Then newest first
      ],
    });

    // Get thread IDs for pending bookings (for messaging links)
    const pendingBookingIds = pendingOffers.map((offer: any) => offer.bookingId).filter(Boolean);
    const pendingThreads = pendingBookingIds.length > 0 ? await (db as any).messageThread.findMany({
      where: {
        bookingId: { in: pendingBookingIds },
        assignedSitterId: sitterId,
      },
      select: {
        id: true,
        bookingId: true,
      },
    }) : [];
    const threadMap = new Map(pendingThreads.map((t: any) => [t.bookingId, t.id]));

    const pendingRequests = pendingOffers
      .filter((offer: any) => offer.booking) // Only include offers with valid bookings
      .map((offer: any) => ({
        id: offer.booking.id,
        firstName: offer.booking.firstName,
        lastName: offer.booking.lastName,
        service: offer.booking.service,
        startAt: offer.booking.startAt.toISOString(),
        endAt: offer.booking.endAt.toISOString(),
        address: offer.booking.address,
        notes: offer.booking.notes,
        totalPrice: offer.booking.totalPrice,
        status: offer.booking.status,
        pets: offer.booking.pets,
        client: offer.booking.client,
        offerEvent: {
          id: offer.id,
          expiresAt: offer.expiresAt?.toISOString() || null,
          offeredAt: offer.offeredAt.toISOString(),
          status: offer.status,
        },
        threadId: threadMap.get(offer.booking.id) || null,
      }));

    // Fetch upcoming bookings (confirmed, not completed, start date in future)
    const upcoming = await (db as any).booking.findMany({
      where: {
        sitterId: sitterId,
        status: { in: ['confirmed', 'pending'] },
        startAt: { gt: now },
      },
      include: {
        pets: true,
        client: true,
      },
      orderBy: {
        startAt: 'asc',
      },
    });

    const upcomingThreads = await (db as any).messageThread.findMany({
      where: {
        bookingId: { in: upcoming.map((b: any) => b.id) },
        assignedSitterId: sitterId,
      },
      select: {
        id: true,
        bookingId: true,
      },
    });
    const upcomingThreadMap = new Map(upcomingThreads.map((t: any) => [t.bookingId, t.id]));

    const upcomingBookings = upcoming.map((booking: any) => ({
      id: booking.id,
      firstName: booking.firstName,
      lastName: booking.lastName,
      service: booking.service,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      address: booking.address,
      notes: booking.notes,
      totalPrice: booking.totalPrice,
      status: booking.status,
      pets: booking.pets,
      client: booking.client,
      sitterPoolOffer: null, // Legacy field for compatibility
      offerEvent: null,
      threadId: upcomingThreadMap.get(booking.id) || null,
    }));

    // Fetch completed bookings (status = completed, end date in past)
    const completed = await (db as any).booking.findMany({
      where: {
        sitterId: sitterId,
        status: 'completed',
        endAt: { lt: now },
      },
      include: {
        pets: true,
        client: true,
      },
      orderBy: {
        endAt: 'desc',
      },
      take: 50, // Limit to most recent 50
    });

    const completedBookings = completed.map((booking: any) => ({
      id: booking.id,
      firstName: booking.firstName,
      lastName: booking.lastName,
      service: booking.service,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      address: booking.address,
      notes: booking.notes,
      totalPrice: booking.totalPrice,
      status: booking.status,
      pets: booking.pets,
      client: booking.client,
      sitterPoolOffer: null, // Legacy field for compatibility
      offerEvent: null,
      threadId: null,
    }));

    // Calculate performance metrics from OfferEvent
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentOffers = await (db as any).offerEvent.findMany({
      where: {
        sitterId,
        offeredAt: { gte: sevenDaysAgo },
        excluded: false,
      },
    });

    const totalOffers = recentOffers.length;
    const accepted = recentOffers.filter((o: any) => o.status === 'accepted' || o.acceptedAt).length;
    const acceptanceRate = totalOffers > 0 ? accepted / totalOffers : null;

    // count is not intercepted by getScopedDb proxy — add orgId manually
    const totalBookings = await (db as any).booking.count({
      where: { sitterId: sitterId, orgId },
    });
    const completedCount = completed.length;
    const totalEarnings = completedBookings.reduce((sum: number, b: any) => {
      const commission = (sitter as any).commissionPercentage || 80;
      return sum + (b.totalPrice * commission / 100);
    }, 0);

    const performance = {
      acceptanceRate,
      completionRate: totalBookings > 0 ? completedCount / totalBookings : null,
      onTimeRate: null as number | null, // Would need actual vs scheduled time data
      clientRating: null as number | null, // Would need rating system
      totalEarnings,
      completedBookingsCount: completedCount,
    };

    // Get unread message count
    const unreadThreads = await (db as any).messageThread.findMany({
      where: {
        assignedSitterId: sitterId,
        status: 'open',
      },
    });

    const unreadCount = unreadThreads.length; // Placeholder

    return NextResponse.json({
      pendingRequests,
      upcomingBookings: upcomingBookings,
      completedBookings: completedBookings,
      performance,
      currentTier: sitter.currentTier ? {
        id: sitter.currentTier.id,
        name: sitter.currentTier.name,
        priorityLevel: (sitter.currentTier as any).priorityLevel || null,
        badgeColor: (sitter.currentTier as any).badgeColor || null,
        badgeStyle: (sitter.currentTier as any).badgeStyle || null,
      } : null,
      isAvailable: (sitter as any).isActive ?? (sitter as any).active ?? false,
      unreadMessageCount: unreadCount,
    });
  } catch (error: any) {
    console.error('[sitter/me/dashboard] FULL ERROR:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
