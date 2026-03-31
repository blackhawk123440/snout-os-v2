/**
 * Cross-client isolation tests (Batch 12)
 * Prove that client A cannot read client B's bookings, reports, messages.
 * Uses requireClientContext + org-scoped queries.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    booking: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    report: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn() },
    messageThread: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn() },
    messageEvent: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { getRequestContext } from '@/lib/request-context';
import { prisma } from '@/lib/db';

describe('cross-client isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/client/bookings', () => {
    it('returns only client A bookings when client A is authenticated', async () => {
      (getRequestContext as any).mockResolvedValue({
        orgId: 'org-1',
        role: 'client',
        clientId: 'client-a',
        userId: 'u1',
      });
      (prisma as any).booking.findMany.mockResolvedValue([
        { id: 'b1', clientId: 'client-a', service: 'Drop-in' },
      ]);
      (prisma as any).booking.count.mockResolvedValue(1);

      const { GET } = await import('@/app/api/client/bookings/route');
      const res = await GET(new Request('http://localhost/api/client/bookings'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect((prisma as any).booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ clientId: 'client-a' }),
        })
      );
      expect(body.items).toHaveLength(1);
      expect(body.items[0].id).toBe('b1');
    });

    it('returns 403 when clientId is missing on session', async () => {
      (getRequestContext as any).mockResolvedValue({
        orgId: 'org-1',
        role: 'client',
        clientId: null,
        userId: 'u1',
      });

      const { GET } = await import('@/app/api/client/bookings/route');
      const res = await GET(new Request('http://localhost/api/client/bookings'));
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toBe('Forbidden');
      expect((prisma as any).booking.findMany).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/client/bookings/[id]', () => {
    it('returns 404 when booking belongs to another client (client B)', async () => {
      (getRequestContext as any).mockResolvedValue({
        orgId: 'org-1',
        role: 'client',
        clientId: 'client-a',
        userId: 'u1',
      });
      // Scoped query with clientId: client-a; booking b2 belongs to client-b
      (prisma as any).booking.findFirst.mockResolvedValue(null);

      const { GET } = await import('@/app/api/client/bookings/[id]/route');
      const res = await GET(new Request('http://localhost/api/client/bookings/b2'), {
        params: Promise.resolve({ id: 'b2' }),
      });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe('Booking not found');
      expect((prisma as any).booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ clientId: 'client-a' }),
        })
      );
    });
  });

  describe('GET /api/client/reports/[id]', () => {
    it('returns 404 when report belongs to another client', async () => {
      (getRequestContext as any).mockResolvedValue({
        orgId: 'org-1',
        role: 'client',
        clientId: 'client-a',
        userId: 'u1',
      });
      (prisma as any).report.findFirst.mockResolvedValue(null);

      const { GET } = await import('@/app/api/client/reports/[id]/route');
      const res = await GET(new Request('http://localhost/api/client/reports/r2'), {
        params: Promise.resolve({ id: 'r2' }),
      });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe('Report not found');
      expect((prisma as any).report.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            booking: expect.objectContaining({ clientId: 'client-a' }),
          }),
        })
      );
    });
  });

  describe('GET /api/client/messages/[id]', () => {
    it('returns 404 when thread belongs to another client', async () => {
      (getRequestContext as any).mockResolvedValue({
        orgId: 'org-1',
        role: 'client',
        clientId: 'client-a',
        userId: 'u1',
      });
      (prisma as any).messageThread.findFirst.mockResolvedValue(null);

      const { GET } = await import('@/app/api/client/messages/[id]/route');
      const res = await GET(new Request('http://localhost/api/client/messages/t2'), {
        params: Promise.resolve({ id: 't2' }),
      });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe('Thread not found');
      expect((prisma as any).messageThread.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ clientId: 'client-a' }),
        })
      );
    });
  });
});
