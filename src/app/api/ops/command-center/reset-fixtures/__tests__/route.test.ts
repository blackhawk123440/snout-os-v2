import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  prisma: {},
}));
vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));
vi.mock('@/lib/rbac', () => ({
  ForbiddenError: class ForbiddenError extends Error {},
  requireOwnerOrAdmin: vi.fn(),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  getRateLimitIdentifier: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(),
}));
vi.mock('@/lib/log-event', () => ({
  logEvent: vi.fn(),
}));
vi.mock('@/lib/runtime-env', () => ({
  getRuntimeEnvName: vi.fn(() => 'prod'),
}));

import { POST } from '@/app/api/ops/command-center/reset-fixtures/route';

describe('POST /api/ops/command-center/reset-fixtures', () => {
  it('returns 404 when runtime env is production', async () => {
    const req = new NextRequest('http://localhost/api/ops/command-center/reset-fixtures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: 'verify-prod-block' }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Not found');
  });
});
