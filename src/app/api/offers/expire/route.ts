/**
 * Offer Expiration API Route
 * 
 * POST: Expire offers that have passed their expiration time
 * Can be called periodically via cron job or scheduled task
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getScopedDb } from '@/lib/tenancy';
import { recordOfferExpired, recordOfferReassigned, recordOfferExhausted, recordManualDispatchRequired } from '@/lib/audit-events';
import { selectEligibleSitter } from '@/lib/sitter-eligibility';
import { resolveCorrelationId } from '@/lib/correlation-id';
import {
  getBookingAttemptCount,
  getSittersInCooldown,
  markBookingForManualDispatch,
  isBookingFlaggedForManualDispatch,
  MAX_REASSIGNMENT_ATTEMPTS,
  SITTER_COOLDOWN_HOURS,
} from '@/lib/offer-reassignment';

export async function POST(request: NextRequest) {
  // Require INTERNAL_API_KEY for cron/server-to-server calls
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey || !authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const correlationId = resolveCorrelationId(request);
    const now = new Date();

    // Cross-org query: intentionally uses raw prisma because this cron job
    // processes expired offers across ALL orgs. Per-offer mutations below
    // are scoped to each offer's orgId via getScopedDb.
    const expiredOffers = await (prisma as any).offerEvent.findMany({
      where: {
        status: 'sent',
        expiresAt: { lte: now },
        excluded: false,
      },
      include: {
        booking: {
          select: {
            id: true,
            sitterId: true,
            status: true,
            startAt: true,
            endAt: true,
          },
        },
      },
    });

    let expiredCount = 0;
    let bookingsReturnedToPool = 0;

    for (const offer of expiredOffers) {
      try {
        // Scope all mutations to this offer's org
        const db = getScopedDb({ orgId: offer.orgId });

        // Mark offer as expired (idempotent - check status first)
        if (offer.status === 'sent') {
          await db.offerEvent.update({
            where: { id: offer.id },
            data: {
              status: 'expired',
            },
          });
        }

        // Record audit event
        await recordOfferExpired(
          offer.orgId,
          offer.sitterId,
          offer.bookingId || '',
          offer.id,
          undefined,
          correlationId
        );

        expiredCount++;

        // Return booking to pool (unassign if not already assigned)
        if (offer.booking && offer.booking.status === 'pending' && !offer.booking.sitterId) {
          // Booking is already in pool - no action needed
          bookingsReturnedToPool++;
        } else if (offer.booking && offer.booking.sitterId === offer.sitterId) {
          // Booking was assigned to this sitter, but offer expired - unassign
          await db.booking.update({
            where: { id: offer.booking.id },
            data: {
              sitterId: null,
              status: 'pending', // Return to pending/unassigned
            },
          });
          bookingsReturnedToPool++;
        }

        // Optionally: Create new offer for next eligible sitter
        // Skip if booking is already flagged for manual dispatch or in manual_in_progress
        // Automation never fights manual control
        const booking = offer.booking;
        if (!offer.bookingId || !booking) {
          continue; // Skip if no booking
        }

        const dispatchStatus = booking.dispatchStatus || 'auto';
        
        // Only create offers if dispatchStatus is 'auto' (automation is active)
        // Automation never fights manual control (manual_required, manual_in_progress, assigned)
        if (dispatchStatus === 'auto') {
          try {
            // Check attempt count to prevent infinite loops
            const attemptCount = await getBookingAttemptCount(offer.orgId, offer.bookingId);
            
            if (attemptCount >= MAX_REASSIGNMENT_ATTEMPTS) {
              // Max attempts reached - mark for manual dispatch
              // markBookingForManualDispatch is idempotent, so safe to call multiple times
              const wasAlreadyManual = offer.booking.dispatchStatus === 'manual_required' || 
                                      offer.booking.dispatchStatus === 'manual_in_progress';
              
              await markBookingForManualDispatch(
                offer.orgId,
                offer.bookingId,
                `Max reassignment attempts (${attemptCount}) reached`
              );
              
              await recordOfferExhausted(
                offer.orgId,
                offer.bookingId,
                attemptCount,
                `Max attempts (${MAX_REASSIGNMENT_ATTEMPTS}) reached for booking`,
                undefined,
                correlationId
              );
              
              // Only record manual dispatch event once (idempotent check)
              if (!wasAlreadyManual) {
                await recordManualDispatchRequired(
                  offer.orgId,
                  offer.bookingId,
                  `Max reassignment attempts (${attemptCount}) reached`,
                  undefined,
                  correlationId
                );
              }
              
              console.log(`[Expire Offers] Booking ${offer.bookingId} exhausted after ${attemptCount} attempts`);
              continue; // Skip reassignment for this offer
            }

            const bookingWindow = {
              startAt: offer.booking.startAt,
              endAt: offer.booking.endAt,
            };

            // Get sitters in cooldown (exclude sitters who declined/expired recently)
            const cooldownSitterIds = await getSittersInCooldown(
              offer.orgId,
              offer.bookingId,
              SITTER_COOLDOWN_HOURS
            );

            // Select next eligible sitter (excluding expired sitter and cooldown sitters)
            const selection = await selectEligibleSitter(
              offer.orgId,
              offer.bookingId,
              bookingWindow,
              [offer.sitterId], // Exclude the sitter whose offer expired
              cooldownSitterIds // Exclude sitters in cooldown
            );

            if (selection.sitterId) {
              // Create new offer for the selected sitter (idempotent - check if offer already exists)
              const existingOffer = await db.offerEvent.findFirst({
                where: {
                  bookingId: offer.bookingId,
                  sitterId: selection.sitterId,
                  status: 'sent',
                  excluded: false,
                },
              });

              if (existingOffer) {
                // Offer already exists - skip creation (idempotency)
                console.log(`[Expire Offers] Offer already exists for booking ${offer.bookingId} and sitter ${selection.sitterId}`);
                continue;
              }

              const expiresAt = new Date();
              expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

              const newOffer = await (db.offerEvent as any).create({
                data: {
                  sitterId: selection.sitterId,
                  bookingId: offer.bookingId,
                  offeredAt: new Date(),
                  expiresAt: expiresAt,
                  status: 'sent',
                  excluded: false,
                },
              });

              // Record reassignment event with selection reason
              await recordOfferReassigned(
                offer.orgId,
                offer.sitterId,
                selection.sitterId,
                offer.bookingId,
                newOffer.id,
                `Offer expired (attempt ${attemptCount + 1}/${MAX_REASSIGNMENT_ATTEMPTS}), reassigned to ${selection.reason}`,
                undefined,
                correlationId
              );
            } else {
              // No eligible sitter found - mark for manual dispatch
              // markBookingForManualDispatch is idempotent, so safe to call multiple times
              const wasAlreadyManual = booking.dispatchStatus === 'manual_required' || 
                                      booking.dispatchStatus === 'manual_in_progress';
              
              await markBookingForManualDispatch(
                offer.orgId,
                offer.bookingId,
                `No eligible sitter found: ${selection.reason}`
              );
              
              // Only record manual dispatch event once (idempotent check)
              if (!wasAlreadyManual) {
                await recordManualDispatchRequired(
                  offer.orgId,
                  offer.bookingId,
                  `No eligible sitter found after ${attemptCount} attempts: ${selection.reason}`,
                  undefined,
                  correlationId
                );
              }
              
              console.log(`[Expire Offers] No eligible sitter found for booking ${offer.bookingId}: ${selection.reason}`);
            }
          } catch (reassignError: any) {
            // Log but don't fail - booking is already in pool
            console.error(`[Expire Offers] Failed to reassign booking ${offer.bookingId}:`, reassignError);
            // Mark for manual dispatch as fallback
            try {
              await markBookingForManualDispatch(
                offer.orgId,
                offer.bookingId,
                `Reassignment error: ${reassignError.message}`
              );
            } catch (markError) {
              console.error(`[Expire Offers] Failed to mark booking for manual dispatch:`, markError);
            }
          }
        }

        // Update metrics window for this sitter
        try {
          await updateMetricsWindowForExpired(offer.orgId, offer.sitterId);
        } catch (error) {
          console.error(`[Expire Offers] Failed to update metrics for sitter ${offer.sitterId}:`, error);
        }
      } catch (error: any) {
        // Log but continue processing other offers
        console.error(`[Expire Offers] Failed to process offer ${offer.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      expiredCount,
      bookingsReturnedToPool,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error('[Expire Offers API] Failed to expire offers:', error);
    return NextResponse.json(
      { error: 'Failed to expire offers', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Update metrics window when an offer expires.
 * Uses getScopedDb internally so all queries are org-scoped.
 */
async function updateMetricsWindowForExpired(orgId: string, sitterId: string) {
  const db = getScopedDb({ orgId });
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get all offers in this window to recalculate rates
  const offers = await (db as any).offerEvent.findMany({
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

  // Get response times (only for accepted/declined, not expired)
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

  // Get or create metrics window
  const existing = await (db as any).sitterMetricsWindow.findFirst({
    where: {
      sitterId,
      windowStart: { lte: sevenDaysAgo },
      windowEnd: { gte: now },
      windowType: 'weekly_7d',
    },
  });

  if (existing) {
    await (db as any).sitterMetricsWindow.update({
      where: { id: existing.id },
      data: {
        avgResponseSeconds,
        medianResponseSeconds,
        offerAcceptRate,
        offerDeclineRate,
        offerExpireRate,
        updatedAt: now,
      },
    });
  } else if (totalOffers > 0) {
    await (db as any).sitterMetricsWindow.create({
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
      },
    });
  }
}
