/**
 * Sitter Dashboard API Route
 * 
 * GET: Fetch dashboard data for a sitter
 * Returns: pending requests, upcoming bookings, completed bookings, performance metrics, tier info
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;

  // Owner/admin can view any sitter's dashboard; sitters can only view their own
  if (ctx.role === 'sitter') {
    if (ctx.sitterId !== resolvedParams.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const sitterId = resolvedParams.id;
    const db = getScopedDb(ctx);

    // Fetch sitter
    const sitter = await db.sitter.findUnique({
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

    // Fetch pending requests (bookings with active pool offers for this sitter)
    const pendingOffers = await db.sitterPoolOffer.findMany({
      where: {
        OR: [
          { sitterId: sitterId, status: 'active' },
          { 
            sitterIds: { contains: sitterId },
            status: 'active',
            expiresAt: { gt: now },
          },
        ],
      },
      include: {
        booking: {
          include: {
            pets: true,
            client: true,
            sitterPoolOffers: {
              where: {
                OR: [
                  { sitterId: sitterId },
                  { sitterIds: { contains: sitterId } },
                ],
                status: 'active',
              },
            },
          },
        },
      },
      orderBy: {
        expiresAt: 'asc',
      },
    });

    // Get thread IDs for pending bookings (for messaging links)
    const pendingBookingIds = pendingOffers.map((offer: any) => offer.bookingId).filter(Boolean);
    const pendingThreads = pendingBookingIds.length > 0 ? await db.messageThread.findMany({
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
      .filter((offer: any) => {
        // Check if sitter hasn't already responded
        try {
          const responses = JSON.parse(offer.responses || '[]') as Array<{ sitterId: string; response: string }>;
          return !responses.some(r => r.sitterId === sitterId);
        } catch (e) {
          // If responses is invalid JSON, treat as no responses
          return true;
        }
      })
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
        sitterPoolOffer: {
          id: offer.id,
          expiresAt: offer.expiresAt.toISOString(),
          status: offer.status,
        },
        threadId: threadMap.get(offer.booking.id) || null,
      }));

    // Fetch upcoming bookings (confirmed bookings assigned to this sitter)
    const upcomingBookings = await db.booking.findMany({
      where: {
        sitterId: sitterId,
        status: { in: ['confirmed', 'in_progress'] },
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

    // Get thread IDs for upcoming bookings
    const upcomingBookingIds = upcomingBookings.map((b: any) => b.id).filter(Boolean);
    const upcomingThreads = upcomingBookingIds.length > 0 ? await db.messageThread.findMany({
      where: {
        bookingId: { in: upcomingBookingIds },
        assignedSitterId: sitterId,
      },
      select: {
        id: true,
        bookingId: true,
      },
    }) : [];
    const upcomingThreadMap = new Map(upcomingThreads.map((t: any) => [t.bookingId, t.id]));

    const upcoming = upcomingBookings.map((booking: any) => ({
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
      sitterPoolOffer: null,
      threadId: upcomingThreadMap.get(booking.id) || null,
    }));

    // Fetch completed bookings
    const completedBookings = await db.booking.findMany({
      where: {
        sitterId: sitterId,
        status: 'completed',
      },
      include: {
        pets: true,
        client: true,
      },
      orderBy: {
        endAt: 'desc',
      },
      take: 50, // Limit to recent 50
    });

    const completed = completedBookings.map((booking: any) => ({
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
      sitterPoolOffer: null,
      threadId: null,
    }));

    // Calculate performance metrics (placeholders for now)
    const allSitterBookings = await db.booking.findMany({
      where: { sitterId: sitterId },
    });

    const totalBookings = allSitterBookings.length;
    const completedCount = allSitterBookings.filter((b: any) => b.status === 'completed').length;
    const totalEarnings = completedBookings.reduce((sum: number, b: any) => {
      const commission = (sitter as any).commissionPercentage || 80;
      return sum + (b.totalPrice * commission / 100);
    }, 0);

    // Calculate metrics (simplified - would need more data for accurate rates)
    const performance = {
      acceptanceRate: null as number | null, // Would need offer response data
      completionRate: totalBookings > 0 ? completedCount / totalBookings : null,
      onTimeRate: null as number | null, // Would need actual vs scheduled time data
      clientRating: null as number | null, // Would need rating system
      totalEarnings,
      completedBookingsCount: completedCount,
    };

    // Get unread message count
    // Note: This is a simplified placeholder - proper unread tracking would require
    // a sitterUnreadCount field on MessageThread or a separate tracking table
    const unreadThreads = await db.messageThread.findMany({
      where: {
        assignedSitterId: sitterId,
        status: 'open',
      },
    });

    // Count threads with unread messages (simplified - would need proper unread tracking)
    const unreadCount = unreadThreads.length; // Placeholder

    return NextResponse.json({
      pendingRequests,
      upcomingBookings: upcoming,
      completedBookings: completed,
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
    console.error('[Sitter Dashboard API] Failed to fetch dashboard:', {
      error: error.message,
      stack: error.stack,
      sitterId: resolvedParams?.id,
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data', 
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    );
  }
}
