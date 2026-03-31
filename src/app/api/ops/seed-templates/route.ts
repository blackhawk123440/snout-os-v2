/**
 * Seed SMS notification templates for the enterprise booking lifecycle.
 * Idempotent — safe to run multiple times (upserts by templateKey).
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';

const TEMPLATES = [
  {
    name: 'Booking Created - Client',
    type: 'sms',
    category: 'client',
    templateKey: 'booking.created.client.sms',
    body: 'Thanks for your booking request with {businessName}! Your {service} on {date} at {time} is being held. Complete payment to confirm: {paymentLink}',
    variables: JSON.stringify(['businessName', 'service', 'date', 'time', 'paymentLink']),
  },
  {
    name: 'Booking Created - Owner',
    type: 'sms',
    category: 'owner',
    templateKey: 'booking.created.owner.sms',
    body: 'New booking: {clientFirstName} {clientLastName} requested {service} on {date} at {time}. Total: {totalPrice}.',
    variables: JSON.stringify(['clientFirstName', 'clientLastName', 'service', 'date', 'time', 'totalPrice']),
  },
  {
    name: 'Booking Confirmed - Client',
    type: 'sms',
    category: 'client',
    templateKey: 'booking.confirmed.client.sms',
    body: 'Your {service} on {date} is confirmed and paid! We are assigning your sitter now. You will hear from us within 24 hours.',
    variables: JSON.stringify(['service', 'date']),
  },
  {
    name: 'Offer Sent - Sitter',
    type: 'sms',
    category: 'sitter',
    templateKey: 'offer.sent.sitter.sms',
    body: 'New {service} booking for {date} at {time}. {clientFirstName} has {petCount} pet(s). Your share: {sitterCommission}. Accept? Reply YES or tap: {acceptLink}',
    variables: JSON.stringify(['service', 'date', 'time', 'clientFirstName', 'petCount', 'sitterCommission', 'acceptLink']),
  },
  {
    name: 'Offer Accepted - Client',
    type: 'sms',
    category: 'client',
    templateKey: 'offer.accepted.client.sms',
    body: 'Great news! {sitterFirstName} has been assigned to your {service} on {date}. They will arrive at {time}.',
    variables: JSON.stringify(['sitterFirstName', 'service', 'date', 'time']),
  },
  {
    name: 'Dispatch Exhausted - Owner',
    type: 'sms',
    category: 'owner',
    templateKey: 'dispatch.exhausted.owner.sms',
    body: 'Booking for {clientFirstName} on {date} needs manual assignment. {attemptCount} sitters were offered but did not respond.',
    variables: JSON.stringify(['clientFirstName', 'date', 'attemptCount']),
  },
  {
    name: 'Visit Check-in - Client',
    type: 'sms',
    category: 'client',
    templateKey: 'visit.checkin.client.sms',
    body: '{sitterFirstName} just arrived for your {service}!',
    variables: JSON.stringify(['sitterFirstName', 'service']),
  },
  {
    name: 'Visit Check-out - Client',
    type: 'sms',
    category: 'client',
    templateKey: 'visit.checkout.client.sms',
    body: 'Visit complete! {sitterFirstName} checked out at {time}. Your visit report will be available shortly.',
    variables: JSON.stringify(['sitterFirstName', 'time']),
  },
  {
    name: 'Report Submitted - Client',
    type: 'sms',
    category: 'client',
    templateKey: 'report.submitted.client.sms',
    body: 'Your visit report is ready! {reportPreview} View full report: {portalLink}',
    variables: JSON.stringify(['reportPreview', 'portalLink']),
  },
  {
    name: 'Payment Overdue - Owner',
    type: 'sms',
    category: 'owner',
    templateKey: 'payment.overdue.owner.sms',
    body: 'Payment overdue: {clientFirstName} {clientLastName} owes {totalPrice} for {service} on {date}.',
    variables: JSON.stringify(['clientFirstName', 'clientLastName', 'totalPrice', 'service', 'date']),
  },
  {
    name: 'Payout Sent - Sitter',
    type: 'sms',
    category: 'sitter',
    templateKey: 'payout.sent.sitter.sms',
    body: '{sitterCommission} deposited for {service} visit on {date}. Funds arrive in 2-3 business days.',
    variables: JSON.stringify(['sitterCommission', 'service', 'date']),
  },
  {
    name: 'Night Before Reminder - Client',
    type: 'sms',
    category: 'client',
    templateKey: 'reminder.nightbefore.client.sms',
    body: 'Reminder: Your {service} is tomorrow at {time}. {sitterFirstName} will be there. Make sure your home is accessible!',
    variables: JSON.stringify(['service', 'time', 'sitterFirstName']),
  },
  {
    name: 'Night Before Reminder - Sitter',
    type: 'sms',
    category: 'sitter',
    templateKey: 'reminder.nightbefore.sitter.sms',
    body: 'Reminder: You have {service} tomorrow at {time} for {clientFirstName}. Address: {address}.',
    variables: JSON.stringify(['service', 'time', 'clientFirstName', 'address']),
  },
  {
    name: 'Morning Of Reminder - Sitter',
    type: 'sms',
    category: 'sitter',
    templateKey: 'reminder.morningof.sitter.sms',
    body: 'Today: {service} at {time} for {clientFirstName}. Address: {address}. Check in when you arrive!',
    variables: JSON.stringify(['service', 'time', 'clientFirstName', 'address']),
  },
  {
    name: 'Report Overdue - Sitter',
    type: 'sms',
    category: 'sitter',
    templateKey: 'report.overdue.sitter.sms',
    body: 'Please submit your visit report for {clientFirstName} ({service} on {date}). Reports are due within 2 hours of checkout.',
    variables: JSON.stringify(['clientFirstName', 'service', 'date']),
  },
  {
    name: 'Sitter Invite',
    type: 'sms',
    category: 'sitter',
    templateKey: 'sitter.invite.sms',
    body: '{businessName} invited you to join their team on Snout. Set up your account: {portalLink}',
    variables: JSON.stringify(['businessName', 'portalLink']),
  },
  {
    name: 'Client Welcome',
    type: 'sms',
    category: 'client',
    templateKey: 'client.welcome.sms',
    body: 'Thanks for booking with {businessName}! Set up your account to track visits, manage pets, and message your sitter: {portalLink}',
    variables: JSON.stringify(['businessName', 'portalLink']),
  },
  {
    name: 'Sitter Approved',
    type: 'sms',
    category: 'sitter',
    templateKey: 'sitter.approved.sms',
    body: 'Welcome aboard! You are now active on {businessName}. You will start receiving booking offers. Log in: {portalLink}',
    variables: JSON.stringify(['businessName', 'portalLink']),
  },
  {
    name: 'Payment Expired - Client',
    type: 'sms',
    category: 'client',
    templateKey: 'booking.payment_expired.client.sms',
    body: 'Your booking hold for {service} on {date} has expired because payment was not received. Book again anytime: {portalLink}',
    variables: JSON.stringify(['service', 'date', 'portalLink']),
  },
  {
    name: 'Balance Due Reminder - Client',
    type: 'sms',
    category: 'client',
    templateKey: 'booking.balance_due.client.sms',
    body: 'Reminder: The remaining balance of {totalPrice} for your {service} on {date} is due by {balanceDueDate}. Pay now: {paymentLink}',
    variables: JSON.stringify(['totalPrice', 'service', 'date', 'balanceDueDate', 'paymentLink']),
  },
  {
    name: 'Balance Auto-Cancel - Client',
    type: 'sms',
    category: 'client',
    templateKey: 'booking.balance_cancelled.client.sms',
    body: 'Your booking for {service} on {date} has been cancelled because the remaining balance was not received. Your deposit is non-refundable. Rebook: {portalLink}',
    variables: JSON.stringify(['service', 'date', 'portalLink']),
  },
  {
    name: 'Recurring Payment Failed - Client',
    type: 'sms',
    category: 'client',
    templateKey: 'recurring.payment_failed.client.sms',
    body: 'We could not process your weekly payment of {totalPrice}. Your visits may be paused. Update your payment method: {paymentLink}',
    variables: JSON.stringify(['totalPrice', 'paymentLink']),
  },
  {
    name: 'Recurring Paused - Client',
    type: 'sms',
    category: 'client',
    templateKey: 'recurring.paused.client.sms',
    body: 'Your recurring visits have been paused due to non-payment. Contact {businessName} to resume: {businessPhone}',
    variables: JSON.stringify(['businessName', 'businessPhone']),
  },
  {
    name: 'Slot Filled Refund - Client',
    type: 'sms',
    category: 'client',
    templateKey: 'booking.slot_filled.client.sms',
    body: 'We are sorry — the time you requested was just booked by another client. You have been fully refunded. Book a different time: {portalLink}',
    variables: JSON.stringify(['portalLink']),
  },
  {
    name: 'Cancellation Refund - Client',
    type: 'sms',
    category: 'client',
    templateKey: 'booking.cancelled.client.sms',
    body: 'Your {service} on {date} has been cancelled. {refundDescription}',
    variables: JSON.stringify(['service', 'date', 'refundDescription']),
  },
  {
    name: 'Sitter Unassigned - Sitter',
    type: 'sms',
    category: 'sitter',
    templateKey: 'booking.cancelled.sitter.sms',
    body: '{clientFirstName} cancelled their {service} on {date}. This booking has been removed from your schedule.',
    variables: JSON.stringify(['clientFirstName', 'service', 'date']),
  },
];

export async function POST() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let created = 0;
    let updated = 0;

    for (const t of TEMPLATES) {
      const existing = await (prisma as any).messageTemplate.findFirst({
        where: { templateKey: t.templateKey },
        select: { id: true },
      });

      if (existing) {
        await (prisma as any).messageTemplate.update({
          where: { id: existing.id },
          data: { body: t.body, variables: t.variables, name: t.name, isActive: true },
        });
        updated++;
      } else {
        await (prisma as any).messageTemplate.create({
          data: { ...t, version: 1, isActive: true },
        });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      total: TEMPLATES.length,
      created,
      updated,
    });
  } catch (error: unknown) {
    console.error('[seed-templates] ERROR:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to seed templates', message }, { status: 500 });
  }
}
