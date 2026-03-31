import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetRequestContext,
  mockStripeBalanceRetrieve,
  mockSitterFindMany,
  mockBookingCalendarEventAggregate,
  mockGetWebhookStatusForOrg,
  mockGetOrCreateOrgAISettings,
} = vi.hoisted(() => ({
  mockGetRequestContext: vi.fn(),
  mockStripeBalanceRetrieve: vi.fn(),
  mockSitterFindMany: vi.fn(),
  mockBookingCalendarEventAggregate: vi.fn(),
  mockGetWebhookStatusForOrg: vi.fn(),
  mockGetOrCreateOrgAISettings: vi.fn(),
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: mockGetRequestContext,
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    sitter: { findMany: mockSitterFindMany },
    bookingCalendarEvent: { aggregate: mockBookingCalendarEventAggregate },
  },
}));

vi.mock('@/lib/setup/webhook-status', () => ({
  getWebhookStatusForOrg: mockGetWebhookStatusForOrg,
}));

vi.mock('@/lib/ai/governance', () => ({
  getOrCreateOrgAISettings: mockGetOrCreateOrgAISettings,
}));

vi.mock('stripe', () => {
  class StripeMock {
    balance = { retrieve: mockStripeBalanceRetrieve };
  }
  return { default: StripeMock };
});

import { GET } from '@/app/api/integrations/status/route';

describe('api/integrations/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestContext.mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
      sitterId: null,
      clientId: null,
    });
    mockStripeBalanceRetrieve.mockResolvedValue({ available: [] });
    mockSitterFindMany.mockResolvedValue([
      { googleRefreshToken: 'refresh-valid', googleTokenExpiry: new Date(Date.now() + 60_000) },
      { googleRefreshToken: 'refresh-expired', googleTokenExpiry: new Date(Date.now() - 60_000) },
    ]);
    mockBookingCalendarEventAggregate.mockResolvedValue({
      _max: { lastSyncedAt: new Date('2026-03-06T00:00:00.000Z') },
    });
    mockGetWebhookStatusForOrg.mockResolvedValue({
      installed: true,
      webhookUrlExpected: 'https://example.com/api/messages/webhook/twilio',
      matchedNumbers: [{ e164: '+15555550111' }],
      unmatchedNumbers: [],
      numbersFetchedCount: 1,
    });
    mockGetOrCreateOrgAISettings.mockResolvedValue({
      enabled: true,
      hardStop: false,
      monthlyBudgetCents: 5000,
      allowedModels: null,
    });
  });

  it('returns canonical integrations status schema', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['ai', 'calendar', 'stripe', 'twilio']);
    expect(body.stripe).toEqual({
      ready: expect.any(Boolean),
      reachable: expect.any(Boolean),
      connectEnabled: expect.any(Boolean),
    });
    expect(body.twilio).toEqual({
      ready: expect.any(Boolean),
      numbersConfigured: expect.any(Boolean),
      webhooksInstalled: expect.any(Boolean),
    });
    expect(body.calendar.connectedSitters).toBe(1);
    expect(body.calendar.lastSyncAt).toBe('2026-03-06T00:00:00.000Z');
    expect(body.ai).toEqual({
      ready: expect.any(Boolean),
      enabled: true,
    });
  });

  it('computes twilio ready when numbers and webhooks are present', async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.twilio.numbersConfigured).toBe(true);
    expect(body.twilio.webhooksInstalled).toBe(true);
    expect(body.twilio.ready).toBe(true);
  });

  it('blocks sitter role', async () => {
    mockGetRequestContext.mockResolvedValue({
      orgId: 'org-1',
      role: 'sitter',
      userId: 'u2',
      sitterId: 's1',
      clientId: null,
    });

    const response = await GET();
    expect(response.status).toBe(403);
  });
});
