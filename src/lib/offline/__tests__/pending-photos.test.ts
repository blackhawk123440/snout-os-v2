/**
 * Unit tests for pending-photos store (offline photo capture).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockPut = vi.fn(() => Promise.resolve());
const mockGet = vi.fn(() => Promise.resolve(null));
const mockGetAll = vi.fn(() => Promise.resolve([]));
const mockDelete = vi.fn(() => Promise.resolve());

const mockDb = {
  put: mockPut,
  get: mockGet,
  getAll: mockGetAll,
  delete: mockDelete,
};

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve(mockDb)),
}));

// Simulate browser so getOfflineDb doesn't throw
beforeEach(() => {
  vi.stubGlobal('window', {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pending-photos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue([]);
  });

  it('addPendingPhoto stores blob and returns id', async () => {
    const { addPendingPhoto } = await import('../db');
    const blob = new Blob(['fake'], { type: 'image/jpeg' });
    const id = await addPendingPhoto('booking-1', blob, 'image/jpeg');
    expect(id).toMatch(/^photo_\d+_[a-z0-9]+$/);
    expect(mockPut).toHaveBeenCalledWith(
      'pending-photos',
      expect.objectContaining({
        bookingId: 'booking-1',
        mimeType: 'image/jpeg',
      })
    );
  });

  it('removePendingPhoto deletes by id', async () => {
    const { removePendingPhoto } = await import('../db');
    await removePendingPhoto('photo_123');
    expect(mockDelete).toHaveBeenCalledWith('pending-photos', 'photo_123');
  });

  it('getPendingPhotosForBooking filters by bookingId', async () => {
    const photos = [
      { id: 'p1', bookingId: 'b1', blob: new Blob(), mimeType: 'image/jpeg', createdAt: '' },
      { id: 'p2', bookingId: 'b1', blob: new Blob(), mimeType: 'image/jpeg', createdAt: '' },
      { id: 'p3', bookingId: 'b2', blob: new Blob(), mimeType: 'image/jpeg', createdAt: '' },
    ];
    mockGetAll.mockResolvedValue(photos);
    const { getPendingPhotosForBooking } = await import('../db');
    const result = await getPendingPhotosForBooking('b1');
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('getPendingPhotosCount returns total count', async () => {
    mockGetAll.mockResolvedValue([{}, {}, {}]);
    const { getPendingPhotosCount } = await import('../db');
    const count = await getPendingPhotosCount();
    expect(count).toBe(3);
  });
});
