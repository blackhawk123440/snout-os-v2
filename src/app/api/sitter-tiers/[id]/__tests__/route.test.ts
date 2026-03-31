import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindFirst, mockUpdate, mockDelete, mockUpdateMany } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockUpdateMany: vi.fn(),
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    sitterTier: {
      findFirst: mockFindFirst,
      update: mockUpdate,
      delete: mockDelete,
      updateMany: mockUpdateMany,
    },
  })),
}));

import { GET, PATCH, DELETE } from '@/app/api/sitter-tiers/[id]/route';
import { getRequestContext } from '@/lib/request-context';

describe('api/sitter-tiers/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
      sitterId: null,
      clientId: null,
    });
    mockFindFirst.mockResolvedValue({
      id: 'tier-1',
      name: 'Certified',
      isDefault: false,
      _count: { Sitter: 0, sitters: 0 },
    });
    mockUpdate.mockResolvedValue({ id: 'tier-1', name: 'Trusted' });
    mockDelete.mockResolvedValue({ id: 'tier-1' });
    mockUpdateMany.mockResolvedValue({ count: 0 });
  });

  it('gets tier by org-scoped id', async () => {
    const response = await GET(new NextRequest('http://localhost/api/sitter-tiers/tier-1'), {
      params: Promise.resolve({ id: 'tier-1' }),
    });
    expect(response.status).toBe(200);
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'tier-1' }),
      })
    );
  });

  it('updates tier for owner/admin only', async () => {
    const response = await PATCH(
      new NextRequest('http://localhost/api/sitter-tiers/tier-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Trusted', isDefault: true }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'tier-1' }) }
    );
    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tier-1' },
      })
    );
  });

  it('prevents deleting default tier', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'tier-1',
      isDefault: true,
      _count: { Sitter: 0, sitters: 0 },
    });
    const response = await DELETE(
      new NextRequest('http://localhost/api/sitter-tiers/tier-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'tier-1' }) }
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('Default tier');
  });
});
