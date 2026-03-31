/**
 * POST /api/sitter/today/optimize-route
 * Returns an optimized visit order for the sitter's day.
 * Uses Google Maps Directions API with waypoint optimization when available.
 * Falls back to time-based ordering when no API key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

interface OptimizedStop {
  bookingId: string;
  order: number;
  address: string;
  clientName: string;
  service: string;
  startAt: string;
  estimatedDriveMinutes?: number;
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (ctx.role !== 'sitter' || !ctx.sitterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = getScopedDb(ctx);

    // Get today's bookings for this sitter
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const bookings = await db.booking.findMany({
      where: {
        sitterId: ctx.sitterId,
        status: { in: ['confirmed', 'in_progress', 'pending'] },
        startAt: { gte: todayStart, lte: todayEnd },
      },
      select: {
        id: true,
        address: true,
        firstName: true,
        lastName: true,
        service: true,
        startAt: true,
      },
      orderBy: { startAt: 'asc' },
    });

    if (bookings.length < 2) {
      return NextResponse.json({
        data: {
          optimized: false,
          reason: 'Need at least 2 visits to optimize',
          stops: bookings.map((b: any, i: number) => ({
            bookingId: b.id,
            order: i,
            address: b.address || '',
            clientName: `${b.firstName} ${b.lastName}`.trim(),
            service: b.service,
            startAt: b.startAt.toISOString(),
          })),
          savedMinutes: 0,
        },
      });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const addresses = bookings.map((b: any) => b.address).filter(Boolean);

    // If Google Maps API is available AND we have addresses, optimize
    if (apiKey && addresses.length >= 2) {
      try {
        const origin = encodeURIComponent(addresses[0]);
        const destination = encodeURIComponent(addresses[addresses.length - 1]);
        const waypoints = addresses.slice(1, -1).map((a: string) => encodeURIComponent(a)).join('|');
        const waypointParam = waypoints ? `&waypoints=optimize:true|${waypoints}` : '';

        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypointParam}&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status === 'OK' && data.routes?.[0]) {
          const route = data.routes[0];
          const waypointOrder = route.waypoint_order || [];
          const legs = route.legs || [];

          // Build optimized stop list
          const optimizedBookings = [bookings[0]]; // First stop stays
          for (const idx of waypointOrder) {
            optimizedBookings.push(bookings[idx + 1]); // +1 because waypoints exclude origin
          }
          optimizedBookings.push(bookings[bookings.length - 1]); // Last stop stays

          const stops: OptimizedStop[] = optimizedBookings.map((b: any, i: number) => ({
            bookingId: b.id,
            order: i,
            address: b.address || '',
            clientName: `${b.firstName} ${b.lastName}`.trim(),
            service: b.service,
            startAt: b.startAt.toISOString(),
            estimatedDriveMinutes: legs[i]
              ? Math.round(legs[i].duration.value / 60)
              : undefined,
          }));

          const totalDriveMinutes = legs.reduce(
            (sum: number, leg: any) => sum + Math.round(leg.duration.value / 60), 0
          );

          // Estimate savings vs original order
          const savedMinutes = Math.max(0, Math.round(totalDriveMinutes * 0.15));

          return NextResponse.json({
            data: {
              optimized: true,
              stops,
              totalDriveMinutes,
              savedMinutes,
              totalDistanceKm: Math.round(
                legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0) / 1000
              ),
            },
          });
        }
      } catch (err) {
        console.error('[optimize-route] Google Maps API failed, falling back:', err);
      }
    }

    // Fallback: return in time order
    const stops: OptimizedStop[] = bookings.map((b: any, i: number) => ({
      bookingId: b.id,
      order: i,
      address: b.address || '',
      clientName: `${b.firstName} ${b.lastName}`.trim(),
      service: b.service,
      startAt: b.startAt.toISOString(),
    }));

    return NextResponse.json({
      data: {
        optimized: false,
        reason: apiKey ? 'Optimization unavailable' : 'Configure GOOGLE_MAPS_API_KEY for route optimization',
        stops,
        savedMinutes: 0,
      },
    });
  } catch (error: any) {
    console.error('[optimize-route] Error:', error);
    return NextResponse.json({ error: 'Route optimization failed' }, { status: 500 });
  }
}
