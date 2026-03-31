/**
 * booking.created -> automation enqueued
 * Verifies enqueueAutomationsForBookingEvent enqueues ownerNewBookingAlert when event is booking.created.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/automation-queue', () => ({
  enqueueAutomation: vi.fn().mockResolvedValue(undefined),
}));

import { enqueueAutomationsForBookingEvent } from '@/lib/booking/booking-events';
import { enqueueAutomation } from '@/lib/automation-queue';

describe('booking.created automation enqueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues ownerNewBookingAlert when event is booking.created', async () => {
    await enqueueAutomationsForBookingEvent('booking.created', {
      orgId: 'org-1',
      bookingId: 'b1',
      occurredAt: new Date().toISOString(),
      metadata: {
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+15551234567',
        service: 'Dog Walking',
      },
    });

    expect(enqueueAutomation).toHaveBeenCalledWith(
      'ownerNewBookingAlert',
      'client',
      expect.objectContaining({
        orgId: 'org-1',
        bookingId: 'b1',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+15551234567',
        service: 'Dog Walking',
      }),
      expect.stringContaining('booking.created:b1:'),
      undefined
    );
    expect(enqueueAutomation).toHaveBeenCalledWith(
      'ownerNewBookingAlert',
      'owner',
      expect.objectContaining({
        orgId: 'org-1',
        bookingId: 'b1',
      }),
      expect.any(String),
      undefined
    );
  });
});
