/**
 * Unit tests for offline action queue.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDb = {
  put: vi.fn(() => Promise.resolve()),
  get: vi.fn(() => Promise.resolve(null)),
  getAll: vi.fn(() => Promise.resolve([])),
  delete: vi.fn(() => Promise.resolve()),
};

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve(mockDb)),
}));

vi.mock('../db', () => ({
  getOfflineDb: vi.fn(() => Promise.resolve(mockDb)),
  STORES: { actionQueue: 'action-queue' },
}));

describe('action-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.getAll.mockResolvedValue([]);
  });

  it('enqueueAction returns an id and calls put', async () => {
    const { enqueueAction } = await import('../action-queue');
    const id = await enqueueAction('visit.checkin', {
      orgId: 'org-1',
      sitterId: 's1',
      bookingId: 'b1',
      payload: { lat: 1, lng: 2 },
    });
    expect(id).toMatch(/^act_\d+_[a-z0-9]+$/);
    expect(mockDb.put).toHaveBeenCalledWith(
      'action-queue',
      expect.objectContaining({
        type: 'visit.checkin',
        orgId: 'org-1',
        sitterId: 's1',
        bookingId: 'b1',
        status: 'pending',
      })
    );
  });

  it('getPendingActions returns actions from db', async () => {
    const pending = [
      { id: 'act-1', type: 'visit.checkin', status: 'pending', createdAt: new Date().toISOString(), retryCount: 0 },
    ];
    mockDb.getAll.mockResolvedValue(pending);
    const { getPendingActions } = await import('../action-queue');
    const actions = await getPendingActions();
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('visit.checkin');
  });
});
