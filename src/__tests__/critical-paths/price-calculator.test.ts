import { describe, it, expect } from 'vitest';
import { calculatePayoutForBooking } from '@/lib/payout/payout-engine';

describe('Price calculator — payout calculation', () => {
  it('calculates default 80% payout correctly', () => {
    const result = calculatePayoutForBooking(100, 80);
    expect(result.netAmount).toBe(80);
    expect(result.amountCents).toBe(8000);
    expect(result.commissionPct).toBe(80);
    expect(result.amountGross).toBe(100);
  });

  it('handles 100% commission', () => {
    const result = calculatePayoutForBooking(50, 100);
    expect(result.netAmount).toBe(50);
    expect(result.amountCents).toBe(5000);
  });

  it('handles 0% commission', () => {
    const result = calculatePayoutForBooking(50, 0);
    expect(result.netAmount).toBe(0);
    expect(result.amountCents).toBe(0);
  });

  it('clamps commission above 100', () => {
    const result = calculatePayoutForBooking(100, 150);
    expect(result.commissionPct).toBe(100);
    expect(result.netAmount).toBe(100);
  });

  it('clamps commission below 0', () => {
    const result = calculatePayoutForBooking(100, -10);
    expect(result.commissionPct).toBe(0);
    expect(result.netAmount).toBe(0);
  });

  it('rounds cents correctly for fractional amounts', () => {
    const result = calculatePayoutForBooking(33.33, 80);
    expect(result.amountCents).toBe(2666); // Math.round(26.664 * 100)
  });

  it('handles zero price', () => {
    const result = calculatePayoutForBooking(0, 80);
    expect(result.netAmount).toBe(0);
    expect(result.amountCents).toBe(0);
  });
});
