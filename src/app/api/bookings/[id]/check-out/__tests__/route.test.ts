/**
 * Visit execution: End visit (check-out) API
 * - End visit updates checkedOutAt / state
 * - Sitter can only end their own in-progress booking
 * - GPS optional; absence does not block
 * - Role boundaries: requires sitter
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBookingFindFirst = vi.fn();
const mockBookingUpdate = vi.fn();
const mockBookingFindUnique = vi.fn();
const mockVisitEventFindFirst = vi.fn();
const mockVisitEventUpdate = vi.fn();
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
    },
    eventLog: { create: mockEventLogCreate },
    bookingStatusHistory: {
      create: vi.fn().mockResolvedValue({ id: 'test-history-id' }),
    },
    pet: { findMany: vi.fn().mockResolvedValue([]) },
    sitterEarning: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    loyaltyReward: { findFirst: vi.fn().mockResolvedValue(null) },
    client: { findFirst: vi.fn().mockResolvedValue(null) },
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
  emitVisitCompleted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/event-queue-bridge-init', () => ({
  ensureEventQueueBridge: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/realtime/bus', () => ({
  publish: vi.fn().mockResolvedValue(undefined),
  channels: {
    sitterToday: (orgId: string, sitterId: string) => `sitter-today:${orgId}:${sitterId}`,
    clientBooking: (orgId: string, clientId: string) => `client-booking:${orgId}:${clientId}`,
    ownerOps: (orgId: string) => `owner-ops:${orgId}`,
  },
}));

vi.mock('@/lib/messaging/conversation-service', () => ({
  syncConversationLifecycleWithBookingWorkflow: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/messaging/lifecycle-client-copy', () => ({
  emitClientLifecycleNoticeIfNeeded: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/payout/payout-engine', () => ({
  calculatePayoutForBooking: vi.fn().mockReturnValue({ amountCents: 0, platformFeeCents: 0 }),
  executePayout: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/payout/payout-queue', () => ({
  persistPayrollRunFromTransfer: vi.fn().mockResolvedValue({}),
}));

import { POST } from '@/app/api/bookings/[id]/check-out/route';
import { getRequestContext } from '@/lib/request-context';
import { requireRole } from '@/lib/rbac';

describe('POST /api/bookings/[id]/check-out (End visit)', () => {
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
    vi.mocked(requireRole).mockReturnValue(undefined);
  });

  it('returns 403 when sitterId missing', async () => {
    vi.mocked(getRequestContext).mockResolvedValueOnce({ ...sitterCtx, sitterId: null } as never);
    const res = await POST(new Request('http://localhost/api/bookings/b1/check-out', { method: 'POST' }), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(403);
    expect(mockBookingFindFirst).not.toHaveBeenCalled();
  });

  it('returns 404 when booking not found or not assigned to sitter', async () => {
    mockBookingFindFirst.mockResolvedValueOnce(null);
    const res = await POST(new Request('http://localhost/api/bookings/b1/check-out', { method: 'POST' }), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Booking not found');
  });

  it('returns 400 when booking is not in_progress', async () => {
    mockBookingFindFirst.mockResolvedValueOnce({
      id: 'b1',
      orgId: 'org-1',
      sitterId: 's1',
      status: 'confirmed',
    });
    const res = await POST(new Request('http://localhost/api/bookings/b1/check-out', { method: 'POST' }), {
      params: Promise.resolve({ id: 'b1' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Cannot check out');
    expect(mockBookingUpdate).not.toHaveBeenCalled();
  });

  it('updates booking and visit event on success (no GPS)', async () => {
    mockBookingFindFirst.mockResolvedValueOnce({
      id: 'b1',
      orgId: 'org-1',
      sitterId: 's1',
      status: 'in_progress',
    });
    mockVisitEventFindFirst.mockResolvedValueOnce({ id: 've1' });
    mockVisitEventUpdate.mockResolvedValueOnce(undefined);
    mockBookingFindUnique.mockResolvedValueOnce({
      id: 'b1',
      orgId: 'org-1',
      sitterId: 's1',
      sitter: { id: 's1' },
      pets: [],
    });

    const res = await POST(
      new Request('http://localhost/api/bookings/b1/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: 'b1' }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe('completed');

    expect(mockBookingUpdate).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { status: 'completed' },
    });
    expect(mockVisitEventUpdate).toHaveBeenCalledWith({
      where: { id: 've1' },
      data: expect.objectContaining({
        checkOutAt: expect.any(Date),
        status: 'completed',
      }),
    });
    expect(mockEventLogCreate).not.toHaveBeenCalled();
  });

  it('records GPS in eventLog when lat/lng provided', async () => {
    mockBookingFindFirst.mockResolvedValueOnce({
      id: 'b1',
      orgId: 'org-1',
      sitterId: 's1',
      status: 'in_progress',
    });
    mockVisitEventFindFirst.mockResolvedValueOnce({ id: 've1' });
    mockVisitEventUpdate.mockResolvedValueOnce(undefined);
    mockBookingFindUnique.mockResolvedValueOnce({ id: 'b1', sitterId: 's1', orgId: 'org-1' });

    await POST(
      new Request('http://localhost/api/bookings/b1/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 37.77, lng: -122.42 }),
      }),
      { params: Promise.resolve({ id: 'b1' }) }
    );

    expect(mockEventLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'sitter.check_out',
        status: 'success',
        bookingId: 'b1',
        metadata: expect.stringContaining('37.77'),
      }),
    });
  });
});
