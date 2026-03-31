/**
 * Calendar sync engine tests.
 * Mocks Google Calendar API; verifies upsert, checksum idempotency, delete, repair.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('googleapis', () => {
  const insert = vi.fn();
  const patch = vi.fn();
  const del = vi.fn();
  const refreshToken = vi.fn().mockResolvedValue({ credentials: { access_token: 'tok' } });
  (globalThis as any).__calendarMocks = { insert, patch, delete: del };
  class MockOAuth2 {
    setCredentials = vi.fn();
    refreshAccessToken = refreshToken;
  }
  return {
    google: {
      calendar: vi.fn(() => ({
        events: { insert, patch, delete: del },
      })),
      auth: {
        OAuth2: MockOAuth2,
      },
    },
  };
});

// Must set before importing sync (getOAuth2Client reads env)
beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  vi.clearAllMocks();
  const mocks = (globalThis as any).__calendarMocks;
  if (mocks) {
    mocks.insert.mockResolvedValue({ data: { id: 'google-event-123' } });
    mocks.patch.mockResolvedValue({});
    mocks.delete.mockResolvedValue({});
  }
});

import { upsertEventForBooking, deleteEventForBooking } from '@/lib/calendar/sync';

function getMocks() {
  return (globalThis as any).__calendarMocks ?? { insert: vi.fn(), patch: vi.fn(), delete: vi.fn() };
}

const ORG_ID = 'org-1';
const BOOKING_ID = 'b1';
const SITTER_ID = 's1';

function createMockDb(overrides: Record<string, unknown> = {}) {
  const booking = {
    id: BOOKING_ID,
    orgId: ORG_ID,
    sitterId: SITTER_ID,
    startAt: new Date('2025-03-01T10:00:00Z'),
    endAt: new Date('2025-03-01T11:00:00Z'),
    service: 'Dog Walking',
    firstName: 'Jane',
    lastName: 'Doe',
    notes: null,
    client: { firstName: 'Jane', lastName: 'Doe' },
    pets: [{ name: 'Max' }],
    sitter: {
      id: SITTER_ID,
      firstName: 'Sarah',
      lastName: 'Sitter',
      googleRefreshToken: 'refresh-tok',
      calendarSyncEnabled: true,
      googleCalendarId: 'primary',
    },
  };

  const defaultMocks = {
    booking: {
      findUnique: vi.fn().mockResolvedValue(booking),
    },
    bookingCalendarEvent: {
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    sitter: {
      findUnique: vi.fn().mockResolvedValue({
        googleRefreshToken: 'refresh-tok',
        googleCalendarId: 'primary',
      }),
    },
  };

  return { ...defaultMocks, ...overrides } as any;
}

describe('calendar sync', () => {
  describe('upsertEventForBooking', () => {
    it('creates event when no mapping exists', async () => {
      const db = createMockDb();
      const result = await upsertEventForBooking(db, BOOKING_ID, ORG_ID);

      expect(result.action).toBe('created');
      expect(result.googleEventId).toBe('google-event-123');
      expect(getMocks().insert).toHaveBeenCalledTimes(1);
      expect(getMocks().patch).not.toHaveBeenCalled();
      expect(db.bookingCalendarEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            orgId: ORG_ID,
            bookingId: BOOKING_ID,
            sitterId: SITTER_ID,
            googleCalendarEventId: 'google-event-123',
            payloadChecksum: expect.any(String),
          }),
        })
      );
    });

    it('skips update when checksum unchanged (idempotency)', async () => {
      const db = createMockDb();
      let callCount = 0;
      db.bookingCalendarEvent.findFirst.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return null;
        const firstChecksum = (db.bookingCalendarEvent.upsert as any).mock?.calls?.[0]?.[0]?.create?.payloadChecksum;
        return firstChecksum
          ? { googleCalendarEventId: 'google-event-123', payloadChecksum: firstChecksum }
          : { googleCalendarEventId: 'google-event-123', payloadChecksum: 'fallback' };
      });
      const r1 = await upsertEventForBooking(db, BOOKING_ID, ORG_ID);
      expect(r1.action).toBe('created');
      const r2 = await upsertEventForBooking(db, BOOKING_ID, ORG_ID);
      expect(r2.action).toBe('skipped');
      expect(getMocks().insert).toHaveBeenCalledTimes(1);
      expect(getMocks().patch).not.toHaveBeenCalled();
    });

    it('updates when booking changed (checksum differs)', async () => {
      const db = createMockDb({
        booking: {
          findUnique: vi.fn().mockResolvedValue({
            id: BOOKING_ID,
            orgId: ORG_ID,
            sitterId: SITTER_ID,
            startAt: new Date('2025-03-01T10:00:00Z'),
            endAt: new Date('2025-03-01T11:00:00Z'),
            service: 'Dog Walking',
            firstName: 'Jane',
            lastName: 'Doe',
            notes: 'Updated notes',
            client: { firstName: 'Jane', lastName: 'Doe' },
            pets: [{ name: 'Max' }],
            sitter: {
              id: SITTER_ID,
              firstName: 'Sarah',
              lastName: 'Sitter',
              googleRefreshToken: 'refresh-tok',
              calendarSyncEnabled: true,
              googleCalendarId: 'primary',
            },
          }),
        },
        bookingCalendarEvent: {
          findFirst: vi.fn().mockResolvedValue({
            googleCalendarEventId: 'existing-id',
            payloadChecksum: 'old-checksum-different',
          }),
          upsert: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
          deleteMany: vi.fn(),
          findMany: vi.fn(),
        },
      });
      const result = await upsertEventForBooking(db, BOOKING_ID, ORG_ID);
      expect(result.action).toBe('updated');
      expect(getMocks().patch).toHaveBeenCalledTimes(1);
      expect(db.bookingCalendarEvent.update).toHaveBeenCalled();
    });

    it('recreates when Google event was deleted (404 on patch)', async () => {
      getMocks().patch.mockRejectedValueOnce({ code: 404 });
      const db = createMockDb({
        bookingCalendarEvent: {
          findFirst: vi.fn().mockResolvedValue({
            googleCalendarEventId: 'deleted-event-id',
            payloadChecksum: 'some-checksum',
          }),
          upsert: vi.fn().mockResolvedValue({}),
          update: vi.fn(),
          deleteMany: vi.fn(),
          findMany: vi.fn(),
        },
      });
      const result = await upsertEventForBooking(db, BOOKING_ID, ORG_ID);
      expect(result.action).toBe('created');
      expect(getMocks().patch).toHaveBeenCalledTimes(1);
      expect(getMocks().insert).toHaveBeenCalledTimes(1);
    });

    it('skips when sitter has no Google token', async () => {
      const db = createMockDb({
        booking: {
          findUnique: vi.fn().mockResolvedValue({
            id: BOOKING_ID,
            orgId: ORG_ID,
            sitterId: SITTER_ID,
            startAt: new Date(),
            endAt: new Date(),
            service: 'Walk',
            firstName: 'J',
            lastName: 'D',
            notes: null,
            client: null,
            pets: [],
            sitter: {
              id: SITTER_ID,
              firstName: 'S',
              lastName: 'S',
              googleRefreshToken: '',
              calendarSyncEnabled: true,
              googleCalendarId: 'primary',
            },
          }),
        },
      });
      const result = await upsertEventForBooking(db, BOOKING_ID, ORG_ID);
      expect(result.action).toBe('skipped');
      expect(getMocks().insert).not.toHaveBeenCalled();
    });

    it('skips when booking has no sitter', async () => {
      const db = createMockDb({
        booking: {
          findUnique: vi.fn().mockResolvedValue({
            id: BOOKING_ID,
            sitterId: null,
            sitter: null,
          }),
        },
      });
      const result = await upsertEventForBooking(db, BOOKING_ID, ORG_ID);
      expect(result.action).toBe('skipped');
      expect(getMocks().insert).not.toHaveBeenCalled();
    });

    it('throws on Google API error so worker can retry / dead-letter', async () => {
      getMocks().insert.mockRejectedValueOnce(new Error('Google API 500'));
      const db = createMockDb();
      await expect(upsertEventForBooking(db, BOOKING_ID, ORG_ID)).rejects.toThrow('Google API 500');
    });
  });

  describe('deleteEventForBooking', () => {
    it('deletes Google event and removes mapping', async () => {
      const db = createMockDb({
        bookingCalendarEvent: {
          findFirst: vi.fn().mockResolvedValue({
            googleCalendarEventId: 'google-event-123',
          }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          upsert: vi.fn(),
          update: vi.fn(),
          findMany: vi.fn(),
        },
      });
      const result = await deleteEventForBooking(db, BOOKING_ID, SITTER_ID, ORG_ID);
      expect(result.deleted).toBe(true);
      expect(getMocks().delete).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'google-event-123',
          calendarId: 'primary',
        })
      );
      expect(db.bookingCalendarEvent.deleteMany).toHaveBeenCalledWith({
        where: { bookingId: BOOKING_ID, sitterId: SITTER_ID },
      });
    });

    it('removes mapping when no Google event id (already deleted)', async () => {
      const db = createMockDb({
        bookingCalendarEvent: {
          findFirst: vi.fn().mockResolvedValue({
            googleCalendarEventId: null,
          }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          upsert: vi.fn(),
          update: vi.fn(),
          findMany: vi.fn(),
        },
      });
      const result = await deleteEventForBooking(db, BOOKING_ID, SITTER_ID, ORG_ID);
      expect(result.deleted).toBe(true);
      expect(getMocks().delete).not.toHaveBeenCalled();
      expect(db.bookingCalendarEvent.deleteMany).toHaveBeenCalled();
    });

    it('ignores 404 from Google (event already deleted)', async () => {
      getMocks().delete.mockRejectedValueOnce({ code: 404 });
      const db = createMockDb({
        bookingCalendarEvent: {
          findFirst: vi.fn().mockResolvedValue({
            googleCalendarEventId: 'gone-event',
          }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          upsert: vi.fn(),
          update: vi.fn(),
          findMany: vi.fn(),
        },
      });
      const result = await deleteEventForBooking(db, BOOKING_ID, SITTER_ID, ORG_ID);
      expect(result.deleted).toBe(true);
      expect(db.bookingCalendarEvent.deleteMany).toHaveBeenCalled();
    });

    it('throws on non-404 Google error so worker can retry / dead-letter', async () => {
      getMocks().delete.mockRejectedValueOnce(new Error('Google API 500'));
      const db = createMockDb({
        bookingCalendarEvent: {
          findFirst: vi.fn().mockResolvedValue({
            googleCalendarEventId: 'event-123',
          }),
          deleteMany: vi.fn(),
          upsert: vi.fn(),
          update: vi.fn(),
          findMany: vi.fn(),
        },
      });
      await expect(deleteEventForBooking(db, BOOKING_ID, SITTER_ID, ORG_ID)).rejects.toThrow('Google API 500');
    });
  });
});
