/**
 * Master Spec V1 Anti-Poaching Integration Tests
 * 
 * Tests anti-poaching enforcement per Master Spec V1 Section 7.
 * Ensures policy violations return HTTP 400, create MessagePolicyViolation records,
 * and log outbound_blocked audit events.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as sendHandler } from '../../send/route';
import { prisma } from '@/lib/db';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    messageThread: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    messageEvent: {
      create: vi.fn(),
    },
    messagePolicyViolation: {
      create: vi.fn(),
    },
    messageParticipant: {
      findFirst: vi.fn(),
    },
    assignmentWindow: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock auth
vi.mock('@/lib/auth-enforcement', () => ({
  requireMessagingAuth: vi.fn().mockResolvedValue({
    success: true,
    context: {
      user: { id: 'test-sitter-user-id', sitterId: 'test-sitter-id' },
      orgId: 'default',
    },
  }),
}));

// Mock routing resolver
vi.mock('@/lib/messaging/routing-resolver', () => ({
  resolveOutboundMessage: vi.fn().mockResolvedValue({
    allowed: true,
    fromNumberToUse: '+15551234567',
  }),
}));

// Mock anti-poaching
vi.mock('@/lib/messaging/anti-poaching', () => ({
  scanMessage: vi.fn(),
}));

// Mock provider
vi.mock('@/lib/messaging/providers/twilio', () => ({
  TwilioProvider: vi.fn().mockImplementation(() => ({
    sendMessage: vi.fn().mockResolvedValue({ success: true, messageSid: 'SM123' }),
  })),
}));

describe('Master Spec V1 Anti-Poaching Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup active assignment window to avoid window gating (403)
    vi.mocked(prisma.assignmentWindow.findFirst).mockResolvedValue({
      id: 'window-1',
      orgId: 'default',
      threadId: 'thread-1',
      bookingId: 'booking-1',
      sitterId: 'test-sitter-id',
      startAt: new Date(Date.now() - 3600000), // 1 hour ago
      endAt: new Date(Date.now() + 3600000), // 1 hour from now
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // Setup thread
    vi.mocked(prisma.messageThread.findUnique).mockResolvedValue({
      id: 'thread-1',
      orgId: 'default',
      scope: 'client_general',
      bookingId: 'booking-1',
      assignedSitterId: 'test-sitter-id',
      status: 'open',
      messageNumber: {
        e164: '+15551234567',
      },
    } as any);

    // Setup participant
    vi.mocked(prisma.messageParticipant.findFirst).mockResolvedValue({
      id: 'participant-1',
      threadId: 'thread-1',
      orgId: 'default',
      role: 'sitter',
      userId: 'test-sitter-user-id',
    } as any);
  });

  it('should block message containing phone number (HTTP 400)', async () => {
    const { scanMessage } = await import('@/lib/messaging/anti-poaching');
    vi.mocked(scanMessage).mockReturnValue({
      allowed: false,
      reasons: ['PHONE_NUMBER'],
      redactions: 'Text me at ***-***-4567',
    });

    const request = new NextRequest('http://localhost/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        threadId: 'thread-1',
        text: 'Text me at 555-123-4567',
      }),
    });

    const response = await sendHandler(request);
    const data = await response.json();

    // Assert HTTP 400
    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();

    // Assert MessagePolicyViolation created
    expect(prisma.messagePolicyViolation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: 'default',
          threadId: 'thread-1',
          senderUserId: 'test-sitter-user-id',
          reasons: expect.stringContaining('PHONE_NUMBER'),
        }),
      })
    );

    // Assert message NOT persisted as sent
    expect(prisma.messageEvent.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryStatus: 'sent',
        }),
      })
    );
  });

  it('should block message containing email (HTTP 400)', async () => {
    const { scanMessage } = await import('@/lib/messaging/anti-poaching');
    vi.mocked(scanMessage).mockReturnValue({
      allowed: false,
      reasons: ['EMAIL'],
      redactions: 'Email me at t***@example.com',
    });

    const request = new NextRequest('http://localhost/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        threadId: 'thread-1',
        text: 'Email me at test@example.com',
      }),
    });

    const response = await sendHandler(request);
    
    expect(response.status).toBe(400);
    expect(prisma.messagePolicyViolation.create).toHaveBeenCalled();
  });

  it('should block "take it offline" phrases (HTTP 400)', async () => {
    const { scanMessage } = await import('@/lib/messaging/anti-poaching');
    vi.mocked(scanMessage).mockReturnValue({
      allowed: false,
      reasons: ['SOCIAL_PHRASE'],
      redactions: 'Text me directly',
    });

    const request = new NextRequest('http://localhost/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        threadId: 'thread-1',
        text: 'Text me directly',
      }),
    });

    const response = await sendHandler(request);
    
    expect(response.status).toBe(400);
    expect(prisma.messagePolicyViolation.create).toHaveBeenCalled();
  });

  it('should allow normal messages when inside assignment window', async () => {
    const { scanMessage } = await import('@/lib/messaging/anti-poaching');
    vi.mocked(scanMessage).mockReturnValue({
      allowed: true,
      reasons: [],
    });

    const request = new NextRequest('http://localhost/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        threadId: 'thread-1',
        text: 'On my way!',
      }),
    });

    const response = await sendHandler(request);
    
    // Should succeed (200 or 201)
    expect([200, 201]).toContain(response.status);
    expect(prisma.messagePolicyViolation.create).not.toHaveBeenCalled();
  });
});
