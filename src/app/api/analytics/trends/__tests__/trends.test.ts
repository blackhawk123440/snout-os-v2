/**
 * Trend endpoints: revenue, bookings, payout-volume, automation-failures.
 * Range handling (7d/30d/90d), zero-data returns empty daily[] or valid shape,
 * owner allowed / sitter-client forbidden.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

const mockFindMany = vi.fn().mockResolvedValue([]);

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    stripeCharge: { findMany: mockFindMany },
    booking: { findMany: mockFindMany, count: vi.fn().mockResolvedValue(0) },
    eventLog: { findMany: mockFindMany },
    payoutTransfer: { findMany: mockFindMany },
    messageEvent: { findMany: mockFindMany },
  })),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    dailyOrgStats: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { getRequestContext } from '@/lib/request-context';
import { GET as getRevenue } from '@/app/api/analytics/trends/revenue/route';
import { GET as getBookings } from '@/app/api/analytics/trends/bookings/route';
import { GET as getPayoutVolume } from '@/app/api/analytics/trends/payout-volume/route';
import { GET as getAutomationFailures } from '@/app/api/analytics/trends/automation-failures/route';

const ownerCtx = { orgId: 'org-1', role: 'owner' as const, userId: 'u1', sitterId: null, clientId: null };
const sitterCtx = { orgId: 'org-1', role: 'sitter' as const, userId: 'u1', sitterId: 's1', clientId: null };

function nextRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe('GET /api/analytics/trends/revenue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue(ownerCtx);
    mockFindMany.mockResolvedValue([]);
  });

  it('returns 200 for owner with valid payload shape', async () => {
    const res = await getRevenue(nextRequest('/api/analytics/trends/revenue?range=30d'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('range');
    expect(body).toHaveProperty('periodStart');
    expect(body).toHaveProperty('periodEnd');
    expect(Array.isArray(body.daily)).toBe(true);
  });

  it('returns 403 for sitter', async () => {
    (getRequestContext as any).mockResolvedValue(sitterCtx);
    const res = await getRevenue(nextRequest('/api/analytics/trends/revenue?range=30d'));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('zero-data returns empty daily array', async () => {
    const res = await getRevenue(nextRequest('/api/analytics/trends/revenue?range=7d'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.daily).toEqual([]);
  });

  it('accepts range 7d, 30d, 90d', async () => {
    for (const r of ['7d', '30d', '90d']) {
      const res = await getRevenue(nextRequest(`/api/analytics/trends/revenue?range=${r}`));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.range).toBe(r);
    }
  });
});

describe('GET /api/analytics/trends/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue(ownerCtx);
    mockFindMany.mockResolvedValue([]);
  });

  it('returns 200 with valid payload shape', async () => {
    const res = await getBookings(nextRequest('/api/analytics/trends/bookings?range=30d'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('range');
    expect(Array.isArray(body.daily)).toBe(true);
  });

  it('zero-data returns empty daily array', async () => {
    const res = await getBookings(nextRequest('/api/analytics/trends/bookings?range=90d'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.daily).toEqual([]);
  });
});

describe('GET /api/analytics/trends/payout-volume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue(ownerCtx);
    mockFindMany.mockResolvedValue([]);
  });

  it('returns 200 with valid payload shape', async () => {
    const res = await getPayoutVolume(nextRequest('/api/analytics/trends/payout-volume?range=30d'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('range');
    expect(Array.isArray(body.daily)).toBe(true);
  });

  it('zero-data returns empty daily array', async () => {
    const res = await getPayoutVolume(nextRequest('/api/analytics/trends/payout-volume?range=7d'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.daily).toEqual([]);
  });
});

describe('GET /api/analytics/trends/automation-failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue(ownerCtx);
    mockFindMany.mockResolvedValue([]);
  });

  it('returns 200 with valid payload shape', async () => {
    const res = await getAutomationFailures(nextRequest('/api/analytics/trends/automation-failures?range=30d'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('range');
    expect(Array.isArray(body.daily)).toBe(true);
  });

  it('zero-data returns empty daily array', async () => {
    const res = await getAutomationFailures(nextRequest('/api/analytics/trends/automation-failures?range=90d'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.daily).toEqual([]);
  });
});
