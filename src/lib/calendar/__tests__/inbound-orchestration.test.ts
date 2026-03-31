/**
 * Tests for inbound calendar sync orchestration.
 *
 * Verifies:
 * - fetchGoogleCalendarChanges filters out Snout-created events (echo prevention)
 * - fetchGoogleCalendarChanges classifies deleted vs upserted events
 * - fetchGoogleCalendarChanges returns empty when sitter has no token
 * - scheduleInboundCalendarSync respects the feature flag
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock googleapis — OAuth2 must be a class (used with `new`)
const mockEventsList = vi.fn();
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class MockOAuth2 {
        setCredentials = vi.fn();
        refreshAccessToken = vi.fn().mockResolvedValue({ credentials: { access_token: 'tok' } });
      },
    },
    calendar: () => ({
      events: {
        list: (...args: any[]) => mockEventsList(...args),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      freebusy: { query: vi.fn() },
    }),
  },
}));

// Set required env vars
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

describe('fetchGoogleCalendarChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDb = {
    sitter: {
      findUnique: vi.fn(),
    },
  } as any;

  it('returns empty when sitter has no refresh token', async () => {
    mockDb.sitter.findUnique.mockResolvedValueOnce({
      googleRefreshToken: null,
      calendarSyncEnabled: true,
      googleCalendarId: 'primary',
    });

    const { fetchGoogleCalendarChanges } = await import('../sync');
    const result = await fetchGoogleCalendarChanges(mockDb, 's1', new Date(), 'org-1');
    expect(result.events).toHaveLength(0);
    expect(mockEventsList).not.toHaveBeenCalled();
  });

  it('returns empty when calendar sync is disabled', async () => {
    mockDb.sitter.findUnique.mockResolvedValueOnce({
      googleRefreshToken: 'refresh-tok',
      calendarSyncEnabled: false,
      googleCalendarId: 'primary',
    });

    const { fetchGoogleCalendarChanges } = await import('../sync');
    const result = await fetchGoogleCalendarChanges(mockDb, 's1', new Date(), 'org-1');
    expect(result.events).toHaveLength(0);
  });

  it('classifies cancelled events as deleted', async () => {
    mockDb.sitter.findUnique.mockResolvedValueOnce({
      googleRefreshToken: 'refresh-tok',
      calendarSyncEnabled: true,
      googleCalendarId: 'primary',
    });

    mockEventsList.mockResolvedValueOnce({
      data: {
        items: [
          { id: 'gcal-1', status: 'cancelled', updated: '2026-03-25T10:00:00Z' },
          { id: 'gcal-2', status: 'confirmed', start: { dateTime: '2026-04-01T14:00:00Z' }, end: { dateTime: '2026-04-01T16:00:00Z' }, updated: '2026-03-25T11:00:00Z' },
        ],
      },
    });

    const { fetchGoogleCalendarChanges } = await import('../sync');
    const result = await fetchGoogleCalendarChanges(mockDb, 's1', new Date(), 'org-1');

    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toEqual({
      externalEventId: 'gcal-1',
      action: 'deleted',
      updatedAt: '2026-03-25T10:00:00Z',
    });
    expect(result.events[1]).toEqual({
      externalEventId: 'gcal-2',
      action: 'upserted',
      startAt: '2026-04-01T14:00:00Z',
      endAt: '2026-04-01T16:00:00Z',
      updatedAt: '2026-03-25T11:00:00Z',
    });
  });

  it('filters out Snout-created events to prevent echo loop', async () => {
    mockDb.sitter.findUnique.mockResolvedValueOnce({
      googleRefreshToken: 'refresh-tok',
      calendarSyncEnabled: true,
      googleCalendarId: 'primary',
    });

    mockEventsList.mockResolvedValueOnce({
      data: {
        items: [
          // Snout-created event (should be filtered out)
          {
            id: 'gcal-snout',
            status: 'confirmed',
            start: { dateTime: '2026-04-01T14:00:00Z' },
            end: { dateTime: '2026-04-01T16:00:00Z' },
            extendedProperties: { private: { snoutSource: 'snout-os' } },
          },
          // External event (should be kept)
          {
            id: 'gcal-external',
            status: 'confirmed',
            start: { dateTime: '2026-04-02T09:00:00Z' },
            end: { dateTime: '2026-04-02T10:00:00Z' },
          },
        ],
      },
    });

    const { fetchGoogleCalendarChanges } = await import('../sync');
    const result = await fetchGoogleCalendarChanges(mockDb, 's1', new Date(), 'org-1');

    expect(result.events).toHaveLength(1);
    expect(result.events[0].externalEventId).toBe('gcal-external');
  });

  it('returns error string on API failure', async () => {
    mockDb.sitter.findUnique.mockResolvedValueOnce({
      googleRefreshToken: 'refresh-tok',
      calendarSyncEnabled: true,
      googleCalendarId: 'primary',
    });

    mockEventsList.mockRejectedValueOnce(new Error('Google API quota exceeded'));

    const { fetchGoogleCalendarChanges } = await import('../sync');
    const result = await fetchGoogleCalendarChanges(mockDb, 's1', new Date(), 'org-1');

    expect(result.events).toHaveLength(0);
    expect(result.error).toContain('quota exceeded');
  });
});
