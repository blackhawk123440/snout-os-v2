/**
 * Phase 4.3: Proactive Thread Creation Integration Tests
 * 
 * Tests for:
 * - Booking assignment creates thread and window
 * - Reassignment updates window sitterId, no duplicates
 * - Disable flag prevents proactive creation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ensureProactiveThreadCreation, handleBookingReassignment } from '@/lib/messaging/proactive-thread-creation';
import { prisma } from '@/lib/db';
import { determineClientClassification } from '@/lib/messaging/client-classification';
import { assignNumberToThread, determineThreadNumberClass } from '@/lib/messaging/number-helpers';
import { findOrCreateAssignmentWindow } from '@/lib/messaging/window-helpers';
import { TwilioProvider } from '@/lib/messaging/providers/twilio';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(),
    },
    messageThread: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    assignmentWindow: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/messaging/client-classification');
vi.mock('@/lib/messaging/number-helpers');
vi.mock('@/lib/messaging/window-helpers');
vi.mock('@/lib/messaging/providers/twilio');
vi.mock('@/lib/messaging/org-helpers', () => ({
  getDefaultOrgId: vi.fn().mockResolvedValue('org-1'),
}));

vi.mock('@/lib/env', () => ({
  env: {
    ENABLE_PROACTIVE_THREAD_CREATION: true, // Default to enabled for tests
  },
}));

describe('Phase 4.3 Integration Tests', () => {
  const orgId = 'org-1';
  const bookingId = 'booking-1';
  const clientId = 'client-1';
  const sitterId = 'sitter-1';
  const newSitterId = 'sitter-2';

  const mockBooking = {
    id: bookingId,
    clientId,
    service: 'Drop-ins',
    startAt: new Date('2025-01-15T10:00:00Z'),
    endAt: new Date('2025-01-15T12:00:00Z'),
    status: 'confirmed',
  };

  const mockThread = {
    id: 'thread-1',
    orgId,
    clientId,
    bookingId,
    assignedSitterId: sitterId,
    status: 'open',
    scope: 'client',
    isOneTimeClient: false,
    isRecurringClient: true,
    isMeetAndGreet: false,
    messageNumberId: 'number-1',
    numberClass: 'sitter',
    assignmentWindowId: 'window-1',
  };

  const mockWindow = {
    id: 'window-1',
    orgId,
    threadId: 'thread-1',
    bookingId,
    sitterId,
    startAt: new Date('2025-01-15T09:00:00Z'), // 60 min buffer
    endAt: new Date('2025-01-15T13:00:00Z'), // 60 min buffer
    status: 'active',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset env mock
    vi.doMock('@/lib/env', () => ({
      env: {
        ENABLE_PROACTIVE_THREAD_CREATION: true,
      },
    }));
  });

  describe('ensureProactiveThreadCreation', () => {
    it('should create thread and window for recurring client when flag enabled', async () => {
      // Mock booking fetch
      (prisma.booking.findUnique as any).mockResolvedValue(mockBooking);

      // Mock client classification (recurring)
      (determineClientClassification as any).mockResolvedValue({
        isOneTimeClient: false,
        isRecurringClient: true,
      });

      // Mock thread doesn't exist
      (prisma.messageThread.findFirst as any).mockResolvedValue(null);

      // Mock thread creation
      (prisma.messageThread.create as any).mockResolvedValue(mockThread);

      // Mock number class determination
      (determineThreadNumberClass as any).mockResolvedValue('sitter');

      // Mock number assignment
      (assignNumberToThread as any).mockResolvedValue({
        numberId: 'number-1',
        e164: '+15551234567',
        numberClass: 'sitter',
      });

      // Mock window creation
      (findOrCreateAssignmentWindow as any).mockResolvedValue('window-1');

      // Mock thread update with window ID
      (prisma.messageThread.update as any).mockResolvedValue({
        ...mockThread,
        assignmentWindowId: 'window-1',
      });

      const result = await ensureProactiveThreadCreation(bookingId, sitterId, orgId);

      expect(result).not.toBeNull();
      expect(result?.threadId).toBe('thread-1');
      expect(result?.windowId).toBe('window-1');
      expect(result?.numberClass).toBe('sitter');

      // Verify thread was created
      expect(prisma.messageThread.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId,
          clientId,
          bookingId,
          assignedSitterId: sitterId,
          status: 'open',
          scope: 'client',
          isOneTimeClient: false,
          isMeetAndGreet: false,
        }),
      });

      // Verify window was created
      expect(findOrCreateAssignmentWindow).toHaveBeenCalledWith(
        bookingId,
        'thread-1',
        sitterId,
        mockBooking.startAt,
        mockBooking.endAt,
        mockBooking.service,
        orgId
      );

      // Verify number was assigned
      expect(assignNumberToThread).toHaveBeenCalled();
    });

    it('should skip one-time clients', async () => {
      // Mock booking fetch
      (prisma.booking.findUnique as any).mockResolvedValue(mockBooking);

      // Mock client classification (one-time)
      (determineClientClassification as any).mockResolvedValue({
        isOneTimeClient: true,
        isRecurringClient: false,
      });

      const result = await ensureProactiveThreadCreation(bookingId, sitterId, orgId);

      expect(result).toBeNull();
      expect(prisma.messageThread.create).not.toHaveBeenCalled();
      expect(findOrCreateAssignmentWindow).not.toHaveBeenCalled();
    });

    it('should return null when feature flag disabled', async () => {
      // Mock env with flag disabled
      vi.doMock('@/lib/env', () => ({
        env: {
          ENABLE_PROACTIVE_THREAD_CREATION: false,
        },
      }));

      // Need to re-import to get new mock
      const { ensureProactiveThreadCreation: ensureProactiveThreadCreationDisabled } = await import('@/lib/messaging/proactive-thread-creation');

      const result = await ensureProactiveThreadCreationDisabled(bookingId, sitterId, orgId);

      expect(result).toBeNull();
      expect(prisma.messageThread.findFirst).not.toHaveBeenCalled();
    });

    it('should be idempotent - reuse existing thread', async () => {
      // Mock booking fetch
      (prisma.booking.findUnique as any).mockResolvedValue(mockBooking);

      // Mock client classification (recurring)
      (determineClientClassification as any).mockResolvedValue({
        isOneTimeClient: false,
        isRecurringClient: true,
      });

      // Mock thread already exists
      (prisma.messageThread.findFirst as any).mockResolvedValue(mockThread);

      // Mock thread update (no change needed)
      (prisma.messageThread.update as any).mockResolvedValue(mockThread);

      // Mock number class determination
      (determineThreadNumberClass as any).mockResolvedValue('sitter');

      // Mock number assignment
      (assignNumberToThread as any).mockResolvedValue({
        numberId: 'number-1',
        e164: '+15551234567',
        numberClass: 'sitter',
      });

      // Mock window creation (idempotent)
      (findOrCreateAssignmentWindow as any).mockResolvedValue('window-1');

      // Mock thread update with window ID
      (prisma.messageThread.update as any).mockResolvedValue({
        ...mockThread,
        assignmentWindowId: 'window-1',
      });

      const result = await ensureProactiveThreadCreation(bookingId, sitterId, orgId);

      expect(result).not.toBeNull();
      
      // Should NOT create new thread
      expect(prisma.messageThread.create).not.toHaveBeenCalled();
      
      // Should still create/update window
      expect(findOrCreateAssignmentWindow).toHaveBeenCalled();
    });

    it('should return null when booking has no client', async () => {
      // Mock booking without client
      (prisma.booking.findUnique as any).mockResolvedValue({
        ...mockBooking,
        clientId: null,
      });

      const result = await ensureProactiveThreadCreation(bookingId, sitterId, orgId);

      expect(result).toBeNull();
      expect(prisma.messageThread.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('handleBookingReassignment', () => {
    it('should update thread and window on sitter reassignment', async () => {
      // Mock thread exists
      (prisma.messageThread.findFirst as any).mockResolvedValue(mockThread);

      // Mock thread update
      (prisma.messageThread.update as any).mockResolvedValue({
        ...mockThread,
        assignedSitterId: newSitterId,
      });

      // Mock booking fetch
      (prisma.booking.findUnique as any).mockResolvedValue(mockBooking);

      // Mock window creation/update
      (findOrCreateAssignmentWindow as any).mockResolvedValue('window-1');

      // Mock number class determination
      (determineThreadNumberClass as any).mockResolvedValue('sitter');

      // Mock number assignment
      (assignNumberToThread as any).mockResolvedValue({
        numberId: 'number-1',
        e164: '+15551234567',
        numberClass: 'sitter',
      });

      // Mock thread update with window ID
      (prisma.messageThread.update as any).mockResolvedValue({
        ...mockThread,
        assignedSitterId: newSitterId,
        assignmentWindowId: 'window-1',
      });

      await handleBookingReassignment(bookingId, newSitterId, orgId);

      // Verify thread was updated with new sitter
      expect(prisma.messageThread.update).toHaveBeenCalledWith({
        where: { id: 'thread-1' },
        data: { assignedSitterId: newSitterId },
      });

      // Verify window was updated with new sitter
      expect(findOrCreateAssignmentWindow).toHaveBeenCalledWith(
        bookingId,
        'thread-1',
        newSitterId,
        mockBooking.startAt,
        mockBooking.endAt,
        mockBooking.service,
        orgId
      );

      // Verify number was reassigned
      expect(assignNumberToThread).toHaveBeenCalledWith(
        'thread-1',
        'sitter',
        orgId,
        expect.any(TwilioProvider),
        expect.objectContaining({
          sitterId: newSitterId,
          // isOneTimeClient and isMeetAndGreet may be undefined when falsy
        })
      );
    });

    it('should close windows when sitter unassigned', async () => {
      // Mock thread exists
      (prisma.messageThread.findFirst as any).mockResolvedValue(mockThread);

      // Mock thread update
      (prisma.messageThread.update as any).mockResolvedValue({
        ...mockThread,
        assignedSitterId: null,
      });

      // Mock closeAllBookingWindows
      const { closeAllBookingWindows } = await import('@/lib/messaging/window-helpers');
      vi.mocked(closeAllBookingWindows).mockResolvedValue(undefined);

      await handleBookingReassignment(bookingId, null, orgId);

      // Verify thread was updated (unassigned)
      expect(prisma.messageThread.update).toHaveBeenCalledWith({
        where: { id: 'thread-1' },
        data: { assignedSitterId: null },
      });

      // Verify windows were closed
      expect(closeAllBookingWindows).toHaveBeenCalledWith(bookingId);
    });

    it('should handle no existing thread gracefully', async () => {
      // Mock no thread exists
      (prisma.messageThread.findFirst as any).mockResolvedValue(null);

      await handleBookingReassignment(bookingId, newSitterId, orgId);

      // Should not update anything
      expect(prisma.messageThread.update).not.toHaveBeenCalled();
      expect(findOrCreateAssignmentWindow).not.toHaveBeenCalled();
    });

    it('should not create duplicate windows on reassignment', async () => {
      // Mock thread exists
      (prisma.messageThread.findFirst as any).mockResolvedValue(mockThread);

      // Mock thread update
      (prisma.messageThread.update as any).mockResolvedValue({
        ...mockThread,
        assignedSitterId: newSitterId,
      });

      // Mock booking fetch
      (prisma.booking.findUnique as any).mockResolvedValue(mockBooking);

      // Mock window exists (findOrCreateAssignmentWindow will update it, not create new)
      (findOrCreateAssignmentWindow as any).mockResolvedValue('window-1');

      // Mock number class determination
      (determineThreadNumberClass as any).mockResolvedValue('sitter');

      // Mock number assignment
      (assignNumberToThread as any).mockResolvedValue({
        numberId: 'number-1',
        e164: '+15551234567',
        numberClass: 'sitter',
      });

      // Mock thread update
      (prisma.messageThread.update as any).mockResolvedValue({
        ...mockThread,
        assignedSitterId: newSitterId,
        assignmentWindowId: 'window-1',
      });

      await handleBookingReassignment(bookingId, newSitterId, orgId);

      // Verify findOrCreateAssignmentWindow was called (it handles idempotency)
      expect(findOrCreateAssignmentWindow).toHaveBeenCalled();
      
      // Should only be called once (idempotent)
      expect(findOrCreateAssignmentWindow).toHaveBeenCalledTimes(1);
    });
  });
});
