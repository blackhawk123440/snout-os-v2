/**
 * Tests for bundle usage/depletion logic.
 *
 * Verifies:
 * - Active bundle with matching service type gets decremented
 * - Expired bundles are skipped
 * - Depleted bundles are skipped
 * - Non-matching service type bundles are skipped
 * - Status transitions to 'depleted' when visits hit 0
 * - No crash when no bundles/purchases exist
 * - EventLog records deduction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSettingFindFirst = vi.fn();
const mockSettingUpsert = vi.fn().mockResolvedValue({});
const mockEventLogCreate = vi.fn().mockResolvedValue({ id: 'evt-1' });

const mockDb = {
  setting: {
    findFirst: (...args: any[]) => mockSettingFindFirst(...args),
    upsert: (...args: any[]) => mockSettingUpsert(...args),
  },
  eventLog: {
    create: (...args: any[]) => mockEventLogCreate(...args),
  },
  booking: {
    update: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue({ notes: '' }),
  },
} as any;

import { tryUseBundleVisit } from '../bundle-usage';

const makeBundles = (types: string[]) =>
  JSON.stringify(types.map((t, i) => ({ id: `b${i}`, serviceType: t })));

const makePurchase = (overrides: Partial<{
  id: string; bundleId: string; clientId: string; remainingVisits: number;
  expiresAt: string; status: string;
}> = {}) => ({
  id: overrides.id ?? 'p1',
  bundleId: overrides.bundleId ?? 'b0',
  clientId: overrides.clientId ?? 'client-1',
  remainingVisits: overrides.remainingVisits ?? 5,
  purchasedAt: '2026-01-01T00:00:00Z',
  expiresAt: overrides.expiresAt ?? '2027-01-01T00:00:00Z',
  status: overrides.status ?? 'active',
});

describe('tryUseBundleVisit', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('decrements remainingVisits for matching active bundle', async () => {
    mockSettingFindFirst
      .mockResolvedValueOnce({ value: makeBundles(['Dog Walking']) })
      .mockResolvedValueOnce({ value: JSON.stringify([makePurchase()]) });

    const result = await tryUseBundleVisit(mockDb, 'org-1', 'client-1', 'Dog Walking', 'booking-1');

    expect(result?.used).toBe(true);
    expect(result?.remaining).toBe(4);

    // Verify persisted
    const savedPurchases = JSON.parse(mockSettingUpsert.mock.calls[0][0].update.value);
    expect(savedPurchases[0].remainingVisits).toBe(4);
    expect(savedPurchases[0].status).toBe('active');
  });

  it('transitions to depleted when visits hit 0', async () => {
    mockSettingFindFirst
      .mockResolvedValueOnce({ value: makeBundles(['Walk']) })
      .mockResolvedValueOnce({ value: JSON.stringify([makePurchase({ remainingVisits: 1 })]) });

    const result = await tryUseBundleVisit(mockDb, 'org-1', 'client-1', 'Walk', 'booking-2');

    expect(result?.used).toBe(true);
    expect(result?.remaining).toBe(0);

    const saved = JSON.parse(mockSettingUpsert.mock.calls[0][0].update.value);
    expect(saved[0].status).toBe('depleted');
  });

  it('skips expired purchases', async () => {
    mockSettingFindFirst
      .mockResolvedValueOnce({ value: makeBundles(['Walk']) })
      .mockResolvedValueOnce({
        value: JSON.stringify([makePurchase({ expiresAt: '2020-01-01T00:00:00Z' })]),
      });

    const result = await tryUseBundleVisit(mockDb, 'org-1', 'client-1', 'Walk', 'booking-3');
    expect(result?.used).toBe(false);
    expect(mockSettingUpsert).not.toHaveBeenCalled();
  });

  it('skips depleted purchases', async () => {
    mockSettingFindFirst
      .mockResolvedValueOnce({ value: makeBundles(['Walk']) })
      .mockResolvedValueOnce({
        value: JSON.stringify([makePurchase({ remainingVisits: 0, status: 'depleted' })]),
      });

    const result = await tryUseBundleVisit(mockDb, 'org-1', 'client-1', 'Walk', 'booking-4');
    expect(result?.used).toBe(false);
  });

  it('skips bundles with non-matching service type', async () => {
    mockSettingFindFirst
      .mockResolvedValueOnce({ value: makeBundles(['Cat Sitting']) })
      .mockResolvedValueOnce({ value: JSON.stringify([makePurchase()]) });

    const result = await tryUseBundleVisit(mockDb, 'org-1', 'client-1', 'Dog Walking', 'booking-5');
    expect(result?.used).toBe(false);
  });

  it('returns used=false when no purchases exist', async () => {
    mockSettingFindFirst
      .mockResolvedValueOnce({ value: makeBundles(['Walk']) })
      .mockResolvedValueOnce(null);

    const result = await tryUseBundleVisit(mockDb, 'org-1', 'client-1', 'Walk', 'booking-6');
    expect(result?.used).toBe(false);
  });

  it('returns used=false when no bundles exist', async () => {
    mockSettingFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ value: JSON.stringify([makePurchase()]) });

    const result = await tryUseBundleVisit(mockDb, 'org-1', 'client-1', 'Walk', 'booking-7');
    expect(result?.used).toBe(false);
  });

  it('logs deduction to EventLog', async () => {
    mockSettingFindFirst
      .mockResolvedValueOnce({ value: makeBundles(['Walk']) })
      .mockResolvedValueOnce({ value: JSON.stringify([makePurchase()]) });

    await tryUseBundleVisit(mockDb, 'org-1', 'client-1', 'Walk', 'booking-8');

    expect(mockEventLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'bundle.visit_used',
        bookingId: 'booking-8',
      }),
    }));
  });

  it('case-insensitive service type matching', async () => {
    mockSettingFindFirst
      .mockResolvedValueOnce({ value: makeBundles(['Dog Walking']) })
      .mockResolvedValueOnce({ value: JSON.stringify([makePurchase()]) });

    const result = await tryUseBundleVisit(mockDb, 'org-1', 'client-1', 'dog walking', 'booking-9');
    expect(result?.used).toBe(true);
  });
});
