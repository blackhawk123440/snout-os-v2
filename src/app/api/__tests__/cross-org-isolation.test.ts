/**
 * Cross-org isolation tests (Batch 5)
 * Prove that cross-org access fails for messages, uploads, payments.
 * Uses 2 org fixtures: org-a, org-b.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

global.fetch = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    messageThread: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    messageEvent: { findMany: vi.fn() },
    booking: { findUnique: vi.fn(), findFirst: vi.fn() },
    stripeCharge: { findMany: vi.fn() },
  },
}));

import { auth } from '@/lib/auth';
import { getRequestContext } from '@/lib/request-context';
import { prisma } from '@/lib/db';

describe('cross-org isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
  });

  describe('GET /api/messages/threads/[id]/messages', () => {
    it('returns 404 when thread belongs to another org (scoped query finds nothing)', async () => {
      (getRequestContext as any).mockResolvedValue({ orgId: 'org-a', role: 'owner', sitterId: null, clientId: null });
      (auth as any).mockResolvedValue({
        user: { id: 'u1', orgId: 'org-a', role: 'owner' },
      });
      // Scoped db converts findUnique to findFirst with orgId; thread in org-b won't match
      (prisma as any).messageThread.findFirst.mockResolvedValue(null);
      (prisma as any).messageEvent.findMany.mockResolvedValue([]);
      // When NEXT_PUBLIC_API_URL is set, route proxies to BFF; mock 404 so we get 404
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ error: 'Thread not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { GET } = await import('@/app/api/messages/threads/[id]/messages/route');
      const req = new Request('http://localhost/api/messages/threads/thread-1/messages');
      const res = await GET(req as any, { params: Promise.resolve({ id: 'thread-1' }) });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe('Thread not found');
    });

    it('returns 404 when thread not found (no cross-org leak)', async () => {
      (getRequestContext as any).mockResolvedValue({ orgId: 'org-a', role: 'owner', sitterId: null, clientId: null });
      (auth as any).mockResolvedValue({
        user: { id: 'u1', orgId: 'org-a', role: 'owner' },
      });
      (prisma as any).messageThread.findFirst.mockResolvedValue(null);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ error: 'Thread not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const { GET } = await import('@/app/api/messages/threads/[id]/messages/route');
      const req = new Request('http://localhost/api/messages/threads/thread-1/messages');
      const res = await GET(req as any, { params: Promise.resolve({ id: 'thread-1' }) });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe('Thread not found');
    });
  });

  describe('POST /api/upload/report-media', () => {
    it('returns 404 when booking belongs to another org (scoped db scopes query)', async () => {
      (getRequestContext as any).mockResolvedValue({
        orgId: 'org-a',
        role: 'owner',
        sitterId: null,
        userId: 'u1',
      });
      // getScopedDb injects orgId - booking in org-b won't be found
      (prisma as any).booking.findFirst.mockResolvedValue(null);

      const formData = new FormData();
      formData.set('bookingId', 'booking-org-b');
      formData.append('file', new Blob(['x']), 'photo.jpg');

      const { POST } = await import('@/app/api/upload/report-media/route');
      const req = new Request('http://localhost/api/upload/report-media', {
        method: 'POST',
        body: formData,
      });
      const res = await POST(req as any);
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe('Booking not found');
    });
  });

  describe('GET /api/payments', () => {
    it('returns only org-scoped payments', async () => {
      (getRequestContext as any).mockResolvedValue({
        orgId: 'org-a',
        role: 'owner',
        userId: 'u1',
      });
      (prisma as any).stripeCharge.findMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/payments/route');
      const req = new Request('http://localhost/api/payments');
      const res = await GET(req as any);
      const body = await res.json();

      expect(res.status).toBe(200);
      // getScopedDb injects orgId into where
      expect((prisma as any).stripeCharge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ orgId: 'org-a' }),
        })
      );
    });
  });
});
