/**
 * Canonical Twilio inbound webhook.
 * POST /api/messages/webhook/twilio
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { env } from '@/lib/env';
import { publish, channels } from '@/lib/realtime/bus';
import { logEvent } from '@/lib/log-event';
import { TwilioProvider } from '@/lib/messaging/providers/twilio';
import { normalizeE164 } from '@/lib/messaging/phone-utils';
import { getOrgIdFromNumber } from '@/lib/messaging/number-org-mapping';
import { createClientContact, findClientContactByPhone } from '@/lib/messaging/client-contact-lookup';
import { createSoftAntiPoachingFlag } from '@/lib/messaging/anti-poaching-flags';
import { reconcileConversationLifecycleForThread } from '@/lib/messaging/conversation-service';
import { mapTwilioStatusToLifecycle } from '@/lib/messaging/message-lifecycle';
import { sendThreadMessage } from '@/lib/messaging/send';
import { CLIENT_EXPIRED_SERVICE_LANE_REPLY } from '@/lib/messaging/policy-copy';
import { isStopCommand, isHelpCommand, isStartCommand } from '@/lib/messaging/sms-commands';
import { getScopedDb } from '@/lib/tenancy';

function twimlOk() {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

function isE2eWebhookBypassAllowed(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    return false;
  }
  const enabled = process.env.ENABLE_E2E_AUTH === 'true' || process.env.ENABLE_E2E_LOGIN === 'true';
  if (!enabled) return false;
  const expected = process.env.E2E_AUTH_KEY;
  const provided = request.headers.get('x-e2e-key');
  return Boolean(expected && provided && provided === expected);
}

export async function POST(request: NextRequest) {
  let messageSid = '';
  let from = '';
  let to = '';
  try {
    const rawBody = await request.text();
    const body = new URLSearchParams(rawBody);
    messageSid = body.get('MessageSid') || '';
    from = normalizeE164(body.get('From') || '');
    to = normalizeE164(body.get('To') || '');
    const messageBody = (body.get('Body') || '').trim();
    const messageStatus = (body.get('MessageStatus') || '').trim().toLowerCase();

    const signature = request.headers.get('X-Twilio-Signature') || '';
    const webhookUrl = env.TWILIO_WEBHOOK_URL || `${request.nextUrl.origin}/api/messages/webhook/twilio`;
    const provider = new TwilioProvider();
    const isValid = provider.verifyWebhook(rawBody, signature, webhookUrl) || isE2eWebhookBypassAllowed(request);
    if (!isValid) {
      await logEvent({
        orgId: 'unknown',
        action: 'message.webhook.invalid_signature',
        entityType: 'webhook',
        metadata: { from, to, messageSid },
      });
      return twimlOk();
    }

    let orgId: string;
    try {
      orgId = await getOrgIdFromNumber(to);
    } catch {
      await logEvent({
        orgId: 'unknown',
        action: 'message.webhook.org_unresolved',
        entityType: 'webhook',
        metadata: { from, to, messageSid },
      });
      return twimlOk();
    }

    const db = getScopedDb({ orgId });

    if (messageSid && messageStatus) {
      const lifecycle = mapTwilioStatusToLifecycle(messageStatus);
      const mappedStatus = lifecycle === 'accepted' ? 'queued' : lifecycle;
      await db.messageEvent.updateMany({
        where: { orgId, providerMessageSid: messageSid },
        data: {
          deliveryStatus: mappedStatus,
          providerErrorCode: body.get('ErrorCode') || null,
          providerErrorMessage: body.get('ErrorMessage') || null,
          failureCode: mappedStatus === 'failed' ? body.get('ErrorCode') || null : null,
          failureDetail: mappedStatus === 'failed' ? body.get('ErrorMessage') || null : null,
        },
      });
      return twimlOk();
    }

    // TCPA compliance: handle STOP/HELP/START keywords immediately
    if (isStopCommand(messageBody)) {
      await db.optOutState.upsert({
        where: { orgId_phoneE164: { orgId, phoneE164: from } },
        create: { orgId, phoneE164: from, state: 'opted_out', source: 'inbound_keyword' },
        update: { state: 'opted_out', source: 'inbound_keyword' },
      });
      await logEvent({
        orgId,
        action: 'sms.opt_out',
        entityType: 'opt_out',
        metadata: { phone: from, keyword: messageBody, messageSid },
      });
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been unsubscribed from Snout Pet Care messages. Reply START to re-subscribe.</Message></Response>',
        { status: 200, headers: { 'Content-Type': 'text/xml' } }
      );
    }

    if (isHelpCommand(messageBody)) {
      await logEvent({
        orgId,
        action: 'sms.help_request',
        entityType: 'opt_out',
        metadata: { phone: from, keyword: messageBody, messageSid },
      });
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Snout Pet Care: For help, visit snoutservices.com or reply to this message. Reply STOP to unsubscribe.</Message></Response>',
        { status: 200, headers: { 'Content-Type': 'text/xml' } }
      );
    }

    if (isStartCommand(messageBody)) {
      await db.optOutState.upsert({
        where: { orgId_phoneE164: { orgId, phoneE164: from } },
        create: { orgId, phoneE164: from, state: 'opted_in', source: 'inbound_keyword' },
        update: { state: 'opted_in', source: 'inbound_keyword' },
      });
      await logEvent({
        orgId,
        action: 'sms.opt_in',
        entityType: 'opt_out',
        metadata: { phone: from, keyword: messageBody, messageSid },
      });
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been re-subscribed to Snout Pet Care messages. Reply STOP to unsubscribe.</Message></Response>',
        { status: 200, headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const messageNumber = await db.messageNumber.findFirst({
      where: {
        orgId,
        status: 'active',
        OR: [{ e164: to }, { e164: body.get('To') || '' }],
      },
      select: { id: true, numberClass: true, assignedSitterId: true },
    });
    if (!messageNumber) {
      await logEvent({
        orgId,
        action: 'message.webhook.number_not_found',
        entityType: 'webhook',
        metadata: { from, to, messageSid },
      });
      return twimlOk();
    }

    const existing = messageSid
      ? await db.messageEvent.findFirst({
          where: { orgId, providerMessageSid: messageSid },
          select: { id: true, threadId: true },
        })
      : null;
    if (existing) return twimlOk();

    const existingContact = await findClientContactByPhone(orgId, from);
    let clientId = existingContact?.clientId ?? null;
    if (!clientId) {
      const existingClient = await db.client.findFirst({
        where: { orgId, phone: from },
        select: { id: true },
      });
      clientId = existingClient?.id ?? null;
    }
    if (!clientId) {
      const guest = await db.client.create({
        data: {
          orgId,
          firstName: 'Guest',
          lastName: from,
          phone: from,
        },
      });
      clientId = guest.id;
      await createClientContact({
        id: randomUUID(),
        orgId,
        clientId: guest.id,
        e164: from,
        label: 'Mobile',
        verified: false,
      });
    }
    if (!clientId) return twimlOk();

    let thread = await db.messageThread.findFirst({
      where: {
        orgId,
        clientId,
        messageNumberId: messageNumber.id,
        status: { notIn: ['closed', 'archived'] },
      },
      select: { id: true },
      orderBy: { lastMessageAt: 'desc' },
    });
    if (!thread) {
      thread = await db.messageThread.create({
        data: {
          orgId,
          clientId,
          assignedSitterId: messageNumber.assignedSitterId,
          status: 'open',
          scope: messageNumber.numberClass === 'sitter' ? 'client_booking' : 'client_general',
          threadType: messageNumber.numberClass === 'sitter' ? 'assignment' : 'front_desk',
          numberClass: messageNumber.numberClass,
          messageNumberId: messageNumber.id,
          maskedNumberE164: to,
        },
        select: { id: true },
      });
    }

    const lifecycle = await reconcileConversationLifecycleForThread({
      orgId,
      threadId: thread.id,
    }).catch(() => ({ rerouted: false, laneType: "company", reason: "lifecycle_unavailable" }));
    const created = await db.messageEvent.create({
      data: {
        threadId: thread.id,
        orgId,
        direction: 'inbound',
        actorType: 'client',
        actorClientId: clientId,
        providerMessageSid: messageSid || null,
        body: messageBody,
        deliveryStatus: 'received',
        routingDisposition: lifecycle.rerouted ? 'rerouted' : 'normal',
      },
      select: { id: true },
    });

    await db.messageThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: new Date(),
        lastClientMessageAt: new Date(),
        lastInboundAt: new Date(),
        ownerUnreadCount: { increment: 1 },
      },
    });
    void createSoftAntiPoachingFlag({
      orgId,
      threadId: thread.id,
      messageEventId: created.id,
      body: messageBody,
    }).catch(() => {});
    if (lifecycle.rerouted) {
      const recentlyNotified = await db.messageEvent.findFirst({
        where: {
          orgId,
          threadId: thread.id,
          direction: 'outbound',
          actorType: 'automation',
          body: CLIENT_EXPIRED_SERVICE_LANE_REPLY,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (!recentlyNotified) {
        void sendThreadMessage({
          orgId,
          threadId: thread.id,
          actor: { role: 'automation', userId: null },
          body: CLIENT_EXPIRED_SERVICE_LANE_REPLY,
          idempotencyKey: messageSid ? `reroute-notice:${messageSid}` : undefined,
        }).catch(() => {});
      }
    }

    await publish(channels.messagesThread(orgId, thread.id), {
      type: 'message.new',
      threadId: thread.id,
      messageId: created.id,
      ts: Date.now(),
    }).catch(() => {});
    await logEvent({
      orgId,
      action: 'message.inbound_received',
      entityType: 'thread',
      entityId: thread.id,
      metadata: { from, to, messageSid, messageId: created.id },
    });
    return twimlOk();
  } catch (error: any) {
    console.error('[Messaging Webhook] Unexpected error:', error?.message || error);
    try {
      const { captureException } = await import('@sentry/nextjs');
      captureException(error, { tags: { webhook: 'twilio-inbound' } });
    } catch (_) {}
    // Return 500 so Twilio retries the webhook instead of losing the message
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
