/**
 * GET /api/bookings/conflicts — canonical conflict list, org-scoped, owner/admin only.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDb = {
  booking: {
    findMany: vi.fn(),
  },
};

vi.mock('@/lib/request-context', () => ({ getRequestContext: vi.fn() }));
vi.mock('@/lib/rbac', () => ({
  ForbiddenError: class ForbiddenError extends Error {},
  requireAnyRole: vi.fn(),
}));
vi.mock('@/lib/tenancy', () => ({ getScopedDb: vi.fn(() => mockDb) }));

import { GET } from '@/app/api/bookings/conflicts/route';
import { getRequestContext } from '@/lib/request-context';

describe('GET /api/bookings/conflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
    });
  });

  it('returns conflictBookingIds array when owner and same-sitter overlap', async () => {
    mockDb.booking.findMany.mockResolvedValue([
      { id: 'b1', sitterId: 's1', startAt: new Date('2025-03-01T10:00:00Z'), endAt: new Date('2025-03-01T11:00:00Z') },
      { id: 'b2', sitterId: 's1', startAt: new Date('2025-03-01T10:30:00Z'), endAt: new Date('2025-03-01T11:30:00Z') },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.conflictBookingIds)).toBe(true);
    expect(body.conflictBookingIds).toContain('b1');
    expect(body.conflictBookingIds).toContain('b2');
  });

  it('returns 403 when role is not owner/admin', async () => {
    const { requireAnyRole, ForbiddenError } = await import('@/lib/rbac');
    (requireAnyRole as any).mockImplementationOnce(() => {
      throw new ForbiddenError();
    });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns empty array when no conflicts', async () => {
    mockDb.booking.findMany.mockResolvedValue([]);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.conflictBookingIds).toEqual([]);
  });
});
