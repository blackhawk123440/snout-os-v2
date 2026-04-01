/**
 * Stripe Webhook Handler
 *
 * Handles: payment_intent.succeeded, payment_intent.payment_failed,
 * charge.refunded, invoice.payment_succeeded.
 * Persists to StripeCharge/StripeRefund, logs payment.completed/failed/refunded.
 * Verifies webhook signature; rejects non-POST.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { getScopedDb } from '@/lib/tenancy';
import { onBookingConfirmed } from '@/lib/bookings/booking-confirmed-handler';
import { logEvent } from '@/lib/log-event';
import { syncConversationLifecycleWithBookingWorkflow } from '@/lib/messaging/conversation-service';
import {
  persistPaymentSucceeded,
  persistPaymentFailed,
  persistRefund,
} from '@/lib/stripe-webhook-persist';
import { publish, channels } from '@/lib/realtime/bus';

const WEBHOOK_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

async function claimStripeWebhookEvent(event: Stripe.Event): Promise<'claimed' | 'duplicate'> {
  const now = new Date();
  try {
    await (prisma as any).stripeWebhookEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        status: 'processing',
        claimedAt: now,
        processedAt: null,
        lastError: null,
      },
    });
    return 'claimed';
  } catch (error: any) {
    const isUniqueViolation = error?.code === 'P2002';
    if (!isUniqueViolation) throw error;
  }

  const existing = await (prisma as any).stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (!existing) {
    return 'duplicate';
  }
  if (existing.status === 'processed') {
    return 'duplicate';
  }

  const staleBefore = new Date(Date.now() - WEBHOOK_CLAIM_TIMEOUT_MS);
  const canReclaim =
    existing.status === 'failed' ||
    !existing.claimedAt ||
    new Date(existing.claimedAt).getTime() <= staleBefore.getTime();

  if (!canReclaim) {
    return 'duplicate';
  }

  const updated = await (prisma as any).stripeWebhookEvent.updateMany({
    where: {
      stripeEventId: event.id,
      status: existing.status,
    },
    data: {
      type: event.type,
      status: 'processing',
      claimedAt: now,
      processedAt: null,
      lastError: null,
    },
  });

  return updated.count > 0 ? 'claimed' : 'duplicate';
}

async function markStripeWebhookEventProcessed(eventId: string) {
  await (prisma as any).stripeWebhookEvent.updateMany({
    where: { stripeEventId: eventId },
    data: {
      status: 'processed',
      processedAt: new Date(),
      lastError: null,
    },
  });
}

async function markStripeWebhookEventFailed(eventId: string, error: unknown) {
  await (prisma as any).stripeWebhookEvent.updateMany({
    where: { stripeEventId: eventId },
    data: {
      status: 'failed',
      lastError: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000),
    },
  });
}

export async function POST(request: NextRequest) {
  let eventId: string | null = null;
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
    }

    const rawBody = await request.text();
    let event: Stripe.Event;
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_dummy', { apiVersion: '2025-03-31.basil' as any });
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err: any) {
      console.warn('[Stripe Webhook] Signature verification failed:', err?.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    eventId = event.id;
    const claimResult = await claimStripeWebhookEvent(event);
    if (claimResult === 'duplicate') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // payment_intent.succeeded
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as any;
      const bookingId = pi.metadata?.bookingId;
      const orgId = pi.metadata?.orgId || 'default';
      const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
      const db = getScopedDb({ orgId });

      await persistPaymentSucceeded(
        db,
        pi.id,
        pi.amount,
        pi.currency || 'usd',
        orgId,
        bookingId,
        pi.receipt_email,
        null,
        chargeId || undefined
      );

      if (bookingId) {
        const booking = await db.booking.findUnique({
          where: { id: bookingId },
          select: { orgId: true, clientId: true, sitterId: true, startAt: true, endAt: true, status: true },
        });
        if (booking) {
          if (chargeId) {
            await db.stripeCharge.updateMany({
              where: { id: chargeId },
              data: { orgId: booking.orgId || orgId, clientId: booking.clientId },
            });
          }
          const previousStatus = booking.status || 'pending';
          if (previousStatus !== 'confirmed') {
            // Step 1: Mark booking confirmed + paid in DB first — this MUST succeed
            await db.booking.update({
              where: { id: bookingId },
              data: { status: 'confirmed', paymentStatus: 'paid' },
            });

            // Step 2: Fire confirmation side effects (notifications, lifecycle sync)
            // These are non-blocking — failures are logged but don't roll back the confirmation
            try {
              await onBookingConfirmed({
                bookingId,
                orgId: booking.orgId || orgId,
                clientId: booking.clientId || '',
                sitterId: booking.sitterId,
                startAt: new Date(booking.startAt),
                endAt: new Date(booking.endAt),
                actorUserId: 'system',
              });
            } catch (e: any) {
              console.error('[Stripe Webhook] onBookingConfirmed notification failed (booking already confirmed):', e);
              try {
                const { captureException } = await import('@sentry/nextjs');
                captureException(e, { tags: { webhook: 'stripe', phase: 'onBookingConfirmed' }, extra: { bookingId } });
              } catch (_) {}
            }

            await syncConversationLifecycleWithBookingWorkflow({
              orgId: booking.orgId || orgId,
              bookingId,
              clientId: booking.clientId,
              sitterId: booking.sitterId,
              bookingStatus: 'confirmed',
              serviceWindowStart: booking.startAt ? new Date(booking.startAt) : null,
              serviceWindowEnd: booking.endAt ? new Date(booking.endAt) : null,
            }).catch((error) => {
              console.error('[Stripe Webhook] messaging lifecycle sync failed:', error);
            });
          }
          await logEvent({
            orgId: booking.orgId || orgId,
            actorUserId: 'system',
            action: 'payment.completed',
            entityType: 'payment',
            entityId: pi.id,
            bookingId,
            status: 'success',
            metadata: { stripeEventType: event.type },
          }).catch(() => {});
          // Notify owner dashboard via SSE
          publish(channels.ownerOps(booking.orgId || orgId), {
            type: 'payment.received',
            bookingId,
            amount: pi.amount / 100,
            ts: Date.now(),
          }).catch(() => {});
          // Notify assigned sitter that payment was received (N4)
          if (booking.sitterId) {
            const fullBooking = await db.booking.findUnique({
              where: { id: bookingId },
              select: { firstName: true, lastName: true, service: true, startAt: true },
            });
            if (fullBooking) {
              void import('@/lib/notifications/triggers').then(({ notifySitterPaymentReceived }) => {
                notifySitterPaymentReceived({
                  orgId: booking.orgId || orgId,
                  bookingId,
                  sitterId: booking.sitterId!,
                  clientName: `${fullBooking.firstName} ${fullBooking.lastName}`.trim(),
                  service: fullBooking.service,
                  startAt: fullBooking.startAt,
                });
              }).catch(() => {});
            }
          }
          const { enqueueAutomation } = await import('@/lib/automation-queue');
          await enqueueAutomation(
            'bookingConfirmation',
            'client',
            { bookingId },
            `bookingConfirmation:client:${bookingId}:payment`
          );
        }
      }
    }

    // Tip payment: webhook-driven transfer to sitter
    // Fires on payment_intent.succeeded when metadata.type === 'tip'
    // This is the reliable path — the client-side /tip/success call is a fallback
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as any;
      if (pi.metadata?.type === 'tip' && !pi.metadata?.transfer_id) {
        const sitterId = pi.metadata?.sitter_id;
        if (sitterId) {
          try {
            const { prisma } = await import('@/lib/db');

            // Resolve sitter's connected Stripe account
            let destinationAccountId: string | null = null;
            if (sitterId.startsWith('acct_')) {
              destinationAccountId = sitterId;
            } else {
              const account = await prisma.sitterStripeAccount.findFirst({
                where: { sitterId, payoutsEnabled: true },
                select: { accountId: true },
              });
              destinationAccountId = account?.accountId ?? null;

              // Try name alias lookup
              if (!destinationAccountId) {
                const parts = sitterId.split('-');
                if (parts.length >= 2) {
                  const sitters = await prisma.sitter.findMany({
                    select: { id: true, firstName: true, lastName: true },
                  });
                  const match = sitters.find((s) => {
                    const full = [s.firstName, s.lastName].filter(Boolean).join('-').toLowerCase();
                    return full === sitterId.toLowerCase();
                  });
                  if (match) {
                    const acct = await prisma.sitterStripeAccount.findFirst({
                      where: { sitterId: match.id, payoutsEnabled: true },
                      select: { accountId: true },
                    });
                    destinationAccountId = acct?.accountId ?? null;
                  }
                }
              }
            }

            if (destinationAccountId) {
              const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
                apiVersion: '2025-03-31.basil' as any,
              });
              const chargeId = typeof pi.latest_charge === 'string'
                ? pi.latest_charge
                : pi.latest_charge?.id;

              const transfer = await stripeClient.transfers.create({
                amount: pi.amount,
                currency: pi.currency || 'usd',
                destination: destinationAccountId,
                ...(chargeId ? { source_transaction: chargeId } : {}),
                description: `Tip from ${pi.metadata?.payer_name || 'client'}`,
                metadata: {
                  payment_intent_id: pi.id,
                  sitter_id: sitterId,
                  type: 'tip_transfer',
                },
              });

              // Mark the payment intent to prevent double-transfer
              await stripeClient.paymentIntents.update(pi.id, {
                metadata: { ...pi.metadata, transfer_id: transfer.id },
              });

              // Record tip in ledger
              const { upsertLedgerEntry } = await import('@/lib/finance/ledger');
              const orgId = pi.metadata?.orgId || 'default';
              const db = getScopedDb({ orgId });
              await upsertLedgerEntry(db, {
                orgId,
                entryType: 'charge',
                source: 'stripe',
                stripeId: pi.id,
                sitterId,
                amountCents: pi.amount,
                currency: pi.currency || 'usd',
                status: 'succeeded',
                occurredAt: new Date(),
              });

              // Update SitterEarning tips field if record exists
              await prisma.sitterEarning.updateMany({
                where: { sitterId },
                data: { tips: { increment: pi.amount / 100 } },
              }).catch(() => {});

              await logEvent({
                orgId,
                actorUserId: 'system',
                action: 'tip.transferred',
                entityType: 'tip',
                entityId: pi.id,
                status: 'success',
                metadata: {
                  sitterId,
                  amount: pi.amount,
                  transferId: transfer.id,
                  source: 'webhook',
                },
              }).catch(() => {});
            } else {
              await logEvent({
                orgId: pi.metadata?.orgId || 'default',
                actorUserId: 'system',
                action: 'tip.transfer_deferred',
                entityType: 'tip',
                entityId: pi.id,
                status: 'pending',
                metadata: {
                  sitterId,
                  amount: pi.amount,
                  reason: 'no_connected_account',
                },
              }).catch(() => {});
            }
          } catch (tipErr) {
            console.error('[Stripe Webhook] Tip transfer failed:', tipErr);
            await logEvent({
              orgId: pi.metadata?.orgId || 'default',
              actorUserId: 'system',
              action: 'tip.transfer_failed',
              entityType: 'tip',
              entityId: pi.id,
              status: 'failed',
              metadata: {
                sitterId,
                error: tipErr instanceof Error ? tipErr.message : String(tipErr),
              },
            }).catch(() => {});
          }
        }
      }
    }

    // payment_intent.payment_failed
    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as any;
      const err = pi.last_payment_error?.message || 'Payment failed';
      const orgId = pi.metadata?.orgId || 'default';
      const bookingId = pi.metadata?.bookingId;
      const db = getScopedDb({ orgId });
      await persistPaymentFailed(
        db,
        pi.id,
        pi.amount,
        pi.currency || 'usd',
        orgId,
        err,
        bookingId,
        pi.receipt_email
      );

      // Payment failure recovery: send SMS to client with payment link to retry
      if (bookingId) {
        try {
          const booking = await db.booking.findUnique({
            where: { id: bookingId },
            select: { phone: true, firstName: true, stripePaymentLinkUrl: true, service: true },
          });
          if (booking?.phone && booking.stripePaymentLinkUrl) {
            const { sendMessage } = await import('@/lib/message-utils');
            const msg = `Hi ${booking.firstName || 'there'}, your payment for ${booking.service || 'your booking'} didn't go through. Please try again: ${booking.stripePaymentLinkUrl}`;
            void sendMessage(booking.phone, msg, bookingId);
            await logEvent({
              orgId,
              action: 'payment.failed.recovery_sent',
              bookingId,
              status: 'success',
              metadata: { error: err },
            });
          }
        } catch (recoveryErr) {
          console.error('[Stripe Webhook] Payment failure recovery SMS failed:', recoveryErr);
        }
      }
    }

    // charge.refunded
    if (event.type === 'charge.refunded') {
      const charge = event.data.object as any;
      const refunds = charge.refunds?.data || [];
      const orgId = charge.metadata?.orgId || 'default';
      const db = getScopedDb({ orgId });
      for (const r of refunds) {
        await persistRefund(
          db,
          r.id,
          charge.id,
          r.amount,
          r.currency || 'usd',
          r.status || 'succeeded',
          orgId,
          charge.payment_intent
        );
      }
    }

    // checkout.session.completed (pay-first flow)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.bookingId;
      const sessionOrgId = session.metadata?.orgId;
      const bookingType = session.metadata?.bookingType;

      // Bundle purchase completion
      if (bookingType === 'bundle' && session.metadata?.purchaseId && sessionOrgId) {
        try {
          const db = getScopedDb({ orgId: sessionOrgId });
          const { loadPurchases, savePurchases } = await import('@/lib/bundles/bundle-persistence');
          const allPurchases = await loadPurchases(db);
          const purchase = allPurchases.find(
            (p: any) => p.id === session.metadata!.purchaseId && p.status === 'pending_payment'
          );
          if (purchase) {
            (purchase as any).status = 'active';
            (purchase as any).stripeSessionId = session.id;
            await savePurchases(db, sessionOrgId, allPurchases);
            await logEvent({
              orgId: sessionOrgId,
              actorUserId: 'system',
              action: 'bundle.payment.completed',
              entityType: 'bundle',
              entityId: session.metadata!.purchaseId,
              status: 'success',
              metadata: {
                purchaseId: session.metadata!.purchaseId,
                bundleId: session.metadata!.bundleId,
                clientId: session.metadata!.clientId,
                sessionId: session.id,
              },
            }).catch(() => {});
          }
        } catch (bundleErr) {
          console.error('[Stripe Webhook] Bundle payment confirmation failed:', bundleErr);
        }
      }

      if (bookingId && sessionOrgId) {
        const db = getScopedDb({ orgId: sessionOrgId });
        const booking = await db.booking.findFirst({ where: { id: bookingId } });

        if (booking) {
          // First-paid, first-secured: check if slot is still available
          const isDeposit = bookingType === 'deposit';
          if (!isDeposit) {
            try {
              const { checkSlotAvailability } = await import('@/lib/booking/slot-availability');
              const slotCheck = await checkSlotAvailability({
                orgId: sessionOrgId,
                service: (booking as any).service,
                startAt: (booking as any).startAt,
                endAt: (booking as any).endAt,
                excludeBookingId: bookingId,
              });

              if (!slotCheck.available) {
                // Slot filled while client was paying — auto-refund
                const pi = session.payment_intent;
                if (typeof pi === 'string') {
                  const refundStripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-03-31.basil' as any });
                  await refundStripe.refunds.create({
                    payment_intent: pi,
                    metadata: { bookingId, reason: 'slot_filled' },
                  });
                }

                await db.booking.update({
                  where: { id: bookingId },
                  data: {
                    status: 'cancelled',
                    paymentStatus: 'refund_full',
                    cancellationReason: 'slot_filled_during_payment',
                    cancelledAt: new Date(),
                    cancelledBy: 'system',
                  },
                });

                await (db.bookingStatusHistory as any).create({
                  data: {
                    bookingId,
                    fromStatus: 'pending_payment',
                    toStatus: 'cancelled',
                    changedBy: 'stripe_webhook',
                    reason: 'slot_filled_during_payment',
                  },
                });

                await logEvent({
                  orgId: sessionOrgId,
                  action: 'booking.slot_filled_refund',
                  bookingId,
                  status: 'success',
                  metadata: { reason: 'slot_filled_during_payment' },
                });

                // Don't proceed to confirm — booking is cancelled and refunded
                return NextResponse.json({ received: true });
              }
            } catch (slotError) {
              console.error('[Stripe Webhook] Slot availability check failed (proceeding anyway):', slotError);
            }
          }

          const newStatus = 'confirmed';
          const newPaymentStatus = isDeposit ? 'deposit_paid' : 'paid';

          await db.booking.update({
            where: { id: bookingId },
            data: {
              status: newStatus,
              paymentStatus: newPaymentStatus,
              dispatchStatus: isDeposit ? 'held' : 'auto',
              stripePaymentIntentId: session.payment_intent as string || null,
            },
          });

          await (db.bookingStatusHistory as any).create({
            data: {
              bookingId,
              fromStatus: 'pending_payment',
              toStatus: newStatus,
              changedBy: 'stripe_webhook',
              reason: isDeposit ? 'deposit_received' : 'payment_received',
            },
          });

          if (!isDeposit) {
            // Start dispatch for paid bookings
            try {
              const { emitBookingCreated } = await import('@/lib/event-emitter');
              await emitBookingCreated(booking);
            } catch (e) {
              console.error('[Stripe Webhook] emitBookingCreated failed:', e);
            }
          }

          await logEvent({
            orgId: sessionOrgId,
            action: isDeposit ? 'payment.deposit_received' : 'payment.completed',
            bookingId,
            status: 'success',
            metadata: { sessionId: session.id, amount: session.amount_total, bookingType },
          });
        }
      }
    }

    // account.updated (Stripe Connect - update payoutsEnabled/chargesEnabled)
    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      const accountId = account.id;
      const { prisma } = await import('@/lib/db');
      const existing = await (prisma as any).sitterStripeAccount.findFirst({
        where: { accountId },
      });
      if (existing) {
        const db = getScopedDb({ orgId: existing.orgId });
        const wasPreviouslyDisabled = !existing.payoutsEnabled;
        await db.sitterStripeAccount.update({
          where: { id: existing.id },
          data: {
            payoutsEnabled: account.payouts_enabled ?? false,
            chargesEnabled: account.charges_enabled ?? false,
            onboardingStatus: account.details_submitted ? 'complete' : 'onboarding',
          },
        });

        // Process pending payouts when sitter's payouts become enabled
        if (wasPreviouslyDisabled && account.payouts_enabled && existing.sitterId) {
          void (async () => {
            try {
              const pendingPayouts = await (db as any).payoutTransfer.findMany({
                where: { sitterId: existing.sitterId, status: 'pending' },
                select: { id: true, bookingId: true },
              });
              if (pendingPayouts.length > 0) {
                const { processSitterPayout } = await import('@/lib/payout/sitter-payout');
                for (const payout of pendingPayouts) {
                  await processSitterPayout({
                    orgId: existing.orgId,
                    bookingId: payout.bookingId,
                    sitterId: existing.sitterId,
                  }).catch(err => console.error('[Stripe Webhook] Pending payout failed:', err));
                }
              }
            } catch (e) {
              console.error('[Stripe Webhook] Failed to process pending payouts:', e);
            }
          })();
        }
      }
    }

    // invoice.payment_succeeded (legacy)
    if (event.type === 'invoice.payment_succeeded') {
      const inv = event.data.object as any;
      const bookingId = inv.metadata?.bookingId;
      const orgId = inv.metadata?.orgId || 'default';
      const amount = inv.amount_paid || 0;
      const chargeId = typeof inv.charge === 'string' ? inv.charge : inv.charge?.id;
      const db = getScopedDb({ orgId });
      if (chargeId) {
        await persistPaymentSucceeded(
          db,
          inv.payment_intent || chargeId,
          amount,
          inv.currency || 'usd',
          orgId,
          bookingId,
          inv.customer_email,
          inv.customer_name,
          chargeId
        );
      }
      if (bookingId) {
        await logEvent({
          orgId,
          actorUserId: 'system',
          action: 'payment.completed',
          entityType: 'payment',
          entityId: inv.id,
          bookingId,
          status: 'success',
          metadata: { stripeEventType: event.type },
        }).catch(() => {});
      }
    }

    // transfer.failed — Stripe Connect transfer to sitter failed
    if ((event.type as string) === 'transfer.failed') {
      const transfer = event.data.object as any;
      const transferId = transfer.id;
      const { prisma } = await import('@/lib/db');
      const pt = await (prisma as any).payoutTransfer.findFirst({
        where: { stripeTransferId: transferId },
      });
      if (pt) {
        await (prisma as any).payoutTransfer.update({
          where: { id: pt.id },
          data: { status: 'failed', lastError: 'Stripe transfer failed' },
        });
        await logEvent({
          orgId: pt.orgId,
          action: 'payout.transfer_failed',
          status: 'failed',
          metadata: { transferId, sitterId: pt.sitterId, bookingId: pt.bookingId },
        }).catch(() => {});
      }
    }

    // transfer.reversed — Stripe reversed a Connect transfer (compliance, dispute, etc.)
    if ((event.type as string) === 'transfer.reversed') {
      const transfer = event.data.object as any;
      const transferId = transfer.id;
      const { prisma } = await import('@/lib/db');
      const pt = await (prisma as any).payoutTransfer.findFirst({
        where: { stripeTransferId: transferId },
      });
      if (pt) {
        await (prisma as any).payoutTransfer.update({
          where: { id: pt.id },
          data: { status: 'failed', lastError: 'Transfer reversed by Stripe' },
        });
        await logEvent({
          orgId: pt.orgId,
          action: 'payout.transfer_reversed',
          status: 'failed',
          metadata: { transferId, sitterId: pt.sitterId, bookingId: pt.bookingId, reversalAmount: transfer.amount_reversed },
        }).catch(() => {});
      }
    }

    await markStripeWebhookEventProcessed(event.id);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    if (eventId) {
      await markStripeWebhookEventFailed(eventId, error).catch(() => {});
    }
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed', message: error.message },
      { status: 500 }
    );
  }
}
