import { describe, it, expect } from 'vitest';
import { calculateRefund } from '../cancellation-engine';

describe('calculateRefund', () => {
  const now = new Date('2026-03-24T12:00:00Z');

  it('returns full refund for booking 3 days out', () => {
    const result = calculateRefund(
      { totalPrice: 100, depositAmount: 0, startAt: new Date('2026-03-27T12:00:00Z'), holiday: false },
      now
    );
    expect(result.refundPercent).toBe(100);
    expect(result.refundAmount).toBe(100);
    expect(result.depositKept).toBe(0);
    expect(result.reason).toBe('more_than_48h');
  });

  it('returns 50% refund for booking 36 hours out', () => {
    const result = calculateRefund(
      { totalPrice: 100, depositAmount: 0, startAt: new Date('2026-03-26T00:00:00Z'), holiday: false },
      now
    );
    expect(result.refundPercent).toBe(50);
    expect(result.refundAmount).toBe(50);
    expect(result.reason).toBe('within_48h');
  });

  it('returns no refund for booking 12 hours out', () => {
    const result = calculateRefund(
      { totalPrice: 100, depositAmount: 0, startAt: new Date('2026-03-25T00:00:00Z'), holiday: false },
      now
    );
    expect(result.refundPercent).toBe(0);
    expect(result.refundAmount).toBe(0);
    expect(result.reason).toBe('day_of');
  });

  it('returns no refund for holiday booking 1 week out', () => {
    const result = calculateRefund(
      { totalPrice: 150, depositAmount: 0, startAt: new Date('2026-03-31T12:00:00Z'), holiday: true },
      now
    );
    expect(result.refundPercent).toBe(0);
    expect(result.refundAmount).toBe(0);
    expect(result.reason).toBe('holiday_nonrefundable');
  });

  it('refunds balance but keeps deposit for advance booking 3 days out', () => {
    const result = calculateRefund(
      { totalPrice: 200, depositAmount: 50, startAt: new Date('2026-03-27T12:00:00Z'), holiday: false },
      now
    );
    expect(result.refundAmount).toBe(150); // 200 - 50 deposit
    expect(result.depositKept).toBe(50);
    expect(result.reason).toBe('more_than_48h');
    expect(result.description).toContain('$150.00');
    expect(result.description).toContain('$50.00');
  });

  it('returns no refund for advance booking with deposit 12 hours out', () => {
    const result = calculateRefund(
      { totalPrice: 200, depositAmount: 50, startAt: new Date('2026-03-25T00:00:00Z'), holiday: false },
      now
    );
    expect(result.refundPercent).toBe(0);
    expect(result.refundAmount).toBe(0);
    expect(result.depositKept).toBe(50);
    expect(result.reason).toBe('day_of');
  });

  it('returns 50% of non-deposit portion for advance booking 36h out', () => {
    const result = calculateRefund(
      { totalPrice: 200, depositAmount: 50, startAt: new Date('2026-03-26T00:00:00Z'), holiday: false },
      now
    );
    expect(result.refundAmount).toBe(75); // (200 - 50) * 0.5
    expect(result.depositKept).toBe(50);
    expect(result.reason).toBe('within_48h');
  });
});
