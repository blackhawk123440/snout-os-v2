import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindMany, mockCreate, mockUpdateMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdateMany: vi.fn(),
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    sitterTier: {
      findMany: mockFindMany,
      create: mockCreate,
      updateMany: mockUpdateMany,
    },
  })),
}));

import { GET, POST } from '@/app/api/sitter-tiers/route';
import { getRequestContext } from '@/lib/request-context';

describe('api/sitter-tiers collection route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
      sitterId: null,
      clientId: null,
    });
    mockFindMany.mockResolvedValue([]);
    mockCreate.mockResolvedValue({ id: 'tier-1', name: 'Certified', orgId: 'org-1' });
    mockUpdateMany.mockResolvedValue({ count: 0 });
  });

  it('returns tiers for owner/admin', async () => {
    mockFindMany.mockResolvedValue([{ id: 'tier-1', name: 'Certified', orgId: 'org-1' }]);
    const response = await GET(new NextRequest('http://localhost/api/sitter-tiers'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.tiers).toHaveLength(1);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.any(Object),
      })
    );
  });

  it('rejects sitter role', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'sitter',
      userId: 'u2',
      sitterId: 's1',
      clientId: null,
    });
    const response = await GET(new NextRequest('http://localhost/api/sitter-tiers'));
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('creates a tier with org scope', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/sitter-tiers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Trusted',
          pointTarget: 80,
          minCompletionRate: 95,
          minResponseRate: 90,
          isDefault: true,
        }),
        headers: { 'content-type': 'application/json' },
      })
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.tier.id).toBe('tier-1');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Trusted',
          pointTarget: 80,
          isDefault: true,
        }),
      })
    );
  });
});
