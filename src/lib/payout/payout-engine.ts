/**
 * Payout calculation and execution.
 * Uses sitter commission split; creates Stripe transfer and persists PayoutTransfer.
 */

import type { PrismaClient } from "@prisma/client";
import { createTransferToConnectedAccount } from "@/lib/stripe-connect";
import { logEvent } from "@/lib/log-event";
import { upsertLedgerEntry } from "@/lib/finance/ledger";

export interface PayoutCalculation {
  amountCents: number;
  amountGross: number;
  commissionPct: number;
  netAmount: number;
}

/**
 * Calculate sitter payout for a completed booking.
 * Uses sitter commissionPercentage (default 80%).
 */
export function calculatePayoutForBooking(
  totalPrice: number,
  commissionPercentage: number = 80
): PayoutCalculation {
  const pct = Math.min(100, Math.max(0, commissionPercentage));
  const netAmount = (totalPrice * pct) / 100;
  const amountCents = Math.round(netAmount * 100);
  return {
    amountCents,
    amountGross: totalPrice,
    commissionPct: pct,
    netAmount,
  };
}

/**
 * Execute payout: create Stripe transfer and persist PayoutTransfer.
 * Idempotent: skips if PayoutTransfer already exists for this booking.
 */
export async function executePayout(params: {
  db: PrismaClient;
  orgId: string;
  sitterId: string;
  bookingId: string;
  amountCents: number;
  currency?: string;
  correlationId?: string;
}): Promise<{ success: boolean; transferId?: string; payoutTransferId?: string; error?: string }> {
  const { db, orgId, sitterId, bookingId, amountCents, currency = "usd", correlationId } = params;

  // Approval mode: if enabled, create as pending_approval instead of executing
  const approvalRequired = process.env.PAYOUT_APPROVAL_REQUIRED === 'true';

  const existing = await db.payoutTransfer.findFirst({
    where: { orgId, bookingId, sitterId },
  });
  if (existing) {
    return {
      success: existing.status === "paid",
      transferId: existing.stripeTransferId ?? undefined,
      payoutTransferId: existing.id,
      error: existing.status === "failed" ? existing.lastError ?? undefined : undefined,
    };
  }

  const account = await db.sitterStripeAccount.findFirst({
    where: { orgId, sitterId },
  });
  if (!account?.accountId || !account.payoutsEnabled) {
    const pt = await db.payoutTransfer.create({
      data: {
        orgId,
        sitterId,
        bookingId,
        amount: amountCents,
        currency,
        status: "failed",
        lastError: "Sitter has no connected Stripe account or payouts not enabled",
      },
    });
    await upsertLedgerEntry(db, {
      orgId,
      entryType: "payout",
      source: "stripe",
      sitterId,
      bookingId,
      amountCents,
      currency,
      status: "failed",
      occurredAt: pt.createdAt,
    });
    await logEvent({
      action: "payout.failed",
      orgId,
      correlationId,
      metadata: {
        sitterId,
        bookingId,
        reason: "no_connected_account",
      },
    }).catch(() => {});
    // Notify sitter to complete Stripe Connect onboarding
    try {
      const sitter = await db.sitter.findUnique({
        where: { id: sitterId },
        select: { phone: true, firstName: true },
      });
      if (sitter?.phone) {
        const { sendMessage } = await import("@/lib/message-utils");
        void sendMessage(
          sitter.phone,
          `Hi ${sitter.firstName || "there"}, you have a pending payout of $${(amountCents / 100).toFixed(2)} but your Stripe account isn't set up yet. Go to your profile to connect Stripe and receive your earnings.`,
          bookingId,
        );
      }
    } catch { /* notification is best-effort */ }
    return { success: false, error: "Sitter has no connected Stripe account" };
  }

  // If approval required, create as pending_approval and stop — owner approves later
  if (approvalRequired) {
    const pt = await db.payoutTransfer.create({
      data: { orgId, sitterId, bookingId, amount: amountCents, currency, status: "pending" },
    });
    await logEvent({
      action: "payout.pending_approval",
      orgId,
      correlationId,
      metadata: { sitterId, bookingId, amountCents, payoutTransferId: pt.id },
    }).catch(() => {});
    return { success: true, payoutTransferId: pt.id, error: "Pending owner approval" };
  }

  try {
    const metadata: Record<string, string> = { orgId, sitterId, bookingId };
    if (correlationId) metadata.correlationId = correlationId;

    // Create PayoutTransfer record FIRST with status "pending" to prevent data loss
    const pt = await db.payoutTransfer.create({
      data: {
        orgId,
        sitterId,
        bookingId,
        amount: amountCents,
        currency,
        status: "pending",
      },
    });

    let transferId: string;
    try {
      const result = await createTransferToConnectedAccount({
        amountCents,
        currency,
        destinationAccountId: account.accountId,
        description: `Payout for booking ${bookingId}`,
        metadata: { ...metadata, payoutTransferId: pt.id },
      });
      transferId = result.transferId;
    } catch (transferErr) {
      // Transfer failed — update the pending record to failed
      await db.payoutTransfer.update({
        where: { id: pt.id },
        data: { status: "failed", lastError: transferErr instanceof Error ? transferErr.message : String(transferErr) },
      });
      throw transferErr; // Re-throw to trigger outer catch
    }

    // Transfer succeeded — update record with Stripe transfer ID
    await db.payoutTransfer.update({
      where: { id: pt.id },
      data: { stripeTransferId: transferId, status: "paid" },
    });
    await upsertLedgerEntry(db, {
      orgId,
      entryType: "payout",
      source: "stripe",
      stripeId: transferId,
      sitterId,
      bookingId,
      amountCents,
      currency,
      status: "succeeded",
      occurredAt: pt.createdAt,
    });

    // Create SitterEarning record for earnings tracking
    const grossAmount = amountCents / 100;
    const platformFee = grossAmount * 0.2; // 20% platform fee (inverse of 80% commission)
    await db.sitterEarning.upsert({
      where: {
        orgId_sitterId_bookingId: { orgId, sitterId, bookingId },
      },
      create: {
        orgId,
        sitterId,
        bookingId,
        amountGross: grossAmount,
        platformFee,
        netAmount: grossAmount - platformFee,
      },
      update: {
        amountGross: grossAmount,
        platformFee,
        netAmount: grossAmount - platformFee,
      },
    }).catch((e) => console.error("[payout] SitterEarning upsert failed:", e));

    await logEvent({
      action: "payout.sent",
      orgId,
      correlationId,
      metadata: {
        sitterId,
        bookingId,
        transferId,
        amountCents,
      },
    }).catch(() => {});

    return { success: true, transferId, payoutTransferId: pt.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // PayoutTransfer already exists (created as "pending" above, updated to "failed" in inner catch)
    // Just log the ledger entry and event
    await upsertLedgerEntry(db, {
      orgId,
      entryType: "payout",
      source: "stripe",
      sitterId,
      bookingId,
      amountCents,
      currency,
      status: "failed",
      occurredAt: new Date(),
    });
    await logEvent({
      action: "payout.failed",
      orgId,
      correlationId,
      metadata: {
        sitterId,
        bookingId,
        error: msg,
      },
    }).catch(() => {});
    return { success: false, error: msg };
  }
}
