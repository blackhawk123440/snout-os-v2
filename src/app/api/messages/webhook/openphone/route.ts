/**
 * POST /api/messages/webhook/openphone
 * Inbound webhook for OpenPhone messages and delivery statuses.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyOpenPhoneSignature } from '@/lib/openphone-verify';
import { normalizeE164 } from '@/lib/messaging/phone-utils';
import { logEvent } from '@/lib/log-event';
import { publish, channels } from '@/lib/realtime/bus';
import { findClientContactByPhone, createClientContact } from '@/lib/messaging/client-contact-lookup';
import { randomUUID } from 'crypto';

function jsonOk() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-openphone-signature') || '';
    const secret = process.env.OPENPHONE_WEBHOOK_SECRET;

    // Fail closed: reject if webhook secret is not configured
    if (!secret) {
      console.error('[OpenPhone Webhook] OPENPHONE_WEBHOOK_SECRET not set — rejecting request');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    if (!verifyOpenPhoneSignature(rawBody, signature, secret)) {
      await logEvent({
        orgId: 'unknown',
        action: 'message.webhook.openphone.invalid_signature',
        entityType: 'webhook',
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.type || '';
    const data = payload.data || {};

    // Handle delivery status updates
    if (eventType === 'message.delivery.updated' || eventType === 'message.updated') {
      if (data.id) {
        try {
          const { prisma } = await import('@/lib/db');
          const statusMap: Record<string, string> = {
            delivered: 'delivered',
            failed: 'failed',
            sent: 'sent',
          };
          await (prisma as any).messageEvent.updateMany({
            where: { providerMessageSid: data.id },
            data: {
              deliveryStatus: statusMap[data.status] || 'queued',
              providerErrorCode: data.errorCode || null,
              providerErrorMessage: data.errorMessage || null,
            },
          });
        } catch (e) {
          console.error('[OpenPhone Webhook] Delivery status update failed:', e);
        }
      }
      return jsonOk();
    }

    // Handle inbound messages
    if (eventType !== 'message.received') {
      return jsonOk();
    }

    const from = normalizeE164(data.from?.phoneNumber || '');
    const toNumber = data.to?.[0]?.phoneNumber || '';
    const messageBody = (data.body || data.content || '').trim();
    const messageSid = data.id || '';
    const phoneNumberId = data.phoneNumberId || '';

    if (!from || !messageBody) return jsonOk();

    // Resolve org from OpenPhone phone number ID
    const { prisma } = await import('@/lib/db');
    const { getScopedDb } = await import('@/lib/tenancy');

    let orgId: string | null = null;
    try {
      const account = await (prisma as any).messageAccount.findFirst({
        where: { provider: 'openphone' },
      });
      if (account) {
        orgId = account.orgId;
      } else {
        // Fall back to MessageNumber lookup
        const num = await (prisma as any).messageNumber.findFirst({
          where: { provider: 'openphone', status: 'active' },
        });
        orgId = num?.orgId || null;
      }
    } catch {}

    if (!orgId) {
      // Try default org
      orgId = 'default';
    }

    const db = getScopedDb({ orgId });

    // Check for STOP/HELP/START keywords
    const { isStopCommand, isHelpCommand, isStartCommand } = await import('@/lib/messaging/sms-commands');
    if (isStopCommand(messageBody)) {
      await db.optOutState.upsert({
        where: { orgId_phoneE164: { orgId, phoneE164: from } },
        create: { orgId, phoneE164: from, state: 'opted_out', source: 'inbound_keyword' },
        update: { state: 'opted_out', source: 'inbound_keyword' },
      });
      return jsonOk();
    }
    if (isStartCommand(messageBody)) {
      await db.optOutState.upsert({
        where: { orgId_phoneE164: { orgId, phoneE164: from } },
        create: { orgId, phoneE164: from, state: 'opted_in', source: 'inbound_keyword' },
        update: { state: 'opted_in', source: 'inbound_keyword' },
      });
      return jsonOk();
    }
    if (isHelpCommand(messageBody)) {
      return jsonOk();
    }

    // Find or create client
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
        data: { orgId, firstName: 'Guest', lastName: from, phone: from },
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

    // Find or create thread
    const messageNumber = await db.messageNumber.findFirst({
      where: { orgId, provider: 'openphone', status: 'active' },
      select: { id: true },
    });

    let thread = await db.messageThread.findFirst({
      where: {
        orgId,
        clientId,
        ...(messageNumber ? { messageNumberId: messageNumber.id } : {}),
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
          status: 'open',
          scope: 'client_general',
          threadType: 'front_desk',
          numberClass: 'front_desk',
          messageNumberId: messageNumber?.id || null,
          maskedNumberE164: toNumber || null,
        },
        select: { id: true },
      });
    }

    // Create message event
    const existing = messageSid
      ? await db.messageEvent.findFirst({
          where: { orgId, providerMessageSid: messageSid },
          select: { id: true },
        })
      : null;
    if (existing) return jsonOk();

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
        routingDisposition: 'normal',
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

    await publish(channels.messagesThread(orgId, thread.id), {
      type: 'message.new',
      threadId: thread.id,
      messageId: created.id,
      ts: Date.now(),
    }).catch(() => {});

    await logEvent({
      orgId,
      action: 'message.openphone.inbound_received',
      entityType: 'thread',
      entityId: thread.id,
      metadata: { from, messageSid, messageId: created.id },
    });

    return jsonOk();
  } catch (error: any) {
    console.error('[OpenPhone Webhook] Unexpected error:', error?.message || error);
    try {
      const { captureException } = await import('@sentry/nextjs');
      captureException(error, { tags: { webhook: 'openphone-inbound' } });
    } catch (_) {}
    // Return 500 so OpenPhone retries the webhook instead of losing the message
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
