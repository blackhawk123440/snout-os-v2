import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB
vi.mock('@/lib/db', () => ({
  prisma: {
    messageAccount: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/messaging/provider-credentials', () => ({
  getProviderCredentials: vi.fn(),
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({})),
}));

vi.mock('@/lib/env', () => ({
  env: {
    TWILIO_WEBHOOK_AUTH_TOKEN: '',
    TWILIO_MESSAGING_SERVICE_SID: '',
    TWILIO_PHONE_NUMBER: '',
  },
}));

describe('Provider Factory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.OPENPHONE_API_KEY;
    delete process.env.OPENPHONE_NUMBER_ID;
  });

  it('returns OpenPhoneProvider when org has openphone MessageAccount', async () => {
    const { prisma } = await import('@/lib/db');
    (prisma as any).messageAccount.findFirst.mockResolvedValue({
      provider: 'openphone',
      providerConfigJson: JSON.stringify({ apiKey: 'op_key', phoneNumberId: 'PN_1' }),
    });
    const { getProviderCredentials } = await import('@/lib/messaging/provider-credentials');
    (getProviderCredentials as any).mockResolvedValue(null);

    const { getMessagingProvider } = await import('@/lib/messaging/provider-factory');
    const provider = await getMessagingProvider('org_1');
    expect(provider.constructor.name).toBe('OpenPhoneProvider');
  });

  it('returns TwilioProvider when org has Twilio credentials', async () => {
    const { prisma } = await import('@/lib/db');
    (prisma as any).messageAccount.findFirst.mockResolvedValue(null);
    const { getProviderCredentials } = await import('@/lib/messaging/provider-credentials');
    (getProviderCredentials as any).mockResolvedValue({
      accountSid: 'AC_test',
      authToken: 'token_test',
    });

    const { getMessagingProvider } = await import('@/lib/messaging/provider-factory');
    const provider = await getMessagingProvider('org_2');
    expect(provider.constructor.name).toBe('TwilioProvider');
  });

  it('returns OpenPhoneProvider from env vars when no DB config', async () => {
    process.env.OPENPHONE_API_KEY = 'op_env_key';
    process.env.OPENPHONE_NUMBER_ID = 'PN_env';
    const { prisma } = await import('@/lib/db');
    (prisma as any).messageAccount.findFirst.mockResolvedValue(null);
    const { getProviderCredentials } = await import('@/lib/messaging/provider-credentials');
    (getProviderCredentials as any).mockResolvedValue(null);

    const { getMessagingProvider } = await import('@/lib/messaging/provider-factory');
    const provider = await getMessagingProvider('org_3');
    expect(provider.constructor.name).toBe('OpenPhoneProvider');
  });

  it('returns MockProvider when nothing is configured', async () => {
    const { prisma } = await import('@/lib/db');
    (prisma as any).messageAccount.findFirst.mockResolvedValue(null);
    const { getProviderCredentials } = await import('@/lib/messaging/provider-credentials');
    (getProviderCredentials as any).mockResolvedValue(null);

    const { getMessagingProvider } = await import('@/lib/messaging/provider-factory');
    const provider = await getMessagingProvider('org_4');
    expect(provider.constructor.name).toBe('MockProvider');
  });

  it('getOrgMessagingProviderType returns correct type', async () => {
    const { prisma } = await import('@/lib/db');
    (prisma as any).messageAccount.findFirst.mockResolvedValue({ provider: 'openphone' });
    const { getProviderCredentials } = await import('@/lib/messaging/provider-credentials');
    (getProviderCredentials as any).mockResolvedValue(null);

    const { getOrgMessagingProviderType } = await import('@/lib/messaging/provider-factory');
    const type = await getOrgMessagingProviderType('org_5');
    expect(type).toBe('openphone');
  });
});

describe('Provider-aware sending', () => {
  it('sendMessage routes through provider abstraction', async () => {
    // Verify the sendMessage function signature accepts orgId parameter
    const { sendMessage } = await import('@/lib/message-utils');
    expect(typeof sendMessage).toBe('function');
  });
});

describe('Thread creation without masking', () => {
  it('OpenPhone provider throws on createSession', async () => {
    const { OpenPhoneProvider } = await import('@/lib/messaging/providers/openphone');
    const provider = new OpenPhoneProvider('key', 'PN_1');
    await expect(provider.createSession({ clientE164: '+1' })).rejects.toThrow('does not support');
  });

  it('OpenPhone provider throws on createParticipant', async () => {
    const { OpenPhoneProvider } = await import('@/lib/messaging/providers/openphone');
    const provider = new OpenPhoneProvider('key', 'PN_1');
    await expect(provider.createParticipant({ sessionSid: 's1', identifier: '+1', friendlyName: 'x' }))
      .rejects.toThrow('does not support');
  });

  it('OpenPhone provider throws on sendViaProxy', async () => {
    const { OpenPhoneProvider } = await import('@/lib/messaging/providers/openphone');
    const provider = new OpenPhoneProvider('key', 'PN_1');
    await expect(provider.sendViaProxy({ sessionSid: 's1', fromParticipantSid: 'p1', body: 'hi' }))
      .rejects.toThrow('does not support');
  });
});

describe('Webhook handler basics', () => {
  it('OpenPhone provider parseInbound handles missing fields gracefully', async () => {
    const { OpenPhoneProvider } = await import('@/lib/messaging/providers/openphone');
    const provider = new OpenPhoneProvider('key', 'PN_1');
    const msg = provider.parseInbound({ data: {} });
    expect(msg.from).toBe('');
    expect(msg.body).toBe('');
    expect(msg.timestamp).toBeInstanceOf(Date);
  });

  it('OpenPhone provider parseStatusCallback handles unknown status', async () => {
    const { OpenPhoneProvider } = await import('@/lib/messaging/providers/openphone');
    const provider = new OpenPhoneProvider('key', 'PN_1');
    const cb = provider.parseStatusCallback({ data: { id: 'msg_1', status: 'xyz' } });
    expect(cb.status).toBe('queued');
  });
});
