/**
 * Ledger persistence: upsert LedgerEntry idempotently by stripeId.
 * Pass getScopedDb(ctx) for org-scoped writes.
 */

import type { PrismaClient } from "@prisma/client";

export type LedgerEntryType = "charge" | "refund" | "payout" | "fee" | "adjustment";
export type LedgerSource = "stripe" | "internal";

export interface UpsertLedgerParams {
  orgId: string;
  entryType: LedgerEntryType;
  source: LedgerSource;
  stripeId?: string | null;
  bookingId?: string | null;
  clientId?: string | null;
  sitterId?: string | null;
  amountCents: number;
  currency?: string;
  status?: "succeeded" | "failed" | "pending";
  occurredAt: Date;
}

/**
 * Upsert a ledger entry. Idempotent when stripeId is provided (updates existing).
 */
export async function upsertLedgerEntry(
  db: PrismaClient,
  params: UpsertLedgerParams
): Promise<void> {
  const {
    orgId,
    entryType,
    source,
    stripeId,
    bookingId,
    clientId,
    sitterId,
    amountCents,
    currency = "usd",
    status = "succeeded",
    occurredAt,
  } = params;

  try {
    if (stripeId) {
      await db.ledgerEntry.upsert({
        where: { stripeId },
        update: {
          amountCents,
          status,
          occurredAt,
          bookingId: bookingId ?? undefined,
          clientId: clientId ?? undefined,
          sitterId: sitterId ?? undefined,
        },
        create: {
          orgId,
          entryType,
          source,
          stripeId,
          bookingId: bookingId ?? undefined,
          clientId: clientId ?? undefined,
          sitterId: sitterId ?? undefined,
          amountCents,
          currency,
          status,
          occurredAt,
        },
      });
    } else {
      await db.ledgerEntry.create({
        data: {
          orgId,
          entryType,
          source,
          bookingId: bookingId ?? undefined,
          clientId: clientId ?? undefined,
          sitterId: sitterId ?? undefined,
          amountCents,
          currency,
          status,
          occurredAt,
        },
      });
    }
  } catch (err) {
    console.error("[ledger] upsertLedgerEntry failed:", err);
  }
}
