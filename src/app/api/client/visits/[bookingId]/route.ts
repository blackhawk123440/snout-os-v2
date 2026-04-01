/**
 * GET /api/client/visits/[bookingId]
 * Returns the Visit Card for a completed booking.
 * Client-only, scoped to their own bookings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, requireClientContext, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { buildClientFacingSitterProfile } from '@/lib/sitter-helpers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { bookingId } = await params;

  try {
    const db = getScopedDb(ctx);

    const card = await (db as any).visitCard.findFirst({
      where: { bookingId, clientId: ctx.clientId },
    });

    if (!card) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Get sitter info + trust profile
    const sitter = await (db as any).sitter.findFirst({
      where: { id: card.sitterId },
      select: { firstName: true, lastName: true },
    });
    const sitterName = sitter ? `${sitter.firstName} ${sitter.lastName}`.trim() : 'Your sitter';

    // Get booking pets
    const booking = await (db as any).booking.findFirst({
      where: { id: bookingId, clientId: ctx.clientId },
      select: {
        service: true,
        pets: { select: { id: true, name: true } },
      },
    });
    const petNames = booking?.pets?.map((p: any) => p.name).filter(Boolean).join(' and ') || 'your pet';

    // Build trust profile
    let sitterProfile = null;
    try {
      const snapshot = await (db as any).sitterTierSnapshot.findFirst({
        where: { sitterId: card.sitterId },
        orderBy: { asOfDate: 'desc' },
        select: { tier: true, rolling30dBreakdownJson: true },
      });
      if (snapshot) {
        const completedVisits = await (db as any).booking.count({
          where: { sitterId: card.sitterId, status: 'completed' },
        });
        sitterProfile = buildClientFacingSitterProfile(snapshot, completedVisits);
      }
    } catch { /* optional */ }

    return NextResponse.json({
      id: card.id,
      sitterName,
      sitterProfile,
      petNames,
      service: booking?.service || '',
      date: card.checkInAt,
      checkInAt: card.checkInAt,
      checkOutAt: card.checkOutAt,
      durationMinutes: card.durationMinutes,
      checkInLat: card.checkInLat,
      checkInLng: card.checkInLng,
      photos: card.photoUrls ? JSON.parse(card.photoUrls) : [],
      petChecklists: card.petChecklists ? JSON.parse(card.petChecklists) : [],
      sitterNote: card.sitterNote,
      pets: booking?.pets?.map((p: any) => ({ id: p.id, name: p.name })) || [],
    });
  } catch (error: any) {
    console.error('[client/visits] Error:', error);
    return NextResponse.json({ error: 'Failed to load visit card' }, { status: 500 });
  }
}
