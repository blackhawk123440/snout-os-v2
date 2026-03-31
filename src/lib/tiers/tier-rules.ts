/**
 * Tier Rules and Pay Rules
 * 
 * Implements promotion/demotion logic and pay raise eligibility
 * Based on SITTER_TIER_SYSTEM_DESIGN.md
 */

import { prisma } from '@/lib/db';
import { calculateRolling26WeekScore } from './srs-engine';

export type Tier = 'foundation' | 'reliant' | 'trusted' | 'preferred';

export interface TierThresholds {
  min: number;
  max: number;
}

export const TIER_THRESHOLDS: Record<Tier, TierThresholds> = {
  foundation: { min: 0, max: 69 },
  reliant: { min: 70, max: 79 },
  trusted: { min: 80, max: 89 },
  preferred: { min: 90, max: 100 },
};

export const TIER_QUOTAS: Record<Tier, { min: number; max: number }> = {
  foundation: { min: 20, max: 30 },
  reliant: { min: 35, max: 45 },
  trusted: { min: 55, max: 65 },
  preferred: { min: 70, max: 80 },
};

export const BASE_PAY_START = 12.50;
export const PAY_RAISE_PERCENT = 2.5;
export const PAY_CAP = 16.25;
export const PAY_RAISE_INTERVAL_MONTHS = 6;

/**
 * Determine tier from score
 */
export function getTierFromScore(score: number): Tier {
  if (score >= 90) return 'preferred';
  if (score >= 80) return 'trusted';
  if (score >= 70) return 'reliant';
  return 'foundation';
}

/**
 * Check if sitter meets promotion requirements
 */
export async function checkPromotionEligibility(
  orgId: string,
  sitterId: string,
  currentTier: Tier,
  newTier: Tier,
  asOfDate: Date
): Promise<{ eligible: boolean; reason?: string }> {
  // Can't promote to same or lower tier
  const tierOrder: Tier[] = ['foundation', 'reliant', 'trusted', 'preferred'];
  if (tierOrder.indexOf(newTier) <= tierOrder.indexOf(currentTier)) {
    return { eligible: false, reason: 'New tier must be higher than current tier' };
  }

  // Check if threshold met for 2 consecutive weekly evaluations
  const windowStart = new Date(asOfDate);
  windowStart.setDate(windowStart.getDate() - 14); // 2 weeks

  const recentSnapshots = await (prisma as any).sitterTierSnapshot.findMany({
    where: {
      orgId,
      sitterId,
      asOfDate: { gte: windowStart, lte: asOfDate },
    },
    orderBy: { asOfDate: 'desc' },
    take: 2,
  });

  if (recentSnapshots.length < 2) {
    return { eligible: false, reason: 'Need 2 consecutive weekly evaluations' };
  }

  // Check both snapshots meet threshold
  const threshold = TIER_THRESHOLDS[newTier].min;
  const bothMeet = recentSnapshots.every((s: any) => s.rolling30dScore >= threshold);
  if (!bothMeet) {
    return { eligible: false, reason: 'Score threshold not met for 2 consecutive weeks' };
  }

  // Check no corrective action in last 30 days
  const correctiveWindow = new Date(asOfDate);
  correctiveWindow.setDate(correctiveWindow.getDate() - 30);

  const correctiveEvents = await (prisma as any).sitterServiceEvent.findMany({
    where: {
      orgId,
      sitterId,
      level: { in: ['corrective', 'probation'] },
      effectiveFrom: { lte: asOfDate },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: correctiveWindow } },
      ],
    },
  });

  if (correctiveEvents.length > 0) {
    return { eligible: false, reason: 'Corrective action in last 30 days' };
  }

  // Check visits30d >= 15
  const latestSnapshot = recentSnapshots[0];
  if (latestSnapshot.visits30d < 15) {
    return { eligible: false, reason: 'Insufficient activity (need 15+ visits in 30 days)' };
  }

  return { eligible: true };
}

/**
 * Check if sitter should be demoted
 */
export async function checkDemotionRequired(
  orgId: string,
  sitterId: string,
  currentTier: Tier,
  asOfDate: Date
): Promise<{ demote: boolean; reason?: string; newTier?: Tier }> {
  // Check for immediate demotion (corrective/probation)
  const correctiveWindow = new Date(asOfDate);
  correctiveWindow.setDate(correctiveWindow.getDate() - 1); // Last 24 hours

  const recentCorrective = await (prisma as any).sitterServiceEvent.findFirst({
    where: {
      orgId,
      sitterId,
      level: { in: ['corrective', 'probation'] },
      effectiveFrom: { gte: correctiveWindow },
    },
  });

  if (recentCorrective) {
    // Immediate demotion to foundation
    return { demote: true, reason: 'Corrective action or probation', newTier: 'foundation' };
  }

  // Check if below tier min for 2 consecutive weeks
  const windowStart = new Date(asOfDate);
  windowStart.setDate(windowStart.getDate() - 14);

  const recentSnapshots = await (prisma as any).sitterTierSnapshot.findMany({
    where: {
      orgId,
      sitterId,
      asOfDate: { gte: windowStart, lte: asOfDate },
    },
    orderBy: { asOfDate: 'desc' },
    take: 2,
  });

  if (recentSnapshots.length < 2) {
    return { demote: false };
  }

  const tierMin = TIER_THRESHOLDS[currentTier].min;
  const bothBelow = recentSnapshots.every((s: any) => s.rolling30dScore < tierMin);

  if (bothBelow) {
    // Determine new tier based on current score
    const currentScore = recentSnapshots[0].rolling30dScore;
    const newTier = getTierFromScore(currentScore);
    return { demote: true, reason: 'Score below tier minimum for 2 consecutive weeks', newTier };
  }

  return { demote: false };
}

/**
 * Check if sitter is at risk (1 week dip)
 */
export async function checkAtRisk(
  orgId: string,
  sitterId: string,
  currentTier: Tier,
  asOfDate: Date
): Promise<{ atRisk: boolean; reason?: string }> {
  const windowStart = new Date(asOfDate);
  windowStart.setDate(windowStart.getDate() - 7); // 1 week

  const recentSnapshots = await (prisma as any).sitterTierSnapshot.findMany({
    where: {
      orgId,
      sitterId,
      asOfDate: { gte: windowStart, lte: asOfDate },
    },
    orderBy: { asOfDate: 'desc' },
    take: 2,
  });

  if (recentSnapshots.length < 2) {
    return { atRisk: false };
  }

  const tierMin = TIER_THRESHOLDS[currentTier].min;
  const latestScore = recentSnapshots[0].rolling30dScore;
  const previousScore = recentSnapshots[1].rolling30dScore;

  // At risk if current score below tier min but previous was above
  if (latestScore < tierMin && previousScore >= tierMin) {
    return { atRisk: true, reason: 'Score dropped below tier minimum' };
  }

  // At risk if significant drop (10+ points)
  if (previousScore - latestScore >= 10) {
    return { atRisk: true, reason: 'Significant score drop detected' };
  }

  return { atRisk: false };
}

/**
 * Check pay raise eligibility
 */
export async function checkPayRaiseEligibility(
  orgId: string,
  sitterId: string,
  asOfDate: Date
): Promise<{ eligible: boolean; reason?: string; newPay?: number }> {
  // Get current compensation
  const compensation = await (prisma as any).sitterCompensation.findUnique({
    where: { orgId_sitterId: { orgId, sitterId } },
  });

  if (!compensation) {
    // Create initial compensation record
    await (prisma as any).sitterCompensation.create({
      data: {
        orgId,
        sitterId,
        basePay: BASE_PAY_START,
        nextReviewDate: new Date(asOfDate.getTime() + PAY_RAISE_INTERVAL_MONTHS * 30 * 24 * 60 * 60 * 1000),
      },
    });
    return { eligible: false, reason: 'Initial compensation record created' };
  }

  // Check if at pay cap
  if (compensation.basePay >= PAY_CAP) {
    return { eligible: false, reason: 'At pay cap - additional value via perks' };
  }

  // Check if review date has passed
  if (compensation.nextReviewDate && new Date(compensation.nextReviewDate) > asOfDate) {
    return { eligible: false, reason: 'Next review date not yet reached' };
  }

  // Check rolling 26-week score >= 80
  const rolling26w = await calculateRolling26WeekScore(orgId, sitterId, asOfDate);
  if (!rolling26w || rolling26w.score < 80) {
    return { eligible: false, reason: 'Rolling 26-week score below 80' };
  }

  // Check no corrective actions in last 26 weeks
  const correctiveWindow = new Date(asOfDate);
  correctiveWindow.setDate(correctiveWindow.getDate() - 26 * 7);

  const correctiveEvents = await (prisma as any).sitterServiceEvent.findMany({
    where: {
      orgId,
      sitterId,
      level: { in: ['corrective', 'probation'] },
      effectiveFrom: { gte: correctiveWindow },
    },
  });

  if (correctiveEvents.length > 0) {
    return { eligible: false, reason: 'Corrective action in last 26 weeks' };
  }

  // Check activity threshold (visits30d >= 15)
  const latestSnapshot = await (prisma as any).sitterTierSnapshot.findFirst({
    where: { orgId, sitterId },
    orderBy: { asOfDate: 'desc' },
  });

  if (!latestSnapshot || latestSnapshot.visits30d < 15) {
    return { eligible: false, reason: 'Insufficient activity threshold' };
  }

  // Calculate new pay
  const raiseAmount = compensation.basePay * (PAY_RAISE_PERCENT / 100);
  const newPay = Math.min(compensation.basePay + raiseAmount, PAY_CAP);

  return { eligible: true, newPay };
}

/**
 * Get tier perks based on tier level
 */
export function getTierPerks(tier: Tier): {
  priority: boolean;
  multipliers: { holiday: number };
  mentorship: boolean;
  reducedOversight: boolean;
} {
  switch (tier) {
    case 'preferred':
      return {
        priority: true,
        multipliers: { holiday: 2.0 },
        mentorship: true,
        reducedOversight: true,
      };
    case 'trusted':
      return {
        priority: true,
        multipliers: { holiday: 1.5 },
        mentorship: true,
        reducedOversight: true,
      };
    case 'reliant':
      return {
        priority: true,
        multipliers: { holiday: 1.0 },
        mentorship: false,
        reducedOversight: false,
      };
    case 'foundation':
    default:
      return {
        priority: false,
        multipliers: { holiday: 1.0 },
        mentorship: false,
        reducedOversight: false,
      };
  }
}
