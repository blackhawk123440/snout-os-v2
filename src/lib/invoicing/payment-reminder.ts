/**
 * Payment reminder logic.
 * Finds unpaid bookings with payment links older than X hours
 * and sends reminder SMS to clients via existing messaging infra.
 */

import { prisma } from '@/lib/db';
import { whereOrg } from '@/lib/org-scope';

export async function processPaymentReminders(params: {
  orgId: string;
  reminderAfterHours?: number;
  maxReminders?: number;
}): Promise<{ sent: number; skipped: number }> {
  const { orgId, reminderAfterHours = 24, maxReminders = 2 } = params;

  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - reminderAfterHours);

  // Find unpaid bookings with payment links that are old enough
  const unpaidBookings = await (prisma as any).booking.findMany({
    where: whereOrg(orgId, {
      paymentStatus: { not: 'paid' },
      status: { not: 'cancelled' },
      stripePaymentLinkUrl: { not: null },
      createdAt: { lte: cutoff },
    }),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      service: true,
      totalPrice: true,
      stripePaymentLinkUrl: true,
    },
    take: 50,
  });

  let sent = 0;
  let skipped = 0;

  for (const booking of unpaidBookings) {
    // Count existing reminders for this booking
    const reminderCount = await (prisma as any).eventLog.count({
      where: whereOrg(orgId, {
        bookingId: booking.id,
        eventType: 'payment.reminder.sent',
      }),
    });

    if (reminderCount >= maxReminders) {
      skipped++;
      continue;
    }

    // Send reminder via the existing payment link endpoint
    try {
      const res = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/messages/send-payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, forceResend: true }),
      });

      if (res.ok) {
        // Log the reminder
        await (prisma as any).eventLog.create({
          data: {
            orgId,
            bookingId: booking.id,
            eventType: 'payment.reminder.sent',
            action: 'payment.reminder.sent',
            metadata: JSON.stringify({ reminderNumber: reminderCount + 1 }),
          },
        });
        sent++;
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }

  return { sent, skipped };
}
