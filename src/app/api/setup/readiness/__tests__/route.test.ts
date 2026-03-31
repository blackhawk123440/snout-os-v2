import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  authMock,
  getProviderCredentialsMock,
  getWebhookStatusForOrgMock,
  prismaMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getProviderCredentialsMock: vi.fn(),
  getWebhookStatusForOrgMock: vi.fn(),
  prismaMock: {
    messageNumber: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
}));

vi.mock('@/lib/messaging/provider-credentials', () => ({
  getProviderCredentials: (...args: any[]) => getProviderCredentialsMock(...args),
}));

vi.mock('@/lib/setup/webhook-status', () => ({
  getWebhookStatusForOrg: (...args: any[]) => getWebhookStatusForOrgMock(...args),
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

describe('GET /api/setup/readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { orgId: 'default' } });
    getProviderCredentialsMock.mockResolvedValue(null);
    getWebhookStatusForOrgMock.mockResolvedValue(null);
    prismaMock.messageNumber.findMany.mockResolvedValue([]);
    prismaMock.messageNumber.findFirst.mockResolvedValue(null);
  });

  it('reports actionable message when number inventory is missing', async () => {
    const { GET } = await import('../route');
    const req = new NextRequest('https://example.com/api/setup/readiness');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.numbers.ready).toBe(false);
    expect(String(json.numbers.message)).toContain('Sync numbers');
  });
});

