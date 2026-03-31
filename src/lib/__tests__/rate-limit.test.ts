import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, getRateLimitIdentifier, rateLimitResponse } from '@/lib/rate-limit';

describe('rate-limit', () => {
  const config = { keyPrefix: 'test', limit: 3, windowSec: 60 };

  beforeEach(() => {
    // Use unique identifier per test to avoid cross-test pollution
  });

  it('getRateLimitIdentifier returns x-forwarded-for when present', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getRateLimitIdentifier(req)).toBe('1.2.3.4');
  });

  it('getRateLimitIdentifier returns x-real-ip when present', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '9.9.9.9' },
    });
    expect(getRateLimitIdentifier(req)).toBe('9.9.9.9');
  });

  it('checkRateLimit allows requests under limit', async () => {
    const id = `test-under-${Date.now()}`;
    const r1 = await checkRateLimit(id, config);
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit(id, config);
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(1);
  });

  it('checkRateLimit rejects requests over limit', async () => {
    const id = `test-over-${Date.now()}`;
    await checkRateLimit(id, config);
    await checkRateLimit(id, config);
    await checkRateLimit(id, config);
    const r4 = await checkRateLimit(id, config);
    expect(r4.success).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.retryAfter).toBeDefined();
  });

  it('rateLimitResponse returns 429 with Retry-After', () => {
    const res = rateLimitResponse(42);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
  });
});
