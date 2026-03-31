/**
 * Auto-charge payment automation
 *
 * When a booking is confirmed, attempts to charge the client's saved payment method.
 * If no saved method exists, generates a payment link and sends it via SMS.
 *
 * Org-configurable: "charge_at_booking" (default) or "charge_at_completion".
 */

import { stripe } from '@/lib/stripe';
import { logEvent } from '@/lib/log-event';

interface AutoChargeParams {
  bookingId: string;
  orgId: string;
  clientId: string;
  /** Amount in dollars (will be converted to cents) */
  amount: number;
  service: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
}

interface AutoChargeResult {
  charged: boolean;
  paymentIntentId?: string;
  paymentLinkUrl?: string;
  paymentLinkSent?: boolean;
  error?: string;
}

/**
 * Get the org's payment timing preference.
 * Returns 'at_booking' (charge when confirmed) or 'at_completion' (charge after service).
 */
export async function getPaymentTiming(orgId: string): Promise<'at_booking' | 'at_completion'> {
  try {
    const { prisma } = await import('@/lib/db');
    const setting = await (prisma as any).setting.findFirst({
      where: { orgId, key: 'payment_timing' },
    });
    if (setting?.value === 'at_completion') return 'at_completion';
  } catch {}
  return 'at_booking';
}

/**
 * Attempt to auto-charge a client's saved payment method for a confirmed booking.
 * If no saved method, generate and send a payment link.
 */
export async function chargeOnConfirmation(params: AutoChargeParams): Promise<AutoChargeResult> {
  const { bookingId, orgId, clientId, amount, service, clientName, clientEmail, clientPhone } = params;
  const amountCents = Math.round(amount * 100);

  if (amountCents <= 0) {
    return { charged: true }; // Free booking, nothing to charge
  }

  try {
    const { prisma } = await import('@/lib/db');
    const db = prisma as any;

    // Check if already paid
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { paymentStatus: true },
    });
    if (booking?.paymentStatus === 'paid') {
      return { charged: true };
    }

    // Try to auto-charge saved payment method
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { stripeCustomerId: true, email: true },
    });

    if (client?.stripeCustomerId) {
      const methods = await stripe.paymentMethods.list({
        customer: client.stripeCustomerId,
        type: 'card',
        limit: 1,
      });

      if (methods.data.length > 0) {
        const paymentMethod = methods.data[0];
        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: 'usd',
            customer: client.stripeCustomerId,
            payment_method: paymentMethod.id,
            off_session: true,
            confirm: true,
            description: `${service} for ${clientName}`,
            metadata: { bookingId, orgId, clientId },
          });

          // PaymentIntent succeeded — webhook will handle booking update
          await logEvent({
            orgId,
            action: 'payment.auto_charged',
            entityType: 'payment',
            entityId: paymentIntent.id,
            bookingId,
            status: 'success',
            metadata: {
              amount: amountCents,
              paymentMethodLast4: paymentMethod.card?.last4,
            },
          }).catch(() => {});

          return { charged: true, paymentIntentId: paymentIntent.id };
        } catch (chargeError: any) {
          // Card declined or requires authentication — fall through to payment link
          console.warn('[auto-charge] Card charge failed, falling back to payment link:', chargeError?.message);
          await logEvent({
            orgId,
            action: 'payment.auto_charge_failed',
            bookingId,
            status: 'failed',
            metadata: {
              error: chargeError?.message,
              code: chargeError?.code,
              declineCode: chargeError?.decline_code,
            },
          }).catch(() => {});
        }
      }
    }

    // No saved method or charge failed — generate payment link
    const { createPaymentLink } = await import('@/lib/stripe');
    const paymentLinkUrl = await createPaymentLink(amount, `${service} — ${clientName}`, clientEmail || undefined, {
      bookingId,
      orgId,
      clientId,
    });

    if (!paymentLinkUrl) {
      return { charged: false, error: 'Failed to create payment link' };
    }

    // Save payment link on booking
    await db.booking.update({
      where: { id: bookingId },
      data: { stripePaymentLinkUrl: paymentLinkUrl },
    });

    // Send payment link via SMS if phone available
    let paymentLinkSent = false;
    if (clientPhone) {
      try {
        const { guardedSend } = await import('@/lib/messaging-guard');
        paymentLinkSent = await guardedSend(orgId, 'payment_link_on_confirm', async () => {
          const { sendMessage } = await import('@/lib/message-utils');
          const msg = `Hi ${clientName.split(' ')[0] || 'there'}, your booking for ${service} has been confirmed! Please complete payment here: ${paymentLinkUrl}`;
          await sendMessage(clientPhone, msg, bookingId);
          return true;
        });
      } catch (smsError) {
        console.warn('[auto-charge] Failed to send payment link SMS:', smsError);
      }
    }

    await logEvent({
      orgId,
      action: 'payment.link_generated_on_confirm',
      bookingId,
      status: 'success',
      metadata: { paymentLinkSent },
    }).catch(() => {});

    return { charged: false, paymentLinkUrl, paymentLinkSent };
  } catch (error: any) {
    console.error('[auto-charge] Error:', error);
    return { charged: false, error: error?.message || 'Unknown error' };
  }
}
