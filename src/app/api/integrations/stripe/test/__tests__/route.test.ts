import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetRequestContext, mockBalanceRetrieve, mockAccountsRetrieve } = vi.hoisted(() => ({
  mockGetRequestContext: vi.fn(),
  mockBalanceRetrieve: vi.fn(),
  mockAccountsRetrieve: vi.fn(),
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: mockGetRequestContext,
}));

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_SECRET_KEY: 'sk_test_123',
  },
}));

vi.mock('stripe', () => {
  class StripeMock {
    balance = { retrieve: mockBalanceRetrieve };
    accounts = { retrieve: mockAccountsRetrieve };
  }
  return { default: StripeMock };
});

import { POST } from '@/app/api/integrations/stripe/test/route';

describe('api/integrations/stripe/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestContext.mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
      sitterId: null,
      clientId: null,
    });
  });

  it('returns structured connectivity and transfer status', async () => {
    mockBalanceRetrieve.mockResolvedValue({
      available: [{ amount: 1000, currency: 'usd' }],
      pending: [{ amount: 250, currency: 'usd' }],
    });
    mockAccountsRetrieve.mockResolvedValue({
      id: 'acct_123',
      payouts_enabled: true,
      capabilities: { transfers: 'active' },
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.connectivity).toBe(true);
    expect(body.accountReachable).toBe(true);
    expect(body.transfersEnabled).toBe(true);
    expect(body.accountId).toBe('acct_123');
  });

  it('rejects sitter role', async () => {
    mockGetRequestContext.mockResolvedValue({
      orgId: 'org-1',
      role: 'sitter',
      userId: 'u2',
      sitterId: 's1',
      clientId: null,
    });

    const response = await POST();
    expect(response.status).toBe(403);
  });
});
