/**
 * Decline Booking Request API Route
 * 
 * POST: Decline a booking request from an OfferEvent
 * Updates OfferEvent status, records response time
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { recordOfferDeclined } from '@/lib/audit-events';
import { resolveCorrelationId } from '@/lib/correlation-id';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bookingId: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only sitters can decline bookings, and only their own
  if (ctx.role !== 'sitter' || !ctx.sitterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const correlationId = resolveCorrelationId(request);
    const resolvedParams = await params;
    const sitterId = resolvedParams.id;
    const bookingId = resolvedParams.bookingId;
    const orgId = ctx.orgId;

    const db = getScopedDb(ctx);

    // Verify URL sitter ID matches authenticated sitter
    if (sitterId !== ctx.sitterId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Find the active offer for this booking and sitter
    const offer = await db.offerEvent.findFirst({
      where: {
        sitterId: sitterId,
        bookingId: bookingId,
        status: 'sent',
        excluded: false,
      },
    });

    if (!offer) {
      return NextResponse.json(
        { error: 'No active offer found for this booking' },
        { status: 404 }
      );
    }

    const now = new Date();

    // Check if expired (still allow decline for tracking, but mark as expired)
    const isExpired = offer.expiresAt && new Date(offer.expiresAt) < now;

    // Check if already accepted/declined (idempotency)
    if (offer.status === 'accepted' || offer.acceptedAt) {
      return NextResponse.json(
        { error: 'Offer already accepted' },
        { status: 400 }
      );
    }

    if (offer.status === 'declined' || offer.declinedAt) {
      return NextResponse.json(
        { error: 'Offer already declined' },
        { status: 400 }
      );
    }

    const responseSeconds = Math.floor((now.getTime() - new Date(offer.offeredAt).getTime()) / 1000);

    // Update offer status
    await db.offerEvent.update({
      where: { id: offer.id },
      data: {
        status: isExpired ? 'expired' : 'declined',
        declinedAt: now,
        declineReason: isExpired ? 'expired' : 'declined',
      },
    });

    // Record audit event
    await recordOfferDeclined(
      orgId,
      sitterId,
      bookingId,
      offer.id,
      responseSeconds,
      isExpired ? 'expired' : 'declined',
      ctx.userId ?? undefined,
      correlationId
    );

    // Update metrics window with response time
    await updateMetricsWindow(db, orgId, sitterId, responseSeconds, 'declined');

    // Trigger tier recomputation (async, don't wait)
    try {
      const { computeTierForSitter, recordTierChange } = await import('@/lib/tiers/tier-engine-twilio');
      const tierResult = await computeTierForSitter(orgId, sitterId, 7);
      
      // Get tier ID from tier name
      const tier = await db.sitterTier.findFirst({
        where: { name: tierResult.tier },
      });

      if (tier) {
        await recordTierChange(
          orgId,
          sitterId,
          tierResult.tier,
          tier.id,
          tierResult.metrics,
          tierResult.reasons
        );
      }
    } catch (error) {
      console.error('[Tier Engine] Failed to recompute tier:', error);
      // Don't fail the request if tier computation fails
    }

    // Notify owner of decline
    void import('@/lib/notifications/triggers').then(async ({ notifyOwnerOfferDeclined }) => {
      const sitter = await db.sitter.findUnique({
        where: { id: sitterId },
        select: { firstName: true, lastName: true },
      });
      notifyOwnerOfferDeclined({
        orgId,
        bookingId,
        sitterName: sitter ? `${sitter.firstName} ${sitter.lastName}`.trim() : 'Sitter',
      });
    }).catch(() => {});

    // Log event
    void import('@/lib/log-event').then(({ logEvent }) => {
      logEvent({
        orgId,
        action: 'offer.declined',
        bookingId,
        status: 'success',
        metadata: { sitterId, responseSeconds, reason: isExpired ? 'expired' : 'declined' },
      });
    }).catch(() => {});

    return NextResponse.json({ success: true, responseSeconds });
  } catch (error: any) {
    console.error('[Decline Booking API] Failed to decline booking:', error);
    return NextResponse.json(
      { error: 'Failed to decline booking', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Update metrics window with response time and decline
 */
async function updateMetricsWindow(
  db: any,
  _orgId: string,
  sitterId: string,
  responseSeconds: number,
  action: 'accepted' | 'declined'
) {
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get or create metrics window
  const existing = await db.sitterMetricsWindow.findFirst({
    where: {
      sitterId,
      windowStart: { lte: sevenDaysAgo },
      windowEnd: { gte: now },
      windowType: 'weekly_7d',
    },
  });

  // Get all offers in this window to recalculate rates
  const offers = await db.offerEvent.findMany({
    where: {
      sitterId,
      offeredAt: { gte: sevenDaysAgo, lte: now },
      excluded: false,
    },
  });

  const totalOffers = offers.length;
  const accepted = offers.filter((o: any) => o.status === 'accepted' || o.acceptedAt).length;
  const declined = offers.filter((o: any) => o.status === 'declined' || o.declinedAt).length;
  const expired = offers.filter((o: any) => o.status === 'expired' || (o.expiresAt && new Date(o.expiresAt) < now && !o.acceptedAt && !o.declinedAt)).length;

  // Get response times
  const responseTimes = offers
    .filter((o: any) => o.acceptedAt || o.declinedAt)
    .map((o: any) => {
      const respondedAt = o.acceptedAt || o.declinedAt;
      return Math.floor((new Date(respondedAt).getTime() - new Date(o.offeredAt).getTime()) / 1000);
    });

  const avgResponseSeconds = responseTimes.length > 0
    ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
    : null;

  const sortedTimes = [...responseTimes].sort((a: number, b: number) => a - b);
  const medianResponseSeconds = sortedTimes.length > 0
    ? sortedTimes[Math.floor(sortedTimes.length / 2)]
    : null;

  const offerAcceptRate = totalOffers > 0 ? accepted / totalOffers : null;
  const offerDeclineRate = totalOffers > 0 ? declined / totalOffers : null;
  const offerExpireRate = totalOffers > 0 ? expired / totalOffers : null;

  if (existing) {
    await db.sitterMetricsWindow.update({
      where: { id: existing.id },
      data: {
        avgResponseSeconds,
        medianResponseSeconds,
        offerAcceptRate,
        offerDeclineRate,
        offerExpireRate,
        lastOfferRespondedAt: now,
        updatedAt: now,
      },
    });
  } else {
    await (db.sitterMetricsWindow as any).create({
      data: {
        sitterId,
        windowStart: sevenDaysAgo,
        windowEnd: now,
        windowType: 'weekly_7d',
        avgResponseSeconds,
        medianResponseSeconds,
        offerAcceptRate,
        offerDeclineRate,
        offerExpireRate,
        lastOfferRespondedAt: now,
      },
    });
  }
}
