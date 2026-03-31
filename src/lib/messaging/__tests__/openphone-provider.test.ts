import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenPhoneProvider } from '../providers/openphone';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('OpenPhoneProvider', () => {
  let provider: OpenPhoneProvider;

  beforeEach(() => {
    vi.resetAllMocks();
    provider = new OpenPhoneProvider('op_test_key', 'PN_test_123', 'webhook_secret_123');
  });

  // ─── sendMessage ──────────────────────────────────────────────

  it('sendMessage returns success with valid config', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: { id: 'msg_abc123' } }),
    });
    const result = await provider.sendMessage({ to: '+11234567890', body: 'Hello' });
    expect(result.success).toBe(true);
    expect(result.messageSid).toBe('msg_abc123');
  });

  it('sendMessage returns error when API key is missing', async () => {
    const noKeyProvider = new OpenPhoneProvider('', 'PN_test', 'secret');
    const result = await noKeyProvider.sendMessage({ to: '+11234567890', body: 'Hello' });
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('API key not configured');
  });

  it('sendMessage handles 429 rate limit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ message: 'Rate limit exceeded' }),
    });
    const result = await provider.sendMessage({ to: '+11234567890', body: 'Hello' });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('429');
  });

  it('sendMessage handles 500 server error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
    const result = await provider.sendMessage({ to: '+11234567890', body: 'Hello' });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('500');
  });

  // ─── verifyWebhook ────────────────────────────────────────────

  it('verifyWebhook rejects missing signature', () => {
    expect(provider.verifyWebhook('body', '', '/webhook')).toBe(false);
  });

  // ─── parseInbound ─────────────────────────────────────────────

  it('parseInbound normalizes OpenPhone payload', () => {
    const payload = {
      type: 'message.received',
      data: {
        id: 'msg_xyz',
        from: { phoneNumber: '+11111111111' },
        to: [{ phoneNumber: '+12222222222' }],
        body: 'Hey there',
        media: [{ url: 'https://img.example.com/photo.jpg' }],
        createdAt: '2024-06-15T10:30:00Z',
      },
    };
    const msg = provider.parseInbound(payload);
    expect(msg.from).toBe('+11111111111');
    expect(msg.to).toBe('+12222222222');
    expect(msg.body).toBe('Hey there');
    expect(msg.messageSid).toBe('msg_xyz');
    expect(msg.mediaUrls).toEqual(['https://img.example.com/photo.jpg']);
    expect(msg.timestamp).toBeInstanceOf(Date);
  });

  // ─── parseStatusCallback ──────────────────────────────────────

  it('parseStatusCallback maps status values', () => {
    expect(provider.parseStatusCallback({ data: { id: 'msg_1', status: 'delivered' } }).status).toBe('delivered');
    expect(provider.parseStatusCallback({ data: { id: 'msg_2', status: 'failed' } }).status).toBe('failed');
    expect(provider.parseStatusCallback({ data: { id: 'msg_3', status: 'sent' } }).status).toBe('sent');
    expect(provider.parseStatusCallback({ data: { id: 'msg_4', status: 'unknown' } }).status).toBe('queued');
  });

  // ─── Proxy methods throw ──────────────────────────────────────

  it('createSession throws not-supported error', async () => {
    await expect(provider.createSession({ clientE164: '+11234567890' }))
      .rejects.toThrow('does not support number masking');
  });

  it('createParticipant throws not-supported error', async () => {
    await expect(provider.createParticipant({ sessionSid: 's1', identifier: '+1', friendlyName: 'test' }))
      .rejects.toThrow('does not support number masking');
  });
});
