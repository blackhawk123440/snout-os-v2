/**
 * Cron: Weekly Recurring Auto-Charge
 *
 * Runs every Sunday. For each active weekly recurring schedule:
 * 1. Calculates the upcoming week's total
 * 2. Attempts auto-charge via saved payment method
 * 3. On success: generates individual bookings for each day
 * 4. On failure: retries once at 6 PM, then pauses the schedule
 *
 * Schedule: Sunday 6 AM Central (11 AM UTC) primary, Sunday 6 PM Central (11 PM UTC) retry
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getScopedDb } from '@/lib/tenancy';
import { logEvent } from '@/lib/log-event';

// ── Helpers ─────────────────────────────────────────────────────────────

function getNextDateForDay(weekStart: Date, dayOfWeek: number): Date {
  const date = new Date(weekStart);
  const currentDay = date.getDay();
  const diff = (dayOfWeek - currentDay + 7) % 7;
  date.setDate(date.getDate() + diff);
  return date;
}

function combineDateAndTime(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours || 9, minutes || 0, 0, 0);
  return result;
}

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 1 : 8 - day; // If Sunday, next Monday is tomorrow
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getNextSunday(): Date {
  const monday = getNextMonday();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

// ── Main handler ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (!expectedKey || !authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const mondayDate = getNextMonday();
    const sundayDate = getNextSunday();

    let processed = 0;
    let charged = 0;
    let failed = 0;
    let paused = 0;
    let linksSent = 0;

    // Find all active weekly recurring schedules
    const schedules = await (prisma as any).recurringSchedule.findMany({
      where: {
        status: 'active',
        frequency: 'weekly',
        effectiveFrom: { lte: today },
        OR: [
          { effectiveUntil: null },
          { effectiveUntil: { gte: today } },
        ],
      },
    });

    for (const schedule of schedules) {
      processed++;

      try {
        const db = getScopedDb({ orgId: schedule.orgId });

        // Parse days of week
        let daysOfWeek: number[] = [];
        try {
          daysOfWeek = typeof schedule.daysOfWeek === 'string'
            ? JSON.parse(schedule.daysOfWeek)
            : Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [];
        } catch { daysOfWeek = [1, 3, 5]; } // Default Mon/Wed/Fri

        if (daysOfWeek.length === 0) continue;

        // Calculate weekly total
        const pricePerVisit = schedule.totalPrice || 0;
        const visitCount = daysOfWeek.length;
        const weeklyTotal = pricePerVisit * visitCount;

        if (weeklyTotal <= 0) continue;

        // Look up client
        const client = await (db as any).client.findFirst({
          where: { id: schedule.clientId },
          select: {
            id: true, firstName: true, lastName: true, phone: true, email: true,
            stripeCustomerId: true, defaultPaymentMethodId: true,
          },
        });

        if (!client) continue;

        // Check if already charged this week (idempotency)
        if (schedule.lastPaymentDate) {
          const lastPayment = new Date(schedule.lastPaymentDate);
          const daysSincePayment = (now.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSincePayment < 5) continue; // Already paid within 5 days
        }

        // No saved payment method — send payment link
        if (!client.stripeCustomerId || !client.defaultPaymentMethodId) {
          try {
            const Stripe = (await import('stripe')).default;
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-03-31.basil' as any });
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

            const session = await (stripe.checkout.sessions.create as any)({
              mode: 'payment',
              ...(client.stripeCustomerId && { customer: client.stripeCustomerId }),
              line_items: [{
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: `Weekly ${schedule.service} — ${visitCount} visits`,
                    description: `Week of ${mondayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                  },
                  unit_amount: Math.round(weeklyTotal * 100),
                },
                quantity: 1,
              }],
              metadata: {
                recurringScheduleId: schedule.id,
                orgId: schedule.orgId,
                clientId: client.id,
                weekStart: mondayDate.toISOString(),
                type: 'recurring_weekly',
              },
              success_url: `${baseUrl}/client/recurring?paid=true`,
              cancel_url: `${baseUrl}/client/recurring?paid=false`,
            });

            await logEvent({
              orgId: schedule.orgId,
              action: 'recurring.payment_link_sent',
              status: 'success',
              metadata: { scheduleId: schedule.id, amount: weeklyTotal, sessionUrl: session.url },
            });

            linksSent++;
          } catch (linkError) {
            console.error(`[weekly-charge] Payment link failed for schedule ${schedule.id}:`, linkError);
          }
          continue;
        }

        // Attempt auto-charge
        try {
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-03-31.basil' as any });

          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(weeklyTotal * 100),
            currency: 'usd',
            customer: client.stripeCustomerId,
            payment_method: client.defaultPaymentMethodId,
            off_session: true,
            confirm: true,
            metadata: {
              recurringScheduleId: schedule.id,
              orgId: schedule.orgId,
              weekStart: mondayDate.toISOString(),
              weekEnd: sundayDate.toISOString(),
              type: 'recurring_weekly',
            },
          });

          if (paymentIntent.status === 'succeeded') {
            // Generate individual bookings for each day this week
            for (const dayOfWeek of daysOfWeek) {
              const bookingDate = getNextDateForDay(mondayDate, dayOfWeek);
              const startAt = combineDateAndTime(bookingDate, schedule.startTime);
              const endAt = combineDateAndTime(bookingDate, schedule.endTime);

              await (db.booking as any).create({
                data: {
                  clientId: schedule.clientId,
                  sitterId: schedule.sitterId || null,
                  firstName: client.firstName || '',
                  lastName: client.lastName || '',
                  phone: client.phone || '',
                  email: client.email || null,
                  address: schedule.address || null,
                  service: schedule.service,
                  startAt,
                  endAt,
                  totalPrice: pricePerVisit,
                  status: schedule.sitterId ? 'confirmed' : 'pending',
                  paymentStatus: 'paid',
                  dispatchStatus: schedule.sitterId ? 'assigned' : 'auto',
                  recurringScheduleId: schedule.id,
                  notes: schedule.notes || null,
                  stripePaymentIntentId: paymentIntent.id,
                },
              });
            }

            // Update schedule
            await (db as any).recurringSchedule.update({
              where: { id: schedule.id },
              data: {
                lastPaymentDate: now,
                lastPaymentAmount: weeklyTotal,
                lastGeneratedAt: now,
                paymentFailureCount: 0,
              },
            });

            // Record charge
            await (db as any).stripeCharge.create({
              data: {
                bookingId: null,
                paymentIntentId: paymentIntent.id,
                amount: weeklyTotal,
                status: 'succeeded',
                metadata: JSON.stringify({
                  type: 'recurring_weekly',
                  scheduleId: schedule.id,
                  weekStart: mondayDate.toISOString(),
                  visitCount,
                }),
              },
            });

            await logEvent({
              orgId: schedule.orgId,
              action: 'recurring.weekly_charged',
              status: 'success',
              metadata: {
                scheduleId: schedule.id,
                amount: weeklyTotal,
                visitCount,
                paymentIntentId: paymentIntent.id,
              },
            });

            charged++;
          } else {
            // Payment requires action — treat as failure
            throw new Error(`Payment requires additional action: ${paymentIntent.status}`);
          }
        } catch (chargeError: any) {
          failed++;

          const failureCount = schedule.paymentFailureCount || 0;

          await (db as any).recurringSchedule.update({
            where: { id: schedule.id },
            data: { paymentFailureCount: failureCount + 1 },
          });

          if (failureCount === 0) {
            // First failure — will retry at 6 PM run
            await logEvent({
              orgId: schedule.orgId,
              action: 'recurring.payment_failed',
              status: 'failed',
              metadata: {
                scheduleId: schedule.id,
                amount: weeklyTotal,
                error: chargeError.message,
                failureCount: failureCount + 1,
                willRetry: true,
              },
            });
          } else {
            // Second+ failure — pause schedule
            await (db as any).recurringSchedule.update({
              where: { id: schedule.id },
              data: { status: 'paused' },
            });

            await logEvent({
              orgId: schedule.orgId,
              action: 'recurring.paused_nonpayment',
              status: 'failed',
              metadata: {
                scheduleId: schedule.id,
                amount: weeklyTotal,
                error: chargeError.message,
                failureCount: failureCount + 1,
              },
            });

            paused++;
          }
        }
      } catch (scheduleError) {
        console.error(`[weekly-charge] Schedule ${schedule.id} failed:`, scheduleError);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      charged,
      failed,
      paused,
      linksSent,
      weekStart: mondayDate.toISOString(),
      weekEnd: sundayDate.toISOString(),
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error('[weekly-recurring-charge] ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
