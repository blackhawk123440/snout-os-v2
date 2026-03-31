/**
 * GET /api/analytics/kpis — owner/admin allowed, sitter/client forbidden,
 * no-data returns valid zero/null-safe payload, trend deltas correctly shaped.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

const mockAggregate = vi.fn().mockResolvedValue({ _sum: { amount: 0 } });
const mockCount = vi.fn().mockResolvedValue(0);
const mockGroupBy = vi.fn().mockResolvedValue([]);
const mockFindMany = vi.fn().mockResolvedValue([]);

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    stripeCharge: { aggregate: mockAggregate, count: mockCount },
    booking: { count: mockCount, groupBy: mockGroupBy },
    eventLog: { count: mockCount },
    payoutTransfer: { aggregate: mockAggregate },
    messageResponseLink: { findMany: mockFindMany },
  })),
}));

import { GET } from '@/app/api/analytics/kpis/route';
import { getRequestContext } from '@/lib/request-context';

const ownerCtx = { orgId: 'org-1', role: 'owner' as const, userId: 'u1', sitterId: null, clientId: null };
const adminCtx = { orgId: 'org-1', role: 'admin' as const, userId: 'u1', sitterId: null, clientId: null };
const sitterCtx = { orgId: 'org-1', role: 'sitter' as const, userId: 'u1', sitterId: 's1', clientId: null };
const clientCtx = { orgId: 'org-1', role: 'client' as const, userId: 'u1', sitterId: null, clientId: 'c1' };

function setZeroMocks() {
  mockAggregate.mockResolvedValue({ _sum: { amount: 0 } });
  mockCount.mockResolvedValue(0);
  mockGroupBy.mockResolvedValue([]);
  mockFindMany.mockResolvedValue([]);
}

const CANONICAL_KPI_FIELDS = [
  'range',
  'periodStart',
  'periodEnd',
  'previousPeriodStart',
  'previousPeriodEnd',
  'revenueToday',
  'revenueWeek',
  'revenueMonth',
  'revenue',
  'bookingsToday',
  'bookingsWeek',
  'bookingsMonth',
  'bookings',
  'activeClients',
  'activeSitters',
  'utilization',
  'cancellationRate',
  'failedPaymentCount',
  'automationFailureCount',
  'payoutVolume',
  'averageBookingValue',
  'repeatBookingRate',
  'messageResponseLag',
];

const TREND_SHAPE = ['value', 'previousValue', 'deltaPercent', 'trend'];

describe('GET /api/analytics/kpis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue(ownerCtx);
    setZeroMocks();
  });

  it('returns 200 for owner with canonical fields', async () => {
    const res = await GET(new NextRequest('http://localhost/api/analytics/kpis?range=30d'));
    const body = await res.json();
    expect(res.status).toBe(200);
    for (const key of CANONICAL_KPI_FIELDS) {
      expect(body).toHaveProperty(key);
    }
  });

  it('returns 200 for admin', async () => {
    (getRequestContext as any).mockResolvedValue(adminCtx);
    const res = await GET(new NextRequest('http://localhost/api/analytics/kpis?range=7d'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.range).toBe('7d');
  });

  it('returns 403 for sitter', async () => {
    (getRequestContext as any).mockResolvedValue(sitterCtx);
    const res = await GET(new NextRequest('http://localhost/api/analytics/kpis?range=30d'));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 403 for client', async () => {
    (getRequestContext as any).mockResolvedValue(clientCtx);
    const res = await GET(new NextRequest('http://localhost/api/analytics/kpis?range=30d'));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 401 when getRequestContext throws', async () => {
    (getRequestContext as any).mockRejectedValue(new Error('Unauthorized'));
    const res = await GET(new NextRequest('http://localhost/api/analytics/kpis?range=30d'));
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('no-data range returns valid zero/null-safe payload', async () => {
    const res = await GET(new NextRequest('http://localhost/api/analytics/kpis?range=30d'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.revenueToday).toBe(0);
    expect(body.revenueWeek).toBe(0);
    expect(body.revenueMonth).toBe(0);
    expect(body.bookingsToday).toBe(0);
    expect(body.bookingsWeek).toBe(0);
    expect(body.bookingsMonth).toBe(0);
    expect(body.utilization).toBe(0);
    expect(body.messageResponseLag).toBeNull();
    expect(body.revenue).toMatchObject({ value: 0 });
    expect(body.bookings).toMatchObject({ value: 0 });
    expect(body.activeClients).toMatchObject({ value: 0 });
    expect(body.activeSitters).toMatchObject({ value: 0 });
    expect(body.failedPaymentCount).toMatchObject({ value: 0 });
    expect(body.automationFailureCount).toMatchObject({ value: 0 });
    expect(body.payoutVolume).toMatchObject({ value: 0 });
  });

  it('trend deltas are stable and correctly shaped', async () => {
    const res = await GET(new NextRequest('http://localhost/api/analytics/kpis?range=30d'));
    const body = await res.json();
    expect(res.status).toBe(200);
    for (const key of ['revenue', 'bookings', 'activeClients', 'activeSitters', 'cancellationRate', 'failedPaymentCount', 'automationFailureCount', 'payoutVolume', 'averageBookingValue', 'repeatBookingRate']) {
      const trend = body[key];
      expect(trend).toBeDefined();
      for (const prop of TREND_SHAPE) {
        expect(trend).toHaveProperty(prop);
      }
      expect(typeof trend.value).toBe('number');
      expect(['up', 'down', 'neutral']).toContain(trend.trend);
    }
  });

  it('parses range 7d, 30d, 90d, mtd', async () => {
    for (const r of ['7d', '30d', '90d', 'mtd']) {
      const res = await GET(new NextRequest(`http://localhost/api/analytics/kpis?range=${r}`));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.range).toBe(r);
    }
  });

  it('defaults to 30d when range missing or invalid', async () => {
    const res = await GET(new NextRequest('http://localhost/api/analytics/kpis'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.range).toBe('30d');
  });
});
