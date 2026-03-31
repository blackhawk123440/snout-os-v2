/**
 * Slot Availability Check
 *
 * "First-paid, first-secured" — checks how many sitters are available
 * for a given time slot. Used to:
 * 1. Show availability warnings on the booking form
 * 2. Auto-refund if slot fills during payment
 */

import { getScopedDb } from '@/lib/tenancy';

export async function checkSlotAvailability(params: {
  orgId: string;
  service: string;
  startAt: Date | string;
  endAt: Date | string;
  excludeBookingId?: string;
}): Promise<{ available: boolean; availableSitterCount: number }> {
  const { orgId, service, excludeBookingId } = params;
  const startAt = new Date(params.startAt);
  const endAt = new Date(params.endAt);
  const db = getScopedDb({ orgId });

  // Find all active sitters eligible for this service
  const activeSitters = await (db as any).sitter.findMany({
    where: { active: true, onboardingStatus: 'active', deletedAt: null },
    select: { id: true },
  });

  if (activeSitters.length === 0) {
    return { available: false, availableSitterCount: 0 };
  }

  // Find bookings that overlap with this time slot and have a sitter assigned
  const whereClause: any = {
    status: { in: ['confirmed', 'in_progress', 'pending_payment'] },
    sitterId: { not: null },
    startAt: { lt: endAt },
    endAt: { gt: startAt },
  };
  if (excludeBookingId) {
    whereClause.id = { not: excludeBookingId };
  }

  const conflictingBookings = await (db as any).booking.findMany({
    where: whereClause,
    select: { sitterId: true },
  });

  const busySitterIds = new Set<string>(
    conflictingBookings.map((b: any) => b.sitterId).filter(Boolean)
  );

  const availableSitterCount = activeSitters.filter(
    (s: any) => !busySitterIds.has(s.id)
  ).length;

  return {
    available: availableSitterCount > 0,
    availableSitterCount,
  };
}
