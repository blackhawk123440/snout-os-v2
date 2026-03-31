/**
 * GET /api/sitter/route?date=YYYY-MM-DD
 * Returns structured route data for the sitter's day:
 * - Ordered stops with addresses, booking details, and status
 * - Google Maps navigation URL
 * - Apple Maps navigation URL
 * Used by web route map and React Native sitter app.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });

  const db = getScopedDb(ctx);
  const dateStr = request.nextUrl.searchParams.get('date');
  const date = dateStr ? new Date(dateStr) : new Date();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  try {
    const bookings = await db.booking.findMany({
      where: {
        sitterId: ctx.sitterId,
        status: { in: ['pending', 'confirmed', 'in_progress', 'completed'] },
        startAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { startAt: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        address: true,
        pickupAddress: true,
        service: true,
        startAt: true,
        endAt: true,
        status: true,
        phone: true,
        pets: { select: { name: true, species: true } },
        notes: true,
      },
    });

    // Build structured stops
    const stops = bookings.map((b, index) => {
      const address = b.service === 'Pet Taxi' ? b.pickupAddress : b.address;
      return {
        stopNumber: index + 1,
        bookingId: b.id,
        clientName: `${b.firstName || ''} ${b.lastName || ''}`.trim(),
        address: address || null,
        service: b.service,
        startAt: b.startAt instanceof Date ? b.startAt.toISOString() : b.startAt,
        endAt: b.endAt instanceof Date ? b.endAt.toISOString() : b.endAt,
        status: b.status,
        pets: b.pets?.map((p: any) => p.name || p.species).join(', ') || '',
        phone: b.phone || null,
        notes: b.notes?.slice(0, 100) || null,
        // Navigation deep links
        googleMapsUrl: address
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
          : null,
        appleMapsUrl: address
          ? `https://maps.apple.com/?q=${encodeURIComponent(address)}`
          : null,
      };
    });

    const addressesForRoute = stops.filter(s => s.address).map(s => s.address!);

    // Build multi-stop navigation URLs
    let googleMapsRouteUrl: string | null = null;
    let appleMapsRouteUrl: string | null = null;

    if (addressesForRoute.length >= 1) {
      const origin = encodeURIComponent(addressesForRoute[0]);
      const destination = encodeURIComponent(addressesForRoute[addressesForRoute.length - 1]);
      const middle = addressesForRoute.slice(1, -1).map(w => encodeURIComponent(w));
      const waypointsParam = middle.length > 0 ? `&waypoints=${middle.join('|')}` : '';
      googleMapsRouteUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointsParam}&travelmode=driving`;

      // Apple Maps multi-stop
      const appleParts = addressesForRoute.map(a => encodeURIComponent(a));
      appleMapsRouteUrl = `https://maps.apple.com/?daddr=${appleParts.join('&daddr=')}`;
    }

    return NextResponse.json({
      date: dayStart.toISOString().slice(0, 10),
      stopCount: stops.length,
      stops,
      navigation: {
        googleMapsUrl: googleMapsRouteUrl,
        appleMapsUrl: appleMapsRouteUrl,
      },
      // Legacy compatibility
      googleMapsUrl: googleMapsRouteUrl,
      waypoints: addressesForRoute,
      bookingIds: bookings.map(b => b.id),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to build route', message }, { status: 500 });
  }
}
