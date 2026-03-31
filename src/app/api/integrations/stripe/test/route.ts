import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { env } from '@/lib/env';

export async function POST() {
  try {
    const ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      {
        success: false,
        connectivity: false,
        accountReachable: false,
        transfersEnabled: false,
        message: 'Missing STRIPE_SECRET_KEY',
      },
      { status: 400 }
    );
  }

  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY as string, { apiVersion: '2025-03-31.basil' as any });
    await stripe.balance.retrieve();
    const account = await stripe.accounts.retrieve();
    const transfersEnabled =
      account.payouts_enabled === true ||
      (account.capabilities && (account.capabilities as any).transfers === 'active');

    return NextResponse.json(
      {
        success: true,
        connectivity: true,
        accountReachable: true,
        transfersEnabled: !!transfersEnabled,
        accountId: account.id,
        message: transfersEnabled
          ? 'Stripe connectivity and transfers are enabled'
          : 'Stripe connectivity is good, but transfers are not enabled',
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        connectivity: false,
        accountReachable: false,
        transfersEnabled: false,
        message: error?.message || 'Stripe API test failed',
      },
      { status: 500 }
    );
  }
}
