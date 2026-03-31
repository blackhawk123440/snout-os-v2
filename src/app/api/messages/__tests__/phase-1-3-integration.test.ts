/**
 * Phase 1.3 Integration Tests
 * 
 * Tests for:
 * - Thread number association and routing
 * - Pool mismatch behavior
 * - Owner inbox routing
 * - Offboarding integration hooks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/db';
import {
  handlePoolNumberMismatch,
  getPoolMismatchAutoResponse,
} from '../../../../lib/messaging/pool-routing';
import {
  deactivateSitterMaskedNumber,
  reassignSitterThreads,
  completeSitterOffboarding,
} from '../../../../lib/messaging/sitter-offboarding';
import {
  routeToOwnerInbox,
  findOrCreateOwnerInboxThread,
} from '../../../../lib/messaging/owner-inbox-routing';
import type { MessagingProvider, InboundMessage } from '../../../../lib/messaging/provider';
import { TwilioProvider } from '../../../../lib/messaging/providers/twilio';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    messageThread: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    messageEvent: {
      create: vi.fn(),
    },
    messageNumber: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    setting: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock event logger
vi.mock('@/lib/event-logger', () => ({
  logEvent: vi.fn().mockResolvedValue('event-id-123'),
}));

// Mock provider
const mockProvider: MessagingProvider = {
  verifyWebhook: vi.fn(),
  parseInbound: vi.fn(),
  parseStatusCallback: vi.fn(),
  sendMessage: vi.fn().mockResolvedValue({ success: true, messageSid: 'msg-123' }),
  createSession: vi.fn(),
  createParticipant: vi.fn(),
  sendViaProxy: vi.fn(),
  updateSessionParticipants: vi.fn(),
};

describe('Phase 1.3 Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Pool Mismatch Behavior', () => {
    it('should route to owner inbox, send auto-response, and record audit', async () => {
      const inboundMessage: InboundMessage = {
        from: '+15551234567',
        to: '+15559876543',
        body: 'Hello',
        messageSid: 'msg-123',
        timestamp: new Date(),
      };

      const mockOwnerThread = { id: 'owner-thread-1', orgId: 'org-1' };
      const mockMessageNumber = { id: 'pool-1', e164: '+15559876543', providerNumberSid: 'PN123' };
      const mockMessageEvent = { id: 'event-1' };

      (prisma.messageThread.findFirst as any).mockResolvedValue(mockOwnerThread);
      (prisma.messageThread.create as any).mockResolvedValue(mockOwnerThread);
      (prisma.messageEvent.create as any).mockResolvedValue(mockMessageEvent);
      (prisma.messageNumber.findUnique as any).mockResolvedValue(mockMessageNumber);

      const result = await handlePoolNumberMismatch(
        'pool-1',
        inboundMessage,
        'org-1',
        mockProvider
      );

      expect(result.ownerThreadId).toBe('owner-thread-1');
      expect(result.autoResponseSent).toBe(true);
      expect(result.auditEventId).toBe('event-1');

      // Verify message was created in owner inbox
      expect(prisma.messageEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            threadId: 'owner-thread-1',
            direction: 'inbound',
            actorType: 'client',
          }),
        })
      );

      // Verify auto-response was sent
      expect(mockProvider.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+15551234567',
          body: expect.stringContaining('Snout Services'),
        })
      );
    });
  });

  describe('Owner Inbox Routing', () => {
    it('should find or create owner inbox thread', async () => {
      const mockOwnerThread = { id: 'owner-thread-1', orgId: 'org-1', scope: 'internal' };

      (prisma.messageThread.findFirst as any).mockResolvedValue(mockOwnerThread);

      const result = await findOrCreateOwnerInboxThread('org-1');

      expect(result.id).toBe('owner-thread-1');
      expect(prisma.messageThread.findFirst).toHaveBeenCalledWith({
        where: {
          orgId: 'org-1',
          scope: 'internal',
          clientId: null,
        },
      });
    });

    it('should route message to owner inbox', async () => {
      const inboundMessage: InboundMessage = {
        from: '+15551234567',
        to: '+15559876543',
        body: 'Help needed',
        messageSid: 'msg-123',
        timestamp: new Date(),
      };

      const mockOwnerThread = { id: 'owner-thread-1', orgId: 'org-1' };
      const mockMessageEvent = { id: 'event-1' };

      (prisma.messageThread.findFirst as any).mockResolvedValue(mockOwnerThread);
      (prisma.messageEvent.create as any).mockResolvedValue(mockMessageEvent);

      const result = await routeToOwnerInbox(inboundMessage, 'org-1', 'Outside assignment window');

      expect(result.ownerThreadId).toBe('owner-thread-1');
      expect(result.messageEventId).toBe('event-1');
    });
  });

  describe('Offboarding Integration Hooks', () => {
    it('should deactivate sitter masked number', async () => {
      const mockMessageNumber = {
        id: 'number-1',
        assignedSitterId: 'sitter-1',
        status: 'active',
        e164: '+15551234568',
      };

      (prisma.messageNumber.findFirst as any).mockResolvedValue(mockMessageNumber);
      (prisma.messageNumber.update as any).mockResolvedValue({
        ...mockMessageNumber,
        assignedSitterId: null,
      });

      const result = await deactivateSitterMaskedNumber('sitter-1', 'org-1');

      expect(result.maskedNumberId).toBe('number-1');
      expect(result.messageNumberId).toBe('number-1');
      expect(prisma.messageNumber.update).toHaveBeenCalledWith({
        where: { id: 'number-1' },
        data: {
          assignedSitterId: null,
        },
      });
    });

    it('should reassign sitter threads to owner inbox', async () => {
      const mockThreads = [
        { id: 'thread-1', assignedSitterId: 'sitter-1', orgId: 'org-1' },
        { id: 'thread-2', assignedSitterId: 'sitter-1', orgId: 'org-1' },
      ];

      const mockOwnerThread = { id: 'owner-thread-1', orgId: 'org-1' };

      (prisma.messageThread.findMany as any).mockResolvedValue(mockThreads);
      (prisma.messageThread.findFirst as any).mockResolvedValue(mockOwnerThread);
      (prisma.messageThread.update as any).mockResolvedValue({});

      const result = await reassignSitterThreads('sitter-1', 'org-1', 'unassign_to_owner');

      expect(result.threadsUnassigned).toBe(2);
      expect(result.threadsReassigned).toBe(0);
      expect(result.ownerThreadId).toBe('owner-thread-1');

      // Verify threads were unassigned
      expect(prisma.messageThread.update).toHaveBeenCalledTimes(2);
    });
  });
});
