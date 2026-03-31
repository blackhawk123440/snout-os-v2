import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRequestContext = vi.fn();
const mockRequireAnyRole = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockSendBookingLinkMessage = vi.fn();

vi.mock('@/lib/request-context', () => ({
  getRequestContext: (...args: unknown[]) => mockGetRequestContext(...args),
}));

vi.mock('@/lib/rbac', () => ({
  requireAnyRole: (...args: unknown[]) => mockRequireAnyRole(...args),
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getRateLimitIdentifier: () => '127.0.0.1',
  rateLimitResponse: () => new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 }),
}));

vi.mock('@/lib/messaging/payment-tip-send', () => ({
  sendBookingLinkMessage: (...args: unknown[]) => mockSendBookingLinkMessage(...args),
}));

import { POST } from '@/app/api/messages/send-payment-link/route';

describe('POST /api/messages/send-payment-link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestContext.mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
      sitterId: null,
      clientId: null,
    });
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 5, resetAt: Date.now() + 60_000 });
  });

  it('authorized send succeeds', async () => {
    mockSendBookingLinkMessage.mockResolvedValue({
      deduped: false,
      threadId: 't1',
      link: 'https://pay.example/abc',
      messageEvent: { id: 'm1', deliveryStatus: 'sent', providerMessageSid: 'sid_1', failureDetail: null },
    });
    const res = await POST(
      new Request('http://localhost/api/messages/send-payment-link', {
        method: 'POST',
        body: JSON.stringify({ bookingId: 'b1' }),
      }) as any
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.deliveryStatus).toBe('sent');
  });

  it('unauthorized send blocked', async () => {
    mockGetRequestContext.mockRejectedValueOnce(new Error('no session'));
    const res = await POST(
      new Request('http://localhost/api/messages/send-payment-link', {
        method: 'POST',
        body: JSON.stringify({ bookingId: 'b1' }),
      }) as any
    );
    expect(res.status).toBe(401);
  });

  it('missing link blocked with good error', async () => {
    mockSendBookingLinkMessage.mockRejectedValueOnce(new Error('Link could not be generated for this booking'));
    const res = await POST(
      new Request('http://localhost/api/messages/send-payment-link', {
        method: 'POST',
        body: JSON.stringify({ bookingId: 'b1' }),
      }) as any
    );
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.error).toContain('generated');
  });

  it('duplicate rapid clicks deduped', async () => {
    mockSendBookingLinkMessage.mockResolvedValue({
      deduped: true,
      threadId: 't1',
      link: 'https://pay.example/abc',
      messageEvent: { id: 'm1', deliveryStatus: 'sent', providerMessageSid: 'sid_1', failureDetail: null },
    });
    const res = await POST(
      new Request('http://localhost/api/messages/send-payment-link', {
        method: 'POST',
        body: JSON.stringify({ bookingId: 'b1' }),
      }) as any
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deduped).toBe(true);
  });

  it('delivery failure recorded visibly', async () => {
    mockSendBookingLinkMessage.mockResolvedValue({
      deduped: false,
      threadId: 't1',
      link: 'https://pay.example/abc',
      messageEvent: { id: 'm1', deliveryStatus: 'failed', providerMessageSid: null, failureDetail: 'Provider rejected number' },
    });
    const res = await POST(
      new Request('http://localhost/api/messages/send-payment-link', {
        method: 'POST',
        body: JSON.stringify({ bookingId: 'b1' }),
      }) as any
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deliveryStatus).toBe('failed');
    expect(body.error).toContain('Provider rejected number');
  });
});
