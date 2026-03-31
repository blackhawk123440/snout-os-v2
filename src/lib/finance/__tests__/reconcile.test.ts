/**
 * Reconciliation tests:
 * - detects missing ledger entry (Stripe has it, ledger doesn't)
 * - uses persisted tables only (no live Stripe API)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockLedgerFindMany = vi.fn();
const mockChargeFindMany = vi.fn();
const mockPayoutFindMany = vi.fn();
const mockRefundFindMany = vi.fn();
const mockChargeFindManyUnscoped = vi.fn();

vi.mock("@/lib/tenancy", () => ({
  getScopedDb: vi.fn(() => ({
    ledgerEntry: { findMany: mockLedgerFindMany },
    stripeCharge: { findMany: mockChargeFindMany },
    payoutTransfer: { findMany: mockPayoutFindMany },
  })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    stripeRefund: { findMany: mockRefundFindMany },
    stripeCharge: { findMany: mockChargeFindManyUnscoped },
  },
}));

describe("reconcileOrgRange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLedgerFindMany.mockResolvedValue([]);
    mockChargeFindMany.mockResolvedValue([]);
    mockPayoutFindMany.mockResolvedValue([]);
    mockRefundFindMany.mockResolvedValue([]);
    mockChargeFindManyUnscoped.mockResolvedValue([]);
  });

  it("detects charge missing in ledger", async () => {
    const start = new Date("2025-03-01");
    const end = new Date("2025-03-31");

    mockChargeFindMany.mockResolvedValue([
      { id: "ch_123", amount: 5000, createdAt: new Date("2025-03-15") },
    ]);
    mockLedgerFindMany.mockResolvedValue([]);
    mockRefundFindMany.mockResolvedValue([]);

    const { reconcileOrgRange } = await import("../reconcile");
    const result = await reconcileOrgRange({ orgId: "org-1", start, end });

    expect(result.missingInDb).toContainEqual(
      expect.objectContaining({
        type: "charge",
        id: "ch_123",
        amountCents: 5000,
      })
    );
  });

  it("returns totals from ledger", async () => {
    const start = new Date("2025-03-01");
    const end = new Date("2025-03-31");

    mockLedgerFindMany.mockResolvedValue([
      { entryType: "charge", amountCents: 5000, stripeId: "ch_1" },
      { entryType: "charge", amountCents: 3000, stripeId: "ch_2" },
      { entryType: "refund", amountCents: 500, stripeId: "re_1" },
    ]);
    mockChargeFindMany.mockResolvedValue([
      { id: "ch_1", amount: 5000, createdAt: new Date() },
      { id: "ch_2", amount: 3000, createdAt: new Date() },
    ]);
    mockRefundFindMany.mockResolvedValue([
      { id: "re_1", chargeId: "ch_1", amount: 500, createdAt: new Date() },
    ]);
    mockChargeFindManyUnscoped.mockResolvedValue([
      { id: "ch_1", orgId: "org-1" },
    ]);

    const { reconcileOrgRange } = await import("../reconcile");
    const result = await reconcileOrgRange({ orgId: "org-1", start, end });

    expect(result.totalsByType.charge).toBe(8000);
    expect(result.totalsByType.refund).toBe(500);
  });
});
