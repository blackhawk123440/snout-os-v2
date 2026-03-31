/**
 * Reconciliation: compare LedgerEntry vs StripeCharge/StripeRefund/PayoutTransfer.
 * No live Stripe API calls; uses persisted tables.
 */

import { getScopedDb } from "@/lib/tenancy";
import { prisma } from "@/lib/db";

export interface ReconcileResult {
  totalsByType: Record<string, number>;
  stripeTotalsByType: Record<string, number>;
  missingInDb: Array<{ type: string; id: string; amountCents: number; occurredAt: Date }>;
  missingInStripe: Array<{ type: string; id: string; stripeId: string | null; amountCents: number }>;
  amountDiffs: Array<{ type: string; id: string; ledgerCents: number; stripeCents: number }>;
}

/**
 * Reconcile org's ledger vs Stripe-persisted tables for a date range.
 */
export async function reconcileOrgRange(params: {
  orgId: string;
  start: Date;
  end: Date;
}): Promise<ReconcileResult> {
  const { orgId, start, end } = params;
  const db = getScopedDb({ orgId });

  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);

  // Ledger totals and map
  const ledgerEntries = await db.ledgerEntry.findMany({
    where: { occurredAt: { gte: startDay, lte: endDay } },
    select: { entryType: true, amountCents: true, stripeId: true },
  });
  const totalsByType: Record<string, number> = {};
  const ledgerMap = new Map<string, number>();
  for (const e of ledgerEntries) {
    totalsByType[e.entryType] = (totalsByType[e.entryType] ?? 0) + e.amountCents;
    if (e.stripeId) ledgerMap.set(`${e.entryType}:${e.stripeId}`, e.amountCents);
  }

  // Stripe side: charges, refunds, payouts
  const charges = await db.stripeCharge.findMany({
    where: { createdAt: { gte: startDay, lte: endDay } },
    select: { id: true, amount: true, createdAt: true },
  });
  const refundsRaw = await prisma.stripeRefund.findMany({
    where: { createdAt: { gte: startDay, lte: endDay } },
    select: { id: true, chargeId: true, amount: true, createdAt: true },
  });
  const chargeIds = refundsRaw.map((r) => r.chargeId);
  const chargesForRefunds = await prisma.stripeCharge.findMany({
    where: { id: { in: chargeIds } },
    select: { id: true, orgId: true },
  });
  const chargeOrgMap = new Map(chargesForRefunds.map((c) => [c.id, c.orgId]));
  const refunds = refundsRaw.filter((r) => chargeOrgMap.get(r.chargeId) === orgId);

  const payouts = await db.payoutTransfer.findMany({
    where: { createdAt: { gte: startDay, lte: endDay } },
    select: { id: true, stripeTransferId: true, amount: true, createdAt: true },
  });

  const stripeTotalsByType: Record<string, number> = {
    charge: charges.reduce((s, c) => s + c.amount, 0),
    refund: refunds.reduce((s, r) => s + r.amount, 0),
    payout: payouts.reduce((s, p) => s + p.amount, 0),
  };

  const missingInDb: ReconcileResult["missingInDb"] = [];
  const missingInStripe: ReconcileResult["missingInStripe"] = [];
  const amountDiffs: ReconcileResult["amountDiffs"] = [];

  for (const c of charges) {
    const ledgerCents = ledgerMap.get(`charge:${c.id}`);
    if (ledgerCents === undefined) {
      missingInDb.push({ type: "charge", id: c.id, amountCents: c.amount, occurredAt: c.createdAt });
    } else if (ledgerCents !== c.amount) {
      amountDiffs.push({ type: "charge", id: c.id, ledgerCents, stripeCents: c.amount });
    }
  }
  for (const r of refunds) {
    const ledgerCents = ledgerMap.get(`refund:${r.id}`);
    if (ledgerCents === undefined) {
      missingInDb.push({ type: "refund", id: r.id, amountCents: r.amount, occurredAt: r.createdAt });
    } else if (ledgerCents !== r.amount) {
      amountDiffs.push({ type: "refund", id: r.id, ledgerCents, stripeCents: r.amount });
    }
  }
  for (const p of payouts) {
    const stripeId = p.stripeTransferId ?? p.id;
    const ledgerCents = p.stripeTransferId ? ledgerMap.get(`payout:${p.stripeTransferId}`) : undefined;
    if (ledgerCents === undefined && p.stripeTransferId) {
      missingInDb.push({ type: "payout", id: p.id, amountCents: p.amount, occurredAt: p.createdAt });
    } else if (ledgerCents !== undefined && ledgerCents !== p.amount) {
      amountDiffs.push({ type: "payout", id: p.id, ledgerCents, stripeCents: p.amount });
    }
  }

  for (const e of ledgerEntries) {
    if (!e.stripeId) continue;
    const type = e.entryType;
    if (type === "charge") {
      const found = charges.some((c) => c.id === e.stripeId);
      if (!found) missingInStripe.push({ type: "charge", id: e.stripeId, stripeId: e.stripeId, amountCents: e.amountCents });
    } else if (type === "refund") {
      const found = refunds.some((r) => r.id === e.stripeId);
      if (!found) missingInStripe.push({ type: "refund", id: e.stripeId, stripeId: e.stripeId, amountCents: e.amountCents });
    } else if (type === "payout") {
      const found = payouts.some((p) => p.stripeTransferId === e.stripeId);
      if (!found) missingInStripe.push({ type: "payout", id: e.stripeId, stripeId: e.stripeId, amountCents: e.amountCents });
    }
  }

  return {
    totalsByType,
    stripeTotalsByType,
    missingInDb,
    missingInStripe,
    amountDiffs,
  };
}
