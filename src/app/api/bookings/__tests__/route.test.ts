import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockReportFindMany = vi.fn();

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireAnyRole: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    booking: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    report: {
      findMany: (...args: unknown[]) => mockReportFindMany(...args),
    },
  })),
}));

import { GET } from '@/app/api/bookings/route';
import { getRequestContext } from '@/lib/request-context';

describe('GET /api/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'owner-1',
      clientId: null,
      sitterId: null,
    } as never);
    mockReportFindMany.mockResolvedValue([]);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getRequestContext).mockRejectedValueOnce(new Error('no session'));
    const res = await GET(new Request('http://localhost/api/bookings'));
    expect(res.status).toBe(401);
  });

  it('returns owner booking list with report projection', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'b1',
        firstName: 'Client',
        lastName: 'One',
        phone: '+15550001',
        email: 'client@example.com',
        address: '123 Main',
        service: 'Dog Walk',
        startAt: new Date('2026-03-09T10:00:00.000Z'),
        endAt: new Date('2026-03-09T11:00:00.000Z'),
        status: 'completed',
        paymentStatus: 'unpaid',
        totalPrice: 45,
        sitter: { id: 's1', firstName: 'Sam', lastName: 'Sitter' },
        client: { id: 'c1', firstName: 'Client', lastName: 'One' },
        createdAt: new Date('2026-03-08T10:00:00.000Z'),
      },
    ]);
    mockCount.mockResolvedValueOnce(1);
    mockReportFindMany.mockResolvedValueOnce([{ bookingId: 'b1' }]);

    const res = await GET(new Request('http://localhost/api/bookings?page=1&pageSize=50'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        id: 'b1',
        status: 'completed',
        hasReport: true,
      })
    );
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: 0,
        take: 50,
      })
    );
  });

  it('caps page size and applies filters', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCount.mockResolvedValueOnce(0);
    mockReportFindMany.mockResolvedValueOnce([]);

    const res = await GET(
      new Request(
        'http://localhost/api/bookings?page=2&pageSize=999&status=confirmed,completed&paymentStatus=paid&search=alex&from=2026-03-01&to=2026-03-31'
      )
    );
    expect(res.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 200,
        take: 200,
        where: expect.objectContaining({
          status: { in: ['confirmed', 'completed'] },
          paymentStatus: { in: ['paid'] },
          startAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          OR: expect.any(Array),
        }),
      })
    );
  });
});
