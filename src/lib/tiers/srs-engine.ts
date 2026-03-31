/**
 * Service Reliability Score (SRS) Engine
 * 
 * Implements the exact tier specification from SITTER_TIER_SYSTEM_DESIGN.md
 * Event-driven, deterministic, auditable scoring based on Twilio + system events
 */

import { prisma } from '@/lib/db';

export interface SRSBreakdown {
  responsiveness: number; // 0-20
  acceptance: number; // 0-12
  completion: number; // 0-8
  timeliness: number; // 0-20
  accuracy: number; // 0-20
  engagement: number; // 0-10
  conduct: number; // 0-10
}

export interface SRSScoreResult {
  score: number; // 0-100
  breakdown: SRSBreakdown;
  provisional: boolean;
  visits30d: number;
  offers30d: number;
  flags: {
    atRisk: boolean;
    atRiskReason?: string;
  };
  tierRecommendation: 'foundation' | 'reliant' | 'trusted' | 'preferred';
  sampleSizes: {
    responsiveness: number;
    acceptance: number;
    completion: number;
    timeliness: number;
    accuracy: number;
    engagement: number;
    conduct: number;
  };
}

/**
 * Get orgId for a sitter (derived from related entities)
 */
async function getSitterOrgId(sitterId: string): Promise<string | null> {
  // Try to get orgId from MessageThread (most reliable)
  const thread = await (prisma as any).messageThread.findFirst({
    where: { assignedSitterId: sitterId },
    select: { orgId: true },
  });
  if (thread?.orgId) return thread.orgId;

  // Try from AssignmentWindow
  const window = await (prisma as any).assignmentWindow.findFirst({
    where: { sitterId },
    select: { orgId: true },
  });
  if (window?.orgId) return window.orgId;

  // Try from Booking
  const booking = await (prisma as any).booking.findFirst({
    where: { sitterId },
    select: { id: true },
  });
  if (booking) {
    const bookingThread = await (prisma as any).messageThread.findFirst({
      where: { bookingId: booking.id },
      select: { orgId: true },
    });
    if (bookingThread?.orgId) return bookingThread.orgId;
  }

  return null;
}

/**
 * Calculate Responsiveness score (0-20)
 * Based on median response time bands
 */
async function calculateResponsiveness(
  orgId: string,
  sitterId: string,
  asOfDate: Date
): Promise<{ score: number; sampleSize: number }> {
  const windowStart = new Date(asOfDate);
  windowStart.setDate(windowStart.getDate() - 30);

  // Get active assignment windows in the period
  const assignmentWindows = await (prisma as any).assignmentWindow.findMany({
    where: {
      orgId,
      sitterId,
      startAt: { lte: asOfDate },
      endAt: { gte: windowStart },
      status: 'active',
    },
  });

  // Get time off periods to exclude
  const timeOffs = await (prisma as any).sitterTimeOff.findMany({
    where: {
      orgId,
      sitterId,
      OR: [
        { startsAt: { lte: asOfDate }, endsAt: { gte: windowStart } },
      ],
    },
  });

  // Get threads assigned to this sitter
  const sitterThreads = await (prisma as any).messageThread.findMany({
    where: {
      orgId,
      assignedSitterId: sitterId,
    },
    select: { id: true },
  });
  const threadIds = sitterThreads.map((t: any) => t.id);

  if (threadIds.length === 0) {
    return { score: 0, sampleSize: 0 };
  }

  // Get messages requiring response within assignment windows
  const responseLinks = await (prisma as any).messageResponseLink.findMany({
    where: {
      orgId,
      threadId: { in: threadIds },
      requiresResponseEvent: {
        createdAt: { gte: windowStart, lte: asOfDate },
        direction: 'inbound',
        actorType: 'client',
        requiresResponse: true,
      },
      withinAssignmentWindow: true,
      excluded: false,
    },
    include: {
      requiresResponseEvent: {
        select: { createdAt: true },
      },
      responseEvent: {
        select: { createdAt: true },
      },
    },
  });

  // Filter out time off periods
  const validResponses = responseLinks.filter((link: any) => {
    const messageTime = new Date(link.requiresResponseEvent.createdAt);
    return !timeOffs.some((to: any) => 
      messageTime >= new Date(to.startsAt) && messageTime <= new Date(to.endsAt)
    );
  });

  if (validResponses.length === 0) {
    return { score: 0, sampleSize: 0 };
  }

  // Calculate response times in minutes
  const responseTimes = validResponses
    .map((link: any) => {
      const responseTime = new Date(link.responseEvent.createdAt).getTime();
      const requireTime = new Date(link.requiresResponseEvent.createdAt).getTime();
      return Math.floor((responseTime - requireTime) / (1000 * 60));
    })
    .filter((minutes: number) => minutes >= 0);

  if (responseTimes.length === 0) {
    return { score: 0, sampleSize: validResponses.length };
  }

  // Calculate median
  responseTimes.sort((a: number, b: number) => a - b);
  const median = responseTimes[Math.floor(responseTimes.length / 2)];

  // Apply bands
  let score = 0;
  if (median <= 5) score = 20;
  else if (median <= 10) score = 16;
  else if (median <= 20) score = 12;
  else if (median <= 45) score = 8;
  else if (median <= 90) score = 4;
  else score = 0;

  return { score, sampleSize: responseTimes.length };
}

/**
 * Calculate Booking Reliability score (0-20)
 * Acceptance (0-12) + Completion (0-8)
 */
async function calculateBookingReliability(
  orgId: string,
  sitterId: string,
  asOfDate: Date
): Promise<{ acceptance: number; completion: number; acceptanceSamples: number; completionSamples: number }> {
  const windowStart = new Date(asOfDate);
  windowStart.setDate(windowStart.getDate() - 30);

  // Get all offers in period
  const offers = await (prisma as any).offerEvent.findMany({
    where: {
      orgId,
      sitterId,
      offeredAt: { gte: windowStart, lte: asOfDate },
      excluded: false,
    },
  });

  const totalOffers = offers.length;
  const accepted = offers.filter((o: any) => o.acceptedAt !== null).length;
  const declined = offers.filter((o: any) => o.declinedAt !== null).length;

  // Acceptance rate
  const acceptanceRate = totalOffers > 0 ? accepted / totalOffers : 0;
  let acceptanceScore = 0;
  if (acceptanceRate >= 0.90) acceptanceScore = 12;
  else if (acceptanceRate >= 0.85) acceptanceScore = 10;
  else if (acceptanceRate >= 0.80) acceptanceScore = 8;
  else if (acceptanceRate >= 0.75) acceptanceScore = 6;
  else if (acceptanceRate >= 0.70) acceptanceScore = 4;
  else acceptanceScore = 0;

  // Completion rate (from accepted bookings)
  const acceptedBookingIds = offers
    .filter((o: any) => o.acceptedAt !== null && o.bookingId)
    .map((o: any) => o.bookingId);

  const visits = await (prisma as any).visitEvent.findMany({
    where: {
      orgId,
      sitterId,
      bookingId: { in: acceptedBookingIds },
      excluded: false,
    },
  });

  const totalVisits = visits.length;
  const completed = visits.filter((v: any) => v.status === 'completed').length;

  const completionRate = totalVisits > 0 ? completed / totalVisits : 1.0;
  let completionScore = 0;
  if (completionRate >= 0.99) completionScore = 8;
  else if (completionRate >= 0.97) completionScore = 6;
  else if (completionRate >= 0.95) completionScore = 4;
  else if (completionRate >= 0.92) completionScore = 2;
  else completionScore = 0;

  return {
    acceptance: acceptanceScore,
    completion: completionScore,
    acceptanceSamples: totalOffers,
    completionSamples: totalVisits,
  };
}

/**
 * Calculate Timeliness score (0-20)
 */
async function calculateTimeliness(
  orgId: string,
  sitterId: string,
  asOfDate: Date
): Promise<{ score: number; sampleSize: number }> {
  const windowStart = new Date(asOfDate);
  windowStart.setDate(windowStart.getDate() - 30);

  const visits = await (prisma as any).visitEvent.findMany({
    where: {
      orgId,
      sitterId,
      scheduledStart: { gte: windowStart, lte: asOfDate },
      excluded: false,
    },
  });

  if (visits.length === 0) {
    return { score: 0, sampleSize: 0 };
  }

  let score = 0;
  visits.forEach((visit: any) => {
    if (visit.status === 'completed' && visit.lateMinutes === 0) {
      score += 1; // OnTime
    } else if (visit.status === 'completed' && visit.lateMinutes > 0 && visit.lateMinutes <= 15) {
      score += 0; // LateMinor
    } else if (visit.status === 'completed' && visit.lateMinutes > 15) {
      score -= 2; // LateMajor
    } else if (visit.status === 'missed') {
      score -= 6; // Missed
    }
  });

  // Normalize to 0-20 range
  const normalized = Math.max(0, Math.min(20, (score / visits.length) * 20 + 10));

  return { score: normalized, sampleSize: visits.length };
}

/**
 * Calculate Visit Accuracy score (0-20)
 */
async function calculateVisitAccuracy(
  orgId: string,
  sitterId: string,
  asOfDate: Date
): Promise<{ score: number; sampleSize: number }> {
  const windowStart = new Date(asOfDate);
  windowStart.setDate(windowStart.getDate() - 30);

  const visits = await (prisma as any).visitEvent.findMany({
    where: {
      orgId,
      sitterId,
      scheduledStart: { gte: windowStart, lte: asOfDate },
      excluded: false,
      status: 'completed',
    },
  });

  if (visits.length === 0) {
    return { score: 20, sampleSize: 0 };
  }

  // Calculate penalties per 10 visits
  const totalPenalties = visits.reduce((sum: number, visit: any) => {
    return sum + (visit.checklistMissedCount || 0) + (visit.mediaMissingCount || 0) + (visit.complaintVerified ? 3 : 0) + (visit.safetyFlag ? 5 : 0);
  }, 0);

  const visitsPer10 = visits.length / 10;
  const penaltyPer10 = totalPenalties / visitsPer10;

  // Score = max(0, 20 - PenaltyPer10)
  const score = Math.max(0, 20 - penaltyPer10);

  return { score, sampleSize: visits.length };
}

/**
 * Calculate Engagement score (0-10)
 */
async function calculateEngagement(
  orgId: string,
  sitterId: string,
  asOfDate: Date
): Promise<{ score: number; sampleSize: number; quotaPercent: number }> {
  const windowStart = new Date(asOfDate);
  windowStart.setDate(windowStart.getDate() - 30);

  // Get current tier to determine quota
  const latestSnapshot = await (prisma as any).sitterTierSnapshot.findFirst({
    where: { orgId, sitterId },
    orderBy: { asOfDate: 'desc' },
  });

  const tier = latestSnapshot?.tier || 'foundation';
  const quotaRanges: Record<string, { min: number; max: number }> = {
    foundation: { min: 20, max: 30 },
    reliant: { min: 35, max: 45 },
    trusted: { min: 55, max: 65 },
    preferred: { min: 70, max: 80 },
  };

  const quota = quotaRanges[tier]?.max || 30;

  // Count visits in period
  const visits = await (prisma as any).visitEvent.findMany({
    where: {
      orgId,
      sitterId,
      scheduledStart: { gte: windowStart, lte: asOfDate },
      excluded: false,
      status: { in: ['completed', 'late'] },
    },
  });

  const actualVisits = visits.length;
  const quotaPercent = quota > 0 ? (actualVisits / quota) * 100 : 0;

  let score = 0;
  if (quotaPercent >= 100) score = 10;
  else if (quotaPercent >= 90) score = 8;
  else if (quotaPercent >= 80) score = 6;
  else if (quotaPercent >= 70) score = 4;
  else score = 0;

  return { score, sampleSize: actualVisits, quotaPercent };
}

/**
 * Calculate Professional Conduct score (0-10)
 */
async function calculateConduct(
  orgId: string,
  sitterId: string,
  asOfDate: Date
): Promise<{ score: number; sampleSize: number }> {
  const windowStart = new Date(asOfDate);
  windowStart.setDate(windowStart.getDate() - 30);

  const events = await (prisma as any).sitterServiceEvent.findMany({
    where: {
      orgId,
      sitterId,
      effectiveFrom: { lte: asOfDate },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: windowStart } },
      ],
    },
  });

  const coachingCount = events.filter((e: any) => e.level === 'coaching').length;
  const correctiveCount = events.filter((e: any) => e.level === 'corrective').length;
  const probationCount = events.filter((e: any) => e.level === 'probation').length;

  let score = 10;
  if (probationCount > 0) score = 0;
  else if (correctiveCount > 0) score = 2;
  else if (coachingCount >= 2) score = 5;
  else if (coachingCount === 1) score = 7;
  else score = 10;

  return { score, sampleSize: events.length };
}

/**
 * Main SRS calculation function
 */
export async function calculateSRS(
  orgId: string,
  sitterId: string,
  asOfDate: Date = new Date()
): Promise<SRSScoreResult> {
  // Ensure orgId is available
  if (!orgId) {
    const derivedOrgId = await getSitterOrgId(sitterId);
    if (!derivedOrgId) {
      throw new Error(`Cannot determine orgId for sitter ${sitterId}`);
    }
    orgId = derivedOrgId;
  }

  // Calculate all category scores
  const [responsiveness, bookingReliability, timeliness, accuracy, engagement, conduct] = await Promise.all([
    calculateResponsiveness(orgId, sitterId, asOfDate),
    calculateBookingReliability(orgId, sitterId, asOfDate),
    calculateTimeliness(orgId, sitterId, asOfDate),
    calculateVisitAccuracy(orgId, sitterId, asOfDate),
    calculateEngagement(orgId, sitterId, asOfDate),
    calculateConduct(orgId, sitterId, asOfDate),
  ]);

  // Build breakdown
  const breakdown: SRSBreakdown = {
    responsiveness: responsiveness.score,
    acceptance: bookingReliability.acceptance,
    completion: bookingReliability.completion,
    timeliness: timeliness.score,
    accuracy: accuracy.score,
    engagement: engagement.score,
    conduct: conduct.score,
  };

  // Calculate total score (weighted)
  const totalScore = 
    breakdown.responsiveness * 0.20 +
    (breakdown.acceptance + breakdown.completion) * 0.25 +
    breakdown.timeliness * 0.20 +
    breakdown.accuracy * 0.20 +
    breakdown.engagement * 0.10 +
    breakdown.conduct * 0.10;

  // Check provisional status
  const visits30d = engagement.sampleSize;
  const provisional = visits30d < 15;

  // Get offers count
  const windowStart = new Date(asOfDate);
  windowStart.setDate(windowStart.getDate() - 30);
  const offers30d = await (prisma as any).offerEvent.count({
    where: {
      orgId,
      sitterId,
      offeredAt: { gte: windowStart, lte: asOfDate },
      excluded: false,
    },
  });

  // Determine tier recommendation
  let tierRecommendation: 'foundation' | 'reliant' | 'trusted' | 'preferred' = 'foundation';
  if (totalScore >= 90) tierRecommendation = 'preferred';
  else if (totalScore >= 80) tierRecommendation = 'trusted';
  else if (totalScore >= 70) tierRecommendation = 'reliant';
  else tierRecommendation = 'foundation';

  return {
    score: Math.round(totalScore * 100) / 100,
    breakdown,
    provisional,
    visits30d,
    offers30d,
    flags: {
      atRisk: false, // Will be set by tier evaluation
      atRiskReason: undefined,
    },
    tierRecommendation,
    sampleSizes: {
      responsiveness: responsiveness.sampleSize,
      acceptance: bookingReliability.acceptanceSamples,
      completion: bookingReliability.completionSamples,
      timeliness: timeliness.sampleSize,
      accuracy: accuracy.sampleSize,
      engagement: engagement.sampleSize,
      conduct: conduct.sampleSize,
    },
  };
}

/**
 * Calculate rolling 26-week score
 */
export async function calculateRolling26WeekScore(
  orgId: string,
  sitterId: string,
  asOfDate: Date = new Date()
): Promise<{ score: number; breakdown: SRSBreakdown } | null> {
  const windowStart = new Date(asOfDate);
  windowStart.setDate(windowStart.getDate() - 26 * 7);

  // Get all snapshots in the 26-week window
  const snapshots = await (prisma as any).sitterTierSnapshot.findMany({
    where: {
      orgId,
      sitterId,
      asOfDate: { gte: windowStart, lte: asOfDate },
    },
    orderBy: { asOfDate: 'asc' },
  });

  if (snapshots.length === 0) {
    return null;
  }

  // Average the scores
  const totalScore = snapshots.reduce((sum: number, s: any) => sum + s.rolling30dScore, 0);
  const avgScore = totalScore / snapshots.length;

  // Average breakdowns
  const breakdowns = snapshots.map((s: any) => JSON.parse(s.rolling30dBreakdownJson));
  const avgBreakdown: SRSBreakdown = {
    responsiveness: breakdowns.reduce((sum: number, b: any) => sum + (b.responsiveness || 0), 0) / breakdowns.length,
    acceptance: breakdowns.reduce((sum: number, b: any) => sum + (b.acceptance || 0), 0) / breakdowns.length,
    completion: breakdowns.reduce((sum: number, b: any) => sum + (b.completion || 0), 0) / breakdowns.length,
    timeliness: breakdowns.reduce((sum: number, b: any) => sum + (b.timeliness || 0), 0) / breakdowns.length,
    accuracy: breakdowns.reduce((sum: number, b: any) => sum + (b.accuracy || 0), 0) / breakdowns.length,
    engagement: breakdowns.reduce((sum: number, b: any) => sum + (b.engagement || 0), 0) / breakdowns.length,
    conduct: breakdowns.reduce((sum: number, b: any) => sum + (b.conduct || 0), 0) / breakdowns.length,
  };

  return {
    score: Math.round(avgScore * 100) / 100,
    breakdown: avgBreakdown,
  };
}
