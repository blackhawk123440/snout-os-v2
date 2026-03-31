import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBookingFindFirst = vi.fn();
const mockThreadFindFirst = vi.fn();
const mockVisitEventFindFirst = vi.fn();
const mockReportFindFirst = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    booking: { findFirst: (...args: unknown[]) => mockBookingFindFirst(...args) },
    messageThread: { findFirst: (...args: unknown[]) => mockThreadFindFirst(...args) },
    visitEvent: { findFirst: (...args: unknown[]) => mockVisitEventFindFirst(...args) },
    report: { findFirst: (...args: unknown[]) => mockReportFindFirst(...args) },
  },
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock('@/lib/org-scope', () => ({
  whereOrg: (_orgId: string, where: unknown) => where,
}));

import { GET } from '@/app/api/sitter/bookings/[id]/route';
import { getRequestContext } from '@/lib/request-context';

describe('GET /api/sitter/bookings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: 'org-1',
      role: 'sitter',
      userId: 'u1',
      sitterId: 's1',
      clientId: null,
    } as never);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getRequestContext).mockRejectedValueOnce(new Error('no session'));
    const res = await GET(new Request('http://localhost/api/sitter/bookings/b1'), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when sitter tries another sitter booking', async () => {
    mockBookingFindFirst.mockResolvedValueOnce({
      id: 'b1',
      orgId: 'org-1',
      sitterId: 's2',
    });
    const res = await GET(new Request('http://localhost/api/sitter/bookings/b1'), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(403);
  });

  it('handles missing optional fields without crashing', async () => {
    mockBookingFindFirst.mockResolvedValueOnce({
      id: 'b1',
      orgId: 'org-1',
      sitterId: 's1',
      status: 'confirmed',
      service: 'Walk',
      startAt: new Date('2026-03-04T10:00:00.000Z'),
      endAt: new Date('2026-03-04T11:00:00.000Z'),
      updatedAt: new Date('2026-03-04T09:00:00.000Z'),
      address: null,
      pickupAddress: null,
      dropoffAddress: null,
      entryInstructions: null,
      doorCode: null,
      notes: null,
      totalPrice: 30,
      pets: [],
      client: null,
      checklistItems: [],
    });
    mockThreadFindFirst.mockResolvedValueOnce(null);
    mockVisitEventFindFirst.mockResolvedValueOnce(null);
    mockReportFindFirst.mockResolvedValueOnce(null);

    const res = await GET(new Request('http://localhost/api/sitter/bookings/b1'), {
      params: Promise.resolve({ id: 'b1' }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.addressParts).toEqual({
      line1: null,
      line2: null,
      city: null,
      state: null,
      zip: null,
      full: null,
    });
    expect(body.emergencyContact).toBeNull();
    expect(body.client).toEqual({
      firstName: undefined,
      lastName: undefined,
      phone: undefined,
      email: undefined,
      notes: null,
    });
    expect(Array.isArray(body.checklist)).toBe(true);
    expect(body.checklist).toHaveLength(6);
  });
});
