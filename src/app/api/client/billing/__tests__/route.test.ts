import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBookingFindMany = vi.fn();
const mockLoyaltyFindFirst = vi.fn();
const mockStripeChargeFindMany = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserFindMany = vi.fn();

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn(),
  requireClientContext: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    booking: {
      findMany: (...args: unknown[]) => mockBookingFindMany(...args),
    },
    loyaltyReward: {
      findFirst: (...args: unknown[]) => mockLoyaltyFindFirst(...args),
    },
    stripeCharge: {
      findMany: (...args: unknown[]) => mockStripeChargeFindMany(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
  })),
}));

import { GET } from '@/app/api/client/billing/route';
import { getRequestContext } from '@/lib/request-context';

describe('GET /api/client/billing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: 'org-1',
      role: 'client',
      clientId: 'client-1',
      userId: 'user-1',
      sitterId: null,
    } as never);
  });

  it('returns paidCompletions using webhook-confirmed succeeded charges', async () => {
    mockBookingFindMany
      .mockResolvedValueOnce([
        {
          id: 'b-unpaid',
          service: 'Dog Walk',
          startAt: new Date('2026-03-10T10:00:00.000Z'),
          totalPrice: 35,
          stripePaymentLinkUrl: 'https://pay.example/link',
          paymentStatus: 'unpaid',
          status: 'confirmed',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'b-paid',
          service: 'Drop-in',
          startAt: new Date('2026-03-09T10:00:00.000Z'),
          paymentStatus: 'paid',
          totalPrice: 25,
        },
      ]);
    mockLoyaltyFindFirst.mockResolvedValueOnce({ points: 42, tier: 'silver' });
    mockUserFindUnique.mockResolvedValueOnce(null);
    mockUserFindMany.mockResolvedValueOnce([]);
    mockStripeChargeFindMany.mockResolvedValueOnce([
      {
        id: 'ch_paid_1',
        amount: 2500,
        status: 'succeeded',
        createdAt: new Date('2026-03-09T11:00:00.000Z'),
        bookingId: 'b-paid',
        paymentIntentId: 'pi_123',
        currency: 'usd',
      },
      {
        id: 'ch_failed_1',
        amount: 1800,
        status: 'failed',
        createdAt: new Date('2026-03-09T12:00:00.000Z'),
        bookingId: 'b-failed',
        paymentIntentId: 'pi_456',
        currency: 'usd',
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.paidCompletions).toHaveLength(1);
    expect(body.paidCompletions[0]).toEqual(
      expect.objectContaining({
        status: 'paid',
        amount: 25,
        bookingReference: 'b-paid',
        invoiceReference: 'ch_paid_1',
      })
    );
    expect(body.loyaltySummary).toEqual(
      expect.objectContaining({
        availablePoints: 42,
        redeemablePoints: 0,
        redeemableDiscount: 0,
      })
    );
    expect(body.referrals).toEqual(
      expect.objectContaining({
        referralCode: null,
        referralCount: 0,
        qualifiedReferralCount: 0,
      })
    );
  });
});
