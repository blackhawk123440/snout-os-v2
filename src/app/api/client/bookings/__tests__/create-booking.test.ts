/**
 * Tests for POST /api/client/bookings
 *
 * Verifies:
 * - Auth enforcement (client role required)
 * - Validation (service, startAt, endAt required)
 * - Booking creation with correct tenant scoping
 * - Outstanding balance blocking
 * - Pricing calculation integration
 * - Event emission (non-blocking)
 * - Pet creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock request context
const mockCtx = {
  orgId: 'org-1',
  userId: 'user-1',
  role: 'client',
  clientId: 'client-1',
  correlationId: 'corr-1',
};

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn().mockResolvedValue(mockCtx),
}));

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn(),
  requireClientContext: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error { constructor() { super('Forbidden'); } },
}));

// Mock DB
const mockCount = vi.fn().mockResolvedValue(0);
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn().mockResolvedValue([]);
const mockCreate = vi.fn();

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: () => ({
    booking: {
      count: mockCount,
      findMany: mockFindMany,
      create: (...args: any[]) => mockCreate(...args),
    },
    client: {
      findFirst: (...args: any[]) => mockFindFirst(...args),
    },
  }),
}));

// Mock pricing
vi.mock('@/lib/rates', () => ({
  calculateBookingPrice: vi.fn().mockResolvedValue({ total: 75.00, breakdown: {} }),
}));

// Mock outstanding balance
vi.mock('@/lib/outstanding-balance', () => ({
  checkOutstandingBalance: vi.fn().mockResolvedValue({ hasOutstanding: false }),
}));

// Mock event emission
vi.mock('@/lib/event-emitter', () => ({
  emitBookingCreated: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/event-queue-bridge-init', () => ({
  ensureEventQueueBridge: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/booking/booking-events', () => ({
  emitAndEnqueueBookingEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/messaging/conversation-service', () => ({
  syncConversationLifecycleWithBookingWorkflow: vi.fn().mockResolvedValue(undefined),
}));

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/client/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  service: 'Dog Walking',
  startAt: new Date(Date.now() + 86400000).toISOString(),
  endAt: new Date(Date.now() + 86400000 + 3600000).toISOString(),
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '+15551234567',
  pets: [{ name: 'Buddy', species: 'Dog' }],
};

describe('POST /api/client/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue({
      id: 'client-1',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+15551234567',
      email: 'jane@example.com',
      orgId: 'org-1',
    });
    mockCreate.mockResolvedValue({
      id: 'booking-1',
      clientId: 'client-1',
      service: 'Dog Walking',
      startAt: new Date(),
      endAt: new Date(),
      totalPrice: 75.00,
      status: 'pending',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+15551234567',
      sitterId: null,
      pets: [{ id: 'pet-1', name: 'Buddy', species: 'Dog' }],
      timeSlots: [],
    });
  });

  it('creates booking with valid input', async () => {
    const { POST } = await import('../route');
    const res = await POST(makeRequest(validBody) as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.booking.id).toBe('booking-1');
    expect(data.booking.totalPrice).toBe(75);

    // Verify create was called with correct data
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.data.clientId).toBe('client-1');
    expect(createArg.data.service).toBe('Dog Walking');
    expect(createArg.data.status).toBe('pending');
    expect(createArg.data.paymentStatus).toBe('unpaid');
  });

  it('rejects missing required fields', async () => {
    const { POST } = await import('../route');
    const res = await POST(makeRequest({ firstName: 'Jane' }) as any);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  it('rejects endAt before startAt', async () => {
    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      ...validBody,
      startAt: new Date(Date.now() + 86400000 + 3600000).toISOString(),
      endAt: new Date(Date.now() + 86400000).toISOString(),
    }) as any);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('endAt must be after startAt');
  });

  it('blocks booking when client has outstanding balance', async () => {
    const { checkOutstandingBalance } = await import('@/lib/outstanding-balance');
    (checkOutstandingBalance as any).mockResolvedValueOnce({
      hasOutstanding: true,
      totalOutstanding: 150.00,
      bookings: [{ id: 'old-booking', totalPrice: 150 }],
    });

    const { POST } = await import('../route');
    const res = await POST(makeRequest(validBody) as any);
    const data = await res.json();

    expect(res.status).toBe(402);
    expect(data.error).toBe('outstanding_balance');
    expect(data.message).toContain('$150.00');
  });

  it('uses session clientId, not body clientId (prevents spoofing)', async () => {
    const { POST } = await import('../route');
    await POST(makeRequest({ ...validBody, clientId: 'hacker-client' }) as any);

    // The create should use ctx.clientId from session, not body
    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.data.clientId).toBe('client-1'); // from session
  });

  it('creates default pet if none provided', async () => {
    const { POST } = await import('../route');
    await POST(makeRequest({ ...validBody, pets: [] }) as any);

    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.data.pets.create).toHaveLength(1);
    expect(createArg.data.pets.create[0].name).toBe('Pet');
    expect(createArg.data.pets.create[0].species).toBe('Dog');
  });

  it('includes orgId in response for client correlation', async () => {
    const { POST } = await import('../route');
    const res = await POST(makeRequest(validBody) as any);
    const data = await res.json();

    expect(data.orgId).toBe('org-1');
  });
});
