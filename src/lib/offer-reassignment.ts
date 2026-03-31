/**
 * Offer Reassignment Helper
 * 
 * Production-safe offer reassignment with attempt tracking, cooldowns, and escalation.
 */

import { prisma } from '@/lib/db';

// Configuration constants
export const MAX_REASSIGNMENT_ATTEMPTS = 5; // Max attempts per booking
export const SITTER_COOLDOWN_HOURS = 24; // Hours before re-offering to a sitter who declined/expired

/**
 * Get attempt count for a booking (count of all offers for this booking)
 */
export async function getBookingAttemptCount(
  orgId: string,
  bookingId: string
): Promise<number> {
  const offers = await (prisma as any).offerEvent.findMany({
    where: {
      orgId,
      bookingId,
      excluded: false,
    },
    select: { id: true },
  });
  return offers.length;
}

/**
 * Get sitter IDs that should be excluded due to cooldown
 * (sitters who declined/expired an offer for this booking within cooldown period)
 */
export async function getSittersInCooldown(
  orgId: string,
  bookingId: string,
  cooldownHours: number = SITTER_COOLDOWN_HOURS
): Promise<string[]> {
  const cooldownThreshold = new Date();
  cooldownThreshold.setHours(cooldownThreshold.getHours() - cooldownHours);

  const recentOffers = await (prisma as any).offerEvent.findMany({
    where: {
      orgId,
      bookingId,
      status: { in: ['declined', 'expired'] },
      OR: [
        { declinedAt: { gte: cooldownThreshold } },
        { updatedAt: { gte: cooldownThreshold } }, // For expired offers
      ],
      excluded: false,
    },
    select: { sitterId: true },
    distinct: ['sitterId'],
  });

  return recentOffers.map((o: any) => o.sitterId);
}

/**
 * Mark booking as requiring manual dispatch
 * 
 * Idempotent: Only updates if not already in manual_required state
 */
export async function markBookingForManualDispatch(
  orgId: string,
  bookingId: string,
  reason: string
): Promise<void> {
  // Check current state (idempotent check)
  const booking = await (prisma as any).booking.findUnique({
    where: { id: bookingId },
    select: {
      dispatchStatus: true,
      manualDispatchReason: true,
      notes: true,
    },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  // If already in manual_required state, skip update (idempotent)
  if (booking.dispatchStatus === 'manual_required') {
    return;
  }

  const now = new Date();
  
  // Update to manual_required state
  await (prisma as any).booking.update({
    where: { id: bookingId },
    data: {
      dispatchStatus: 'manual_required',
      manualDispatchReason: reason,
      manualDispatchAt: now,
      status: 'pending', // Ensure it's in pool
      sitterId: null, // Ensure unassigned
    },
  });
}

/**
 * Check if booking is flagged for manual dispatch
 * 
 * Backward compatible: Also checks notes field for legacy [MANUAL_DISPATCH] flag
 */
export async function isBookingFlaggedForManualDispatch(
  bookingId: string
): Promise<boolean> {
  const booking = await (prisma as any).booking.findUnique({
    where: { id: bookingId },
    select: {
      dispatchStatus: true,
      notes: true,
    },
  });

  if (!booking) {
    return false;
  }

  // Check new first-class field
  if (booking.dispatchStatus === 'manual_required' || booking.dispatchStatus === 'manual_in_progress') {
    return true;
  }

  // Backward compatibility: Check notes for legacy flag
  if (booking.notes?.includes('[MANUAL_DISPATCH]')) {
    // Migrate on read (lazy migration)
    try {
      await migrateLegacyManualDispatchFlag(bookingId, booking.notes);
    } catch (error) {
      console.error(`[Manual Dispatch] Failed to migrate legacy flag for booking ${bookingId}:`, error);
    }
    return true;
  }

  return false;
}

/**
 * Migrate legacy [MANUAL_DISPATCH] flag from notes to dispatchStatus
 * 
 * This is called lazily when reading a booking with the legacy flag.
 */
async function migrateLegacyManualDispatchFlag(
  bookingId: string,
  notes: string | null
): Promise<void> {
  if (!notes?.includes('[MANUAL_DISPATCH]')) {
    return;
  }

  // Extract reason from notes
  const match = notes.match(/\[MANUAL_DISPATCH\]\s*(.+?)(?:\n|$)/);
  const reason = match ? match[1].trim() : 'Legacy manual dispatch flag';

  // Update to new field structure
  await (prisma as any).booking.update({
    where: { id: bookingId },
    data: {
      dispatchStatus: 'manual_required',
      manualDispatchReason: reason,
      manualDispatchAt: new Date(),
    },
  });

  // Optionally clean up notes (remove the flag, keep other notes)
  const cleanedNotes = notes
    .replace(/\[MANUAL_DISPATCH\][^\n]*\n?/g, '')
    .trim();
  
  if (cleanedNotes !== notes) {
    await (prisma as any).booking.update({
      where: { id: bookingId },
      data: {
        notes: cleanedNotes || null,
      },
    });
  }
}
