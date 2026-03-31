/**
 * Vitest: signup route - double submit idempotency, retry after partial failure.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/signup/route';

vi.mock('@/lib/signup-bootstrap', () => ({
  resolveSignupIdempotency: vi.fn(),
  bootstrapOrgAndOwner: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => Promise.resolve({ success: true, remaining: 99, retryAfter: 0 }),
}));

import {
  resolveSignupIdempotency,
  bootstrapOrgAndOwner,
} from '@/lib/signup-bootstrap';

function makeRequest(body: { email: string; password: string; name?: string; idempotencyKey?: string }) {
  return new NextRequest('https://example.test/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/signup', () => {
  const payload = {
    email: 'owner@new.test',
    password: 'password123',
    name: 'New Owner',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (resolveSignupIdempotency as any).mockResolvedValue(null);
    (bootstrapOrgAndOwner as any).mockResolvedValue({
      userId: 'user-1',
      orgId: 'org-1',
      email: 'owner@new.test',
      created: true,
    });
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('https://example.test/api/auth/signup', {
      method: 'POST',
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(resolveSignupIdempotency).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid body (missing email)', async () => {
    const req = makeRequest({ email: '', password: 'password123' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates user and org on first submit', async () => {
    const res = await POST(makeRequest(payload));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.created).toBe(true);
    expect(data.userId).toBe('user-1');
    expect(data.orgId).toBe('org-1');
    expect(data.email).toBe('owner@new.test');
    expect(bootstrapOrgAndOwner).toHaveBeenCalledTimes(1);
  });

  it('double submit: second request returns existing user/org without creating again', async () => {
    const req1 = makeRequest(payload);
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.created).toBe(true);

    (resolveSignupIdempotency as any).mockResolvedValueOnce({
      existing: {
        userId: 'user-1',
        orgId: 'org-1',
        email: 'owner@new.test',
        created: false,
      },
    });

    const res2 = await POST(makeRequest(payload));
    const data2 = await res2.json();
    expect(res2.status).toBe(200);
    expect(data2.created).toBe(false);
    expect(data2.userId).toBe('user-1');
    expect(data2.orgId).toBe('org-1');
    expect(bootstrapOrgAndOwner).toHaveBeenCalledTimes(1);
  });

  it('retry after partial failure: first request fails, retry succeeds', async () => {
    (bootstrapOrgAndOwner as any)
      .mockRejectedValueOnce(new Error('Database connection lost'))
      .mockResolvedValueOnce({
        userId: 'user-1',
        orgId: 'org-1',
        email: 'owner@new.test',
        created: true,
      });

    const res1 = await POST(makeRequest(payload));
    expect(res1.status).toBe(500);
    const body1 = await res1.json();
    expect(body1.error).toBe('Signup failed');

    const res2 = await POST(makeRequest(payload));
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.created).toBe(true);
    expect(data2.userId).toBe('user-1');
    expect(bootstrapOrgAndOwner).toHaveBeenCalledTimes(2);
  });

  it('honors Idempotency-Key header for idempotency lookup', async () => {
    const req = makeRequest({ ...payload, idempotencyKey: 'key-abc' });
    req.headers.set('Idempotency-Key', 'header-key');
    await POST(req);
    expect(resolveSignupIdempotency).toHaveBeenCalledWith(
      'owner@new.test',
      'header-key'
    );
  });
});
