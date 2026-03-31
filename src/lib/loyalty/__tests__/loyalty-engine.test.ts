/**
 * Tests for loyalty engine.
 *
 * Verifies:
 * - Tier calculation from points
 * - Points calculation from dollar amounts
 * - Redemption math (100 points = $5)
 * - awardPoints creates/updates LoyaltyReward
 * - redeemPoints deducts and recalculates tier
 * - awardReferralBonus is idempotent
 * - Edge cases: zero amounts, negative, boundaries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateTier,
  calculatePointsForAmount,
  calculateRedemptionDiscount,
  REFERRAL_BONUS_POINTS,
  MINIMUM_REDEMPTION_POINTS,
} from '../loyalty-engine';

describe('calculateTier', () => {
  it('returns bronze for 0-99 points', () => {
    expect(calculateTier(0)).toBe('bronze');
    expect(calculateTier(50)).toBe('bronze');
    expect(calculateTier(99)).toBe('bronze');
  });

  it('returns silver for 100-299 points', () => {
    expect(calculateTier(100)).toBe('silver');
    expect(calculateTier(200)).toBe('silver');
    expect(calculateTier(299)).toBe('silver');
  });

  it('returns gold for 300-599 points', () => {
    expect(calculateTier(300)).toBe('gold');
    expect(calculateTier(450)).toBe('gold');
    expect(calculateTier(599)).toBe('gold');
  });

  it('returns platinum for 600+ points', () => {
    expect(calculateTier(600)).toBe('platinum');
    expect(calculateTier(1000)).toBe('platinum');
  });
});

describe('calculatePointsForAmount', () => {
  it('awards 1 point per dollar (floor)', () => {
    expect(calculatePointsForAmount(75)).toBe(75);
    expect(calculatePointsForAmount(75.99)).toBe(75);
    expect(calculatePointsForAmount(100)).toBe(100);
  });

  it('returns 0 for zero or negative amounts', () => {
    expect(calculatePointsForAmount(0)).toBe(0);
    expect(calculatePointsForAmount(-50)).toBe(0);
  });

  it('handles small amounts', () => {
    expect(calculatePointsForAmount(0.50)).toBe(0);
    expect(calculatePointsForAmount(1.49)).toBe(1);
  });
});

describe('calculateRedemptionDiscount', () => {
  it('requires minimum 100 points', () => {
    expect(calculateRedemptionDiscount(99)).toEqual({ discountDollars: 0, pointsUsed: 0 });
    expect(calculateRedemptionDiscount(50)).toEqual({ discountDollars: 0, pointsUsed: 0 });
  });

  it('100 points = $5 discount', () => {
    expect(calculateRedemptionDiscount(100)).toEqual({ discountDollars: 5, pointsUsed: 100 });
  });

  it('200 points = $10 discount', () => {
    expect(calculateRedemptionDiscount(200)).toEqual({ discountDollars: 10, pointsUsed: 200 });
  });

  it('150 points = $5 discount (only full batches)', () => {
    expect(calculateRedemptionDiscount(150)).toEqual({ discountDollars: 5, pointsUsed: 100 });
  });

  it('599 points = $25 discount (5 batches)', () => {
    expect(calculateRedemptionDiscount(599)).toEqual({ discountDollars: 25, pointsUsed: 500 });
  });
});

// Mock DB for awardPoints/redeemPoints/awardReferralBonus
const mockFindFirst = vi.fn();
const mockCreate = vi.fn().mockResolvedValue({ id: 'lr-1' });
const mockUpdate = vi.fn().mockResolvedValue({ id: 'lr-1' });
const mockEventLogCreate = vi.fn().mockResolvedValue({ id: 'evt-1' });
const mockEventLogFindFirst = vi.fn().mockResolvedValue(null);

const mockDb = {
  loyaltyReward: {
    findFirst: (...args: any[]) => mockFindFirst(...args),
    create: (...args: any[]) => mockCreate(...args),
    update: (...args: any[]) => mockUpdate(...args),
  },
  eventLog: {
    create: (...args: any[]) => mockEventLogCreate(...args),
    findFirst: (...args: any[]) => mockEventLogFindFirst(...args),
  },
} as any;

describe('awardPoints', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates LoyaltyReward when none exists', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const { awardPoints } = await import('../loyalty-engine');

    const result = await awardPoints(mockDb, 'org-1', 'client-1', 75, 'booking completed');
    expect(result).toEqual({ newTotal: 75, tier: 'bronze', awarded: 75 });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orgId: 'org-1',
        clientId: 'client-1',
        points: 75,
        tier: 'bronze',
      }),
    }));
  });

  it('increments existing LoyaltyReward', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'lr-1', points: 80 });
    const { awardPoints } = await import('../loyalty-engine');

    const result = await awardPoints(mockDb, 'org-1', 'client-1', 25, 'another booking');
    expect(result).toEqual({ newTotal: 105, tier: 'silver', awarded: 25 });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ points: 105, tier: 'silver' }),
    }));
  });

  it('returns zero for zero points', async () => {
    const { awardPoints } = await import('../loyalty-engine');
    const result = await awardPoints(mockDb, 'org-1', 'client-1', 0, 'test');
    expect(result.awarded).toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('redeemPoints', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('redeems 100 points for $5 discount', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'lr-1', points: 150 });
    const { redeemPoints } = await import('../loyalty-engine');

    const result = await redeemPoints(mockDb, 'org-1', 'client-1');
    expect(result).toEqual({ discountDollars: 5, pointsUsed: 100, remainingPoints: 50 });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ points: 50, tier: 'bronze' }),
    }));
  });

  it('returns zero when below minimum', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'lr-1', points: 50 });
    const { redeemPoints } = await import('../loyalty-engine');

    const result = await redeemPoints(mockDb, 'org-1', 'client-1');
    expect(result.discountDollars).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns zero when no record exists', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const { redeemPoints } = await import('../loyalty-engine');

    const result = await redeemPoints(mockDb, 'org-1', 'client-1');
    expect(result.discountDollars).toBe(0);
  });
});

describe('awardReferralBonus', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('awards 50 points for a new referral', async () => {
    mockEventLogFindFirst.mockResolvedValueOnce(null); // no existing bonus
    mockFindFirst.mockResolvedValueOnce(null); // no loyalty record yet
    const { awardReferralBonus } = await import('../loyalty-engine');

    const result = await awardReferralBonus(mockDb, 'org-1', 'referrer-1', 'new-client-1');
    expect(result.awarded).toBe(true);
    expect(result.points).toBe(REFERRAL_BONUS_POINTS);
  });

  it('is idempotent — does not double-award', async () => {
    mockEventLogFindFirst.mockResolvedValueOnce({ id: 'existing-log' }); // already awarded
    const { awardReferralBonus } = await import('../loyalty-engine');

    const result = await awardReferralBonus(mockDb, 'org-1', 'referrer-1', 'new-client-1');
    expect(result.awarded).toBe(false);
    expect(result.points).toBe(0);
  });
});

describe('constants are correct', () => {
  it('referral bonus is 50 points', () => {
    expect(REFERRAL_BONUS_POINTS).toBe(50);
  });

  it('minimum redemption is 100 points', () => {
    expect(MINIMUM_REDEMPTION_POINTS).toBe(100);
  });
});
