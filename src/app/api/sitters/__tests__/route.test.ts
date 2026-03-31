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

vi.mock('@/lib/db', () => ({
  prisma: {
    sitter: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    messageNumber: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { GET } from '@/app/api/sitters/route';
import { getRequestContext } from '@/lib/request-context';

describe('GET /api/sitters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = '';
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'owner-1',
    } as never);
  });

  it('caps page size and applies active filter', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCount.mockResolvedValueOnce(0);

    const res = await GET(
      new Request('http://localhost/api/sitters?page=3&pageSize=999&status=active&search=Alex')
    );
    expect(res.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 400,
        take: 200,
        where: expect.objectContaining({
          active: true,
          OR: expect.any(Array),
        }),
      })
    );
  });
});
