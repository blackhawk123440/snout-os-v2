/**
 * Centralized notification triggers.
 * Every function is fire-and-forget — never throws, never blocks the caller.
 * Each checks OrgNotificationSettings before sending.
 *
 * Messaging availability: When an org's messagingProvider is "none",
 * SMS sending is skipped and notifications fall back to email + in-app.
 * See lib/messaging/availability.ts for the check.
 */

import { prisma } from '@/lib/db';
import { logEvent } from '@/lib/log-event';
import { publish, channels } from '@/lib/realtime/bus';
import { sendEmail } from '@/lib/email';
import { bookingConfirmationEmail } from '@/lib/email-templates';
import {
  pushVisitStarted,
  pushSitterAssigned,
  pushSitterChanged,
  pushReplacementNeeded,
} from './push-dispatch';

// ─── Helpers ─────────────────────────────────────────────────────────

async function getNotifSettings(orgId: string) {
  return (prisma as any).orgNotificationSettings.findFirst({
    where: { orgId },
  });
}

/**
 * Check whether SMS messaging is available for this org.
 * Returns false when messagingProvider === 'none'.
 * Defaults to true for backward compatibility (pre-migration orgs).
 */
async function canSendSms(orgId: string): Promise<boolean> {
  try {
    const { isMessagingAvailable } = await import('@/lib/messaging/availability');
    return isMessagingAvailable(orgId);
  } catch {
    // If availability module fails to load (pre-migration), default to true
    return true;
  }
}

async function findThreadForClient(orgId: string, clientId: string): Promise<string | null> {
  const thread = await (prisma as any).messageThread.findFirst({
    where: { orgId, clientId },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  return thread?.id ?? null;
}

async function findThreadForSitter(orgId: string, sitterId: string): Promise<string | null> {
  const thread = await (prisma as any).messageThread.findFirst({
    where: { orgId, assignedSitterId: sitterId },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  return thread?.id ?? null;
}

async function getSitterEmail(sitterId: string): Promise<{ email: string | null; firstName: string | null }> {
  const sitter = await (prisma as any).sitter.findFirst({
    where: { id: sitterId },
    select: { email: true, firstName: true },
  });
  return { email: sitter?.email ?? null, firstName: sitter?.firstName ?? null };
}

/** Wraps a plain text notification into the format sendEmail expects (html + text). */
function plainTextEmail(to: string, subject: string, text: string) {
  return {
    to,
    subject,
    text,
    html: `<div style="font-family: -apple-system, sans-serif; font-size: 15px; line-height: 1.5; color: #1a1a1a; max-width: 480px;">${text.replace(/\n/g, '<br>')}</div>`,
  };
}

async function trySendThreadMessage(params: {
  orgId: string;
  threadId: string;
  body: string;
}): Promise<void> {
  // Skip SMS if org has no messaging provider configured
  const smsAvailable = await canSendSms(params.orgId);
  if (!smsAvailable) {
    // Log that we skipped SMS — helps with debugging and monitoring
    await logEvent({
      orgId: params.orgId,
      action: 'notification.sms_skipped',
      status: 'success',
      metadata: {
        reason: 'messaging_provider_none',
        skipped: true,
        threadId: params.threadId,
        bodyPreview: params.body.substring(0, 80),
      },
    }).catch(() => {});
    return;
  }

  // Dynamic import to avoid circular deps
  const { sendThreadMessage } = await import('@/lib/messaging/send');
  await sendThreadMessage({
    orgId: params.orgId,
    threadId: params.threadId,
    body: params.body,
    actor: { role: 'system' },
  });
}

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const fmtTime = (d: Date | string) =>
  new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

// ─── N1: Booking Created → Client SMS (G1) ──────────────────────────

export async function notifyClientBookingReceived(params: {
  orgId: string;
  bookingId: string;
  clientId: string;
  clientFirstName: string;
  service: string;
  startAt: Date | string;
  phone?: string | null;
  pets?: Array<{ name?: string; species: string }>;
  timeSlots?: Array<{ startAt: Date | string; endAt: Date | string; duration?: number }>;
  totalPrice?: number;
  address?: string | null;
  notes?: string | null;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.clientReminders) return;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const portalUrl = `${baseUrl}/client/bookings/${params.bookingId}`;

    // Load booking details if not passed (for callers that don't have the data)
    let pets = params.pets;
    let timeSlots = params.timeSlots;
    let totalPrice = params.totalPrice;
    let address = params.address;
    if (!pets || !timeSlots) {
      try {
        const booking = await (prisma as any).booking.findFirst({
          where: { id: params.bookingId, orgId: params.orgId },
          include: { pets: { select: { name: true, species: true } }, timeSlots: { select: { startAt: true, endAt: true, duration: true } } },
        });
        if (booking) {
          pets = pets || booking.pets;
          timeSlots = timeSlots || booking.timeSlots;
          totalPrice = totalPrice ?? (Number(booking.totalPrice) || undefined);
          address = address ?? booking.address;
        }
      } catch { /* fallback to simple message */ }
    }

    // Build rich message
    const { formatPetsByQuantity, formatDatesAndTimesForMessage } = await import('@/lib/booking-utils');
    const petLine = pets?.length ? formatPetsByQuantity(pets as Array<{ species: string }>) : null;
    const dateLine = formatDatesAndTimesForMessage({
      service: params.service,
      startAt: params.startAt,
      endAt: timeSlots?.[timeSlots.length - 1]?.endAt || params.startAt,
      timeSlots: timeSlots as any[],
    });
    const priceLine = totalPrice != null && totalPrice > 0 ? `$${totalPrice.toFixed(2)}` : null;

    const smsBody = [
      `🐾 BOOKING RECEIVED!\n`,
      `Hi ${params.clientFirstName}, we've received your ${params.service} booking request!\n`,
      `📅 ${dateLine}`,
      petLine ? `🐕 Pets: ${petLine}` : null,
      `\nA team member will confirm your booking shortly.`,
    ].filter(Boolean).join('\n');

    const smsAvailable = await canSendSms(params.orgId);
    let smsSent = false;
    let emailSent = false;

    // SMS path
    if (smsAvailable) {
      let threadId = await findThreadForClient(params.orgId, params.clientId);
      if (!threadId && params.bookingId) {
        const threadByBooking = await (prisma as any).messageThread.findFirst({
          where: { orgId: params.orgId, bookingId: params.bookingId, laneType: 'company' },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
        });
        if (threadByBooking) threadId = threadByBooking.id;
      }
      if (threadId) {
        await trySendThreadMessage({ orgId: params.orgId, threadId, body: smsBody });
        smsSent = true;
      }
    }

    // Email path
    const client = await (prisma as any).client.findFirst({
      where: { id: params.clientId },
      select: { email: true },
    });
    if (client?.email) {
      const emailHtml = [
        `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">`,
        `<h2 style="color: #432f21;">Booking received!</h2>`,
        `<p>Hi ${params.clientFirstName},</p>`,
        `<p>We've received your <strong>${params.service}</strong> booking request.</p>`,
        `<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">`,
        `<tr><td style="padding: 8px 0; color: #8c7769;">Schedule</td><td style="padding: 8px 0;">${dateLine}</td></tr>`,
        petLine ? `<tr><td style="padding: 8px 0; color: #8c7769;">Pets</td><td style="padding: 8px 0;">${petLine}</td></tr>` : '',
        priceLine ? `<tr><td style="padding: 8px 0; color: #8c7769;">Total</td><td style="padding: 8px 0;">${priceLine}</td></tr>` : '',
        address ? `<tr><td style="padding: 8px 0; color: #8c7769;">Address</td><td style="padding: 8px 0;">${address}</td></tr>` : '',
        params.notes ? `<tr><td style="padding: 8px 0; color: #8c7769;">Notes</td><td style="padding: 8px 0;">${params.notes}</td></tr>` : '',
        `</table>`,
        `<p>A team member will confirm your booking shortly.</p>`,
        `<p><a href="${portalUrl}" style="background: #432f21; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">View Your Booking</a></p>`,
        `<p style="color: #8c7769; font-size: 14px;">— Snout Pet Care</p>`,
        `</div>`,
      ].join('\n');

      void sendEmail({
        to: client.email,
        subject: `Booking Received: ${params.service} on ${fmtDate(params.startAt)}`,
        html: emailHtml,
        text: smsBody,
      }).then(() => { emailSent = true; }).catch(() => {});
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.client.booking_received',
      bookingId: params.bookingId,
      status: 'success',
      metadata: {
        channels: {
          sms: smsSent ? 'sent' : smsAvailable ? 'no_thread' : 'provider_none',
          email: client?.email ? 'attempted' : 'no_email',
        },
      },
    });
  } catch (error) {
    console.error('[notification] clientBookingReceived failed:', error);
  }
}

// ─── N21: Booking Confirmed → Client SMS + Email (G82) ──────────────

export async function notifyClientBookingConfirmed(params: {
  orgId: string;
  bookingId: string;
  clientId: string;
  clientFirstName: string;
  service: string;
  startAt: Date | string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.clientReminders) return;

    // Load booking details for rich message
    let petLine: string | null = null;
    let dateLine = fmtDate(params.startAt);
    try {
      const { formatPetsByQuantity, formatDatesAndTimesForMessage } = await import('@/lib/booking-utils');
      const booking = await (prisma as any).booking.findFirst({
        where: { id: params.bookingId, orgId: params.orgId },
        include: { pets: { select: { name: true, species: true } }, timeSlots: { select: { startAt: true, endAt: true, duration: true } } },
      });
      if (booking) {
        if (booking.pets?.length) petLine = formatPetsByQuantity(booking.pets);
        dateLine = formatDatesAndTimesForMessage({
          service: params.service,
          startAt: params.startAt,
          endAt: booking.timeSlots?.[booking.timeSlots.length - 1]?.endAt || params.startAt,
          timeSlots: booking.timeSlots,
        });
      }
    } catch { /* fallback to simple format */ }

    // Personalize with pet names when available
    let petNameStr = 'your pet';
    try {
      const booking = await (prisma as any).booking.findFirst({
        where: { id: params.bookingId, orgId: params.orgId },
        include: { pets: { select: { name: true } } },
      });
      if (booking?.pets?.length) {
        const names = booking.pets.map((p: any) => p.name).filter(Boolean);
        if (names.length) petNameStr = names.join(' and ');
      }
    } catch { /* fallback to generic */ }

    const smsBody = [
      `✅ CONFIRMED!\n`,
      `Hi ${params.clientFirstName}, we're confirmed for ${petNameStr}'s ${params.service}!\n`,
      `📅 ${dateLine}`,
      petLine ? `🐕 ${petLine}` : null,
      `\nWe'll send you updates as your visit approaches.`,
    ].filter(Boolean).join('\n');

    const smsAvailable = await canSendSms(params.orgId);
    let smsSent = false;

    if (smsAvailable) {
      const threadId = await findThreadForClient(params.orgId, params.clientId);
      if (threadId) {
        await trySendThreadMessage({ orgId: params.orgId, threadId, body: smsBody });
        smsSent = true;
      }
    }

    if (!smsSent) {
      const client = await (prisma as any).client.findFirst({
        where: { id: params.clientId },
        select: { email: true, firstName: true },
      });
      if (client?.email) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const portalUrl = `${baseUrl}/client/bookings/${params.bookingId}`;
        const emailHtml = `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #432f21;">Your booking is confirmed!</h2>
          <p>Hi ${client.firstName || params.clientFirstName},</p>
          <p>Your <strong>${params.service}</strong> on <strong>${fmtDate(params.startAt)}</strong> has been confirmed.</p>
          ${petLine ? `<p>Pets: ${petLine}</p>` : ''}
          <p>We'll send you updates as your visit approaches.</p>
          <p><a href="${portalUrl}" style="background: #432f21; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">View Your Booking</a></p>
          <p style="color: #8c7769; font-size: 14px;">— Snout Pet Care</p>
        </div>`;
        void sendEmail({
          to: client.email,
          subject: `Booking Confirmed: ${params.service} on ${fmtDate(params.startAt)}`,
          html: emailHtml,
          text: smsBody,
        }).catch(() => {});
      }
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.client.booking_confirmed',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { channel: smsSent ? 'sms' : smsAvailable ? 'no_thread' : 'email_fallback' },
    });
  } catch (error) {
    console.error('[notification] clientBookingConfirmed failed:', error);
  }
}

// ─── N2: Booking Created → Owner Alert (G2) ─────────────────────────

export async function notifyOwnerNewBooking(params: {
  orgId: string;
  bookingId: string;
  clientName: string;
  service: string;
  startAt: Date | string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.ownerAlerts) return;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const bookingUrl = `${baseUrl}/bookings/${params.bookingId}`;
    const dateStr = fmtDate(params.startAt);
    const smsBody = `New booking! ${params.clientName} booked ${params.service} for ${dateStr}. View: ${bookingUrl}`;

    // SSE for live dashboard update
    publish(channels.ownerOps(params.orgId), {
      type: 'booking.created',
      bookingId: params.bookingId,
      bookingUrl,
      clientName: params.clientName,
      service: params.service,
      ts: Date.now(),
    }).catch(() => {});

    let smsSent = false;
    let emailSent = false;

    // SMS to owner if messaging available
    const smsAvailable = await canSendSms(params.orgId);
    if (smsAvailable) {
      try {
        const { getMessagingProvider } = await import('@/lib/messaging/provider-factory');
        const provider = await getMessagingProvider(params.orgId);
        const bs = await (prisma as any).businessSettings.findFirst({
          where: { orgId: params.orgId },
          select: { businessPhone: true },
        });
        if (bs?.businessPhone) {
          const to = bs.businessPhone.startsWith('+') ? bs.businessPhone : `+1${bs.businessPhone.replace(/\D/g, '')}`;
          await provider.sendMessage({ to, body: smsBody });
          smsSent = true;
        }
      } catch (smsErr) {
        console.error('[notification] ownerNewBooking SMS failed:', smsErr);
      }
    }

    // Email to owner
    const owner = await (prisma as any).user.findFirst({
      where: { orgId: params.orgId, role: 'owner' },
      select: { email: true },
    });
    if (owner?.email) {
      const subject = `New Booking — ${params.clientName} · ${params.service}`;
      const text = `Hi,\n\n${params.clientName} just booked ${params.service} for ${dateStr}.\n\nView booking: ${bookingUrl}`;
      void sendEmail(plainTextEmail(owner.email, subject, text))
        .then(() => { emailSent = true; })
        .catch(() => {});
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.owner.new_booking',
      bookingId: params.bookingId,
      status: 'success',
      metadata: {
        clientName: params.clientName,
        service: params.service,
        channels: { sms: smsSent ? 'sent' : 'skipped', email: owner?.email ? 'attempted' : 'no_email', sse: 'published' },
      },
    });
  } catch (error) {
    console.error('[notification] ownerNewBooking failed:', error);
  }
}

// ─── N3: Pool Offer Filled → Other Sitters (G5) ─────────────────────

export async function notifyPoolSittersOfferFilled(params: {
  orgId: string;
  bookingId: string;
  acceptedSitterId: string;
  service: string;
  startAt: Date | string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.sitterNotifications) return;

    // Find other sitters who were offered this booking
    const offers = await (prisma as any).offerEvent?.findMany?.({
      where: {
        orgId: params.orgId,
        bookingId: params.bookingId,
        sitterId: { not: params.acceptedSitterId },
        status: { in: ['pending', 'sent'] },
      },
      select: { sitterId: true },
    }) ?? [];

    const smsAvailable = await canSendSms(params.orgId);
    const messageBody = `The ${params.service} booking for ${fmtDate(params.startAt)} has been filled. Thanks for your availability!`;

    for (const offer of offers) {
      if (!offer.sitterId) continue;
      let sent = false;

      if (smsAvailable) {
        const threadId = await findThreadForSitter(params.orgId, offer.sitterId);
        if (threadId) {
          await trySendThreadMessage({ orgId: params.orgId, threadId, body: messageBody }).catch(() => {});
          sent = true;
        }
      }

      if (!sent) {
        const { email, firstName } = await getSitterEmail(offer.sitterId);
        if (email) {
          void sendEmail(plainTextEmail(email, `Booking Filled — ${params.service} on ${fmtDate(params.startAt)}`, `Hi ${firstName || 'there'}, ${messageBody}`)).catch(() => {});
        }
      }
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.pool.offer_filled',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { notifiedCount: offers.length, smsAvailable },
    });
  } catch (error) {
    console.error('[notification] poolSittersOfferFilled failed:', error);
  }
}

// ─── N4: Payment Received → Sitter (G7) ─────────────────────────────

export async function notifySitterPaymentReceived(params: {
  orgId: string;
  bookingId: string;
  sitterId: string;
  clientName: string;
  service: string;
  startAt: Date | string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.sitterNotifications) return;

    const smsAvailable = await canSendSms(params.orgId);
    let smsSent = false;
    const messageBody = `Payment received for your upcoming ${params.service} visit with ${params.clientName} on ${fmtDate(params.startAt)}. You're all set!`;

    if (smsAvailable) {
      const threadId = await findThreadForSitter(params.orgId, params.sitterId);
      if (threadId) {
        await trySendThreadMessage({ orgId: params.orgId, threadId, body: messageBody });
        smsSent = true;
      }
    }

    if (!smsSent) {
      const { email, firstName } = await getSitterEmail(params.sitterId);
      if (email) {
        void sendEmail(plainTextEmail(email, `Payment Received — ${params.service} on ${fmtDate(params.startAt)}`, `Hi ${firstName || 'there'}, ${messageBody}`)).catch(() => {});
      }
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.sitter.payment_received',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { channel: smsSent ? 'sms' : smsAvailable ? 'no_thread' : 'email_fallback' },
    });
  } catch (error) {
    console.error('[notification] sitterPaymentReceived failed:', error);
  }
}

// ─── N5: Booking Cancelled → Sitter (G14) ───────────────────────────

export async function notifySitterBookingCancelled(params: {
  orgId: string;
  bookingId: string;
  sitterId: string;
  clientName: string;
  service: string;
  startAt: Date | string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.sitterNotifications) return;

    const smsAvailable = await canSendSms(params.orgId);
    let smsSent = false;
    const messageBody = `${params.clientName}'s ${params.service} on ${fmtDate(params.startAt)} has been cancelled.`;

    if (smsAvailable) {
      const threadId = await findThreadForSitter(params.orgId, params.sitterId);
      if (threadId) {
        await trySendThreadMessage({ orgId: params.orgId, threadId, body: messageBody });
        smsSent = true;
      }
    }

    if (!smsSent) {
      const { email, firstName } = await getSitterEmail(params.sitterId);
      if (email) {
        void sendEmail(plainTextEmail(email, `Booking Cancelled — ${params.service} on ${fmtDate(params.startAt)}`, `Hi ${firstName || 'there'}, ${messageBody}`)).catch(() => {});
      }
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.sitter.booking_cancelled',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { channel: smsSent ? 'sms' : smsAvailable ? 'no_thread' : 'email_fallback' },
    });
  } catch (error) {
    console.error('[notification] sitterBookingCancelled failed:', error);
  }
}

// ─── N6: Sitter Changed → Client (G16) ──────────────────────────────

export async function notifyClientSitterChanged(params: {
  orgId: string;
  bookingId: string;
  clientId: string;
  newSitterName: string;
  service: string;
  startAt: Date | string;
  petNames: string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.clientReminders) return;

    const smsAvailable = await canSendSms(params.orgId);
    let smsSent = false;

    if (smsAvailable) {
      const threadId = await findThreadForClient(params.orgId, params.clientId);
      if (threadId) {
        const petPart = params.petNames ? ` They'll take great care of ${params.petNames}!` : '';
        const body = `Your sitter for ${params.service} on ${fmtDate(params.startAt)} has been updated to ${params.newSitterName}.${petPart}`;
        await trySendThreadMessage({ orgId: params.orgId, threadId, body });
        smsSent = true;
      }
    }

    // Email fallback when SMS unavailable
    if (!smsSent) {
      const client = await (prisma as any).client.findFirst({
        where: { id: params.clientId },
        select: { email: true, firstName: true },
      });
      if (client?.email) {
        void sendEmail(plainTextEmail(client.email, `Sitter Update — ${params.service} on ${fmtDate(params.startAt)}`, `Hi ${client.firstName || 'there'}, your sitter for ${params.service} on ${fmtDate(params.startAt)} has been updated to ${params.newSitterName}.${params.petNames ? ` They'll take great care of ${params.petNames}!` : ''}`)).catch(() => {});
      }
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.client.sitter_changed',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { channel: smsSent ? 'sms' : smsAvailable ? 'no_thread' : 'email_fallback' },
    });

    // Push notification (fire and forget)
    pushSitterChanged({
      clientId: params.clientId,
      newSitterName: params.newSitterName,
      service: params.service,
      date: fmtDate(params.startAt),
      bookingId: params.bookingId,
    }).catch(() => {});
  } catch (error) {
    console.error('[notification] clientSitterChanged failed:', error);
  }
}

// ─── N7: Welcome Message → New Client (G23) ─────────────────────────

export async function notifyClientWelcome(params: {
  orgId: string;
  clientId: string;
  clientFirstName: string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.clientReminders) return;

    const smsAvailable = await canSendSms(params.orgId);
    let smsSent = false;

    if (smsAvailable) {
      const threadId = await findThreadForClient(params.orgId, params.clientId);
      if (threadId) {
        const body = `Welcome to Snout, ${params.clientFirstName}! We're excited to care for your pets. Complete your pet profiles in your portal for the best experience.`;
        await trySendThreadMessage({ orgId: params.orgId, threadId, body });
        smsSent = true;
      }
    }

    // Email fallback when SMS unavailable
    if (!smsSent) {
      const client = await (prisma as any).client.findFirst({
        where: { id: params.clientId },
        select: { email: true },
      });
      if (client?.email) {
        void sendEmail(plainTextEmail(client.email, 'Welcome to Snout!', `Hi ${params.clientFirstName}, welcome to Snout! We're excited to care for your pets. Log in to your portal to complete your pet profiles for the best experience.`)).catch(() => {});
      }
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.client.welcome',
      status: 'success',
      metadata: {
        clientId: params.clientId,
        channel: smsSent ? 'sms' : smsAvailable ? 'no_thread' : 'email_fallback',
      },
    });
  } catch (error) {
    console.error('[notification] clientWelcome failed:', error);
  }
}

// ─── N8: Medication Missed Alert → Owner (G55) ──────────────────────

export async function notifyOwnerMedicationMissed(params: {
  orgId: string;
  bookingId: string;
  sitterName: string;
  petName: string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.ownerAlerts) return;

    publish(channels.ownerOps(params.orgId), {
      type: 'medication.missed',
      bookingId: params.bookingId,
      sitterName: params.sitterName,
      petName: params.petName,
      ts: Date.now(),
    }).catch(() => {});

    await logEvent({
      orgId: params.orgId,
      action: 'notification.owner.medication_missed',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { sitterName: params.sitterName, petName: params.petName },
    });
  } catch (error) {
    console.error('[notification] ownerMedicationMissed failed:', error);
  }
}

// ─── N10: Health Concern → Owner (G63) ───────────────────────────────

export async function notifyOwnerHealthConcern(params: {
  orgId: string;
  petId: string;
  petName: string;
  sitterName: string;
  note: string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.ownerAlerts) return;

    const preview = params.note.length > 80 ? params.note.slice(0, 80) + '...' : params.note;

    publish(channels.ownerOps(params.orgId), {
      type: 'health.concern',
      petName: params.petName,
      sitterName: params.sitterName,
      note: preview,
      ts: Date.now(),
    }).catch(() => {});

    await logEvent({
      orgId: params.orgId,
      action: 'notification.owner.health_concern',
      status: 'success',
      metadata: { petName: params.petName, sitterName: params.sitterName, note: preview },
    });
  } catch (error) {
    console.error('[notification] ownerHealthConcern failed:', error);
  }
}

// ─── N11: Tier Promotion → Sitter (G72) ─────────────────────────────

export async function notifySitterTierPromotion(params: {
  orgId: string;
  sitterId: string;
  tierName: string;
  commissionPercentage: number;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.sitterNotifications) return;

    const smsAvailable = await canSendSms(params.orgId);
    let smsSent = false;
    const messageBody = `Congratulations! You've been promoted to ${params.tierName}! Your new commission rate is ${params.commissionPercentage}%.`;

    if (smsAvailable) {
      const threadId = await findThreadForSitter(params.orgId, params.sitterId);
      if (threadId) {
        await trySendThreadMessage({ orgId: params.orgId, threadId, body: messageBody });
        smsSent = true;
      }
    }

    if (!smsSent) {
      const { email, firstName } = await getSitterEmail(params.sitterId);
      if (email) {
        void sendEmail(plainTextEmail(email, `You've been promoted to ${params.tierName}!`, `Hi ${firstName || 'there'}, ${messageBody}`)).catch(() => {});
      }
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.sitter.tier_promoted',
      status: 'success',
      metadata: {
        sitterId: params.sitterId,
        tierName: params.tierName,
        channel: smsSent ? 'sms' : smsAvailable ? 'no_thread' : 'email_fallback',
      },
    });
  } catch (error) {
    console.error('[notification] sitterTierPromotion failed:', error);
  }
}

// ─── N12: Sitter Check-In → Client SMS (G75) ────────────────────────

export async function notifyClientSitterCheckedIn(params: {
  orgId: string;
  bookingId: string;
  clientId: string;
  sitterName: string;
  petNames: string;
  service: string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.clientReminders) return;

    const smsAvailable = await canSendSms(params.orgId);
    let smsSent = false;

    const petPart = params.petNames || 'your pet';
    const messageBody = `${params.sitterName} has arrived and is starting ${petPart}'s ${params.service}! We'll let you know when the visit is complete.`;

    if (smsAvailable) {
      const threadId = await findThreadForClient(params.orgId, params.clientId);
      if (threadId) {
        await trySendThreadMessage({ orgId: params.orgId, threadId, body: messageBody });
        smsSent = true;
      }
    }

    // Email fallback when SMS unavailable
    if (!smsSent) {
      const client = await (prisma as any).client.findFirst({
        where: { id: params.clientId },
        select: { email: true, firstName: true },
      });
      if (client?.email) {
        void sendEmail(plainTextEmail(client.email, `Visit Started — ${params.sitterName} has arrived`, `Hi ${client.firstName || 'there'}, ${messageBody}`)).catch(() => {});
      }
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.client.sitter_checked_in',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { channel: smsSent ? 'sms' : smsAvailable ? 'no_thread' : 'email_fallback' },
    });

    // Push notification (fire and forget)
    pushVisitStarted({
      clientId: params.clientId,
      sitterName: params.sitterName,
      petNames: params.petNames,
      bookingId: params.bookingId,
    }).catch(() => {});
  } catch (error) {
    console.error('[notification] clientSitterCheckedIn failed:', error);
  }
}

// ─── N13: Sitter Assigned → Sitter SMS (S1.9) ───────────────────────

export async function notifySitterAssigned(params: {
  orgId: string;
  bookingId: string;
  sitterId: string;
  sitterFirstName: string;
  clientName: string;
  service: string;
  startAt: Date | string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.sitterNotifications) return;

    const smsAvailable = await canSendSms(params.orgId);
    let smsSent = false;
    const messageBody = `Great! You're assigned to ${params.service} for ${params.clientName} on ${fmtDate(params.startAt)}. Check your portal for details.`;

    if (smsAvailable) {
      const threadId = await findThreadForSitter(params.orgId, params.sitterId);
      if (threadId) {
        await trySendThreadMessage({ orgId: params.orgId, threadId, body: messageBody });
        smsSent = true;
      }
    }

    if (!smsSent) {
      const { email } = await getSitterEmail(params.sitterId);
      if (email) {
        void sendEmail(plainTextEmail(email, `New Assignment — ${params.service} on ${fmtDate(params.startAt)}`, `Hi ${params.sitterFirstName || 'there'}, ${messageBody}`)).catch(() => {});
      }
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.sitter.assigned',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { channel: smsSent ? 'sms' : smsAvailable ? 'no_thread' : 'email_fallback' },
    });

    // Push notification (fire and forget)
    pushSitterAssigned({
      sitterId: params.sitterId,
      clientName: params.clientName,
      service: params.service,
      date: fmtDate(params.startAt),
      bookingId: params.bookingId,
    }).catch(() => {});
  } catch (error) {
    console.error('[notification] sitterAssigned failed:', error);
  }
}

// ─── N14: Owner Pool Accepted → Owner SSE (S1.10) ───────────────────

export async function notifyOwnerPoolAccepted(params: {
  orgId: string;
  bookingId: string;
  sitterName: string;
  clientName: string;
  service: string;
  startAt: Date | string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.ownerAlerts) return;

    publish(channels.ownerOps(params.orgId), {
      type: 'pool.accepted',
      bookingId: params.bookingId,
      sitterName: params.sitterName,
      clientName: params.clientName,
      service: params.service,
      ts: Date.now(),
    }).catch(() => {});

    await logEvent({
      orgId: params.orgId,
      action: 'notification.owner.pool_accepted',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { sitterName: params.sitterName },
    });
  } catch (error) {
    console.error('[notification] ownerPoolAccepted failed:', error);
  }
}

// ─── N15: Visit Completed → Client SMS + Push (G76) ─────────────────

export async function notifyClientVisitCompleted(params: {
  orgId: string;
  bookingId: string;
  clientId: string;
  sitterName: string;
  petNames: string;
  service: string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.clientReminders) return;

    const smsAvailable = await canSendSms(params.orgId);
    let smsSent = false;

    const petPart = params.petNames || 'your pet';
    const messageBody = `${params.sitterName} just finished ${petPart}'s ${params.service}! We hope ${petPart} had a great time.`;

    if (smsAvailable) {
      const threadId = await findThreadForClient(params.orgId, params.clientId);
      if (threadId) {
        await trySendThreadMessage({ orgId: params.orgId, threadId, body: messageBody });
        smsSent = true;
      }
    }

    if (!smsSent) {
      const client = await (prisma as any).client.findFirst({
        where: { id: params.clientId },
        select: { email: true, firstName: true },
      });
      if (client?.email) {
        void sendEmail(plainTextEmail(client.email, `Visit Complete — ${params.sitterName}`, `Hi ${client.firstName || 'there'}, ${messageBody}`)).catch(() => {});
      }
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.client.visit_completed',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { channel: smsSent ? 'sms' : smsAvailable ? 'no_thread' : 'email_fallback' },
    });
  } catch (error) {
    console.error('[notification] clientVisitCompleted failed:', error);
  }
}

// ─── N16: Booking Cancelled → Client SMS (G77) ──────────────────────

export async function notifyClientBookingCancelled(params: {
  orgId: string;
  bookingId: string;
  clientId: string;
  service: string;
  startAt: Date | string;
  refundDescription?: string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.clientReminders) return;

    const smsAvailable = await canSendSms(params.orgId);
    let smsSent = false;

    const refundPart = params.refundDescription ? ` ${params.refundDescription}` : '';
    const messageBody = `Your ${params.service} on ${fmtDate(params.startAt)} has been cancelled.${refundPart}`;

    if (smsAvailable) {
      const threadId = await findThreadForClient(params.orgId, params.clientId);
      if (threadId) {
        await trySendThreadMessage({ orgId: params.orgId, threadId, body: messageBody });
        smsSent = true;
      }
    }

    if (!smsSent) {
      const client = await (prisma as any).client.findFirst({
        where: { id: params.clientId },
        select: { email: true, firstName: true },
      });
      if (client?.email) {
        void sendEmail(plainTextEmail(client.email, `Booking Cancelled — ${params.service}`, `Hi ${client.firstName || 'there'}, ${messageBody}`)).catch(() => {});
      }
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.client.booking_cancelled',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { channel: smsSent ? 'sms' : smsAvailable ? 'no_thread' : 'email_fallback' },
    });
  } catch (error) {
    console.error('[notification] clientBookingCancelled failed:', error);
  }
}

// ─── N17: Client Cancelled → Owner SSE (G78) ────────────────────────

export async function notifyOwnerClientCancelled(params: {
  orgId: string;
  bookingId: string;
  clientName: string;
  service: string;
  startAt: Date | string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.ownerAlerts) return;

    publish(channels.ownerOps(params.orgId), {
      type: 'booking.client_cancelled',
      bookingId: params.bookingId,
      clientName: params.clientName,
      service: params.service,
      ts: Date.now(),
    }).catch(() => {});

    await logEvent({
      orgId: params.orgId,
      action: 'notification.owner.client_cancelled',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { clientName: params.clientName },
    });
  } catch (error) {
    console.error('[notification] ownerClientCancelled failed:', error);
  }
}

// ─── N18: Booking Rescheduled → Client SMS (G79) ────────────────────

export async function notifyClientBookingRescheduled(params: {
  orgId: string;
  bookingId: string;
  clientId: string;
  clientFirstName: string;
  service: string;
  newStartAt: Date | string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.clientReminders) return;

    const smsAvailable = await canSendSms(params.orgId);
    let smsSent = false;

    const messageBody = `Hi ${params.clientFirstName}, your ${params.service} has been rescheduled to ${fmtDate(params.newStartAt)} at ${fmtTime(params.newStartAt)}.`;

    if (smsAvailable) {
      const threadId = await findThreadForClient(params.orgId, params.clientId);
      if (threadId) {
        await trySendThreadMessage({ orgId: params.orgId, threadId, body: messageBody });
        smsSent = true;
      }
    }

    if (!smsSent) {
      const client = await (prisma as any).client.findFirst({
        where: { id: params.clientId },
        select: { email: true },
      });
      if (client?.email) {
        void sendEmail(plainTextEmail(client.email, `Booking Rescheduled — ${params.service}`, messageBody)).catch(() => {});
      }
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.client.booking_rescheduled',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { channel: smsSent ? 'sms' : smsAvailable ? 'no_thread' : 'email_fallback' },
    });
  } catch (error) {
    console.error('[notification] clientBookingRescheduled failed:', error);
  }
}

// ─── N19: Sitter Assigned → Client SMS (G80) ────────────────────────

export async function notifyClientSitterAssigned(params: {
  orgId: string;
  bookingId: string;
  clientId: string;
  sitterName: string;
  service: string;
  startAt: Date | string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.clientReminders) return;

    const smsAvailable = await canSendSms(params.orgId);
    let smsSent = false;

    const messageBody = `Great news! ${params.sitterName} will be your sitter for ${params.service} on ${fmtDate(params.startAt)}.`;

    if (smsAvailable) {
      const threadId = await findThreadForClient(params.orgId, params.clientId);
      if (threadId) {
        await trySendThreadMessage({ orgId: params.orgId, threadId, body: messageBody });
        smsSent = true;
      }
    }

    if (!smsSent) {
      const client = await (prisma as any).client.findFirst({
        where: { id: params.clientId },
        select: { email: true, firstName: true },
      });
      if (client?.email) {
        void sendEmail(plainTextEmail(client.email, `Sitter Confirmed — ${params.sitterName}`, `Hi ${client.firstName || 'there'}, ${messageBody}`)).catch(() => {});
      }
    }

    await logEvent({
      orgId: params.orgId,
      action: 'notification.client.sitter_assigned',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { channel: smsSent ? 'sms' : smsAvailable ? 'no_thread' : 'email_fallback' },
    });
  } catch (error) {
    console.error('[notification] clientSitterAssigned failed:', error);
  }
}

// ─── N20: Offer Declined → Owner SSE (G81) ──────────────────────────

export async function notifyOwnerOfferDeclined(params: {
  orgId: string;
  bookingId: string;
  sitterName: string;
}): Promise<void> {
  try {
    const settings = await getNotifSettings(params.orgId);
    if (settings && !settings.ownerAlerts) return;

    publish(channels.ownerOps(params.orgId), {
      type: 'offer.declined',
      bookingId: params.bookingId,
      sitterName: params.sitterName,
      ts: Date.now(),
    }).catch(() => {});

    await logEvent({
      orgId: params.orgId,
      action: 'notification.owner.offer_declined',
      bookingId: params.bookingId,
      status: 'success',
      metadata: { sitterName: params.sitterName },
    });
  } catch (error) {
    console.error('[notification] ownerOfferDeclined failed:', error);
  }
}
