/**
 * Stats endpoint correctness on seeded fixtures.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    booking: {
      count: vi.fn(),
    },
    stripeCharge: {
      aggregate: vi.fn(),
    },
    messageEvent: {
      count: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/ops/stats/route';
import { getRequestContext } from '@/lib/request-context';
import { prisma } from '@/lib/db';

describe('ops stats endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
    });
  });

  it('returns 403 when role is sitter', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'sitter',
      sitterId: 's1',
      userId: 'u1',
    });

    const response = await GET(new Request('http://localhost/api/ops/stats?range=7d'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns stats for owner with correct structure', async () => {
    (prisma as any).booking.count.mockResolvedValue(5);
    (prisma as any).stripeCharge.aggregate.mockResolvedValue({ _sum: { amount: 15000 } });
    (prisma as any).messageEvent.count.mockResolvedValue(12);

    const response = await GET(new Request('http://localhost/api/ops/stats?range=7d'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('bookingsCreated');
    expect(body).toHaveProperty('visitsCompleted');
    expect(body).toHaveProperty('revenue');
    expect(body).toHaveProperty('messagesSent');
    expect(body).toHaveProperty('trends');
    expect(body.revenue).toBe(150);
  });
});
