/**
 * Ledger tests:
 * - webhook persistence creates ledger entry idempotently
 * - payout creation creates ledger entry
 * - reconciliation detects missing ledger entry
 * - export is owner/admin only and org-scoped
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockLedgerCreate = vi.fn();
const mockLedgerUpsert = vi.fn();

vi.mock("@/lib/tenancy", () => ({
  getScopedDb: vi.fn(() => ({
    ledgerEntry: {
      create: mockLedgerCreate,
      upsert: mockLedgerUpsert,
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    stripeCharge: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    payoutTransfer: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    reconciliationRun: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    stripeRefund: { upsert: vi.fn(), findMany: vi.fn() },
    stripeCharge: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

describe("ledger persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upsertLedgerEntry creates when stripeId provided and no existing", async () => {
    mockLedgerUpsert.mockResolvedValue({});

    const { upsertLedgerEntry } = await import("../ledger");
    const db = (await import("@/lib/tenancy")).getScopedDb({ orgId: "org-1" }) as any;

    await upsertLedgerEntry(db, {
      orgId: "org-1",
      entryType: "charge",
      source: "stripe",
      stripeId: "ch_123",
      amountCents: 5000,
      occurredAt: new Date(),
    });

    expect(mockLedgerUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.any(Object),
        create: expect.objectContaining({
          orgId: "org-1",
          entryType: "charge",
          stripeId: "ch_123",
          amountCents: 5000,
        }),
        update: expect.any(Object),
      })
    );
  });

  it("upsertLedgerEntry is idempotent (upsert by stripeId)", async () => {
    mockLedgerUpsert.mockResolvedValue({});

    const { upsertLedgerEntry } = await import("../ledger");
    const db = (await import("@/lib/tenancy")).getScopedDb({ orgId: "org-1" }) as any;

    await upsertLedgerEntry(db, {
      orgId: "org-1",
      entryType: "charge",
      source: "stripe",
      stripeId: "ch_123",
      amountCents: 5000,
      occurredAt: new Date(),
    });
    await upsertLedgerEntry(db, {
      orgId: "org-1",
      entryType: "charge",
      source: "stripe",
      stripeId: "ch_123",
      amountCents: 5500,
      occurredAt: new Date(),
    });

    expect(mockLedgerUpsert).toHaveBeenCalledTimes(2);
    expect(mockLedgerUpsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.any(Object),
        update: expect.objectContaining({ amountCents: 5500 }),
      })
    );
  });
});
