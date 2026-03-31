import { getScopedDb } from '@/lib/tenancy';
import { sendThreadMessage, type MessagingActor } from '@/lib/messaging/send';
import { createPaymentLink } from '@/lib/stripe';

type LinkTemplateType = 'payment_link' | 'tip_link';

function buildTemplateMessage(templateType: LinkTemplateType, clientFirstName: string, link: string, amount?: number): string {
  if (templateType === 'payment_link') {
    const amountLabel = typeof amount === 'number' ? ` for $${amount.toFixed(2)}` : '';
    return `Hi ${clientFirstName}, your payment link${amountLabel} is ready: ${link}`;
  }
  return `Hi ${clientFirstName}, here is your tip link: ${link}`;
}

export async function resolveBookingLink(params: {
  booking: any;
  templateType: LinkTemplateType;
  baseUrl: string;
}): Promise<string | null> {
  const { booking, templateType, baseUrl } = params;
  if (templateType === 'payment_link') {
    if (booking.stripePaymentLinkUrl) return booking.stripePaymentLinkUrl;
    const amount = Number(booking.totalPrice ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const link = await createPaymentLink(
      amount,
      `${booking.service || 'Pet care'} booking ${booking.id}`,
      booking.client?.email || booking.email || undefined,
      { bookingId: booking.id, orgId: booking.orgId || 'default' }
    );
    return link;
  }
  if (booking.tipLinkUrl) return booking.tipLinkUrl;
  return `${baseUrl}/tip/link-builder?bookingId=${encodeURIComponent(booking.id)}`;
}

export async function sendBookingLinkMessage(params: {
  orgId: string;
  bookingId: string;
  actor: MessagingActor;
  templateType: LinkTemplateType;
  dedupeWindowMs: number;
  forceResend?: boolean;
  baseUrl: string;
  correlationId?: string; // preserved for call-site compatibility
}) {
  const db = getScopedDb({ orgId: params.orgId });
  const booking = await db.booking.findFirst({
    where: { id: params.bookingId },
    include: {
      client: { select: { id: true, firstName: true, phone: true, email: true } },
    },
  });
  if (!booking) throw new Error('Booking not found');

  const recipient = booking.client?.phone || booking.phone || null;
  if (!recipient) {
    throw new Error('Client phone is required to send this message');
  }

  const link = await resolveBookingLink({
    booking,
    templateType: params.templateType,
    baseUrl: params.baseUrl,
  });
  if (!link) {
    throw new Error('Link could not be generated for this booking');
  }

  const firstName = booking.client?.firstName || booking.firstName || 'there';
  const body = buildTemplateMessage(params.templateType, firstName, link, Number(booking.totalPrice));

  let thread = await db.messageThread.findFirst({
    where: { bookingId: booking.id },
    select: { id: true },
  });
  if (!thread) {
    thread = await db.messageThread.create({
      data: {
        orgId: params.orgId,
        scope: 'client_booking',
        bookingId: booking.id,
        clientId: booking.clientId,
        assignedSitterId: booking.sitterId,
        status: 'open',
      },
      select: { id: true },
    });
  }

  const dedupeSince = new Date(Date.now() - params.dedupeWindowMs);
  if (!params.forceResend) {
    const existing = await db.messageEvent.findFirst({
      where: {
        threadId: thread.id,
        direction: 'outbound',
        body,
        createdAt: { gte: dedupeSince },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return { deduped: true, messageEvent: existing, threadId: thread.id, link };
    }
  }

  if (params.templateType === 'payment_link' && booking.stripePaymentLinkUrl !== link) {
    await db.booking.update({ where: { id: booking.id }, data: { stripePaymentLinkUrl: link } });
  }
  if (params.templateType === 'tip_link' && booking.tipLinkUrl !== link) {
    await db.booking.update({ where: { id: booking.id }, data: { tipLinkUrl: link } });
  }

  const result = await sendThreadMessage({
    orgId: params.orgId,
    threadId: thread.id,
    actor: params.actor,
    body,
  });

  const metadata = {
    bookingId: booking.id,
    threadId: thread.id,
    channel: 'sms',
    recipient,
    templateType: params.templateType,
    providerMessageId: result.providerMessageSid ?? null,
    link,
  };

  const updated = await db.messageEvent.update({
    where: { id: result.event.id },
    data: { metadataJson: JSON.stringify(metadata) },
  });

  return { deduped: false, messageEvent: updated, threadId: thread.id, link };
}
