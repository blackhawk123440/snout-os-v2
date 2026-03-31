import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetRequestContext = vi.fn();
vi.mock('@/lib/request-context', () => ({
  getRequestContext: (...args: unknown[]) => mockGetRequestContext(...args),
}));

// Real rbac so requireRole/requireClientContext actually enforce
const { ForbiddenError: RealForbiddenError } = await import('@/lib/rbac');
vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return actual;
});

// Scoped DB mock — returns a mock db whose model methods we control per test
const mockDb: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
function mockModel(name: string, methods: string[]) {
  mockDb[name] = {};
  for (const m of methods) {
    mockDb[name][m] = vi.fn();
  }
}
mockModel('client', ['findFirst']);
mockModel('pet', ['findFirst', 'findMany', 'update']);
mockModel('clientEmergencyContact', ['findFirst', 'findMany', 'delete']);
mockModel('booking', ['findFirst', 'update']);
mockModel('bookingStatusHistory', ['create']);

const mockTransaction = vi.fn();

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => {
    const proxy: Record<string, unknown> = { $transaction: mockTransaction };
    for (const [model, fns] of Object.entries(mockDb)) {
      proxy[model] = fns;
    }
    return proxy;
  }),
}));

vi.mock('@/lib/log-event', () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/notifications/triggers', () => ({
  notifySitterBookingCancelled: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: { refunds: { create: vi.fn() } },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { GET as getMe } from '@/app/api/client/me/route';
import { GET as getPets } from '@/app/api/client/pets/route';
import { PATCH as patchPet } from '@/app/api/client/pets/[id]/route';
import { DELETE as deleteContact } from '@/app/api/client/emergency-contacts/[id]/route';
import { POST as cancelBooking } from '@/app/api/client/bookings/[id]/cancel/route';

// ── Helpers ────────────────────────────────────────────────────────────────

const CLIENT_CTX = {
  orgId: 'org-1',
  role: 'client',
  userId: 'user-1',
  clientId: 'client-1',
  sitterId: null,
};

const SITTER_CTX = {
  orgId: 'org-1',
  role: 'sitter',
  userId: 'user-2',
  sitterId: 'sitter-1',
  clientId: null,
};

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(url = 'http://localhost', init?: RequestInit) {
  return new NextRequest(url, init);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Client API org isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: transaction executes the callback with the same mock db
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const txProxy: Record<string, unknown> = {};
      for (const [model, fns] of Object.entries(mockDb)) {
        txProxy[model] = fns;
      }
      return fn(txProxy);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // GET /api/client/me
  // ────────────────────────────────────────────────────────────────────────

  describe('GET /api/client/me', () => {
    it('returns 401 when no session', async () => {
      mockGetRequestContext.mockRejectedValue(new Error('No session'));

      const res = await getMe();
      expect(res.status).toBe(401);
    });

    it('returns 403 when role is sitter', async () => {
      mockGetRequestContext.mockResolvedValue(SITTER_CTX);

      const res = await getMe();
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'Forbidden' });
    });

    it('returns client data scoped to authenticated clientId', async () => {
      mockGetRequestContext.mockResolvedValue(CLIENT_CTX);
      mockDb.client.findFirst.mockResolvedValue({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '555-1234',
        address: null,
        keyLocation: null,
        lockboxCode: null,
        doorAlarmCode: null,
        wifiNetwork: null,
        wifiPassword: null,
        entryInstructions: null,
        parkingNotes: null,
      });

      const res = await getMe();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.name).toBe('Jane Doe');
      expect(body.email).toBe('jane@example.com');

      // Verify the query was scoped to the client's ID
      expect(mockDb.client.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'client-1' },
        })
      );
    });

    it('returns 404 when client record does not exist', async () => {
      mockGetRequestContext.mockResolvedValue(CLIENT_CTX);
      mockDb.client.findFirst.mockResolvedValue(null);

      const res = await getMe();
      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // GET /api/client/pets
  // ────────────────────────────────────────────────────────────────────────

  describe('GET /api/client/pets', () => {
    it('returns 401 when no session', async () => {
      mockGetRequestContext.mockRejectedValue(new Error('No session'));

      const res = await getPets();
      expect(res.status).toBe(401);
    });

    it('returns 403 when role is sitter', async () => {
      mockGetRequestContext.mockResolvedValue(SITTER_CTX);

      const res = await getPets();
      expect(res.status).toBe(403);
    });

    it('returns pets scoped to authenticated clientId', async () => {
      mockGetRequestContext.mockResolvedValue(CLIENT_CTX);
      mockDb.pet.findMany.mockResolvedValue([
        { id: 'pet-1', name: 'Luna', species: 'Dog', breed: 'Lab', weight: 30, photoUrl: null, updatedAt: new Date() },
      ]);

      const res = await getPets();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.pets).toHaveLength(1);
      expect(body.pets[0].name).toBe('Luna');

      // Verify query filters by clientId
      expect(mockDb.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: 'client-1', isActive: true },
        })
      );
    });

    it('returns empty array when client has no pets', async () => {
      mockGetRequestContext.mockResolvedValue(CLIENT_CTX);
      mockDb.pet.findMany.mockResolvedValue([]);

      const res = await getPets();
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.pets).toEqual([]);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // PATCH /api/client/pets/[id]
  // ────────────────────────────────────────────────────────────────────────

  describe('PATCH /api/client/pets/[id]', () => {
    it('returns 401 when no session', async () => {
      mockGetRequestContext.mockRejectedValue(new Error('No session'));

      const res = await patchPet(
        makeRequest('http://localhost', {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Rex' }),
        }),
        makeParams('pet-1')
      );
      expect(res.status).toBe(401);
    });

    it('returns 403 when role is sitter', async () => {
      mockGetRequestContext.mockResolvedValue(SITTER_CTX);

      const res = await patchPet(
        makeRequest('http://localhost', {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Rex' }),
        }),
        makeParams('pet-1')
      );
      expect(res.status).toBe(403);
    });

    it('returns 404 when pet belongs to another client', async () => {
      mockGetRequestContext.mockResolvedValue(CLIENT_CTX);

      // Transaction callback: findFirst returns null (pet not owned by this client)
      mockDb.pet.findFirst.mockResolvedValue(null);

      const res = await patchPet(
        makeRequest('http://localhost', {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Rex' }),
        }),
        makeParams('pet-other-client')
      );
      expect(res.status).toBe(404);

      // Verify the ownership check used the correct clientId
      expect(mockDb.pet.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pet-other-client', clientId: 'client-1' },
        })
      );
    });

    it('updates pet when owned by authenticated client', async () => {
      mockGetRequestContext.mockResolvedValue(CLIENT_CTX);
      mockDb.pet.findFirst.mockResolvedValue({ id: 'pet-1' });
      mockDb.pet.update.mockResolvedValue({
        id: 'pet-1',
        name: 'Rex',
        species: 'Dog',
        breed: 'Lab',
      });

      const res = await patchPet(
        makeRequest('http://localhost', {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Rex' }),
        }),
        makeParams('pet-1')
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('Rex');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // DELETE /api/client/emergency-contacts/[id]
  // ────────────────────────────────────────────────────────────────────────

  describe('DELETE /api/client/emergency-contacts/[id]', () => {
    it('returns 401 when no session', async () => {
      mockGetRequestContext.mockRejectedValue(new Error('No session'));

      const res = await deleteContact(
        makeRequest('http://localhost', { method: 'DELETE' }),
        makeParams('contact-1')
      );
      expect(res.status).toBe(401);
    });

    it('returns 403 when role is sitter', async () => {
      mockGetRequestContext.mockResolvedValue(SITTER_CTX);

      const res = await deleteContact(
        makeRequest('http://localhost', { method: 'DELETE' }),
        makeParams('contact-1')
      );
      expect(res.status).toBe(403);
    });

    it('returns 404 when contact belongs to another client', async () => {
      mockGetRequestContext.mockResolvedValue(CLIENT_CTX);
      mockDb.clientEmergencyContact.findFirst.mockResolvedValue(null);

      const res = await deleteContact(
        makeRequest('http://localhost', { method: 'DELETE' }),
        makeParams('contact-other')
      );
      expect(res.status).toBe(404);

      expect(mockDb.clientEmergencyContact.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'contact-other', clientId: 'client-1' },
        })
      );
    });

    it('deletes contact when owned by authenticated client', async () => {
      mockGetRequestContext.mockResolvedValue(CLIENT_CTX);
      mockDb.clientEmergencyContact.findFirst.mockResolvedValue({ id: 'contact-1', clientId: 'client-1' });
      mockDb.clientEmergencyContact.delete.mockResolvedValue({});

      const res = await deleteContact(
        makeRequest('http://localhost', { method: 'DELETE' }),
        makeParams('contact-1')
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // POST /api/client/bookings/[id]/cancel
  // ────────────────────────────────────────────────────────────────────────

  describe('POST /api/client/bookings/[id]/cancel', () => {
    it('returns 401 when no session', async () => {
      mockGetRequestContext.mockRejectedValue(new Error('No session'));

      const res = await cancelBooking(
        makeRequest('http://localhost', { method: 'POST' }),
        makeParams('booking-1')
      );
      expect(res.status).toBe(401);
    });

    it('returns 403 when role is sitter', async () => {
      mockGetRequestContext.mockResolvedValue(SITTER_CTX);

      const res = await cancelBooking(
        makeRequest('http://localhost', { method: 'POST' }),
        makeParams('booking-1')
      );
      expect(res.status).toBe(403);
    });

    it('returns 404 when booking belongs to another client', async () => {
      mockGetRequestContext.mockResolvedValue(CLIENT_CTX);

      // Transaction: findFirst returns null
      mockDb.booking.findFirst.mockResolvedValue(null);

      const res = await cancelBooking(
        makeRequest('http://localhost', { method: 'POST' }),
        makeParams('booking-other')
      );
      expect(res.status).toBe(404);

      expect(mockDb.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'booking-other', clientId: 'client-1' },
        })
      );
    });

    it('cancels booking when owned by authenticated client', async () => {
      mockGetRequestContext.mockResolvedValue(CLIENT_CTX);

      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h from now
      mockDb.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: 'confirmed',
        startAt: futureDate,
        sitterId: null,
        firstName: 'Jane',
        lastName: 'Doe',
        service: 'dog_walking',
        paymentStatus: 'unpaid',
      });
      mockDb.booking.update.mockResolvedValue({});
      mockDb.bookingStatusHistory.create.mockResolvedValue({});

      const res = await cancelBooking(
        makeRequest('http://localhost', { method: 'POST' }),
        makeParams('booking-1')
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.within24h).toBe(false);
    });

    it('returns 400 when trying to cancel a completed booking', async () => {
      mockGetRequestContext.mockResolvedValue(CLIENT_CTX);

      mockDb.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: 'completed',
        startAt: new Date(),
        sitterId: null,
        firstName: 'Jane',
        lastName: 'Doe',
        service: 'dog_walking',
        paymentStatus: 'paid',
      });

      // Transaction returns the error object from the route logic
      mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const txProxy: Record<string, unknown> = {};
        for (const [model, fns] of Object.entries(mockDb)) {
          txProxy[model] = fns;
        }
        return fn(txProxy);
      });

      const res = await cancelBooking(
        makeRequest('http://localhost', { method: 'POST' }),
        makeParams('booking-1')
      );
      expect(res.status).toBe(400);
    });
  });
});
