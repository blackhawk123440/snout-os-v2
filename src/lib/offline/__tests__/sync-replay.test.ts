/**
 * Unit tests for sync replay - endpoint mapping.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../action-queue', () => ({
  updateActionStatus: vi.fn(() => Promise.resolve()),
  removeAction: vi.fn(() => Promise.resolve()),
}));

const mockDbGet = vi.fn(() => Promise.resolve(null));
const mockDbDelete = vi.fn(() => Promise.resolve());

vi.mock('../db', () => ({
  getOfflineDb: vi.fn(() =>
    Promise.resolve({
      get: mockDbGet,
      delete: mockDbDelete,
    })
  ),
  STORES: { pendingPhotos: 'pending-photos' },
}));

describe('sync-replay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replayAction maps visit.checkin to check-in endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', mockFetch);
    const { replayAction } = await import('../sync-replay');
    const result = await replayAction({
      id: 'act-1',
      type: 'visit.checkin',
      orgId: 'org-1',
      sitterId: 's1',
      bookingId: 'b1',
      payload: { lat: 1, lng: 2 },
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    });
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/bookings/b1/check-in',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 1, lng: 2 }),
      })
    );
    vi.unstubAllGlobals();
  });

  it('replayAction maps visit.checkout to check-out endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', mockFetch);
    const { replayAction } = await import('../sync-replay');
    const result = await replayAction({
      id: 'act-2',
      type: 'visit.checkout',
      orgId: 'org-1',
      sitterId: 's1',
      bookingId: 'b1',
      payload: {},
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    });
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/bookings/b1/check-out',
      expect.objectContaining({ method: 'POST' })
    );
    vi.unstubAllGlobals();
  });

  it('replayAction delight.create with report calls daily-delight endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ report: 'ok' }) });
    vi.stubGlobal('fetch', mockFetch);
    const { replayAction } = await import('../sync-replay');
    const result = await replayAction({
      id: 'act-d1',
      type: 'delight.create',
      orgId: 'org-1',
      sitterId: 's1',
      bookingId: 'b1',
      payload: { report: 'Had a great visit!', tone: 'warm' },
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    });
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/bookings/b1/daily-delight',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: 'Had a great visit!', tone: 'warm' }),
      })
    );
    vi.unstubAllGlobals();
  });

  it('replayAction delight.create with photoIds uploads first then calls daily-delight', async () => {
    const mockBlob = new Blob(['fake'], { type: 'image/jpeg' });
    mockDbGet.mockImplementation((store: string, id: string) => {
      if (id === 'photo_1') return Promise.resolve({ blob: mockBlob, mimeType: 'image/jpeg' });
      return Promise.resolve(null);
    });

    const uploadRes = { ok: true, json: () => Promise.resolve({ urls: ['https://example.com/photo1.jpg'] }) };
    const delightRes = { ok: true, json: () => Promise.resolve({ report: 'ok' }) };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(uploadRes)
      .mockResolvedValueOnce(delightRes);

    vi.stubGlobal('fetch', mockFetch);
    const { replayAction } = await import('../sync-replay');
    const result = await replayAction({
      id: 'act-d2',
      type: 'delight.create',
      orgId: 'org-1',
      sitterId: 's1',
      bookingId: 'b1',
      payload: { report: 'Great day!', tone: 'warm', photoIds: ['photo_1'] },
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/upload/report-media', expect.any(Object));
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/bookings/b1/daily-delight',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          report: 'Great day!',
          tone: 'warm',
          mediaUrls: ['https://example.com/photo1.jpg'],
        }),
      })
    );
    expect(mockDbDelete).toHaveBeenCalledWith('pending-photos', 'photo_1');
    vi.unstubAllGlobals();
    mockDbGet.mockReset();
    mockDbDelete.mockClear();
  });
});
