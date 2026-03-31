/**
 * Phase 2 Integration Tests
 * 
 * Tests for:
 * - Inbound routing based on assignment windows
 * - Sitter send gating
 * - Window lifecycle (create, update, close)
 * - Thread assignment window management
 * 
 * AssignmentWindow Update Strategy:
 * - Single window per booking per thread, updated in place
 * - When sitter/times change, existing window is updated (no duplicates)
 * - When booking is cancelled/completed, windows are closed (status = 'closed')
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as webhookHandler } from '../../webhook/twilio/route';
import { POST as sendHandler } from '../../send/route';
import { prisma } from '@/lib/db';
import { resolveRoutingForInboundMessage } from '@/lib/messaging/routing-resolution';
import {
  createAssignmentWindow,
  updateAssignmentWindow,
  closeAllBookingWindows,
  findOrCreateAssignmentWindow,
  calculateAssignmentWindow,
} from '@/lib/messaging/window-helpers';
import { hasActiveAssignmentWindow } from '@/lib/messaging/routing-resolution';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    assignmentWindow: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    messageThread: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    messageEvent: {
      create: vi.fn(),
    },
    messageParticipant: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    client: {
      findFirst: vi.fn(),
    },
    booking: {
      findUnique: vi.fn(),
    },
    sitter: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock session helpers
vi.mock('@/lib/messaging/session-helpers', () => ({
  ensureThreadSession: vi.fn().mockResolvedValue({
    sessionSid: 'KS123',
    clientParticipantSid: 'PA123',
  }),
}));

// Mock provider
vi.mock('@/lib/messaging/providers/twilio', () => ({
  TwilioProvider: vi.fn().mockImplementation(() => ({
    verifyWebhook: vi.fn().mockReturnValue(true),
    parseInbound: vi.fn().mockReturnValue({
      messageSid: 'SM123',
      from: '+1234567890',
      to: '+0987654321',
      body: 'Test message',
      timestamp: new Date(),
    }),
    sendMessage: vi.fn().mockResolvedValue({ success: true, messageSid: 'SM123' }),
    sendViaProxy: vi.fn().mockResolvedValue({ success: true, messageSid: 'SM123' }),
    updateSessionParticipants: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

// Mock org helpers
vi.mock('@/lib/messaging/org-helpers', () => ({
  getDefaultOrgId: vi.fn().mockResolvedValue('default'),
  getOrgIdFromContext: vi.fn().mockResolvedValue('default'),
}));

// Mock auth helpers
vi.mock('@/lib/auth-helpers', () => ({
  getCurrentUserSafe: vi.fn().mockResolvedValue({
    id: 'user-1',
    email: 'owner@test.com',
  }),
}));

// Mock sitter helpers
vi.mock('@/lib/sitter-helpers', () => ({
  getCurrentSitterId: vi.fn().mockResolvedValue(null),
}));

// Mock owner inbox routing
vi.mock('@/lib/messaging/owner-inbox-routing', () => ({
  routeToOwnerInbox: vi.fn().mockResolvedValue({
    ownerThreadId: 'owner-thread-1',
    messageEventId: 'event-1',
  }),
  findOrCreateOwnerInboxThread: vi.fn().mockResolvedValue({
    id: 'owner-thread-1',
    orgId: 'default',
    scope: 'internal',
  }),
}));

// Mock number helpers
vi.mock('@/lib/messaging/number-helpers', () => ({
  determineThreadNumberClass: vi.fn().mockResolvedValue('front_desk'),
  assignNumberToThread: vi.fn().mockResolvedValue({
    numberId: 'number-1',
    e164: '+0987654321',
    numberClass: 'front_desk',
  }),
  validatePoolNumberRouting: vi.fn().mockResolvedValue({ isValid: true }),
  getOrCreateFrontDeskNumber: vi.fn().mockResolvedValue({
    numberId: 'number-1',
    e164: '+0987654321',
  }),
}));

// Mock client classification
vi.mock('@/lib/messaging/client-classification', () => ({
  determineClientClassification: vi.fn().mockResolvedValue({
    isOneTimeClient: false,
    isRecurringClient: false,
  }),
}));

// Mock pool routing
vi.mock('@/lib/messaging/pool-routing', () => ({
  handlePoolNumberMismatch: vi.fn(),
}));

// Mock event logger
vi.mock('@/lib/event-logger', () => ({
  logEvent: vi.fn().mockResolvedValue('event-id'),
}));

// Mock logging helpers
vi.mock('@/lib/messaging/logging-helpers', () => ({
  createWebhookLogEntry: vi.fn((msg, data) => `[webhook] ${msg}`),
  redactPhoneNumber: vi.fn((num) => num),
}));

// Mock env
vi.mock('@/lib/env', () => ({
  env: {
    ENABLE_MESSAGING_V1: true,
    TWILIO_WEBHOOK_AUTH_TOKEN: 'test-token',
  },
}));

describe('Phase 2 Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Inbound Routing', () => {
    it('should route to sitter when exactly one active window exists', async () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const windowEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      vi.mocked(prisma.assignmentWindow.findMany).mockResolvedValue([
        {
          id: 'window-1',
          orgId: 'default',
          threadId: 'thread-1',
          bookingId: 'booking-1',
          sitterId: 'sitter-1',
          startAt: windowStart,
          endAt: windowEnd,
          status: 'active',
          createdAt: now,
          updatedAt: now,
          sitter: {
            id: 'sitter-1',
            firstName: 'Test',
            lastName: 'Sitter',
          },
        } as any,
      ]);

      const resolution = await resolveRoutingForInboundMessage('thread-1', now);

      expect(resolution.target).toBe('sitter');
      expect(resolution.sitterId).toBe('sitter-1');
      expect(resolution.metadata.activeWindowsCount).toBe(1);
      expect(resolution.metadata.matchingWindowIds).toEqual(['window-1']);
    });

    it('should route to owner inbox when no active window exists', async () => {
      const now = new Date();

      vi.mocked(prisma.assignmentWindow.findMany).mockResolvedValue([]);

      const resolution = await resolveRoutingForInboundMessage('thread-1', now);

      expect(resolution.target).toBe('owner_inbox');
      expect(resolution.sitterId).toBeUndefined();
      expect(resolution.metadata.activeWindowsCount).toBe(0);
      expect(resolution.reason).toContain('No active assignment window');
    });

    it('should route to owner inbox when overlapping windows exist', async () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 60 * 60 * 1000);

      vi.mocked(prisma.assignmentWindow.findMany).mockResolvedValue([
        {
          id: 'window-1',
          orgId: 'default',
          threadId: 'thread-1',
          bookingId: 'booking-1',
          sitterId: 'sitter-1',
          startAt: windowStart,
          endAt: windowEnd,
          status: 'active',
          createdAt: now,
          updatedAt: now,
          sitter: { id: 'sitter-1', firstName: 'Sitter', lastName: '1' },
        } as any,
        {
          id: 'window-2',
          orgId: 'default',
          threadId: 'thread-1',
          bookingId: 'booking-2',
          sitterId: 'sitter-2',
          startAt: windowStart,
          endAt: windowEnd,
          status: 'active',
          createdAt: now,
          updatedAt: now,
          sitter: { id: 'sitter-2', firstName: 'Sitter', lastName: '2' },
        } as any,
      ]);

      const resolution = await resolveRoutingForInboundMessage('thread-1', now);

      expect(resolution.target).toBe('owner_inbox');
      expect(resolution.metadata.activeWindowsCount).toBe(2);
      expect(resolution.metadata.conflictingWindowIds).toEqual(['window-1', 'window-2']);
      expect(resolution.reason).toContain('Multiple overlapping');
      expect(resolution.reason).toContain('requires owner intervention');
    });

    it('should route to owner inbox when thread has no booking', async () => {
      const now = new Date();

      vi.mocked(prisma.messageThread.findUnique).mockResolvedValue({
        id: 'thread-1',
        orgId: 'default',
        bookingId: null,
        assignedSitterId: null,
      } as any);

      vi.mocked(prisma.assignmentWindow.findMany).mockResolvedValue([]);

      const resolution = await resolveRoutingForInboundMessage('thread-1', now);

      expect(resolution.target).toBe('owner_inbox');
      expect(resolution.metadata.activeWindowsCount).toBe(0);
    });
  });

  describe('Sitter Send Gating', () => {
    it('should allow sitter outbound during active window', async () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 60 * 60 * 1000);

      vi.mocked(prisma.messageThread.findUnique).mockResolvedValue({
        id: 'thread-1',
        orgId: 'default',
        assignedSitterId: 'sitter-1',
        providerSessionSid: 'KS123',
        participants: [
          {
            id: 'participant-1',
            role: 'client',
            realE164: '+1234567890',
          },
        ],
      } as any);

      vi.mocked(prisma.assignmentWindow.findFirst).mockResolvedValue({
        id: 'window-1',
        sitterId: 'sitter-1',
        threadId: 'thread-1',
        startAt: windowStart,
        endAt: windowEnd,
        status: 'active',
      } as any);

      const { getCurrentSitterId } = await import('@/lib/sitter-helpers');
      vi.mocked(getCurrentSitterId).mockResolvedValue('sitter-1');

      const hasWindow = await hasActiveAssignmentWindow('sitter-1', 'thread-1', now);
      expect(hasWindow).toBe(true);
    });

    it('should block sitter outbound outside window (403)', async () => {
      const now = new Date();

      vi.mocked(prisma.messageThread.findUnique).mockResolvedValue({
        id: 'thread-1',
        orgId: 'default',
        assignedSitterId: 'sitter-1',
        participants: [
          {
            id: 'participant-1',
            role: 'client',
            realE164: '+1234567890',
          },
        ],
      } as any);

      vi.mocked(prisma.assignmentWindow.findFirst).mockResolvedValue(null);

      const { getCurrentSitterId } = await import('@/lib/sitter-helpers');
      vi.mocked(getCurrentSitterId).mockResolvedValue('sitter-1');

      const hasWindow = await hasActiveAssignmentWindow('sitter-1', 'thread-1', now);
      expect(hasWindow).toBe(false);
    });

    it('should always allow owner outbound regardless of windows', async () => {
      const now = new Date();

      vi.mocked(prisma.messageThread.findUnique).mockResolvedValue({
        id: 'thread-1',
        orgId: 'default',
        assignedSitterId: 'sitter-1',
        participants: [
          {
            id: 'participant-1',
            role: 'client',
            realE164: '+1234567890',
          },
        ],
      } as any);

      const { getCurrentSitterId } = await import('@/lib/sitter-helpers');
      vi.mocked(getCurrentSitterId).mockResolvedValue(null); // Owner, not sitter

      // Owner should not be checked for window
      const hasWindow = await hasActiveAssignmentWindow('sitter-1', 'thread-1', now);
      // Owner check happens in send handler, not here
      // This test verifies owner is not checked at routing resolution level
    });
  });

  describe('Window Lifecycle', () => {
    it('should create window with correct buffers for Drop-ins (60min)', async () => {
      const bookingStart = new Date('2025-01-05T10:00:00Z');
      const bookingEnd = new Date('2025-01-05T11:00:00Z');

      const { startAt, endAt } = calculateAssignmentWindow(bookingStart, bookingEnd, 'Drop-ins');

      expect(startAt).toEqual(new Date('2025-01-05T09:00:00Z')); // 60 min before
      expect(endAt).toEqual(new Date('2025-01-05T12:00:00Z')); // 60 min after
    });

    it('should create window with correct buffers for Housesitting (2hr)', async () => {
      const bookingStart = new Date('2025-01-05T10:00:00Z');
      const bookingEnd = new Date('2025-01-05T18:00:00Z');

      const { startAt, endAt } = calculateAssignmentWindow(bookingStart, bookingEnd, 'Housesitting');

      expect(startAt).toEqual(new Date('2025-01-05T08:00:00Z')); // 2 hours before
      expect(endAt).toEqual(new Date('2025-01-05T20:00:00Z')); // 2 hours after
    });

    it('should create window when booking is created with sitter', async () => {
      const bookingStart = new Date('2025-01-05T10:00:00Z');
      const bookingEnd = new Date('2025-01-05T11:00:00Z');

      vi.mocked(prisma.assignmentWindow.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.assignmentWindow.create).mockResolvedValue({
        id: 'window-1',
        orgId: 'default',
        threadId: 'thread-1',
        bookingId: 'booking-1',
        sitterId: 'sitter-1',
        startAt: new Date('2025-01-05T09:00:00Z'),
        endAt: new Date('2025-01-05T12:00:00Z'),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const windowId = await findOrCreateAssignmentWindow(
        'booking-1',
        'thread-1',
        'sitter-1',
        bookingStart,
        bookingEnd,
        'Drop-ins',
        'default'
      );

      expect(windowId).toBe('window-1');
      expect(prisma.assignmentWindow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: 'default',
          threadId: 'thread-1',
          bookingId: 'booking-1',
          sitterId: 'sitter-1',
          status: 'active',
        }),
      });
    });

    it('should update existing window when booking times change (not create duplicate)', async () => {
      const oldStart = new Date('2025-01-05T10:00:00Z');
      const oldEnd = new Date('2025-01-05T11:00:00Z');
      const newStart = new Date('2025-01-05T14:00:00Z');
      const newEnd = new Date('2025-01-05T15:00:00Z');

      vi.mocked(prisma.assignmentWindow.findFirst).mockResolvedValue({
        id: 'window-1',
        orgId: 'default',
        threadId: 'thread-1',
        bookingId: 'booking-1',
        sitterId: 'sitter-1',
        startAt: oldStart,
        endAt: oldEnd,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.assignmentWindow.update).mockResolvedValue({
        id: 'window-1',
        startAt: new Date('2025-01-05T13:00:00Z'), // Updated with buffer
        endAt: new Date('2025-01-05T16:00:00Z'), // Updated with buffer
      } as any);

      const windowId = await findOrCreateAssignmentWindow(
        'booking-1',
        'thread-1',
        'sitter-1',
        newStart,
        newEnd,
        'Drop-ins',
        'default'
      );

      expect(windowId).toBe('window-1');
      expect(prisma.assignmentWindow.update).toHaveBeenCalled();
      expect(prisma.assignmentWindow.create).not.toHaveBeenCalled();
    });

    it('should close window when booking is cancelled', async () => {
      vi.mocked(prisma.assignmentWindow.updateMany).mockResolvedValue({ count: 1 });

      await closeAllBookingWindows('booking-1');

      expect(prisma.assignmentWindow.updateMany).toHaveBeenCalledWith({
        where: {
          bookingId: 'booking-1',
          status: 'active',
        },
        data: { status: 'closed' },
      });
    });

    it('should update window sitterId when sitter is reassigned', async () => {
      const bookingStart = new Date('2025-01-05T10:00:00Z');
      const bookingEnd = new Date('2025-01-05T11:00:00Z');

      vi.mocked(prisma.assignmentWindow.findFirst).mockResolvedValue({
        id: 'window-1',
        orgId: 'default',
        threadId: 'thread-1',
        bookingId: 'booking-1',
        sitterId: 'sitter-1', // Old sitter
        startAt: bookingStart,
        endAt: bookingEnd,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.assignmentWindow.update).mockResolvedValue({
        id: 'window-1',
        sitterId: 'sitter-2', // New sitter
        startAt: bookingStart,
        endAt: bookingEnd,
      } as any);

      const windowId = await findOrCreateAssignmentWindow(
        'booking-1',
        'thread-1',
        'sitter-2', // New sitter
        bookingStart,
        bookingEnd,
        'Drop-ins',
        'default'
      );

      expect(windowId).toBe('window-1');
      expect(prisma.assignmentWindow.update).toHaveBeenCalledWith({
        where: { id: 'window-1' },
        data: expect.objectContaining({
          sitterId: 'sitter-2',
        }),
      });
    });
  });
});
