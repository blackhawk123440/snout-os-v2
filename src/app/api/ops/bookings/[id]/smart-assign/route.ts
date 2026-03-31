/**
 * GET /api/ops/bookings/[id]/smart-assign
 * Returns top 5 AI-ranked sitter matches for a booking.
 * Tier permissions are enforced — ineligible sitters are excluded or flagged.
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { rankSittersForBooking } from '@/lib/matching/sitter-matcher';
import { canSitterTakeBooking, getSitterTierInfo } from '@/lib/tier-permissions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
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

  const { id: bookingId } = await params;

  try {
    const db = getScopedDb(ctx);

    // Load the booking to get service, time, clientId, price
    const booking = await db.booking.findFirst({
      where: { id: bookingId },
      select: {
        id: true,
        service: true,
        startAt: true,
        endAt: true,
        clientId: true,
        totalPrice: true,
        recurringScheduleId: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (!booking.clientId) {
      return NextResponse.json(
        { error: 'Booking has no associated client' },
        { status: 400 },
      );
    }

    const allMatches = await rankSittersForBooking({
      orgId: ctx.orgId,
      service: booking.service,
      startAt: booking.startAt,
      endAt: booking.endAt,
      clientId: booking.clientId,
    });

    // Enrich with tier info and eligibility
    const enriched = await Promise.all(
      allMatches.slice(0, 10).map(async (match) => {
        const tierCheck = await canSitterTakeBooking(match.sitterId, {
          service: booking.service,
          startAt: booking.startAt,
          totalPrice: booking.totalPrice ?? 0,
          clientId: booking.clientId,
          isRecurring: !!booking.recurringScheduleId,
        });
        const tierInfo = await getSitterTierInfo(match.sitterId);

        return {
          ...match,
          tierName: tierInfo?.name ?? 'Unassigned',
          tierEligible: tierCheck.allowed,
          tierReasons: tierCheck.reasons,
        };
      })
    );

    // Split into eligible (ranked) and ineligible (appended at end)
    const eligible = enriched.filter((m) => m.tierEligible);
    const ineligible = enriched.filter((m) => !m.tierEligible);

    // Fallback messaging when no good matches
    const topMatches = eligible.slice(0, 5);
    let fallbackMessage: string | null = null;
    if (topMatches.length === 0 && ineligible.length > 0) {
      fallbackMessage = 'All available sitters have tier restrictions for this booking type. Consider an override.';
    } else if (topMatches.length === 0 && allMatches.length === 0) {
      fallbackMessage = 'No active sitters found. Check your team roster.';
    } else if (topMatches.length > 0 && topMatches[0].breakdown.availability === 0) {
      fallbackMessage = 'All sitters have scheduling conflicts. Consider rescheduling or overriding.';
    }

    return NextResponse.json({
      matches: topMatches,
      ineligible: ineligible.slice(0, 5),
      topPick: topMatches[0] ?? null,
      fallbackMessage,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get sitter matches', message },
      { status: 500 },
    );
  }
}
