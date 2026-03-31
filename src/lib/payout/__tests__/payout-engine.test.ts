/**
 * Unit tests for payout calculation and idempotency.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/log-event", () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

import {
  calculatePayoutForBooking,
  executePayout,
} from "../payout-engine";

describe("calculatePayoutForBooking", () => {
  it("computes correct amount at 80% commission", () => {
    const calc = calculatePayoutForBooking(100, 80);
    expect(calc).toEqual({
      amountCents: 8000,
      amountGross: 100,
      commissionPct: 80,
      netAmount: 80,
    });
  });

  it("computes correct amount at 70% commission", () => {
    const calc = calculatePayoutForBooking(50.5, 70);
    expect(calc.amountGross).toBe(50.5);
    expect(calc.commissionPct).toBe(70);
    expect(calc.netAmount).toBe(35.35);
    expect(calc.amountCents).toBe(3535);
  });

  it("clamps commission to 0-100", () => {
    const over = calculatePayoutForBooking(100, 150);
    expect(over.commissionPct).toBe(100);
    expect(over.amountCents).toBe(10000);

    const under = calculatePayoutForBooking(100, -10);
    expect(under.commissionPct).toBe(0);
    expect(under.amountCents).toBe(0);
  });

  it("defaults to 80% when commission not provided", () => {
    const calc = calculatePayoutForBooking(200);
    expect(calc.commissionPct).toBe(80);
    expect(calc.netAmount).toBe(160);
    expect(calc.amountCents).toBe(16000);
  });
});

describe("executePayout idempotency", () => {
  const orgId = "org-1";
  const sitterId = "s1";
  const bookingId = "b1";
  const amountCents = 8000;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing result when PayoutTransfer already exists (paid)", async () => {
    const mockCreate = vi.fn();
    const mockFindFirst = vi.fn();
    mockFindFirst.mockResolvedValueOnce({
      id: "pt-1",
      status: "paid",
      stripeTransferId: "tr_existing",
    });

    const db = {
      payoutTransfer: {
        findFirst: mockFindFirst,
        create: mockCreate,
      },
      sitterStripeAccount: { findFirst: vi.fn() },
    } as any;

    const result = await executePayout({
      db,
      orgId,
      sitterId,
      bookingId,
      amountCents,
    });

    expect(result.success).toBe(true);
    expect(result.transferId).toBe("tr_existing");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns existing result when PayoutTransfer already exists (failed)", async () => {
    const mockCreate = vi.fn();
    const mockFindFirst = vi.fn();
    mockFindFirst.mockResolvedValueOnce({
      id: "pt-1",
      status: "failed",
      stripeTransferId: null,
      lastError: "Stripe error",
    });

    const db = {
      payoutTransfer: {
        findFirst: mockFindFirst,
        create: mockCreate,
      },
      sitterStripeAccount: { findFirst: vi.fn() },
    } as any;

    const result = await executePayout({
      db,
      orgId,
      sitterId,
      bookingId,
      amountCents,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Stripe error");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates failed transfer when sitter has no connected account", async () => {
    const mockCreate = vi.fn().mockResolvedValue({});
    const mockFindFirst = vi.fn();
    mockFindFirst.mockResolvedValueOnce(null); // no existing payout

    const db = {
      payoutTransfer: {
        findFirst: mockFindFirst,
        create: mockCreate,
      },
      sitterStripeAccount: { findFirst: vi.fn().mockResolvedValue(null) },
    } as any;

    const result = await executePayout({
      db,
      orgId,
      sitterId,
      bookingId,
      amountCents,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("no connected Stripe account");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId,
          sitterId,
          bookingId,
          amount: amountCents,
          status: "failed",
          lastError: expect.stringContaining("no connected"),
        }),
      })
    );
  });
});
