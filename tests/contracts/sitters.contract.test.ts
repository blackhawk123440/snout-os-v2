import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSitterFindMany = vi.fn();
const mockMessageNumberFindMany = vi.fn();
const mockSitterCount = vi.fn();

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireAnyRole: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock('@/lib/api/jwt', () => ({
  mintApiJWT: vi.fn(),
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    sitter: {
      findMany: (...args: unknown[]) => mockSitterFindMany(...args),
      count: (...args: unknown[]) => mockSitterCount(...args),
    },
    messageNumber: {
      findMany: (...args: unknown[]) => mockMessageNumberFindMany(...args),
    },
  })),
}));

import { GET } from '@/app/api/sitters/route';
import { getRequestContext } from '@/lib/request-context';

describe('sitters API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'user-1',
      clientId: null,
      sitterId: null,
    } as never);
  });

  it('returns canonical paginated sitter shape', async () => {
    mockSitterFindMany.mockResolvedValueOnce([
      {
        id: 's1',
        firstName: 'Sam',
        lastName: 'Sitter',
        phone: '+15551234567',
        email: 'sam@example.com',
        personalPhone: null,
        active: true,
        commissionPercentage: 80,
        createdAt: new Date('2026-03-09T08:00:00.000Z'),
        updatedAt: new Date('2026-03-09T09:00:00.000Z'),
        deletedAt: null,
        currentTierId: null,
      },
    ]);
    mockMessageNumberFindMany.mockResolvedValueOnce([]);
    mockSitterCount.mockResolvedValueOnce(1);

    const req = new Request('http://localhost/api/sitters?page=1&pageSize=50');
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(50);
    expect(body.total).toBe(1);
    expect(body.sort).toEqual({ field: 'createdAt', direction: 'desc' });
    expect(body.items[0]).toMatchObject({
      id: 's1',
      firstName: 'Sam',
      lastName: 'Sitter',
      phone: '+15551234567',
      email: 'sam@example.com',
      isActive: true,
    });
  });
});
