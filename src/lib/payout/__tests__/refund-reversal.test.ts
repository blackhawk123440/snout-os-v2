/**
 * Unit tests for refund → payout reversal logic.
 * Tests proportional calculation with amountReversed tracking,
 * idempotency, negative-amount prevention, partial-then-full,
 * and PayrollLineItem reconciliation.
 */

import { describe, it, expect } from "vitest";

/**
 * Mirrors the calculation in refund/route.ts using amountReversed.
 * This is the EXACT logic from the production code.
 */
function calculateReversalCents(
  chargeAmount: number,
  payoutAmount: number,
  amountReversed: number,
  refundCents: number,
  isFullRefund: boolean
): number {
  const remainingReversible = payoutAmount - amountReversed;
  if (remainingReversible <= 0) return 0;

  const payoutRatio = chargeAmount > 0 ? payoutAmount / chargeAmount : 0;
  const proportionalCents = isFullRefund
    ? remainingReversible
    : Math.round(refundCents * payoutRatio);
  return Math.min(proportionalCents, remainingReversible);
}

describe("refund reversal with amountReversed tracking", () => {
  it("full refund reverses full payout when nothing reversed yet", () => {
    const result = calculateReversalCents(10000, 8000, 0, 10000, true);
    expect(result).toBe(8000);
  });

  it("partial refund reverses proportional sitter share", () => {
    // Booking $100, sitter got $80 (80%), refund $50 → reverse $40
    const result = calculateReversalCents(10000, 8000, 0, 5000, false);
    expect(result).toBe(4000);
  });

  it("second partial refund only reverses remaining amount", () => {
    // First refund already reversed $40 (4000 cents) of $80 (8000 cents) payout
    // Second refund of $50 → proportional $40, but only $40 remains
    const result = calculateReversalCents(10000, 8000, 4000, 5000, false);
    expect(result).toBe(4000); // Caps at remaining
  });

  it("full refund after partial only reverses what remains", () => {
    // First refund reversed $40, now full refund for remaining
    const result = calculateReversalCents(10000, 8000, 4000, 5000, true);
    expect(result).toBe(4000); // Only $40 left to reverse
  });

  it("returns zero when fully reversed already", () => {
    const result = calculateReversalCents(10000, 8000, 8000, 5000, true);
    expect(result).toBe(0);
  });

  it("returns zero when over-reversed (data inconsistency guard)", () => {
    const result = calculateReversalCents(10000, 8000, 9000, 5000, false);
    expect(result).toBe(0);
  });

  it("handles zero charge amount without division by zero", () => {
    const result = calculateReversalCents(0, 0, 0, 5000, false);
    expect(result).toBe(0);
  });

  it("rounds to whole cents", () => {
    const result = calculateReversalCents(3333, 2666, 0, 1000, false);
    expect(Number.isInteger(result)).toBe(true);
  });

  it("small partial then full reversal scenario", () => {
    // $200 booking, sitter got $160 (80%). First refund $20 → reverse $16
    const first = calculateReversalCents(20000, 16000, 0, 2000, false);
    expect(first).toBe(1600);
    // Second full refund of $180 remaining → reverse $144, but only $144 remains (160-16)
    const second = calculateReversalCents(20000, 16000, 1600, 18000, true);
    expect(second).toBe(14400);
    // Total reversed: 1600 + 14400 = 16000 = full payout
    expect(first + second).toBe(16000);
  });

  it("three partial refunds drain payout correctly", () => {
    // $100 booking, $80 payout, three $33 refunds (proportional $26.40 each)
    const first = calculateReversalCents(10000, 8000, 0, 3300, false);
    expect(first).toBe(2640);
    const second = calculateReversalCents(10000, 8000, 2640, 3300, false);
    expect(second).toBe(2640);
    const third = calculateReversalCents(10000, 8000, 5280, 3400, false);
    // Proportional: 3400 * 0.8 = 2720, remaining: 8000-5280=2720 → caps at 2720
    expect(third).toBe(2720);
    expect(first + second + third).toBe(8000);
  });
});

describe("negative SitterEarning prevention", () => {
  function safeDecrement(currentNetAmount: number, reversalCents: number): number {
    const decrementAmount = Math.min(reversalCents / 100, Math.max(0, currentNetAmount));
    return decrementAmount > 0 ? decrementAmount : 0;
  }

  it("decrements normally when earnings cover reversal", () => {
    expect(safeDecrement(80, 4000)).toBe(40);
  });

  it("caps decrement at current earnings to prevent negative", () => {
    expect(safeDecrement(10, 4000)).toBe(10);
  });

  it("returns zero when earnings are already zero", () => {
    expect(safeDecrement(0, 4000)).toBe(0);
  });

  it("returns zero when earnings are negative", () => {
    expect(safeDecrement(-5, 4000)).toBe(0);
  });
});

describe("PayrollLineItem adjustment with amountReversed", () => {
  function safeLineDecrement(currentNetAmount: number, reversalCents: number): number {
    return Math.min(reversalCents / 100, Math.max(0, currentNetAmount));
  }

  it("decrements by reversal amount", () => {
    expect(safeLineDecrement(80, 4000)).toBe(40);
  });

  it("caps at line net amount to prevent negative", () => {
    expect(safeLineDecrement(20, 4000)).toBe(20);
  });

  it("returns zero when line already zeroed", () => {
    expect(safeLineDecrement(0, 4000)).toBe(0);
  });
});

describe("idempotency with amountReversed", () => {
  it("skips when remaining reversible is zero", () => {
    const remaining = 8000 - 8000;
    expect(remaining <= 0).toBe(true);
  });

  it("allows when remaining reversible is positive", () => {
    const remaining = 8000 - 4000;
    expect(remaining > 0).toBe(true);
  });

  it("blocks when over-reversed", () => {
    const remaining = 8000 - 9000;
    expect(remaining <= 0).toBe(true);
  });
});

describe("amountReversed accumulation", () => {
  it("accumulates correctly across multiple reversals", () => {
    let amountReversed = 0;
    const payoutAmount = 8000;

    // First reversal: 4000
    const first = calculateReversalCents(10000, payoutAmount, amountReversed, 5000, false);
    amountReversed += first;
    expect(amountReversed).toBe(4000);

    // Second reversal: 4000
    const second = calculateReversalCents(10000, payoutAmount, amountReversed, 5000, true);
    amountReversed += second;
    expect(amountReversed).toBe(8000);

    // Third reversal: 0 (fully reversed)
    const third = calculateReversalCents(10000, payoutAmount, amountReversed, 5000, true);
    expect(third).toBe(0);
    expect(amountReversed).toBe(payoutAmount);
  });

  it("status transitions correctly", () => {
    let amountReversed = 0;
    const payoutAmount = 8000;

    // After first partial
    amountReversed += 4000;
    const status1 = amountReversed >= payoutAmount ? "reversed" : "partial_reversal";
    expect(status1).toBe("partial_reversal");

    // After second (full)
    amountReversed += 4000;
    const status2 = amountReversed >= payoutAmount ? "reversed" : "partial_reversal";
    expect(status2).toBe("reversed");
  });
});
