/**
 * POST /api/ops/payouts/approve
 * Owner approves a pending payout, triggering the actual Stripe transfer.
 * Only relevant when org has PAYOUT_APPROVAL_REQUIRED=true.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { createTransferToConnectedAccount } from '@/lib/stripe-connect';
import { upsertLedgerEntry } from '@/lib/finance/ledger';
import { logEvent } from '@/lib/log-event';

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { payoutTransferId } = body;
    if (!payoutTransferId) return NextResponse.json({ error: 'payoutTransferId required' }, { status: 400 });

    const db = getScopedDb(ctx);
    const pt = await db.payoutTransfer.findUnique({ where: { id: payoutTransferId } });
    if (!pt) return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    if (pt.status === 'paid') return NextResponse.json({ error: 'Already paid' }, { status: 409 });

    // Look up sitter's Stripe account
    const account = await db.sitterStripeAccount.findFirst({
      where: { orgId: ctx.orgId, sitterId: pt.sitterId },
    });
    if (!account?.accountId || !account.payoutsEnabled) {
      return NextResponse.json({ error: 'Sitter Stripe account not ready' }, { status: 422 });
    }

    // Execute the transfer
    const { transferId } = await createTransferToConnectedAccount({
      amountCents: pt.amount,
      currency: pt.currency,
      destinationAccountId: account.accountId,
      description: `Approved payout for booking ${pt.bookingId}`,
      metadata: { orgId: ctx.orgId, sitterId: pt.sitterId, bookingId: pt.bookingId || '', approvedBy: ctx.userId || '' },
    });

    await db.payoutTransfer.update({
      where: { id: pt.id },
      data: { stripeTransferId: transferId, status: 'paid' },
    });

    await upsertLedgerEntry(db, {
      orgId: ctx.orgId,
      entryType: 'payout',
      source: 'stripe',
      stripeId: transferId,
      sitterId: pt.sitterId,
      bookingId: pt.bookingId || undefined,
      amountCents: pt.amount,
      currency: pt.currency,
      status: 'succeeded',
      occurredAt: new Date(),
    });

    await logEvent({
      orgId: ctx.orgId,
      action: 'payout.approved',
      status: 'success',
      metadata: { payoutTransferId: pt.id, transferId, approvedBy: ctx.userId, amount: pt.amount },
    }).catch(() => {});

    return NextResponse.json({ success: true, transferId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
