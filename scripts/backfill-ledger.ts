#!/usr/bin/env tsx
/**
 * Backfill LedgerEntry from existing StripeCharge, StripeRefund, PayoutTransfer.
 * Idempotent: upserts by stripeId.
 */

import { prisma } from "../src/lib/db";
import { upsertLedgerEntry } from "../src/lib/finance/ledger";
import { getScopedDb } from "../src/lib/tenancy";

async function backfillLedger() {
  let charges = 0;
  let refunds = 0;
  let payouts = 0;

  // StripeCharge
  const stripeCharges = await prisma.stripeCharge.findMany({
    select: {
      id: true,
      orgId: true,
      amount: true,
      currency: true,
      status: true,
      bookingId: true,
      clientId: true,
      createdAt: true,
    },
  });
  for (const c of stripeCharges) {
    const db = getScopedDb({ orgId: c.orgId });
    await upsertLedgerEntry(db, {
      orgId: c.orgId,
      entryType: "charge",
      source: "stripe",
      stripeId: c.id,
      bookingId: c.bookingId ?? undefined,
      clientId: c.clientId ?? undefined,
      amountCents: c.amount,
      currency: c.currency,
      status: c.status === "succeeded" ? "succeeded" : c.status === "failed" ? "failed" : "pending",
      occurredAt: c.createdAt,
    });
    charges++;
    if (charges % 100 === 0) console.log(`Charges: ${charges}`);
  }

  // StripeRefund (need orgId from charge)
  const stripeRefunds = await prisma.stripeRefund.findMany({
    select: {
      id: true,
      chargeId: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
    },
  });
  for (const r of stripeRefunds) {
    const charge = await prisma.stripeCharge.findFirst({
      where: { id: r.chargeId },
      select: { orgId: true, bookingId: true, clientId: true },
    });
    const orgId = charge?.orgId ?? "default";
    const db = getScopedDb({ orgId });
    await upsertLedgerEntry(db, {
      orgId,
      entryType: "refund",
      source: "stripe",
      stripeId: r.id,
      bookingId: charge?.bookingId ?? undefined,
      clientId: charge?.clientId ?? undefined,
      amountCents: r.amount,
      currency: r.currency,
      status: r.status === "succeeded" ? "succeeded" : r.status === "failed" ? "failed" : "pending",
      occurredAt: r.createdAt,
    });
    refunds++;
    if (refunds % 100 === 0) console.log(`Refunds: ${refunds}`);
  }

  // PayoutTransfer
  const transfers = await prisma.payoutTransfer.findMany({
    select: {
      id: true,
      orgId: true,
      sitterId: true,
      bookingId: true,
      stripeTransferId: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
    },
  });
  for (const t of transfers) {
    const db = getScopedDb({ orgId: t.orgId });
    await upsertLedgerEntry(db, {
      orgId: t.orgId,
      entryType: "payout",
      source: "stripe",
      stripeId: t.stripeTransferId ?? undefined,
      sitterId: t.sitterId,
      bookingId: t.bookingId ?? undefined,
      amountCents: t.amount,
      currency: t.currency,
      status: t.status === "paid" ? "succeeded" : t.status === "failed" ? "failed" : "pending",
      occurredAt: t.createdAt,
    });
    payouts++;
    if (payouts % 100 === 0) console.log(`Payouts: ${payouts}`);
  }

  console.log(`\n✅ Backfill complete: ${charges} charges, ${refunds} refunds, ${payouts} payouts`);
}

backfillLedger()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
