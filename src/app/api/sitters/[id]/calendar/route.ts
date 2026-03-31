/**
 * Sitter Calendar Status API
 *
 * GET: Returns calendar sync status and upcoming bookings for a sitter
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
    requireAnyRole(ctx, ['owner', 'admin', 'sitter']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;
  const sitterId = resolvedParams.id;

  // Permission check: sitter can only view their own calendar, owner/admin can view any
  if (ctx.role === 'sitter' && ctx.sitterId !== sitterId) {
    return NextResponse.json({ error: 'Forbidden: You can only view your own calendar' }, { status: 403 });
  }

  try {
    const db = getScopedDb(ctx);

    // Fetch sitter with calendar fields
    const sitter = await (db as any).sitter.findUnique({
      where: { id: sitterId },
      select: {
        id: true,
        googleAccessToken: true,
        googleRefreshToken: true,
        googleTokenExpiry: true,
        googleCalendarId: true,
        calendarSyncEnabled: true,
      },
    });

    if (!sitter) {
      return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });
    }

    // Determine connection status
    const connected = !!(sitter.googleAccessToken && sitter.googleRefreshToken);
    const syncEnabled = sitter.calendarSyncEnabled || false;

    // Get last sync time from most recent calendar event (updatedAt serves as lastSyncAt)
    const lastCalendarEvent = await (db as any).bookingCalendarEvent.findFirst({
      where: {
        sitterId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        updatedAt: true,
      },
    });

    // Also check if there's a calendar name (could fetch from Google API, but for now use calendarId)
    const calendarName = sitter.googleCalendarId === 'primary' ? 'Primary Calendar' : sitter.googleCalendarId || 'Primary Calendar';

    // Fetch upcoming bookings (same query as dashboard)
    const now = new Date();
    const upcomingBookings = await (db as any).booking.findMany({
      where: {
        sitterId,
        status: { in: ['confirmed', 'pending'] },
        startAt: { gte: now },
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        startAt: 'asc',
      },
      take: 20,
    });

    return NextResponse.json({
      status: {
        connected,
        syncEnabled,
        calendarId: sitter.googleCalendarId || 'primary',
        calendarName: calendarName,
        lastSyncAt: lastCalendarEvent?.updatedAt?.toISOString() || null,
      },
      upcomingBookings: upcomingBookings.map((booking: any) => ({
        id: booking.id,
        firstName: booking.firstName,
        lastName: booking.lastName,
        service: booking.service,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        status: booking.status,
        address: booking.address,
        client: booking.client,
      })),
    });
  } catch (error: any) {
    console.error('[Calendar Status API] Failed to fetch calendar data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar data', message: error.message },
      { status: 500 }
    );
  }
}
