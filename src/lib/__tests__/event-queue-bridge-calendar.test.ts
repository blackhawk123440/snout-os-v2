/**
 * booking.created/updated/cancelled -> calendar sync enqueued
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/calendar-queue', () => ({
  enqueueCalendarSync: vi.fn().mockResolvedValue('job-123'),
}));

import { eventEmitter } from '@/lib/event-emitter';
import { enqueueCalendarSync } from '@/lib/calendar-queue';
import { initializeEventQueueBridge } from '@/lib/event-queue-bridge';

describe('event-queue-bridge calendar enqueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeEventQueueBridge();
  });

  it('enqueues upsert on booking.created when sitter assigned', async () => {
    await eventEmitter.emit('booking.created', {
      booking: {
        id: 'b1',
        orgId: 'org-1',
        sitterId: 's1',
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(enqueueCalendarSync).toHaveBeenCalledWith({
      type: 'upsert',
      bookingId: 'b1',
      orgId: 'org-1',
    });
  });

  it('enqueues delete on booking.updated when status cancelled', async () => {
    await eventEmitter.emit('booking.updated', {
      booking: {
        id: 'b2',
        orgId: 'org-1',
        sitterId: 's1',
        status: 'cancelled',
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(enqueueCalendarSync).toHaveBeenCalledWith({
      type: 'delete',
      bookingId: 'b2',
      sitterId: 's1',
      orgId: 'org-1',
    });
  });

  it('enqueues upsert on booking.updated when not cancelled', async () => {
    await eventEmitter.emit('booking.updated', {
      booking: {
        id: 'b3',
        orgId: 'org-1',
        sitterId: 's1',
        status: 'confirmed',
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(enqueueCalendarSync).toHaveBeenCalledWith({
      type: 'upsert',
      bookingId: 'b3',
      orgId: 'org-1',
    });
  });

  it('enqueues upsert on booking.assigned', async () => {
    await eventEmitter.emit('booking.assigned', {
      booking: {
        id: 'b4',
        orgId: 'org-1',
        sitterId: 's1',
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(enqueueCalendarSync).toHaveBeenCalledWith({
      type: 'upsert',
      bookingId: 'b4',
      orgId: 'org-1',
    });
  });
});
