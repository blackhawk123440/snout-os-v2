import { describe, expect, it } from 'vitest';
import { calculateTransferSummary } from '@/app/sitter/earnings/earnings-helpers';

describe('calculateTransferSummary', () => {
  it('splits pending vs paid(30d) totals', () => {
    const now = new Date('2026-03-10T12:00:00.000Z');
    const result = calculateTransferSummary(
      [
        { amount: 1000, status: 'pending', createdAt: '2026-03-09T10:00:00.000Z' },
        { amount: 2000, status: 'paid', createdAt: '2026-03-08T10:00:00.000Z' },
        { amount: 3000, status: 'paid', createdAt: '2026-01-01T10:00:00.000Z' },
        { amount: 500, status: 'failed', createdAt: '2026-03-07T10:00:00.000Z' },
      ],
      now
    );

    expect(result.pendingCents).toBe(1500);
    expect(result.paid30dCents).toBe(2000);
  });

  it('estimates next payout from last paid transfer', () => {
    const result = calculateTransferSummary([
      { amount: 2000, status: 'paid', createdAt: '2026-03-08T10:00:00.000Z' },
      { amount: 1000, status: 'pending', createdAt: '2026-03-09T10:00:00.000Z' },
    ]);

    expect(result.hasPaidHistory).toBe(true);
    expect(result.nextPayoutDate?.toISOString()).toBe('2026-03-15T10:00:00.000Z');
  });
});
