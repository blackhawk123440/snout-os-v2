/**
 * Unit Tests: Number Assignment Helpers
 * 
 * Phase 1.2: Number Infrastructure
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getOrCreateFrontDeskNumber,
  assignSitterMaskedNumber,
  getPoolNumber,
  determineThreadNumberClass,
  assignNumberToThread,
  validatePoolNumberRouting,
} from '../number-helpers';
import { prisma } from '@/lib/db';
import type { MessagingProvider } from '../provider';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    messageNumber: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    sitterMaskedNumber: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    messageThread: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock provider
const mockProvider: MessagingProvider = {
  verifyWebhook: vi.fn(),
  parseInbound: vi.fn(),
  parseStatusCallback: vi.fn(),
  sendMessage: vi.fn(),
  createSession: vi.fn(),
  createParticipant: vi.fn(),
  sendViaProxy: vi.fn(),
  updateSessionParticipants: vi.fn(),
};

describe('Number Assignment Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateFrontDeskNumber', () => {
    it('should return existing Front Desk number', async () => {
      const mockNumber = {
        id: 'front-desk-1',
        e164: '+15551234567',
        orgId: 'org-1',
        numberClass: 'front_desk',
        status: 'active',
      };

      (prisma.messageNumber.findFirst as any).mockResolvedValue(mockNumber);

      const result = await getOrCreateFrontDeskNumber('org-1', mockProvider);

      expect(result).toEqual({
        numberId: 'front-desk-1',
        e164: '+15551234567',
      });
    });

    it('should throw error if Front Desk number not configured', async () => {
      (prisma.messageNumber.findFirst as any).mockResolvedValue(null);

      await expect(
        getOrCreateFrontDeskNumber('org-1', mockProvider)
      ).rejects.toThrow('Front Desk number not configured');
    });
  });

  describe('assignSitterMaskedNumber', () => {
    it('should return existing active masked number (via MessageNumber.assignedSitterId)', async () => {
      const mockNumber = {
        id: 'number-1',
        e164: '+15551234568',
        assignedSitterId: 'sitter-1',
        numberClass: 'sitter',
        status: 'active',
      };

      (prisma.messageNumber.findFirst as any).mockResolvedValue(mockNumber);

      const result = await assignSitterMaskedNumber(
        'org-1',
        'sitter-1',
        mockProvider
      );

      expect(result).toEqual({
        numberId: 'number-1',
        sitterMaskedNumberId: 'number-1',
        e164: '+15551234568',
      });
    });

    it('should not reuse deactivated sitter numbers for new sitters', async () => {
      // Existing deactivated masked number
      const mockDeactivated = {
        id: 'sitter-masked-1',
        sitterId: 'sitter-old',
        messageNumberId: 'number-1',
        status: 'deactivated',
        deactivatedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
        messageNumber: {
          id: 'number-1',
          e164: '+15551234568',
          numberClass: 'sitter',
        },
      };

      (prisma.sitterMaskedNumber.findUnique as any).mockResolvedValue(null);
      (prisma.messageNumber.findFirst as any).mockResolvedValue(null);
      (prisma.sitterMaskedNumber.findFirst as any).mockResolvedValue(
        mockDeactivated
      );

      // Should convert to pool and throw error (no new sitter number available)
      (prisma.messageNumber.update as any).mockResolvedValue({});

      await expect(
        assignSitterMaskedNumber('org-1', 'sitter-new', mockProvider)
      ).rejects.toThrow('No available sitter number');
    });
  });

  describe('determineThreadNumberClass', () => {
    it('should return front_desk for meet-and-greet threads', async () => {
      const result = await determineThreadNumberClass({
        isMeetAndGreet: true,
      });

      expect(result).toBe('front_desk');
    });

    it('should return pool for one-time client threads', async () => {
      const result = await determineThreadNumberClass({
        isOneTimeClient: true,
      });

      expect(result).toBe('pool');
    });

    it('should return sitter for threads with assigned sitter', async () => {
      const result = await determineThreadNumberClass({
        assignedSitterId: 'sitter-1',
        isMeetAndGreet: false,
        isOneTimeClient: false,
      });

      expect(result).toBe('sitter');
    });

    it('should return front_desk as default', async () => {
      const result = await determineThreadNumberClass({});

      expect(result).toBe('front_desk');
    });
  });

  describe('assignNumberToThread', () => {
    it('should assign Front Desk number and update thread', async () => {
      const mockNumber = {
        id: 'front-desk-1',
        e164: '+15551234567',
        numberClass: 'front_desk',
      };

      (prisma.messageNumber.findFirst as any).mockResolvedValue(mockNumber);
      (prisma.messageNumber.findUnique as any).mockResolvedValue(mockNumber);

      const result = await assignNumberToThread(
        'thread-1',
        'front_desk',
        'org-1',
        mockProvider
      );

      expect(result).toEqual({
        numberId: 'front-desk-1',
        e164: '+15551234567',
        numberClass: 'front_desk',
      });

      expect(prisma.messageThread.update).toHaveBeenCalledWith({
        where: { id: 'thread-1' },
        data: {
          messageNumberId: 'front-desk-1',
          numberClass: 'front_desk',
          maskedNumberE164: '+15551234567',
        },
      });
    });

    it('should ensure thread.numberClass matches MessageNumber.numberClass', async () => {
      const mockNumber = {
        id: 'sitter-1',
        e164: '+15551234568',
        numberClass: 'sitter',
      };

      (prisma.messageNumber.findFirst as any).mockResolvedValue(mockNumber);
      (prisma.messageNumber.findUnique as any).mockResolvedValue(mockNumber);
      (prisma.sitterMaskedNumber.findUnique as any).mockResolvedValue({
        id: 'sitter-masked-1',
        messageNumberId: 'sitter-1',
        status: 'active',
        messageNumber: mockNumber,
      });

      await assignNumberToThread(
        'thread-1',
        'sitter',
        'org-1',
        mockProvider,
        { sitterId: 'sitter-1' }
      );

      expect(prisma.messageThread.update).toHaveBeenCalledWith({
        where: { id: 'thread-1' },
        data: {
          messageNumberId: 'sitter-1',
          numberClass: 'sitter',
          maskedNumberE164: '+15551234568',
        },
      });
    });
  });

  describe('validatePoolNumberRouting', () => {
    it('should validate sender is mapped to active thread', async () => {
      const mockThreads = [
        {
          id: 'thread-1',
          participants: [
            {
              role: 'client',
              realE164: '+15551234567',
            },
          ],
        },
      ];

      (prisma.messageNumber.findUnique as any).mockResolvedValue({
        id: 'pool-1',
        numberClass: 'pool',
      });
      (prisma.messageThread.findMany as any).mockResolvedValue(mockThreads);

      const result = await validatePoolNumberRouting(
        'pool-1',
        '+15551234567',
        'org-1'
      );

      expect(result).toEqual({
        isValid: true,
        threadId: 'thread-1',
      });
    });

    it('should reject sender not mapped to active thread', async () => {
      (prisma.messageNumber.findUnique as any).mockResolvedValue({
        id: 'pool-1',
        numberClass: 'pool',
      });
      (prisma.messageThread.findMany as any).mockResolvedValue([]);

      const result = await validatePoolNumberRouting(
        'pool-1',
        '+15551234567',
        'org-1'
      );

      expect(result).toEqual({
        isValid: false,
        reason: 'Sender not mapped to active thread on this pool number',
      });
    });
  });
});
