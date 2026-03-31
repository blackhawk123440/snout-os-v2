import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();
const mockCount = vi.fn();

const mockThreadFindMany = vi.fn().mockResolvedValue([]);

vi.mock('@/lib/db', () => ({
  prisma: {
    booking: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    messageThread: {
      findMany: (...args: unknown[]) => mockThreadFindMany(...args),
    },
  },
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn(),
  requireClientContext: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock('@/lib/org-scope', () => ({
  whereOrg: (_orgId: string, where: unknown) => ({ orgId: _orgId, ...(where as object) }),
}));

import { GET } from '@/app/api/client/bookings/route';
import { getRequestContext } from '@/lib/request-context';

describe('GET /api/client/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: 'org-1',
      role: 'client',
      clientId: 'client-1',
      userId: 'user-1',
      sitterId: null,
    } as never);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getRequestContext).mockRejectedValueOnce(new Error('no session'));

    const res = await GET(new Request('http://localhost/api/client/bookings'));
    expect(res.status).toBe(401);
  });

  it('returns 50 most recent bookings for the authenticated client', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'b1',
        service: 'Dog Walk',
        startAt: new Date('2026-03-09T10:00:00.000Z'),
        endAt: new Date('2026-03-09T11:00:00.000Z'),
        status: 'confirmed',
        address: '123 Main St',
        sitter: { id: 's1', firstName: 'Alex', lastName: 'Lee' },
      },
    ]);
    mockCount.mockResolvedValueOnce(1);

    const res = await GET(new Request('http://localhost/api/client/bookings?page=1&pageSize=20'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sort).toEqual({ field: 'startAt', direction: 'desc' });
    expect(body.items).toEqual([
      {
        id: 'b1',
        service: 'Dog Walk',
        startAt: '2026-03-09T10:00:00.000Z',
        endAt: '2026-03-09T11:00:00.000Z',
        status: 'confirmed',
        address: '123 Main St',
        sitter: { id: 's1', name: 'Alex Lee' },
        threadId: null,
      },
    ]);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: 'org-1', clientId: 'client-1' },
        orderBy: [{ startAt: 'desc' }, { id: 'asc' }],
        skip: 0,
        take: 20,
      })
    );
  });

  it('returns null sitter when booking is unassigned', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'b2',
        service: 'Boarding',
        startAt: new Date('2026-03-09T12:00:00.000Z'),
        endAt: new Date('2026-03-09T14:00:00.000Z'),
        status: 'pending',
        address: null,
        sitter: null,
        threadId: null,
      },
    ]);
    mockCount.mockResolvedValueOnce(1);

    const res = await GET(new Request('http://localhost/api/client/bookings'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items[0].sitter).toBeNull();
  });
});
