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

describe('bookings API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'user-1',
      clientId: null,
      sitterId: null,
    } as never);
    mockReportFindMany.mockResolvedValue([]);
  });

  it('returns canonical bookings shape using paymentStatus', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'b1',
        firstName: 'Casey',
        lastName: 'Client',
        phone: '+14155550101',
        email: 'casey@example.com',
        address: '123 Main St',
        service: 'Dog Walk',
        startAt: new Date('2026-03-10T10:00:00.000Z'),
        endAt: new Date('2026-03-10T10:30:00.000Z'),
        status: 'confirmed',
        paymentStatus: 'unpaid',
        totalPrice: 35,
        sitter: { id: 's1', firstName: 'Sam', lastName: 'Sitter' },
        client: { id: 'c1', firstName: 'Casey', lastName: 'Client' },
        createdAt: new Date('2026-03-09T08:00:00.000Z'),
      },
    ]);
    mockCount.mockResolvedValueOnce(1);
    mockReportFindMany.mockResolvedValueOnce([]);

    const res = await GET(new Request('http://localhost/api/bookings?page=1&pageSize=50') as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(50);
    expect(body.total).toBe(1);
    expect(body.sort).toEqual({ field: 'createdAt', direction: 'desc' });

    const booking = body.items[0];
    expect(booking).toMatchObject({
      id: 'b1',
      firstName: 'Casey',
      lastName: 'Client',
      status: 'confirmed',
      paymentStatus: 'unpaid',
    });
    expect(Object.keys(booking)).toContain('paymentStatus');
    expect(Object.keys(booking)).not.toContain('paidStatus');
  });
});
