/**
 * POST /api/sitter/instant-payout
 * Request an instant payout to the sitter's connected bank account.
 * Uses Stripe Instant Payouts — sitter pays the fee (typically 1%).
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { stripe } from '@/lib/stripe';
import { logEvent } from '@/lib/log-event';

export async function POST() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });

  try {
    const db = getScopedDb(ctx);
    const account = await db.sitterStripeAccount.findFirst({
      where: { sitterId: ctx.sitterId },
    });

    if (!account?.accountId || !account.payoutsEnabled) {
      return NextResponse.json({ error: 'Stripe Connect not set up or payouts not enabled' }, { status: 422 });
    }

    // Get the connected account's available balance
    const balance = await stripe.balance.retrieve({ stripeAccount: account.accountId });
    const available = balance.available.find((b) => b.currency === 'usd');
    const availableAmount = available?.amount || 0;

    if (availableAmount <= 0) {
      return NextResponse.json({ error: 'No available balance for instant payout' }, { status: 422 });
    }

    // Create instant payout on the connected account
    const payout = await stripe.payouts.create(
      {
        amount: availableAmount,
        currency: 'usd',
        method: 'instant',
        metadata: { sitterId: ctx.sitterId, orgId: ctx.orgId },
      },
      { stripeAccount: account.accountId }
    );

    await logEvent({
      orgId: ctx.orgId,
      action: 'payout.instant_requested',
      status: 'success',
      metadata: {
        sitterId: ctx.sitterId,
        amount: availableAmount,
        payoutId: payout.id,
        fee: payout.metadata?.fee || 'standard',
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      payoutId: payout.id,
      amount: availableAmount / 100,
      status: payout.status,
      arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
    });
  } catch (error: any) {
    const msg = error?.message || 'Unknown error';
    // Stripe returns specific errors for instant payout ineligibility
    if (msg.includes('instant') || msg.includes('not eligible')) {
      return NextResponse.json({
        error: 'Instant payouts not available. Your bank may not support instant transfers, or your account may need additional verification.',
      }, { status: 422 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
