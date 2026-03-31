import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeNextRequest } from '@/test/utils/nextRequest';
import { prisma } from '@/lib/db';

// Prevent BFF proxy calls in CI; mock so route returns predictable error
global.fetch = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    messageThread: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-1', role: 'owner', orgId: 'org-1' } }),
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn().mockResolvedValue({
    orgId: 'org-1',
    role: 'owner',
    sitterId: null,
    clientId: null,
  }),
}));

vi.mock('@/lib/api/jwt', () => ({
  mintApiJWT: vi.fn().mockResolvedValue('mock-jwt-token'),
}));

describe('Messaging Routes Compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
  });

  describe('GET /api/messages/threads', () => {
    it('uses a real NextRequest and returns 200', async () => {
      const { GET } = await import('@/app/api/messages/threads/route');
      const req = makeNextRequest('http://localhost/api/messages/threads?limit=10', {
        method: 'GET',
      });
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.items)).toBe(true);
    });
  });

  describe('GET /api/messages/threads/[id]', () => {
    it('returns 404 when thread not found (Prisma source of truth)', async () => {
      (prisma as any).messageThread.findFirst.mockResolvedValue(null);
      // When NEXT_PUBLIC_API_URL is set, route proxies to BFF; mock 404 so we get 404
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ error: 'Thread not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      const { GET } = await import('@/app/api/messages/threads/[id]/route');
      const req = makeNextRequest('http://localhost/api/messages/threads/thread-1', {
        method: 'GET',
      });
      const res = await GET(req, { params: Promise.resolve({ id: 'thread-1' }) });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Thread not found');
    });
  });

  describe('POST /api/messages/send', () => {
    it('uses a real NextRequest and returns 500 when API server is not configured or fetch fails', async () => {
      // In CI NEXT_PUBLIC_API_URL is set; mock fetch to reject so route returns 500 (no real BFF call)
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError('fetch failed'));
      const { POST } = await import('@/app/api/messages/send/route');
      const req = makeNextRequest('http://localhost/api/messages/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ threadId: 'thread-1', text: 'Hello' }),
      });
      const res = await POST(req);

      expect(res.status).toBe(500);
      const body = await res.json();
      // When API URL is set but fetch fails: "Failed to send message"; when unset: "API server not configured"
      expect(body.error).toMatch(/API server not configured|Failed to send message/);
    });
  });
});
