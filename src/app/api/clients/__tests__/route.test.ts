import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();
const mockCount = vi.fn();

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireAnyRole: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    client: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  })),
}));

import { GET } from '@/app/api/clients/route';
import { getRequestContext } from '@/lib/request-context';

describe('GET /api/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'owner-1',
    } as never);
  });

  it('caps page size and applies status filter', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCount.mockResolvedValueOnce(0);

    const res = await GET(
      new Request('http://localhost/api/clients?page=2&pageSize=999&status=inactive&search=Sam')
    );
    expect(res.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 200,
        take: 200,
        where: expect.objectContaining({
          deletedAt: { not: null },
          OR: expect.any(Array),
        }),
      })
    );
  });
});
