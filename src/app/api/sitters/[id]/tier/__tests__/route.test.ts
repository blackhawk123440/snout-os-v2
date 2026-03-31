import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSitterFindFirst, mockHistoryFindFirst, mockHistoryFindMany, mockMetricsFindFirst } = vi.hoisted(() => ({
  mockSitterFindFirst: vi.fn(),
  mockHistoryFindFirst: vi.fn(),
  mockHistoryFindMany: vi.fn(),
  mockMetricsFindFirst: vi.fn(),
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    sitter: { findFirst: mockSitterFindFirst },
    sitterTierHistory: { findFirst: mockHistoryFindFirst, findMany: mockHistoryFindMany },
    sitterMetricsWindow: { findFirst: mockMetricsFindFirst },
  },
}));

import { GET as getSummary } from '@/app/api/sitters/[id]/tier/summary/route';
import { GET as getDetails } from '@/app/api/sitters/[id]/tier/details/route';
import { getRequestContext } from '@/lib/request-context';

describe('sitter tier routes use real history fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
      sitterId: null,
      clientId: null,
    });
    mockSitterFindFirst.mockResolvedValue({ id: 's1' });
    mockHistoryFindFirst.mockResolvedValue({
      id: 'h1',
      tierId: 't1',
      tier: { name: 'Trusted' },
      periodStart: new Date('2026-01-01T00:00:00Z'),
      reason: 'great response times',
      metadata: null,
    });
    mockHistoryFindMany.mockResolvedValue([
      {
        id: 'h1',
        tier: { name: 'Trusted' },
        periodStart: new Date('2026-01-01T00:00:00Z'),
        reason: null,
        metadata: null,
      },
    ]);
    mockMetricsFindFirst.mockResolvedValue(null);
  });

  it('summary route orders by periodStart and returns tier relation name', async () => {
    const response = await getSummary(new Request('http://localhost') as any, {
      params: Promise.resolve({ id: 's1' }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.currentTier.name).toBe('Trusted');
    expect(mockHistoryFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { periodStart: 'desc' },
      })
    );
  });

  it('details route uses periodStart instead of assignedAt', async () => {
    const response = await getDetails(new Request('http://localhost') as any, {
      params: Promise.resolve({ id: 's1' }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.currentTier.assignedAt).toBeDefined();
    expect(body.history[0].tierName).toBe('Trusted');
    expect(mockHistoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { periodStart: 'desc' },
      })
    );
  });

  it('rejects sitter role for owner-only visibility', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'sitter',
      userId: 'u2',
      sitterId: 's1',
      clientId: null,
    });
    const response = await getSummary(new Request('http://localhost') as any, {
      params: Promise.resolve({ id: 's1' }),
    });
    expect(response.status).toBe(403);
  });
});
