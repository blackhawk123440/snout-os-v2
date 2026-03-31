/**
 * Visit execution: Start visit (check-in) API
 * - Start visit updates checkedInAt / state
 * - Sitter can only start their own assigned booking
 * - GPS failure/absence does not block (optional body)
 * - Role boundaries: requires sitter, 403 for wrong sitter
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBookingFindFirst = vi.fn();
const mockBookingUpdate = vi.fn();
const mockBookingFindUnique = vi.fn();
const mockVisitEventFindFirst = vi.fn();
const mockVisitEventUpdate = vi.fn();
const mockVisitEventCreate = vi.fn();
const mockEventLogCreate = vi.fn();

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: () => ({
    booking: {
      findFirst: mockBookingFindFirst,
      update: mockBookingUpdate,
      findUnique: mockBookingFindUnique,
    },
    visitEvent: {
      findFirst: mockVisitEventFindFirst,
      update: mockVisitEventUpdate,
      create: mockVisitEventCreate,
    },
    eventLog: { create: mockEventLogCreate },
    bookingStatusHistory: {
      create: vi.fn().mockResolvedValue({ id: 'test-history-id' }),
    },
    pet: { findMany: vi.fn().mockResolvedValue([]) },
  }),
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock('@/lib/event-emitter', () => ({
  emitSitterCheckedIn: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/realtime/bus', () => ({
  publish: vi.fn().mockResolvedValue(undefined),
  channels: { sitterToday: (orgId: string, sitterId: string) => `sitter-today:${orgId}:${sitterId}` },
}));

import { POST } from '@/app/api/bookings/[id]/check-in/route';
import { getRequestContext } from '@/lib/request-context';
import * as rbac from '@/lib/rbac';

describe('POST /api/bookings/[id]/check-in (Start visit)', () => {
  const sitterCtx = {
    orgId: 'org-1',
    role: 'sitter',
    userId: 'u1',
    sitterId: 's1',
    clientId: null,
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockResolvedValue(sitterCtx);
    vi.mocked(rbac.requireRole).mockReturnValue(undefined);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getRequestContext).mockRejectedValueOnce(new Error('no session'));
    const res = await POST(new Request('http://localhost/api/bookings/b1/check-in', { method: 'POST' }), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(401);
    expect(mockBookingFindFirst).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not sitter', async () => {
    vi.mocked(rbac.requireRole).mockImplementationOnce(() => {
      throw new rbac.ForbiddenError('Forbidden');
    });
    const res = await POST(new Request('http://localhost/api/bookings/b1/check-in', { method: 'POST' }), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(403);
    expect(mockBookingFindFirst).not.toHaveBeenCalled();
  });

  it('returns 403 when sitterId missing on session', async () => {
    vi.mocked(getRequestContext).mockResolvedValueOnce({ ...sitterCtx, sitterId: null } as never);
    const res = await POST(new Request('http://localhost/api/bookings/b1/check-in', { method: 'POST' }), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(403);
    expect(mockBookingFindFirst).not.toHaveBeenCalled();
  });

  it('returns 404 when booking not found or not assigned to sitter', async () => {
    mockBookingFindFirst.mockResolvedValueOnce(null);
    const res = await POST(new Request('http://localhost/api/bookings/b1/check-in', { method: 'POST' }), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Booking not found');
    expect(mockBookingFindFirst).toHaveBeenCalledWith({ where: { id: 'b1', sitterId: 's1' } });
  });

  it('returns 400 when booking status is not pending or confirmed', async () => {
    mockBookingFindFirst.mockResolvedValueOnce({
      id: 'b1',
      orgId: 'org-1',
      sitterId: 's1',
      clientId: 'c1',
      status: 'in_progress',
      startAt: new Date(),
      endAt: new Date(),
    });
    const res = await POST(new Request('http://localhost/api/bookings/b1/check-in', { method: 'POST' }), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Cannot check in');
    expect(mockBookingUpdate).not.toHaveBeenCalled();
  });

  it('updates booking and visit event on success (no GPS)', async () => {
    mockBookingFindFirst.mockResolvedValueOnce({
      id: 'b1',
      orgId: 'org-1',
      sitterId: 's1',
      clientId: 'c1',
      status: 'confirmed',
      startAt: new Date('2026-03-04T10:00:00Z'),
      endAt: new Date('2026-03-04T11:00:00Z'),
    });
    mockVisitEventFindFirst.mockResolvedValueOnce(null);
    mockVisitEventCreate.mockResolvedValueOnce({ id: 've1' });
    mockBookingFindUnique.mockResolvedValueOnce({
      id: 'b1',
      orgId: 'org-1',
      sitterId: 's1',
      sitter: { id: 's1' },
    });

    const res = await POST(
      new Request('http://localhost/api/bookings/b1/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: 'b1' }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe('in_progress');

    expect(mockBookingUpdate).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { status: 'in_progress' },
    });
    expect(mockVisitEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: 'org-1',
        sitterId: 's1',
        clientId: 'c1',
        bookingId: 'b1',
        status: 'in_progress',
      }),
    });
    expect(mockEventLogCreate).not.toHaveBeenCalled();
  });

  it('records GPS in eventLog when lat/lng provided', async () => {
    mockBookingFindFirst.mockResolvedValueOnce({
      id: 'b1',
      orgId: 'org-1',
      sitterId: 's1',
      clientId: 'c1',
      status: 'confirmed',
      startAt: new Date(),
      endAt: new Date(),
    });
    mockVisitEventFindFirst.mockResolvedValueOnce(null);
    mockVisitEventCreate.mockResolvedValueOnce({ id: 've1' });
    mockBookingFindUnique.mockResolvedValueOnce({ id: 'b1', sitterId: 's1', orgId: 'org-1', sitter: { id: 's1' } });

    const res = await POST(
      new Request('http://localhost/api/bookings/b1/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 37.77, lng: -122.42 }),
      }),
      { params: Promise.resolve({ id: 'b1' }) }
    );

    expect(res.status).toBe(200);
    expect(mockEventLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'sitter.check_in',
        status: 'success',
        bookingId: 'b1',
        metadata: expect.stringContaining('37.77'),
      }),
    });
  });
});
