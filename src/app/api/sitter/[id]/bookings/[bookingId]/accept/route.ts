/**
 * Accept Booking Request API Route
 * 
 * POST: Accept a booking request from an OfferEvent
 * Updates OfferEvent status, assigns booking to sitter, records response time
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { recordOfferAccepted, recordOfferAcceptBlocked } from '@/lib/audit-events';
import { checkSitterEligibility } from '@/lib/sitter-eligibility';
import { enqueueCalendarSync } from '@/lib/calendar-queue';
import { emitBookingUpdated } from '@/lib/event-emitter';
import { ensureEventQueueBridge } from '@/lib/event-queue-bridge-init';
import { validateSitterAssignment } from '@/lib/availability/booking-conflict';
import { syncConversationLifecycleWithBookingWorkflow } from '@/lib/messaging/conversation-service';

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

  // Only sitters can accept bookings, and only their own
  if (ctx.role !== 'sitter' || !ctx.sitterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
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

    const now = new Date();

    // Find the active offer for this booking and sitter (not expired)
    const offer = await db.offerEvent.findFirst({
      where: {
        sitterId: sitterId,
        bookingId: bookingId,
        status: 'sent',
        excluded: false,
        expiresAt: { gt: now }, // Only non-expired offers
      },
    });

    if (!offer) {
      return NextResponse.json(
        { error: 'No active offer found for this booking. The offer may have expired or already been processed.' },
        { status: 404 }
      );
    }

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

    // Check if booking is already assigned to another sitter
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { sitterId: true, status: true, startAt: true, endAt: true },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    if (booking.sitterId && booking.sitterId !== sitterId) {
      return NextResponse.json(
        { error: 'Booking is already assigned to another sitter' },
        { status: 400 }
      );
    }

    const conflictResult = await validateSitterAssignment({
      db: db as any,
      orgId,
      sitterId,
      start: booking.startAt,
      end: booking.endAt,
      excludeBookingId: bookingId,
      respectGoogleBusy: true,
    });

    if (!conflictResult.ok) {
      return NextResponse.json(
        {
          error: 'Availability conflict',
          conflicts: conflictResult.conflicts,
        },
        { status: 409 }
      );
    }

    const responseSeconds = Math.floor((now.getTime() - new Date(offer.offeredAt).getTime()) / 1000);

    // Update offer status
    await db.offerEvent.update({
      where: { id: offer.id },
      data: {
        status: 'accepted',
        acceptedAt: now,
      },
    });

    const previousStatus = booking?.status ?? 'pending';

    // Assign booking to sitter
    await db.booking.update({
      where: { id: bookingId },
      data: {
        sitterId: sitterId,
        status: 'confirmed',
      },
    });
    await syncConversationLifecycleWithBookingWorkflow({
      orgId,
      bookingId,
      clientId: (booking as any).clientId ?? null,
      phone: (booking as any).phone ?? null,
      firstName: (booking as any).firstName ?? null,
      lastName: (booking as any).lastName ?? null,
      sitterId,
      bookingStatus: 'confirmed',
      serviceWindowStart: booking.startAt,
      serviceWindowEnd: booking.endAt,
    }).catch((error) => {
      console.error('[Accept Booking] lifecycle sync failed:', error);
    });

    if (previousStatus !== 'confirmed') {
      try {
        await ensureEventQueueBridge();
        const updated = await db.booking.findUnique({
          where: { id: bookingId },
          include: { pets: true, timeSlots: true, sitter: true, client: true },
        });
        if (updated) await emitBookingUpdated(updated, previousStatus);
      } catch (err) {
        console.error('[Accept Booking] Failed to emit booking.status.changed:', err);
      }
    }

    // Record audit event
    await recordOfferAccepted(
      orgId,
      sitterId,
      bookingId,
      offer.id,
      responseSeconds,
      ctx.userId ?? undefined
    );

    // Update metrics window with response time
    await updateMetricsWindow(db, orgId, sitterId, responseSeconds, 'accepted');

    // Enqueue calendar sync (fail-open)
    enqueueCalendarSync({ type: 'upsert', bookingId, orgId }).catch((e) =>
      console.error('[Accept Booking] calendar sync enqueue failed:', e)
    );

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

    // Fire-and-forget notifications for pool acceptance
    void import('@/lib/notifications/triggers').then(async (triggers) => {
      const sitter = await db.sitter.findUnique({
        where: { id: sitterId },
        select: { firstName: true, lastName: true },
      });
      const sitterName = sitter ? `${sitter.firstName} ${sitter.lastName}`.trim() : 'Sitter';
      const clientName = `${(booking as any).firstName || ''} ${(booking as any).lastName || ''}`.trim();

      // N13: Sitter assigned notification
      triggers.notifySitterAssigned({
        orgId,
        bookingId,
        sitterId,
        sitterFirstName: sitter?.firstName || 'Sitter',
        clientName,
        service: (booking as any).service,
        startAt: (booking as any).startAt,
      });

      // N14: Owner pool accepted notification
      triggers.notifyOwnerPoolAccepted({
        orgId,
        bookingId,
        sitterName,
        clientName,
        service: (booking as any).service,
        startAt: (booking as any).startAt,
      });

      // N3: Other sitters notified booking is filled
      triggers.notifyPoolSittersOfferFilled({
        orgId,
        bookingId,
        acceptedSitterId: sitterId,
        service: (booking as any).service,
        startAt: (booking as any).startAt,
      });

      // N19: Notify client their sitter is confirmed
      if ((booking as any).clientId) {
        triggers.notifyClientSitterAssigned({
          orgId,
          bookingId,
          clientId: (booking as any).clientId,
          sitterName,
          service: (booking as any).service,
          startAt: (booking as any).startAt,
        });
      }
    }).catch(() => {});

    return NextResponse.json({ success: true, responseSeconds });
  } catch (error: any) {
    console.error('[Accept Booking API] Failed to accept booking:', error);
    return NextResponse.json(
      { error: 'Failed to accept booking', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Update metrics window with response time and acceptance
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
