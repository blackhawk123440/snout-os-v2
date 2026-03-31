/**
 * Webhook Negative Tests
 * 
 * Tests for:
 * - Invalid Twilio signature returns 401 and stores nothing
 * - Malformed inbound does not create threads or events
 * - Pool sender mismatch never attaches to active thread
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../webhook/twilio/route';
import { prisma } from '@/lib/db';
import { TwilioProvider } from '@/lib/messaging/providers/twilio';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    messageEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    messageThread: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    messageParticipant: {
      findFirst: vi.fn(),
      findFirstOrCreate: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
    messageNumber: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    client: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock session helpers
vi.mock('@/lib/messaging/session-helpers', () => ({
  ensureThreadSession: vi.fn(),
}));

// Mock number helpers
vi.mock('@/lib/messaging/number-helpers', () => ({
  assignNumberToThread: vi.fn(),
  validatePoolNumberRouting: vi.fn(),
  determineThreadNumberClass: vi.fn(),
}));

// Mock pool routing
vi.mock('@/lib/messaging/pool-routing', () => ({
  handlePoolNumberMismatch: vi.fn(),
}));

// Mock client classification
vi.mock('@/lib/messaging/client-classification', () => ({
  determineClientClassification: vi.fn(),
}));

// Mock org helpers
vi.mock('@/lib/messaging/org-helpers', () => ({
  getDefaultOrgId: vi.fn(() => 'default'),
}));

// Mock env
vi.mock('@/lib/env', () => ({
  env: {
    ENABLE_MESSAGING_V1: true,
    TWILIO_WEBHOOK_AUTH_TOKEN: 'test-token',
    PUBLIC_BASE_URL: 'https://snoutservices.com',
  },
}));

// Mock TwilioProvider completely to avoid require issues
vi.mock('@/lib/messaging/providers/twilio', () => {
  // Create a standalone mock class without any dependencies
  class MockTwilioProvider {
    verifyWebhook(rawBody: string, signature: string, webhookUrl: string): boolean {
      // Default to true, can be overridden in tests
      return true;
    }
    
    parseInbound(payload: any) {
      return {
        from: '+15551234567',
        to: '+15559876543',
        body: 'Hello',
        messageSid: 'msg123',
        timestamp: new Date(),
      };
    }
    
    parseStatusCallback(payload: any) {
      return {
        messageSid: 'msg123',
        status: 'delivered',
        errorCode: null,
        errorMessage: null,
      };
    }
    
    sendMessage(options: any) {
      return Promise.resolve({ success: true, messageSid: 'msg123' });
    }
    
    createSession(options: any) {
      return Promise.resolve({ success: true, sessionSid: 'session123' });
    }
    
    createParticipant(options: any) {
      return Promise.resolve({ success: true, participantSid: 'participant123' });
    }
    
    sendViaProxy(options: any) {
      return Promise.resolve({ success: true, messageSid: 'msg123' });
    }
    
    updateSessionParticipants(options: any) {
      return Promise.resolve({ success: true });
    }
  }
  
  return {
    TwilioProvider: MockTwilioProvider,
  };
});

describe('Webhook Negative Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Invalid Twilio Signature', () => {
    it('should return 401 and store nothing when signature is invalid', async () => {
      const rawBody = 'From=%2B15551234567&To=%2B15559876543&Body=Hello';
      const invalidSignature = 'invalid-signature';
      const webhookUrl = 'https://example.com/api/messages/webhook/twilio';

      const request = new NextRequest('https://example.com/api/messages/webhook/twilio', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': invalidSignature,
        },
        body: rawBody,
      });

      // Override verifyWebhook on the prototype to return false
      TwilioProvider.prototype.verifyWebhook = vi.fn().mockReturnValue(false);

      const response = await POST(request);
      const responseData = await response.json();

      // Should return 401
      expect(response.status).toBe(401);
      expect(responseData.error).toBe('Invalid signature');

      // Should not create any records
      expect(prisma.messageEvent.create).not.toHaveBeenCalled();
      expect(prisma.messageThread.create).not.toHaveBeenCalled();
      expect(prisma.messageParticipant.findFirstOrCreate).not.toHaveBeenCalled();
    });

    it('should return 401 when signature is missing', async () => {
      const rawBody = 'From=%2B15551234567&To=%2B15559876543&Body=Hello';

      const request = new NextRequest('https://example.com/api/messages/webhook/twilio', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          // No x-twilio-signature header
        },
        body: rawBody,
      });

      // Override verifyWebhook on the prototype to return false
      TwilioProvider.prototype.verifyWebhook = vi.fn().mockReturnValue(false);

      const response = await POST(request);
      const responseData = await response.json();

      // Should return 401
      expect(response.status).toBe(401);
      expect(responseData.error).toBe('Invalid signature');

      // Should not create any records
      expect(prisma.messageEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('Malformed Inbound Message', () => {
    it('should not create threads or events for malformed payload', async () => {
      const rawBody = 'Invalid=Payload'; // Missing required fields

      const request = new NextRequest('https://example.com/api/messages/webhook/twilio', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'valid-signature',
        },
        body: rawBody,
      });

      // Mock valid signature
      TwilioProvider.prototype.verifyWebhook = vi.fn().mockReturnValue(true);

      // Mock parseInbound to throw error for malformed payload
      TwilioProvider.prototype.parseInbound = vi.fn().mockImplementation(() => {
        throw new Error('Malformed payload: missing From field');
      });

      const response = await POST(request);

      // Webhook returns 200 even on errors to prevent Twilio retries
      // Errors are logged but not returned as error status
      expect(response.status).toBe(200);

      // Should not create any records
      expect(prisma.messageEvent.create).not.toHaveBeenCalled();
      expect(prisma.messageThread.create).not.toHaveBeenCalled();
    });

    it('should handle missing required fields gracefully', async () => {
      const rawBody = 'From=%2B15551234567'; // Missing To and Body

      const request = new NextRequest('https://example.com/api/messages/webhook/twilio', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'valid-signature',
        },
        body: rawBody,
      });

      // Mock valid signature
      TwilioProvider.prototype.verifyWebhook = vi.fn().mockReturnValue(true);

      // Mock parseInbound to throw error
      TwilioProvider.prototype.parseInbound = vi.fn().mockImplementation(() => {
        throw new Error('Malformed payload: missing To field');
      });

      const response = await POST(request);

      // Webhook returns 200 even on errors to prevent Twilio retries
      expect(response.status).toBe(200);

      // Should not create any records
      expect(prisma.messageEvent.create).not.toHaveBeenCalled();
      expect(prisma.messageThread.create).not.toHaveBeenCalled();
    });
  });

  describe('Pool Sender Mismatch', () => {
    it('should never attach pool mismatch to active thread', async () => {
      const rawBody = 'From=%2B15551234567&To=%2B15559876543&Body=Hello&MessageSid=msg123';
      const webhookUrl = 'https://example.com/api/messages/webhook/twilio';

      const request = new NextRequest(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'valid-signature',
        },
        body: rawBody,
      });

      // Mock valid signature
      TwilioProvider.prototype.verifyWebhook = vi.fn().mockReturnValue(true);

      // Mock parseInbound to return valid message
      TwilioProvider.prototype.parseInbound = vi.fn().mockReturnValue({
        from: '+15551234567',
        to: '+15559876543',
        body: 'Hello',
        messageSid: 'msg123',
        timestamp: new Date(),
      });

      // Mock existing thread with pool number (required for mismatch check)
      (prisma.messageThread.findFirst as any).mockResolvedValue({
        id: 'thread-1',
        orgId: 'default',
        messageNumberId: 'pool-1',
        numberClass: 'pool',
        status: 'open',
      });

      // Mock validatePoolNumberRouting to return mismatch
      const { validatePoolNumberRouting } = await import('@/lib/messaging/number-helpers');
      vi.mocked(validatePoolNumberRouting).mockResolvedValue({
        isValid: false,
        reason: 'Sender not mapped to active thread on this pool number',
      });

      // Mock handlePoolNumberMismatch
      const { handlePoolNumberMismatch } = await import('@/lib/messaging/pool-routing');
      vi.mocked(handlePoolNumberMismatch).mockResolvedValue({
        ownerThreadId: 'owner-thread-1',
        autoResponseSent: true,
        auditEventId: 'event-1',
      });

      // Mock pool number
      (prisma.messageNumber.findUnique as any).mockResolvedValue({
        id: 'pool-1',
        numberClass: 'pool',
        e164: '+15559876543',
      });

      // Mock owner thread (for handlePoolNumberMismatch)
      (prisma.messageThread.findFirst as any)
        .mockResolvedValueOnce({ // First call - existing thread
          id: 'thread-1',
          orgId: 'default',
          messageNumberId: 'pool-1',
          numberClass: 'pool',
          status: 'open',
        })
        .mockResolvedValueOnce({ // Second call - owner thread
          id: 'owner-thread-1',
          orgId: 'default',
        });

      // Mock client lookup (no client found)
      (prisma.client.findFirst as any).mockResolvedValue(null);

      // Mock participant lookup (none found)
      (prisma.messageParticipant.findFirst as any).mockResolvedValue(null);

      // Mock message event creation
      (prisma.messageEvent.create as any).mockResolvedValue({
        id: 'event-1',
      });

      // Mock thread update
      (prisma.messageThread.update as any).mockResolvedValue({});

      const response = await POST(request);

      // Should handle mismatch correctly
      expect(response.status).toBe(200);

      // Should route to owner inbox, not create new thread
      expect(handlePoolNumberMismatch).toHaveBeenCalled();
      expect(prisma.messageThread.create).not.toHaveBeenCalled();
    });
  });
});
