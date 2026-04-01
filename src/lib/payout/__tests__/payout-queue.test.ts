import { describe, expect, it } from 'vitest';
import { getPayoutDelayMs, PAYOUT_HOLD_DAYS } from '@/lib/payout/payout-queue';

describe('payout queue timing', () => {
  it('holds payouts for seven days after completion', () => {
    expect(PAYOUT_HOLD_DAYS).toBe(7);

    const completedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const delayMs = getPayoutDelayMs(completedAt);
    const expectedMin = 4.9 * 24 * 60 * 60 * 1000;
    const expectedMax = 5.1 * 24 * 60 * 60 * 1000;

    expect(delayMs).toBeGreaterThan(expectedMin);
    expect(delayMs).toBeLessThan(expectedMax);
  });

  it('never returns a negative delay for old completions', () => {
    const completedAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    expect(getPayoutDelayMs(completedAt)).toBe(0);
  });
});
