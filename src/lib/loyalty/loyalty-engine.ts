/**
 * Loyalty Engine
 *
 * Core logic for earning, redeeming, and tier-calculating loyalty points.
 * Points are earned from completed bookings. Tier is derived from lifetime points.
 *
 * Earning rules:
 * - 1 point per $1 spent on completed bookings
 * - 50 bonus points for referring a new client
 * - Points round down to nearest integer
 *
 * Tier thresholds:
 * - bronze: 0-99 points
 * - silver: 100-299 points
 * - gold: 300-599 points
 * - platinum: 600+ points
 *
 * Redemption:
 * - 100 points = $5 discount on next booking
 * - Minimum 100 points to redeem
 */

import type { PrismaClient } from '@prisma/client';

export const TIER_THRESHOLDS = [
  { tier: 'bronze', minPoints: 0 },
  { tier: 'silver', minPoints: 100 },
  { tier: 'gold', minPoints: 300 },
  { tier: 'platinum', minPoints: 600 },
] as const;

export const POINTS_PER_DOLLAR = 1;
export const REFERRAL_BONUS_POINTS = 50;
export const REDEMPTION_POINTS_PER_5_DOLLARS = 100;
export const MINIMUM_REDEMPTION_POINTS = 100;

export function calculateTier(points: number): string {
  let tier = 'bronze';
  for (const t of TIER_THRESHOLDS) {
    if (points >= t.minPoints) tier = t.tier;
  }
  return tier;
}

export function calculatePointsForAmount(amountDollars: number): number {
  return Math.floor(Math.max(0, amountDollars) * POINTS_PER_DOLLAR);
}

export function calculateRedemptionDiscount(points: number): { discountDollars: number; pointsUsed: number } {
  if (points < MINIMUM_REDEMPTION_POINTS) {
    return { discountDollars: 0, pointsUsed: 0 };
  }
  const batches = Math.floor(points / REDEMPTION_POINTS_PER_5_DOLLARS);
  return {
    discountDollars: batches * 5,
    pointsUsed: batches * REDEMPTION_POINTS_PER_5_DOLLARS,
  };
}

/**
 * Award points to a client. Creates LoyaltyReward if it doesn't exist.
 * Updates tier based on new total. Idempotent via upsert.
 */
export async function awardPoints(
  db: PrismaClient,
  orgId: string,
  clientId: string,
  points: number,
  reason: string
): Promise<{ newTotal: number; tier: string; awarded: number }> {
  if (points <= 0) return { newTotal: 0, tier: 'bronze', awarded: 0 };

  const existing = await db.loyaltyReward.findFirst({
    where: { orgId, clientId },
    select: { id: true, points: true },
  });

  const currentPoints = existing?.points ?? 0;
  const newTotal = currentPoints + points;
  const tier = calculateTier(newTotal);

  if (existing) {
    await db.loyaltyReward.update({
      where: { id: existing.id },
      data: {
        points: newTotal,
        tier,
        lastEarned: new Date(),
      },
    });
  } else {
    await db.loyaltyReward.create({
      data: {
        orgId,
        clientId,
        points: newTotal,
        tier,
        lastEarned: new Date(),
      },
    });
  }

  // Log the event
  try {
    await db.eventLog.create({
      data: {
        orgId,
        eventType: 'loyalty.points_earned',
        status: 'success',
        metadata: JSON.stringify({
          clientId,
          pointsAwarded: points,
          newTotal,
          tier,
          reason,
        }),
      },
    });
  } catch {}

  return { newTotal, tier, awarded: points };
}

/**
 * Redeem points for a discount. Deducts points and returns discount amount.
 * Returns { discountDollars: 0 } if insufficient points.
 */
export async function redeemPoints(
  db: PrismaClient,
  orgId: string,
  clientId: string,
  maxPointsToRedeem?: number
): Promise<{ discountDollars: number; pointsUsed: number; remainingPoints: number }> {
  const record = await db.loyaltyReward.findFirst({
    where: { orgId, clientId },
    select: { id: true, points: true },
  });

  if (!record || record.points < MINIMUM_REDEMPTION_POINTS) {
    return { discountDollars: 0, pointsUsed: 0, remainingPoints: record?.points ?? 0 };
  }

  const availablePoints = maxPointsToRedeem
    ? Math.min(record.points, maxPointsToRedeem)
    : record.points;

  const { discountDollars, pointsUsed } = calculateRedemptionDiscount(availablePoints);
  if (pointsUsed <= 0) {
    return { discountDollars: 0, pointsUsed: 0, remainingPoints: record.points };
  }

  const remainingPoints = record.points - pointsUsed;
  const tier = calculateTier(remainingPoints);

  await db.loyaltyReward.update({
    where: { id: record.id },
    data: {
      points: remainingPoints,
      tier,
    },
  });

  try {
    await db.eventLog.create({
      data: {
        orgId,
        eventType: 'loyalty.points_redeemed',
        status: 'success',
        metadata: JSON.stringify({
          clientId,
          pointsUsed,
          discountDollars,
          remainingPoints,
          tier,
        }),
      },
    });
  } catch {}

  return { discountDollars, pointsUsed, remainingPoints };
}

/**
 * Award referral bonus to the referring client.
 * Called when a new user signs up with a referral code.
 */
export async function awardReferralBonus(
  db: PrismaClient,
  orgId: string,
  referrerClientId: string,
  newClientId: string
): Promise<{ awarded: boolean; points: number; error?: string }> {
  // Check this referral hasn't already been awarded (idempotency)
  const existingLog = await db.eventLog.findFirst({
    where: {
      orgId,
      eventType: 'loyalty.referral_bonus',
      metadata: { contains: newClientId },
    },
  }).catch(() => null);

  if (existingLog) {
    return { awarded: false, points: 0, error: 'Referral bonus already awarded for this client' };
  }

  const result = await awardPoints(
    db,
    orgId,
    referrerClientId,
    REFERRAL_BONUS_POINTS,
    `Referral bonus: new client ${newClientId}`
  );

  try {
    await db.eventLog.create({
      data: {
        orgId,
        eventType: 'loyalty.referral_bonus',
        status: 'success',
        metadata: JSON.stringify({
          referrerClientId,
          newClientId,
          pointsAwarded: REFERRAL_BONUS_POINTS,
          newTotal: result.newTotal,
        }),
      },
    });
  } catch {}

  return { awarded: true, points: REFERRAL_BONUS_POINTS };
}
