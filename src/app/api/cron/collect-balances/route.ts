/**
 * Cron: Collect remaining balances for advance bookings
 *
 * Runs daily. Sends payment reminders 2 days before balance due date,
 * and auto-cancels bookings where balance was not paid by the deadline.
 * Deposits are non-refundable per policy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getScopedDb } from '@/lib/tenancy';
import { logEvent } from '@/lib/log-event';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (!expectedKey || !authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    let remindersSent = 0;
    let autoCancelled = 0;

    // ── Phase 1: Send balance reminders (due within 2 days) ──────────

    const dueBookings = await (prisma as any).booking.findMany({
      where: {
        status: 'confirmed',
        paymentStatus: 'deposit_paid',
        balanceDueDate: { not: null, lte: twoDaysFromNow, gt: now },
      },
      select: {
        id: true,
        orgId: true,
        service: true,
        startAt: true,
        totalPrice: true,
        depositAmount: true,
        balanceDueDate: true,
        clientId: true,
        firstName: true,
        lastName: true,
        phone: true,
        stripePaymentLinkUrl: true,
        stripeCheckoutSessionId: true,
      },
    });

    for (const booking of dueBookings) {
      try {
        const balance = booking.totalPrice - (booking.depositAmount || 0);
        if (balance <= 0) continue;

        const db = getScopedDb({ orgId: booking.orgId });

        // Check if balance collection was already initiated
        const existingCharge = await (db as any).stripeCharge.findFirst({
          where: {
            bookingId: booking.id,
            metadata: { contains: 'balance' },
            status: { in: ['pending', 'succeeded'] },
          },
        });
        if (existingCharge) continue; // Already handled

        // Create Stripe Checkout for the balance
        let paymentUrl = booking.stripePaymentLinkUrl;
        try {
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-03-31.basil' as any });

          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const formatDate = (d: Date) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          // Look up client's Stripe customer
          let customerId: string | undefined;
          if (booking.clientId) {
            const client = await (db as any).client.findFirst({
              where: { id: booking.clientId },
              select: { stripeCustomerId: true },
            });
            customerId = client?.stripeCustomerId || undefined;
          }

          const session = await (stripe.checkout.sessions.create as any)({
            mode: 'payment',
            ...(customerId && { customer: customerId }),
            line_items: [{
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `Balance due — ${booking.service} on ${formatDate(booking.startAt)}`,
                  description: `Remaining balance after 25% deposit.`,
                },
                unit_amount: Math.round(balance * 100),
              },
              quantity: 1,
            }],
            metadata: {
              bookingId: booking.id,
              orgId: booking.orgId,
              clientId: booking.clientId || '',
              bookingType: 'balance',
            },
            success_url: `${baseUrl}/client/bookings/${booking.id}?paid=true`,
            cancel_url: `${baseUrl}/client/bookings/${booking.id}?paid=false`,
          });

          paymentUrl = session.url;

          await db.booking.update({
            where: { id: booking.id },
            data: {
              paymentStatus: 'balance_due',
              stripePaymentLinkUrl: session.url,
            },
          });
        } catch (stripeError) {
          console.error(`[collect-balances] Stripe session failed for ${booking.id}:`, stripeError);
        }

        // Trigger balance reminder notification (handled by automation engine)
        try {
          const { notifyClientBookingReceived } = await import('@/lib/notifications/triggers');
          // Re-use booking notification trigger — automation rules can customize the message
          void notifyClientBookingReceived({
            orgId: booking.orgId,
            bookingId: booking.id,
            clientId: booking.clientId || '',
            clientFirstName: booking.firstName,
            service: booking.service,
            startAt: booking.startAt,
          }).catch(() => {});
        } catch { /* notification is non-blocking */ }

        await logEvent({
          orgId: booking.orgId,
          action: 'booking.balance_reminder_sent',
          bookingId: booking.id,
          status: 'success',
          metadata: { balance, balanceDueDate: booking.balanceDueDate },
        });

        remindersSent++;
      } catch (err) {
        console.error(`[collect-balances] Reminder failed for booking ${booking.id}:`, err);
      }
    }

    // ── Phase 2: Auto-cancel overdue bookings ────────────────────────

    const overdueBookings = await (prisma as any).booking.findMany({
      where: {
        status: { in: ['confirmed', 'deposit_held'] },
        paymentStatus: { in: ['deposit_paid', 'balance_due'] },
        balanceDueDate: { not: null, lt: now },
      },
      select: {
        id: true,
        orgId: true,
        service: true,
        startAt: true,
        totalPrice: true,
        depositAmount: true,
        clientId: true,
        firstName: true,
        lastName: true,
        phone: true,
        sitterId: true,
        status: true,
      },
    });

    for (const booking of overdueBookings) {
      try {
        const db = getScopedDb({ orgId: booking.orgId });

        await db.booking.update({
          where: { id: booking.id },
          data: {
            status: 'cancelled',
            paymentStatus: 'refund_none',
            cancelledAt: now,
            cancelledBy: 'system',
            cancellationReason: 'balance_not_paid',
            dispatchStatus: 'held',
          },
        });

        await (db.bookingStatusHistory as any).create({
          data: {
            bookingId: booking.id,
            fromStatus: booking.status,
            toStatus: 'cancelled',
            changedBy: 'cron',
            reason: 'balance_not_paid',
          },
        });

        // Cancel pending offers
        if (booking.sitterId) {
          await db.offerEvent.updateMany({
            where: { bookingId: booking.id, status: 'sent' },
            data: { status: 'expired' },
          });
        }

        // Notify owner about auto-cancellation
        try {
          const { notifyOwnerNewBooking } = await import('@/lib/notifications/triggers');
          void notifyOwnerNewBooking({
            orgId: booking.orgId,
            bookingId: booking.id,
            clientName: `${booking.firstName} ${booking.lastName}`.trim(),
            service: booking.service,
            startAt: booking.startAt,
          }).catch(() => {});
        } catch { /* non-blocking */ }

        await logEvent({
          orgId: booking.orgId,
          action: 'booking.balance_expired',
          bookingId: booking.id,
          status: 'success',
          metadata: {
            depositKept: booking.depositAmount || 0,
            balanceNotPaid: booking.totalPrice - (booking.depositAmount || 0),
          },
        });

        autoCancelled++;
      } catch (err) {
        console.error(`[collect-balances] Auto-cancel failed for booking ${booking.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      reminders_sent: remindersSent,
      auto_cancelled: autoCancelled,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error('[collect-balances] ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
