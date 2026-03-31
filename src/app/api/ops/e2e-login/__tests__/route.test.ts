import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('next-auth/jwt', () => ({
  encode: vi.fn().mockResolvedValue('mock-session-token'),
}));

import { prisma } from '@/lib/db';
import { POST } from '@/app/api/ops/e2e-login/route';

function makeRequest(role: 'owner' | 'sitter' | 'client') {
  return new NextRequest('https://example.test/api/ops/e2e-login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-key': 'test-key',
    },
    body: JSON.stringify({ role }),
  });
}

describe('/api/ops/e2e-login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'production';
    process.env.ENV_NAME = 'staging';
    process.env.ENABLE_E2E_AUTH = 'true';
    process.env.E2E_AUTH_KEY = 'test-key';
  });

  it.each([
    {
      role: 'owner' as const,
      user: { id: 'u1', email: 'owner@example.com', name: 'Owner', orgId: 'default', role: 'owner', sitter: null, client: null },
    },
    {
      role: 'sitter' as const,
      user: { id: 'u2', email: 'sitter@example.com', name: 'Sitter', orgId: 'default', role: 'sitter', sitter: { id: 's1' }, client: null },
    },
    {
      role: 'client' as const,
      user: { id: 'u3', email: 'client@example.com', name: 'Client', orgId: 'default', role: 'client', sitter: null, client: { id: 'c1' } },
    },
  ])('returns 200 and session cookie for $role', async ({ role, user }) => {
    (prisma as any).user.findUnique.mockResolvedValueOnce(user);

    const response = await POST(makeRequest(role));
    const body = await response.json();
    const setCookie = response.headers.get('set-cookie') || '';

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(setCookie).toContain('session-token');
  });

  it('falls back to role-based owner lookup when default owner email is missing', async () => {
    (prisma as any).user.findUnique.mockResolvedValueOnce(null);
    (prisma as any).user.findFirst.mockResolvedValueOnce({
      id: 'u9',
      email: 'real-owner@company.test',
      name: 'Real Owner',
      orgId: 'default',
      role: 'owner',
      sitter: null,
      client: null,
    });

    const response = await POST(makeRequest('owner'));
    const body = await response.json();
    const setCookie = response.headers.get('set-cookie') || '';

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(setCookie).toContain('session-token');
    expect((prisma as any).user.findFirst).toHaveBeenCalled();
  });
});
