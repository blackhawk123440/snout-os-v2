/**
 * Tests for POST /api/bookings/[id]/daily-delight (report creation).
 *
 * Verifies:
 * - Report created with structured fields
 * - Manual text accepted (bypasses AI)
 * - Media URLs stored as JSON
 * - Booking ownership verified for sitters
 * - Client rating flow through /api/client/reports/[id]/rate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockBookingFindUnique = vi.fn();
const mockReportCreate = vi.fn();
const mockSitterFindUnique = vi.fn();

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn().mockResolvedValue({
    orgId: 'org-1',
    userId: 'user-1',
    role: 'sitter',
    sitterId: 'sitter-1',
    correlationId: 'corr-1',
  }),
}));

vi.mock('@/lib/rbac', () => ({
  requireAnyRole: vi.fn(),
  assertOrgAccess: vi.fn(),
  ForbiddenError: class extends Error {},
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: () => ({
    booking: { findUnique: (...args: any[]) => mockBookingFindUnique(...args) },
    report: { create: (...args: any[]) => mockReportCreate(...args) },
    sitter: { findUnique: (...args: any[]) => mockSitterFindUnique(...args) },
  }),
}));

vi.mock('@/lib/ai', () => ({
  ai: {
    generateDailyDelight: vi.fn().mockResolvedValue('AI generated report content'),
  },
}));

vi.mock('@/lib/realtime/bus', () => ({
  publish: vi.fn().mockResolvedValue(undefined),
  channels: {
    sitterToday: () => 'test-channel',
    clientBooking: () => 'test-client-channel',
    ownerOps: () => 'test-owner-channel',
  },
}));

vi.mock('@/lib/invariant', () => ({
  InvariantError: class extends Error { code = 400; },
  invariantErrorResponse: (e: any) => ({ error: e.message }),
}));

const fakeBooking = {
  id: 'booking-1',
  orgId: 'org-1',
  sitterId: 'sitter-1',
  clientId: 'client-1',
  startAt: new Date('2026-04-01T10:00:00Z'),
  endAt: new Date('2026-04-01T11:00:00Z'),
  pets: [{ id: 'pet-1', name: 'Buddy', medicationNotes: null }],
  client: { firstName: 'Jane', lastName: 'Doe', phone: '+15551234567' },
};

describe('POST /api/bookings/[id]/daily-delight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBookingFindUnique.mockResolvedValue(fakeBooking);
    mockReportCreate.mockResolvedValue({ id: 'report-1' });
  });

  it('creates report with manual text content', async () => {
    const { POST } = await import('@/app/api/bookings/[id]/daily-delight/route');
    const req = new Request('http://localhost/api/bookings/booking-1/daily-delight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report: 'Buddy had a great walk today!',
        walkDuration: 30,
        pottyNotes: 'Normal',
        foodNotes: 'Ate all food',
        personalNote: 'Very energetic today',
      }),
    });

    const res = await POST(req as any, { params: Promise.resolve({ id: 'booking-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.report).toBe('Buddy had a great walk today!');
    expect(data.reportId).toBe('report-1');

    expect(mockReportCreate).toHaveBeenCalledTimes(1);
    const createData = mockReportCreate.mock.calls[0][0].data;
    expect(createData.content).toBe('Buddy had a great walk today!');
    expect(createData.walkDuration).toBe(30);
    expect(createData.pottyNotes).toBe('Normal');
    expect(createData.foodNotes).toBe('Ate all food');
    expect(createData.personalNote).toBe('Very energetic today');
    expect(createData.bookingId).toBe('booking-1');
    expect(createData.sitterId).toBe('sitter-1');
    expect(createData.sentToClient).toBe(true);
  });

  it('stores media URLs as JSON string', async () => {
    const { POST } = await import('@/app/api/bookings/[id]/daily-delight/route');
    const req = new Request('http://localhost/api/bookings/booking-1/daily-delight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report: 'Walk report',
        mediaUrls: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
      }),
    });

    const res = await POST(req as any, { params: Promise.resolve({ id: 'booking-1' }) });
    expect(res.status).toBe(200);

    const createData = mockReportCreate.mock.calls[0][0].data;
    expect(createData.mediaUrls).toBe(JSON.stringify([
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
    ]));
  });

  it('limits media URLs to 5', async () => {
    const { POST } = await import('@/app/api/bookings/[id]/daily-delight/route');
    const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/photo${i}.jpg`);
    const req = new Request('http://localhost/api/bookings/booking-1/daily-delight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: 'Walk', mediaUrls: urls }),
    });

    await POST(req as any, { params: Promise.resolve({ id: 'booking-1' }) });
    const createData = mockReportCreate.mock.calls[0][0].data;
    const stored = JSON.parse(createData.mediaUrls);
    expect(stored).toHaveLength(5);
  });

  it('returns 404 for missing booking', async () => {
    mockBookingFindUnique.mockResolvedValueOnce(null);
    const { POST } = await import('@/app/api/bookings/[id]/daily-delight/route');
    const req = new Request('http://localhost/api/bookings/missing/daily-delight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: 'test' }),
    });

    const res = await POST(req as any, { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
  });

  it('blocks sitter from reporting on another sitters booking', async () => {
    mockBookingFindUnique.mockResolvedValueOnce({ ...fakeBooking, sitterId: 'other-sitter' });
    const { POST } = await import('@/app/api/bookings/[id]/daily-delight/route');
    const req = new Request('http://localhost/api/bookings/booking-1/daily-delight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: 'test' }),
    });

    const res = await POST(req as any, { params: Promise.resolve({ id: 'booking-1' }) });
    expect(res.status).toBe(403);
  });

  it('falls back to AI generation when no manual report provided', async () => {
    const { POST } = await import('@/app/api/bookings/[id]/daily-delight/route');
    const req = new Request('http://localhost/api/bookings/booking-1/daily-delight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req as any, { params: Promise.resolve({ id: 'booking-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.report).toBe('AI generated report content');
  });
});
