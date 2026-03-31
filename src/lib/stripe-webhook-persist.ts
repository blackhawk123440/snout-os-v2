/**
 * Persist Stripe webhook events to DB (StripeCharge, StripeRefund).
 * Also upserts LedgerEntry for charges/refunds.
 */

import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logEvent } from '@/lib/log-event';
import { upsertLedgerEntry } from '@/lib/finance/ledger';

export async function persistPaymentSucceeded(
  db: PrismaClient,
  paymentIntentId: string,
  amount: number,
  currency: string,
  orgId: string,
  bookingId?: string | null,
  customerEmail?: string | null,
  customerName?: string | null,
  chargeId?: string
): Promise<void> {
  try {
    const id = chargeId || paymentIntentId;
    const chargeRow = await db.stripeCharge.upsert({
      where: { id },
      update: {
        status: 'succeeded',
        amount,
        currency,
        orgId,
        bookingId: bookingId || null,
        customerEmail: customerEmail || null,
        customerName: customerName || null,
        lastError: null,
        syncedAt: new Date(),
      },
      create: {
        id,
        orgId,
        amount,
        currency,
        status: 'succeeded',
        paymentIntentId,
        bookingId: bookingId || null,
        customerEmail: customerEmail || null,
        customerName: customerName || null,
        createdAt: new Date(),
      },
    });
    await upsertLedgerEntry(db, {
      orgId,
      entryType: 'charge',
      source: 'stripe',
      stripeId: id,
      bookingId: bookingId || undefined,
      amountCents: amount,
      currency,
      status: 'succeeded',
      occurredAt: chargeRow.createdAt,
    });
  } catch (err) {
    console.error('[stripe-webhook-persist] persistPaymentSucceeded failed:', err);
  }
}

export async function persistPaymentFailed(
  db: PrismaClient,
  paymentIntentId: string,
  amount: number,
  currency: string,
  orgId: string,
  errorMessage: string,
  bookingId?: string | null,
  customerEmail?: string | null,
  correlationId?: string
): Promise<void> {
  try {
    const id = paymentIntentId;
    const chargeRow = await db.stripeCharge.upsert({
      where: { id },
      update: {
        status: 'failed',
        lastError: errorMessage,
        amount,
        currency,
        orgId,
        bookingId: bookingId || null,
        customerEmail: customerEmail || null,
        syncedAt: new Date(),
      },
      create: {
        id,
        orgId,
        amount,
        currency,
        status: 'failed',
        lastError: errorMessage,
        paymentIntentId,
        bookingId: bookingId || null,
        customerEmail: customerEmail || null,
        createdAt: new Date(),
      },
    });
    await upsertLedgerEntry(db, {
      orgId,
      entryType: 'charge',
      source: 'stripe',
      stripeId: id,
      bookingId: bookingId || undefined,
      amountCents: amount,
      currency,
      status: 'failed',
      occurredAt: chargeRow.createdAt,
    });

    await logEvent({
      orgId,
      action: 'payment.failed',
      entityType: 'payment',
      entityId: paymentIntentId,
      bookingId: bookingId || undefined,
      status: 'failed',
      correlationId,
      metadata: { error: errorMessage, amount, currency },
    });
  } catch (err) {
    console.error('[stripe-webhook-persist] persistPaymentFailed failed:', err);
  }
}

export async function persistRefund(
  db: PrismaClient,
  refundId: string,
  chargeId: string,
  amount: number,
  currency: string,
  status: string,
  orgId: string,
  paymentIntentId?: string | null
): Promise<void> {
  try {
    const refundRow = await prisma.stripeRefund.upsert({
      where: { id: refundId },
      update: {
        amount,
        currency,
        status,
        paymentIntentId: paymentIntentId || null,
        syncedAt: new Date(),
      },
      create: {
        id: refundId,
        chargeId,
        amount,
        currency,
        status,
        paymentIntentId: paymentIntentId || null,
        createdAt: new Date(),
      },
    });
    const charge = await db.stripeCharge.findFirst({
      where: { id: chargeId },
      select: { bookingId: true, clientId: true },
    });
    await upsertLedgerEntry(db, {
      orgId,
      entryType: 'refund',
      source: 'stripe',
      stripeId: refundId,
      bookingId: charge?.bookingId ?? undefined,
      clientId: charge?.clientId ?? undefined,
      amountCents: amount,
      currency,
      status: status === 'succeeded' ? 'succeeded' : status === 'failed' ? 'failed' : 'pending',
      occurredAt: refundRow.createdAt,
    });

    await db.stripeCharge.updateMany({
      where: { id: chargeId },
      data: { refunded: true, refundedAt: new Date(), amountRefunded: amount },
    });

    await logEvent({
      orgId,
      action: 'payment.refunded',
      entityType: 'payment',
      entityId: refundId,
      status: 'success',
      metadata: { chargeId, amount, currency },
    });
  } catch (err) {
    console.error('[stripe-webhook-persist] persistRefund failed:', err);
  }
}
