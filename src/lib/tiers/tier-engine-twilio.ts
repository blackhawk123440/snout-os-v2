/**
 * Tier Engine - Twilio Event Based
 * 
 * Computes sitter tiers from Twilio messaging events:
 * - SMS response times
 * - Booking offer accept/decline via SMS
 * - Offer timeouts
 */

import { PrismaClient } from '@prisma/client';
import { recordTierChanged } from '@/lib/audit-events';

const prisma = new PrismaClient();

export interface TierMetrics {
  avgResponseSeconds: number;
  medianResponseSeconds: number;
  responseRate: number; // responded threads / total requiring response
  offerAcceptRate: number; // accepted / total offers
  offerDeclineRate: number; // declined / total offers
  offerExpireRate: number; // expired / total offers
}

export interface TierComputation {
  tier: string; // Bronze | Silver | Gold | Platinum
  metrics: TierMetrics;
  reasons: string[]; // What drove this tier
  explanation: string; // Human-readable explanation
}

/**
 * Compute tier for a sitter based on last N days of metrics
 */
export async function computeTierForSitter(
  orgId: string,
  sitterId: string,
  windowDays: number = 7
): Promise<TierComputation> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);
  const windowEnd = new Date();

  // Get or create metrics window
  const metricsWindow = await getOrCreateMetricsWindow(
    orgId,
    sitterId,
    windowStart,
    windowEnd,
    windowDays === 7 ? 'weekly_7d' : windowDays === 30 ? 'monthly_30d' : 'daily'
  );

  // Compute metrics from raw events if window is stale or missing
  if (!metricsWindow || shouldRecalculate(metricsWindow)) {
    const computedMetrics = await computeMetricsFromEvents(orgId, sitterId, windowStart, windowEnd);
    await updateMetricsWindow(orgId, sitterId, windowStart, windowEnd, computedMetrics);
    return computeTierFromMetrics(computedMetrics);
  }

  // Use cached metrics
  const metrics: TierMetrics = {
    avgResponseSeconds: metricsWindow.avgResponseSeconds || 0,
    medianResponseSeconds: metricsWindow.medianResponseSeconds || 0,
    responseRate: metricsWindow.responseRate || 0,
    offerAcceptRate: metricsWindow.offerAcceptRate || 0,
    offerDeclineRate: metricsWindow.offerDeclineRate || 0,
    offerExpireRate: metricsWindow.offerExpireRate || 0,
  };

  return computeTierFromMetrics(metrics);
}

/**
 * Compute metrics from raw MessageEvent and OfferEvent data
 */
async function computeMetricsFromEvents(
  orgId: string,
  sitterId: string,
  windowStart: Date,
  windowEnd: Date
): Promise<TierMetrics> {
  // Get sitter's threads
  const threads = await (prisma as any).messageThread.findMany({
    where: {
      orgId,
      assignedSitterId: sitterId,
    },
    select: { id: true },
  });
  const threadIds = threads.map((t: any) => t.id);

  // Compute response metrics from MessageResponseLink
  const responseLinks = await (prisma as any).messageResponseLink.findMany({
    where: {
      orgId,
      threadId: { in: threadIds },
      createdAt: { gte: windowStart, lte: windowEnd },
      excluded: false,
      withinAssignmentWindow: true,
    },
    select: {
      responseSeconds: true,
      responseMinutes: true,
    },
  });

  // Get messages requiring response
  const requiringResponse = await (prisma as any).messageEvent.findMany({
    where: {
      orgId,
      threadId: { in: threadIds },
      requiresResponse: true,
      createdAt: { gte: windowStart, lte: windowEnd },
      direction: 'inbound',
      actorType: 'client',
    },
    select: { id: true },
  });

  const responseSeconds = responseLinks
    .map((r: any) => r.responseSeconds || (r.responseMinutes ? r.responseMinutes * 60 : null))
    .filter((s: number | null): s is number => s !== null);

  const avgResponseSeconds = responseSeconds.length > 0
    ? responseSeconds.reduce((a: number, b: number) => a + b, 0) / responseSeconds.length
    : 0;

  const sortedSeconds = [...responseSeconds].sort((a: number, b: number) => a - b);
  const medianResponseSeconds = sortedSeconds.length > 0
    ? sortedSeconds[Math.floor(sortedSeconds.length / 2)]
    : 0;

  const responseRate = requiringResponse.length > 0
    ? responseLinks.length / requiringResponse.length
    : 0;

  // Compute offer metrics from OfferEvent (in-app booking flow)
  const offers = await (prisma as any).offerEvent.findMany({
    where: {
      orgId,
      sitterId,
      offeredAt: { gte: windowStart, lte: windowEnd },
      excluded: false,
    },
    select: {
      status: true,
      acceptedAt: true,
      declinedAt: true,
      expiresAt: true,
      offeredAt: true,
    },
  });

  const totalOffers = offers.length;
  const accepted = offers.filter((o: any) => o.status === 'accepted' || o.acceptedAt).length;
  const declined = offers.filter((o: any) => o.status === 'declined' || o.declinedAt).length;
  const expired = offers.filter((o: any) => 
    o.status === 'expired' || (o.expiresAt && new Date(o.expiresAt) < new Date() && !o.acceptedAt && !o.declinedAt)
  ).length;

  const offerAcceptRate = totalOffers > 0 ? accepted / totalOffers : 0;
  const offerDeclineRate = totalOffers > 0 ? declined / totalOffers : 0;
  const offerExpireRate = totalOffers > 0 ? expired / totalOffers : 0;

  // Calculate response times from offers (in-app flow)
  const offerResponseTimes = offers
    .filter((o: any) => o.acceptedAt || o.declinedAt)
    .map((o: any) => {
      const respondedAt = o.acceptedAt || o.declinedAt;
      return Math.floor((new Date(respondedAt).getTime() - new Date(o.offeredAt).getTime()) / 1000);
    });

  // Merge response times from offers with message response times
  const allResponseTimes = [...responseSeconds, ...offerResponseTimes];
  
  // Use merged times if available, otherwise fall back to message-only times
  const finalAvgResponseSeconds = allResponseTimes.length > 0
    ? allResponseTimes.reduce((a: number, b: number) => a + b, 0) / allResponseTimes.length
    : avgResponseSeconds;

  const finalSortedTimes = allResponseTimes.length > 0
    ? [...allResponseTimes].sort((a: number, b: number) => a - b)
    : sortedSeconds;
  const finalMedianResponseSeconds = finalSortedTimes.length > 0
    ? finalSortedTimes[Math.floor(finalSortedTimes.length / 2)]
    : medianResponseSeconds;

  return {
    avgResponseSeconds: finalAvgResponseSeconds,
    medianResponseSeconds: finalMedianResponseSeconds,
    responseRate,
    offerAcceptRate,
    offerDeclineRate,
    offerExpireRate,
  };
}

/**
 * Compute tier from metrics using thresholds
 */
function computeTierFromMetrics(metrics: TierMetrics): TierComputation {
  const reasons: string[] = [];
  let tier = 'Bronze'; // Default tier

  // Tier thresholds (adjustable)
  // Platinum: Excellent performance
  if (
    metrics.avgResponseSeconds < 300 && // < 5 min avg
    metrics.responseRate >= 0.95 && // 95%+ response rate
    metrics.offerAcceptRate >= 0.80 && // 80%+ accept rate
    metrics.offerExpireRate < 0.10 // < 10% expire rate
  ) {
    tier = 'Platinum';
    reasons.push('Excellent response time (< 5 min avg)');
    reasons.push('High response rate (≥95%)');
    reasons.push('High offer acceptance (≥80%)');
    reasons.push('Low offer expiration (<10%)');
  }
  // Gold: Good performance
  else if (
    metrics.avgResponseSeconds < 600 && // < 10 min avg
    metrics.responseRate >= 0.85 && // 85%+ response rate
    metrics.offerAcceptRate >= 0.70 && // 70%+ accept rate
    metrics.offerExpireRate < 0.20 // < 20% expire rate
  ) {
    tier = 'Gold';
    reasons.push('Good response time (< 10 min avg)');
    reasons.push('Good response rate (≥85%)');
    reasons.push('Good offer acceptance (≥70%)');
    reasons.push('Acceptable offer expiration (<20%)');
  }
  // Silver: Acceptable performance
  else if (
    metrics.avgResponseSeconds < 1800 && // < 30 min avg
    metrics.responseRate >= 0.70 && // 70%+ response rate
    metrics.offerAcceptRate >= 0.50 && // 50%+ accept rate
    metrics.offerExpireRate < 0.30 // < 30% expire rate
  ) {
    tier = 'Silver';
    reasons.push('Acceptable response time (< 30 min avg)');
    reasons.push('Acceptable response rate (≥70%)');
    reasons.push('Acceptable offer acceptance (≥50%)');
    reasons.push('Moderate offer expiration (<30%)');
  }
  // Bronze: Needs improvement
  else {
    tier = 'Bronze';
    if (metrics.avgResponseSeconds >= 1800) {
      reasons.push('Response time needs improvement (≥ 30 min avg)');
    }
    if (metrics.responseRate < 0.70) {
      reasons.push('Response rate needs improvement (<70%)');
    }
    if (metrics.offerAcceptRate < 0.50) {
      reasons.push('Offer acceptance needs improvement (<50%)');
    }
    if (metrics.offerExpireRate >= 0.30) {
      reasons.push('High offer expiration rate (≥30%)');
    }
  }

  const explanation = `Tier: ${tier}. Based on ${reasons.length > 0 ? reasons.join('; ') : 'baseline metrics'}.`;

  return {
    tier,
    metrics,
    reasons,
    explanation,
  };
}

/**
 * Get or create metrics window
 */
async function getOrCreateMetricsWindow(
  orgId: string,
  sitterId: string,
  windowStart: Date,
  windowEnd: Date,
  windowType: string
) {
  const existing = await (prisma as any).sitterMetricsWindow.findUnique({
    where: {
      orgId_sitterId_windowStart_windowType: {
        orgId,
        sitterId,
        windowStart,
        windowType,
      },
    },
  });

  if (existing) {
    return existing;
  }

  // Create empty window (will be populated by computeMetricsFromEvents)
  return await (prisma as any).sitterMetricsWindow.create({
    data: {
      orgId,
      sitterId,
      windowStart,
      windowEnd,
      windowType,
    },
  });
}

/**
 * Update metrics window with computed values
 */
async function updateMetricsWindow(
  orgId: string,
  sitterId: string,
  windowStart: Date,
  windowEnd: Date,
  metrics: TierMetrics
) {
  await (prisma as any).sitterMetricsWindow.upsert({
    where: {
      orgId_sitterId_windowStart_windowType: {
        orgId,
        sitterId,
        windowStart,
        windowType: windowEnd.getTime() - windowStart.getTime() < 2 * 24 * 60 * 60 * 1000 ? 'daily' : 'weekly_7d',
      },
    },
    create: {
      orgId,
      sitterId,
      windowStart,
      windowEnd,
      windowType: windowEnd.getTime() - windowStart.getTime() < 2 * 24 * 60 * 60 * 1000 ? 'daily' : 'weekly_7d',
      ...metrics,
    },
    update: metrics,
  });
}

/**
 * Check if metrics window should be recalculated
 */
function shouldRecalculate(window: any): boolean {
  // Recalculate if older than 1 hour
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  return !window.updatedAt || new Date(window.updatedAt) < oneHourAgo;
}

/**
 * Store tier change in history
 */
export async function recordTierChange(
  orgId: string,
  sitterId: string,
  tierName: string,
  tierId: string,
  metrics: TierMetrics,
  reasons: string[]
) {
  // Get current tier
  const sitter = await (prisma as any).sitter.findUnique({
    where: { id: sitterId },
    include: { currentTier: true },
  });

  const oldTierName = sitter?.currentTier?.name || null;
  const oldTierId = sitter?.currentTierId || null;

  // Only record if tier changed
  if (oldTierId !== tierId) {
    await (prisma as any).sitterTierHistory.create({
      data: {
        orgId,
        sitterId,
        tierName,
        assignedAt: new Date(),
        reasons: JSON.stringify(reasons),
        metadata: JSON.stringify(metrics),
      },
    });

    // Update sitter's current tier
    await (prisma as any).sitter.update({
      where: { id: sitterId },
      data: { currentTierId: tierId },
    });

    // Record audit event for tier change
    await recordTierChanged(
      orgId,
      sitterId,
      oldTierName,
      tierName,
      reasons.join('; ')
    );
  }
}
