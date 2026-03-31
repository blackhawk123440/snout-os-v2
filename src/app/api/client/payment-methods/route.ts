/**
 * GET /api/client/payment-methods — list saved payment methods
 * POST /api/client/payment-methods — create SetupIntent for adding a new card
 * DELETE /api/client/payment-methods?id=pm_xxx — remove a payment method
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { stripe } from '@/lib/stripe';

async function getOrCreateStripeCustomer(
  db: any,
  clientId: string,
  orgId: string,
  email?: string | null,
  name?: string | null,
): Promise<string> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { stripeCustomerId: true, email: true, firstName: true, lastName: true },
  });

  if (client?.stripeCustomerId) return client.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: email || client?.email || undefined,
    name: name || `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || undefined,
    metadata: { orgId, clientId },
  });

  await db.client.update({
    where: { id: clientId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.clientId) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  try {
    const db = getScopedDb(ctx);
    const client = await db.client.findUnique({
      where: { id: ctx.clientId },
      select: { stripeCustomerId: true },
    });

    if (!client?.stripeCustomerId) {
      return NextResponse.json({ methods: [], hasCustomer: false });
    }

    const methods = await stripe.paymentMethods.list({
      customer: client.stripeCustomerId,
      type: 'card',
    });

    return NextResponse.json({
      methods: methods.data.map((m) => ({
        id: m.id,
        brand: m.card?.brand || 'unknown',
        last4: m.card?.last4 || '****',
        expMonth: m.card?.exp_month,
        expYear: m.card?.exp_year,
        isDefault: false, // Could check customer.invoice_settings.default_payment_method
      })),
      hasCustomer: true,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load payment methods' }, { status: 500 });
  }
}

export async function POST() {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.clientId) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  try {
    const db = getScopedDb(ctx);
    const customerId = await getOrCreateStripeCustomer(db, ctx.clientId, ctx.orgId);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      metadata: { orgId: ctx.orgId, clientId: ctx.clientId },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.clientId) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  try {
    const { searchParams } = new URL(request.url);
    const paymentMethodId = searchParams.get('id');
    if (!paymentMethodId) return NextResponse.json({ error: 'Payment method ID required' }, { status: 400 });

    await stripe.paymentMethods.detach(paymentMethodId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
