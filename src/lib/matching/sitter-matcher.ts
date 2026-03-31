/**
 * Sitter Matching Engine (Phase 3.1)
 *
 * Weighted scoring algorithm that ranks sitters for a booking based on:
 * - Availability (0-30) — uses full availability engine (rules, overrides, bookings, time-off)
 * - Pet familiarity (0-20)
 * - SRS score (0-20)
 * - Workload balance (0-15)
 * - Client history (0-15)
 */

import { prisma } from '@/lib/db';
import { checkConflict } from '@/lib/availability/engine';

export interface MatchInput {
  orgId: string;
  service: string;
  startAt: Date;
  endAt: Date;
  clientId: string;
  lat?: number | null;
  lng?: number | null;
  /** If true, skip tier-based filtering (used when caller handles it). */
  skipTierFilter?: boolean;
  totalPrice?: number;
  isRecurring?: boolean;
}

export interface SitterMatch {
  sitterId: string;
  sitterName: string;
  score: number; // 0-100
  breakdown: {
    availability: number;   // 0-30 points
    petFamiliarity: number; // 0-20 points
    srsScore: number;       // 0-20 points
    workloadBalance: number;// 0-15 points
    clientHistory: number;  // 0-15 points
  };
  /** Human-readable reasons explaining why this sitter was recommended (or not). */
  reasons: string[];
  /** Primary reason for the ranking position. */
  topReason: string;
  /** Set when sitter is unavailable per their schedule rules. Owner can still override. */
  unavailableReason?: string;
}

/**
 * Generate human-readable reason labels from scoring breakdown.
 */
function generateReasons(breakdown: SitterMatch['breakdown'], unavailableReason?: string): { reasons: string[]; topReason: string } {
  const reasons: string[] = [];

  // Availability
  if (unavailableReason) {
    reasons.push('Unavailable per their schedule');
  } else if (breakdown.availability === 30) {
    reasons.push('Available at this time');
  } else {
    reasons.push('Has a scheduling conflict');
  }

  // Pet familiarity
  if (breakdown.petFamiliarity >= 20) reasons.push('Knows these pets well (4+ visits)');
  else if (breakdown.petFamiliarity >= 10) reasons.push('Has visited before');

  // Reliability
  if (breakdown.srsScore >= 16) reasons.push('High reliability score');
  else if (breakdown.srsScore >= 10) reasons.push('Good reliability');

  // Workload
  if (breakdown.workloadBalance >= 15) reasons.push('Light schedule today');
  else if (breakdown.workloadBalance >= 10) reasons.push('Moderate schedule today');
  else if (breakdown.workloadBalance <= 5) reasons.push('Heavy schedule today');

  // Client history
  if (breakdown.clientHistory >= 12) reasons.push('Great client feedback');
  else if (breakdown.clientHistory >= 7) reasons.push('Positive client history');

  // Pick the strongest positive as top reason
  const topReason = unavailableReason
    ? 'Unavailable per their schedule'
    : breakdown.availability === 0
    ? 'Scheduling conflict'
    : breakdown.petFamiliarity >= 20
    ? 'Familiar with these pets'
    : breakdown.srsScore >= 16
    ? 'Top-rated sitter'
    : breakdown.workloadBalance >= 15
    ? 'Available and light schedule'
    : breakdown.clientHistory >= 12
    ? 'Great feedback from this client'
    : 'Available';

  return { reasons, topReason };
}

/**
 * Score availability using the full availability engine.
 * Checks: SitterAvailabilityRule, overrides, existing bookings, time-off.
 * Returns 30 if fully available, 0 if any conflict, plus conflict reason.
 */
async function scoreAvailability(
  sitterId: string,
  orgId: string,
  startAt: Date,
  endAt: Date,
): Promise<{ score: number; unavailableReason?: string }> {
  try {
    const result = await checkConflict({
      db: prisma as any,
      orgId,
      sitterId,
      start: startAt,
      end: endAt,
      respectGoogleBusy: false, // Don't block on Google Calendar for ranking
      checkTravelBuffer: false, // Travel buffer is too strict for suggestions
    });

    if (!result.ok) {
      // Determine the primary conflict reason for display
      const primaryConflict = result.conflicts[0];
      const reason = primaryConflict?.reason === 'outside_availability'
        ? 'Outside their availability schedule'
        : primaryConflict?.reason === 'booking_conflict'
        ? 'Has a scheduling conflict'
        : primaryConflict?.reason === 'blackout'
        ? 'Blocked off this date'
        : primaryConflict?.detail || 'Unavailable';

      return { score: 0, unavailableReason: reason };
    }

    return { score: 30 };
  } catch (error) {
    // If engine fails, fall back to simple booking overlap check
    console.error('[sitter-matcher] Availability engine check failed, using fallback:', error);
    const conflicting = await prisma.booking.findFirst({
      where: {
        orgId,
        sitterId,
        status: { notIn: ['cancelled', 'canceled'] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });
    return { score: conflicting ? 0 : 30 };
  }
}

/**
 * Score pet familiarity based on how many times this sitter has served this client.
 * 0 visits = 0, 1-3 = 10, 4+ = 20
 */
async function scorePetFamiliarity(
  sitterId: string,
  orgId: string,
  clientId: string,
): Promise<number> {
  const pastVisits = await prisma.booking.count({
    where: {
      orgId,
      sitterId,
      clientId,
      status: { in: ['completed', 'confirmed'] },
    },
  });

  if (pastVisits >= 4) return 20;
  if (pastVisits >= 1) return 10;
  return 0;
}

/**
 * Score based on SRS (Sitter Reliability Score).
 * Uses the latest SitterTierSnapshot's rolling30dScore, normalized to 0-20.
 * If no snapshot exists, defaults to 10.
 */
async function scoreSrs(
  sitterId: string,
  orgId: string,
): Promise<number> {
  const snapshot = await prisma.sitterTierSnapshot.findFirst({
    where: { orgId, sitterId },
    orderBy: { asOfDate: 'desc' },
    select: { rolling30dScore: true },
  });

  if (!snapshot) return 10;

  // rolling30dScore is 0-100, normalize to 0-20
  return Math.round((snapshot.rolling30dScore / 100) * 20);
}

/**
 * Score workload balance based on bookings today.
 * 0 bookings = 15, 1-3 = 10, 4-6 = 5, 7+ = 0
 */
async function scoreWorkloadBalance(
  sitterId: string,
  orgId: string,
): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayBookings = await prisma.booking.count({
    where: {
      orgId,
      sitterId,
      status: { notIn: ['cancelled', 'canceled'] },
      startAt: { gte: todayStart, lte: todayEnd },
    },
  });

  if (todayBookings === 0) return 15;
  if (todayBookings <= 3) return 10;
  if (todayBookings <= 6) return 5;
  return 0;
}

/**
 * Score client history based on past visit report ratings.
 * Positive rating (4-5) = 15, neutral (3) = 7, no reports or low = 0
 */
async function scoreClientHistory(
  sitterId: string,
  orgId: string,
  clientId: string,
): Promise<number> {
  const reports = await prisma.report.findMany({
    where: {
      orgId,
      sitterId,
      clientId,
      clientRating: { not: null },
    },
    select: { clientRating: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (reports.length === 0) return 0;

  const avgRating =
    reports.reduce((sum, r) => sum + (r.clientRating ?? 0), 0) / reports.length;

  if (avgRating >= 4) return 15;
  if (avgRating >= 3) return 7;
  return 0;
}

/**
 * Rank all active sitters in an org for a given booking.
 * Returns scored matches sorted by total score descending.
 * Unavailable sitters are included but ranked last with unavailableReason set.
 */
export async function rankSittersForBooking(
  input: MatchInput,
): Promise<SitterMatch[]> {
  const { orgId, startAt, endAt, clientId, lat, lng } = input;

  // 1. Query all active sitters for the org
  let sitters = await prisma.sitter.findMany({
    where: {
      orgId,
      active: true,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  // 1b. Zone filtering: if lat/lng provided, prefer sitters in matching zones
  if (lat != null && lng != null) {
    try {
      const { filterSittersByZone } = await import('@/lib/zones/point-in-polygon');
      const zoneResult = await filterSittersByZone(orgId, lat, lng);
      if (zoneResult.filteredSitterIds && zoneResult.filteredSitterIds.length > 0) {
        const zoneSet = new Set(zoneResult.filteredSitterIds);
        sitters = sitters.filter(s => zoneSet.has(s.id));
      }
    } catch { /* zone filtering is optional */ }
  }

  // 2. Score each sitter in parallel
  const matches: SitterMatch[] = await Promise.all(
    sitters.map(async (sitter) => {
      const [availResult, petFamiliarity, srsScore, workloadBalance, clientHistory] =
        await Promise.all([
          scoreAvailability(sitter.id, orgId, startAt, endAt),
          scorePetFamiliarity(sitter.id, orgId, clientId),
          scoreSrs(sitter.id, orgId),
          scoreWorkloadBalance(sitter.id, orgId),
          scoreClientHistory(sitter.id, orgId, clientId),
        ]);

      const breakdown = {
        availability: availResult.score,
        petFamiliarity,
        srsScore,
        workloadBalance,
        clientHistory,
      };

      const score =
        breakdown.availability +
        breakdown.petFamiliarity +
        breakdown.srsScore +
        breakdown.workloadBalance +
        breakdown.clientHistory;

      const { reasons, topReason } = generateReasons(breakdown, availResult.unavailableReason);

      return {
        sitterId: sitter.id,
        sitterName: `${sitter.firstName} ${sitter.lastName}`.trim(),
        score,
        breakdown,
        reasons,
        topReason,
        ...(availResult.unavailableReason ? { unavailableReason: availResult.unavailableReason } : {}),
      };
    }),
  );

  // 3. Sort by total score descending
  matches.sort((a, b) => b.score - a.score);

  return matches;
}
