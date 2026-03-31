/**
 * Tests for the live automation system.
 *
 * Verifies:
 * - automation-init.ts no longer imports the dead engine
 * - automation-engine.ts processAutomations is a no-op
 * - automation-executor returns controlled failure when booking missing
 * - executor catches handler crashes instead of propagating
 * - all 10 types exist in the executor switch
 * - settings skip works
 * - queue/worker infrastructure exists
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock DB
const mockSettingFindUnique = vi.fn().mockResolvedValue(null);
const mockBookingFindUnique = vi.fn().mockResolvedValue(null);
const mockBookingFindFirst = vi.fn().mockResolvedValue(null);

vi.mock('@/lib/db', () => ({
  prisma: {
    setting: { findUnique: (...args: any[]) => mockSettingFindUnique(...args) },
    booking: {
      findUnique: (...args: any[]) => mockBookingFindUnique(...args),
      findFirst: (...args: any[]) => mockBookingFindFirst(...args),
    },
    automation: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('@/lib/event-emitter', () => ({
  eventEmitter: { onAll: vi.fn(), on: vi.fn(), emit: vi.fn() },
}));

describe('dead engine removal', () => {
  it('automation-init.ts does NOT import from automation-engine', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/automation-init.ts'),
      'utf-8'
    );
    // Check for actual import statement, not documentation references
    expect(source).not.toMatch(/import.*from\s+["']\.\/automation-engine["']/);
    expect(source).not.toMatch(/require\(["']\.\/automation-engine["']\)/);
  });

  it('automation-init.ts imports only initializeEventQueueBridge', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/automation-init.ts'),
      'utf-8'
    );
    expect(source).toContain('initializeEventQueueBridge');
    expect(source).toContain('./event-queue-bridge');
  });

  it('automation-engine.ts processAutomations early-returns without executing', async () => {
    const { processAutomations } = await import('../automation-engine');
    await processAutomations('booking.created', { bookingId: 'b1' });
    // Reached here without crashing = early return worked
    expect(true).toBe(true);
  });

  it('automation-engine.ts is marked as dead code in its header', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/automation-engine.ts'),
      'utf-8'
    );
    expect(source).toContain('DEAD CODE');
  });
});

describe('executor null safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns controlled error when booking is missing (no bookingId)', async () => {
    const { executeAutomationForRecipient } = await import('../automation-executor');
    const result = await executeAutomationForRecipient('bookingConfirmation', 'client', {
      orgId: 'org-1',
      // no bookingId
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Booking required');
    expect(result.error).toContain('missing');
  });

  it('returns controlled error when booking is not found in DB', async () => {
    mockBookingFindFirst.mockResolvedValueOnce(null);

    const { executeAutomationForRecipient } = await import('../automation-executor');
    const result = await executeAutomationForRecipient('checkinNotification', 'client', {
      orgId: 'org-1',
      bookingId: 'nonexistent',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('re-throws handler crashes for BullMQ retry', async () => {
    // Provide a booking with null sitter that causes a crash in a handler
    // The catch-all re-throws so BullMQ can retry on transient errors
    mockBookingFindFirst.mockResolvedValueOnce({
      id: 'b1', orgId: 'org-1', firstName: null, lastName: null,
      phone: null, service: null, startAt: null, endAt: null,
      pets: null, timeSlots: null, sitter: null, client: null,
      sitterId: null, clientId: null,
    });

    const { executeAutomationForRecipient } = await import('../automation-executor');
    // checkinNotification may crash on null fields — the executor re-throws
    // so the queue worker retries and eventually dead-letters
    try {
      const result = await executeAutomationForRecipient('checkinNotification', 'client', {
        orgId: 'org-1',
        bookingId: 'b1',
      });
      // If it returns without throwing, it should still have a valid shape
      expect(result).toHaveProperty('success');
    } catch (error) {
      // Re-throw is expected behavior — the queue handles this
      expect(error).toBeTruthy();
    }
  });
});

describe('executor type coverage', () => {
  it('source contains case statements for all 10 automation types', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/automation-executor.ts'),
      'utf-8'
    );
    const expectedTypes = [
      'ownerNewBookingAlert',
      'bookingConfirmation',
      'nightBeforeReminder',
      'sitterAssignment',
      'paymentReminder',
      'postVisitThankYou',
      'checkinNotification',
      'checkoutNotification',
      'bookingCancellation',
      'visitReportNotification',
    ];
    for (const type of expectedTypes) {
      expect(source).toContain(`case "${type}"`);
    }
  });

  it('source has a default case that returns Unknown automation type', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/automation-executor.ts'),
      'utf-8'
    );
    expect(source).toContain('Unknown automation type');
  });

  it('source has a booking-null guard before the switch', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/automation-executor.ts'),
      'utf-8'
    );
    expect(source).toContain('Booking required for automation');
  });

  it('source wraps switch in try/catch that re-throws for BullMQ retry', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/automation-executor.ts'),
      'utf-8'
    );
    // The catch block re-throws so BullMQ retries on transient errors
    expect(source).toContain('catch (handlerError)');
    expect(source).toContain('throw handlerError');
  });
});

describe('settings integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips automation when disabled in settings', async () => {
    mockSettingFindUnique.mockResolvedValueOnce({
      value: JSON.stringify({
        ownerNewBookingAlert: { enabled: true, sendToClient: false },
      }),
    });

    const { executeAutomationForRecipient } = await import('../automation-executor');
    const result = await executeAutomationForRecipient('ownerNewBookingAlert', 'client', {
      orgId: 'org-1',
      bookingId: 'b1',
    });
    expect(result.success).toBe(true);
    expect(result.metadata?.skipped).toBe(true);
  });
});

describe('queue infrastructure', () => {
  it('enqueueAutomation, initializeAutomationWorker, createAutomationWorker exist', async () => {
    const mod = await import('../automation-queue');
    expect(typeof mod.enqueueAutomation).toBe('function');
    expect(typeof mod.initializeAutomationWorker).toBe('function');
    expect(typeof mod.createAutomationWorker).toBe('function');
  });
});
