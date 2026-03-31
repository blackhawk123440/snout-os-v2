/**
 * Sitter Dashboard Data API (Owner View)
 *
 * GET: Fetch dashboard data for a specific sitter (owner viewing sitter)
 * Returns: pending requests, upcoming bookings, completed bookings, performance metrics, tier info
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    const sitterId = resolvedParams.id;
    const db = getScopedDb(ctx);

    // Fetch sitter (enterprise schema: Sitter has no currentTier)
    const sitter = await db.sitter.findFirst({
      where: { id: sitterId },
      select: { id: true, active: true, commissionPercentage: true },
    });

    if (!sitter) {
      return NextResponse.json(
        { error: 'Sitter not found' },
        { status: 404 }
      );
    }

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Enterprise schema has no OfferEvent or Booking — return empty
    const pendingRequests: any[] = [];
    let upcomingBookings: any[] = [];
    let completedBookings: any[] = [];
    let performance = {
      acceptanceRate: null as number | null,
      completionRate: null as number | null,
      onTimeRate: null as number | null,
      clientRating: null as number | null,
      totalEarnings: 0,
      completedBookingsCount: 0,
    };

    if (typeof (db as any).booking?.findMany === 'function') {
      try {
        const upcoming = await (db as any).booking.findMany({
          where: { sitterId, status: { in: ['confirmed', 'pending'] }, startAt: { gt: now } },
          select: {
            id: true, firstName: true, lastName: true, service: true,
            startAt: true, endAt: true, address: true, notes: true,
            totalPrice: true, status: true,
            pets: { select: { id: true, name: true, type: true, breed: true } },
            client: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          },
          orderBy: { startAt: 'asc' },
        });
        upcomingBookings = upcoming.map((b: any) => ({
          id: b.id,
          firstName: b.firstName,
          lastName: b.lastName,
          service: b.service,
          startAt: b.startAt?.toISOString?.(),
          endAt: b.endAt?.toISOString?.(),
          address: b.address,
          notes: b.notes,
          totalPrice: b.totalPrice,
          status: b.status,
          pets: b.pets,
          client: b.client,
          offerEvent: null,
          threadId: null,
        }));
      } catch (_) {}
    }
    if (typeof (db as any).booking?.findMany === 'function') {
      try {
        const completed = await (db as any).booking.findMany({
          where: { sitterId, status: 'completed', endAt: { lt: now } },
          select: {
            id: true, firstName: true, lastName: true, service: true,
            startAt: true, endAt: true, address: true, notes: true,
            totalPrice: true, status: true,
            pets: { select: { id: true, name: true, type: true, breed: true } },
            client: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          },
          orderBy: { endAt: 'desc' },
          take: 50,
        });
        completedBookings = completed.map((b: any) => ({
          id: b.id,
          firstName: b.firstName,
          lastName: b.lastName,
          service: b.service,
          startAt: b.startAt?.toISOString?.(),
          endAt: b.endAt?.toISOString?.(),
          address: b.address,
          notes: b.notes,
          totalPrice: b.totalPrice,
          status: b.status,
          pets: b.pets,
          client: b.client,
          offerEvent: null,
          threadId: null,
        }));
        const commission = (sitter as any).commissionPercentage ?? 80;
        performance = {
          ...performance,
          completedBookingsCount: completed.length,
          totalEarnings: completed.reduce((sum: number, b: any) => sum + (Number(b.totalPrice) * commission / 100), 0),
        };
      } catch (_) {}
    }

    // Inbox summary: use Thread (enterprise schema)
    let unreadCount = 0;
    let latestThread: { id: string; clientName: string; lastActivityAt: string | null } | null = null;
    try {
      const threads = await (db as any).thread.findMany({
        where: { sitterId, status: 'active' },
        include: { client: { select: { id: true, name: true } } },
        orderBy: { lastActivityAt: 'desc' },
        take: 1,
      });
      unreadCount = await (db as any).thread.count({
        where: { sitterId, status: 'active', ownerUnreadCount: { gt: 0 } },
      }).catch(() => 0);
      const t = threads[0];
      if (t) {
        latestThread = {
          id: t.id,
          clientName: (t as any).client?.name ?? 'Unknown',
          lastActivityAt: t.lastActivityAt?.toISOString() ?? null,
        };
      }
    } catch (_) {}

    // Tier summary: use real schema fields (periodStart, tier relation) and org scope.
    let tierSummary: any = null;
    if (typeof (db as any).sitterTierHistory?.findFirst === 'function') {
      try {
        const latestTierHistory = await (db as any).sitterTierHistory.findFirst({
          where: { sitterId },
          include: { tier: { select: { name: true } } },
          orderBy: { periodStart: 'desc' },
        });
        const latestMetrics = typeof (db as any).sitterMetricsWindow?.findFirst === 'function'
          ? await (db as any).sitterMetricsWindow.findFirst({
              where: { sitterId, windowEnd: { gte: sevenDaysAgo } },
              orderBy: { windowEnd: 'desc' },
            })
          : null;
        if (latestTierHistory) {
          tierSummary = {
            currentTier: {
              name: (latestTierHistory as any).tier?.name ?? 'Unknown',
              assignedAt: (latestTierHistory as any).periodStart?.toISOString?.(),
            },
            metrics: latestMetrics ? {
              avgResponseSeconds: (latestMetrics as any).avgResponseSeconds,
              offerAcceptRate: (latestMetrics as any).offerAcceptRate,
              offerDeclineRate: (latestMetrics as any).offerDeclineRate,
              offerExpireRate: (latestMetrics as any).offerExpireRate,
            } : null,
          };
        }
      } catch (_) {}
    }

    return NextResponse.json({
      pendingRequests,
      upcomingBookings,
      completedBookings,
      performance,
      currentTier: null,
      isAvailable: (sitter as any).active ?? true,
      unreadMessageCount: unreadCount,
      inboxSummary: {
        unreadCount,
        latestThread,
      },
      tierSummary,
    });
  } catch (error: any) {
    console.error('[Sitter Dashboard API] Failed to fetch dashboard:', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', message: error.message },
      { status: 500 }
    );
  }
}
