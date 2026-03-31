import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { prisma } from '@/lib/db';
import { TwilioProvider } from '@/lib/messaging/providers/twilio';
import { getOrgIdFromNumber } from '@/lib/messaging/number-org-mapping';
import { findClientContactByPhone } from '@/lib/messaging/client-contact-lookup';

vi.mock('@/lib/db', () => ({
  prisma: {
    messageNumber: { findFirst: vi.fn() },
    messageEvent: { findFirst: vi.fn(), create: vi.fn() },
    messageThread: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    client: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/lib/log-event', () => ({
  logEvent: vi.fn(async () => {}),
}));

vi.mock('@/lib/realtime/bus', () => ({
  channels: { messagesThread: vi.fn(() => 'messages:thread:test') },
  publish: vi.fn(async () => {}),
}));

vi.mock('@/lib/messaging/number-org-mapping', () => ({
  getOrgIdFromNumber: vi.fn(),
}));

vi.mock('@/lib/messaging/client-contact-lookup', () => ({
  findClientContactByPhone: vi.fn(),
  createClientContact: vi.fn(async () => {}),
}));

vi.mock('@/lib/messaging/providers/twilio', () => {
  class MockProvider {
    verifyWebhook() {
      return true;
    }
  }
  return { TwilioProvider: MockProvider };
});

describe('POST /api/messages/webhook/twilio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (TwilioProvider as any).prototype.verifyWebhook = vi.fn(() => true);
    delete process.env.E2E_AUTH_KEY;
    delete process.env.ENABLE_E2E_AUTH;
    delete process.env.ENABLE_E2E_LOGIN;
    (getOrgIdFromNumber as any).mockResolvedValue('org_test');
    (findClientContactByPhone as any).mockResolvedValue({ clientId: 'client_1' });
    (prisma.client.findFirst as any).mockResolvedValue(null);
    (prisma.client.create as any).mockResolvedValue({ id: 'client_1' });
    (prisma.messageNumber.findFirst as any).mockResolvedValue({
      id: 'num_1',
      numberClass: 'front_desk',
      assignedSitterId: null,
    });
    (prisma.messageEvent.findFirst as any).mockResolvedValue(null);
    (prisma.messageThread.findFirst as any).mockResolvedValue({ id: 'thread_1' });
    (prisma.messageEvent.create as any).mockResolvedValue({ id: 'event_1' });
    (prisma.messageThread.update as any).mockResolvedValue({ id: 'thread_1' });
  });

  it('stores inbound message event on canonical models', async () => {
    const req = new NextRequest('https://example.com/api/messages/webhook/twilio', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'sig',
      },
      body: 'From=%2B15550001111&To=%2B15550002222&Body=Inbound+hello&MessageSid=SM123',
    });

    const res = await POST(req);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain('<Response>');
    expect(prisma.messageEvent.create).toHaveBeenCalled();
    expect(prisma.messageThread.update).toHaveBeenCalled();
  });

  it('no-ops on invalid signature', async () => {
    (TwilioProvider as any).prototype.verifyWebhook = vi.fn(() => false);
    const req = new NextRequest('https://example.com/api/messages/webhook/twilio', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'bad',
      },
      body: 'From=%2B15550001111&To=%2B15550002222&Body=Inbound+hello&MessageSid=SM123',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prisma.messageEvent.create).not.toHaveBeenCalled();
  });

  it('accepts e2e bypass key when enabled', async () => {
    (TwilioProvider as any).prototype.verifyWebhook = vi.fn(() => false);
    process.env.ENABLE_E2E_AUTH = 'true';
    process.env.E2E_AUTH_KEY = 'test-key';
    const req = new NextRequest('https://example.com/api/messages/webhook/twilio', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'bad',
        'x-e2e-key': 'test-key',
      },
      body: 'From=%2B15550001111&To=%2B15550002222&Body=Inbound+hello&MessageSid=SM_E2E',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prisma.messageEvent.create).toHaveBeenCalled();
  });

  it('falls back to Client.phone lookup when ClientContact is unavailable', async () => {
    (findClientContactByPhone as any).mockResolvedValue(null);
    (prisma.client.findFirst as any).mockResolvedValue({ id: 'client_1' });
    const req = new NextRequest('https://example.com/api/messages/webhook/twilio', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'sig',
      },
      body: 'From=%2B15550001111&To=%2B15550002222&Body=Inbound+hello&MessageSid=SM_FALLBACK',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prisma.client.create).not.toHaveBeenCalled();
    expect(prisma.messageEvent.create).toHaveBeenCalled();
  });
});
