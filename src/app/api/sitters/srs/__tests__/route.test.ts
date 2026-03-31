import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    sitterTierSnapshot: {
      findMany: mockFindMany,
    },
  },
}));

import { GET } from '@/app/api/sitters/srs/route';
import { auth } from '@/lib/auth';

describe('api/sitters/srs visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as any).mockResolvedValue({
      user: { role: 'owner', orgId: 'org-1' },
    });
    mockFindMany.mockResolvedValue([]);
  });

  it('allows owner/admin', async () => {
    const response = await GET(new NextRequest('http://localhost/api/sitters/srs'));
    expect(response.status).toBe(200);
  });

  it('blocks sitter role', async () => {
    (auth as any).mockResolvedValue({
      user: { role: 'sitter', orgId: 'org-1' },
    });
    const response = await GET(new NextRequest('http://localhost/api/sitters/srs'));
    expect(response.status).toBe(403);
  });
});
