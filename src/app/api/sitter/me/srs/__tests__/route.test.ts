import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockSnapshotFindFirst, mockCompFindFirst } = vi.hoisted(() => ({
  mockSnapshotFindFirst: vi.fn(),
  mockCompFindFirst: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/sitter-helpers', () => ({
  getCurrentSitterId: vi.fn(),
}));

vi.mock('@/lib/tiers/srs-engine', () => ({
  calculateSRS: vi.fn(),
  calculateRolling26WeekScore: vi.fn(),
}));

vi.mock('@/lib/tiers/tier-rules', () => ({
  getTierPerks: vi.fn(() => ({ priority: true, multipliers: { holiday: 1 }, mentorship: false, reducedOversight: false })),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    messageThread: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    sitterTierSnapshot: { findFirst: mockSnapshotFindFirst },
    sitterCompensation: { findFirst: mockCompFindFirst },
    offerEvent: { findMany: vi.fn().mockResolvedValue([]) },
    report: { findMany: vi.fn().mockResolvedValue([]) },
    booking: { count: vi.fn().mockResolvedValue(0) },
  })),
}));

import { GET } from '@/app/api/sitter/me/srs/route';
import { auth } from '@/lib/auth';
import { getCurrentSitterId } from '@/lib/sitter-helpers';

describe('api/sitter/me/srs visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as any).mockResolvedValue({
      user: { role: 'sitter', orgId: 'org-1' },
    });
    (getCurrentSitterId as any).mockResolvedValue('sitter-1');
    mockSnapshotFindFirst.mockResolvedValue({
      tier: 'trusted',
      rolling30dScore: 88.2,
      provisional: false,
      atRisk: false,
      atRiskReason: null,
      rolling30dBreakdownJson: JSON.stringify({
        responsiveness: 18,
        acceptance: 10,
        completion: 8,
        timeliness: 17,
        accuracy: 18,
        engagement: 9,
        conduct: 9,
      }),
      visits30d: 22,
      rolling26wScore: 84.1,
    });
    mockCompFindFirst.mockResolvedValue(null);
  });

  it('returns sitter SRS payload for authenticated sitter', async () => {
    const response = await GET(new NextRequest('http://localhost/api/sitter/me/srs'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.tier).toBe('trusted');
    expect(body.score).toBe(88.2);
  });

  it('returns 401 when no session', async () => {
    (auth as any).mockResolvedValue(null);
    const response = await GET(new NextRequest('http://localhost/api/sitter/me/srs'));
    expect(response.status).toBe(401);
  });
});
