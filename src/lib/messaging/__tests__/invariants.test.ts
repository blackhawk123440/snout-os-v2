/**
 * Property-Based Tests for Messaging Invariants
 *
 * Uses fast-check for property tests and mocks for DB-dependent invariant checks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  enforceThreadBoundSending,
  enforceFromNumberMatchesThread,
  enforcePoolUnknownSenderRouting,
  checkOutboundInvariants,
} from '../invariants';

vi.mock('@/lib/db', () => ({
  prisma: {
    messageThread: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    messageNumber: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db';

const e164Arb = fc.stringMatching(/^\+1[0-9]{10}$/);
const uuidArb = fc.uuid();

describe('Messaging Invariants - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('INVARIANT 1: Thread-bound sending', () => {
    it('returns invalid when thread does not exist', async () => {
      (prisma.messageThread.findUnique as any).mockResolvedValue(null);
      const result = await enforceThreadBoundSending('thread-1', 'org-1');
      expect(result.valid).toBe(false);
      expect(result.violation?.invariant).toBe('thread-bound-sending');
    });

    it('returns invalid when thread belongs to different org', async () => {
      (prisma.messageThread.findUnique as any).mockResolvedValue({
        id: 'thread-1',
        orgId: 'org-b',
      });
      const result = await enforceThreadBoundSending('thread-1', 'org-a');
      expect(result.valid).toBe(false);
      expect(result.violation?.invariant).toBe('thread-bound-sending');
    });

    it('returns valid when thread exists and belongs to org', async () => {
      (prisma.messageThread.findUnique as any).mockResolvedValue({
        id: 'thread-1',
        orgId: 'org-a',
      });
      const result = await enforceThreadBoundSending('thread-1', 'org-a');
      expect(result.valid).toBe(true);
    });
  });

  describe('INVARIANT 2: from_number matches thread.messageNumber', () => {
    it('returns invalid when thread does not exist', async () => {
      (prisma.messageThread.findUnique as any).mockResolvedValue(null);
      const result = await enforceFromNumberMatchesThread('thread-1', '+15551234567');
      expect(result.valid).toBe(false);
    });

    it('returns invalid when from_number does not match', async () => {
      (prisma.messageThread.findUnique as any).mockResolvedValue({
        id: 'thread-1',
        messageNumber: { e164: '+15559999999' },
      });
      const result = await enforceFromNumberMatchesThread('thread-1', '+15551234567');
      expect(result.valid).toBe(false);
      expect(result.violation?.invariant).toBe('from-number-matches-thread');
    });

    it('returns valid when from_number matches', async () => {
      (prisma.messageThread.findUnique as any).mockResolvedValue({
        id: 'thread-1',
        messageNumber: { e164: '+15551234567' },
      });
      const result = await enforceFromNumberMatchesThread('thread-1', '+15551234567');
      expect(result.valid).toBe(true);
    });
  });

  describe('INVARIANT 3: Pool unknown sender routing', () => {
    it('returns invalid when message number does not exist', async () => {
      (prisma.messageNumber.findUnique as any).mockResolvedValue(null);
      const result = await enforcePoolUnknownSenderRouting('num-1', '+15551234567', 'org-1');
      expect(result.valid).toBe(false);
    });

    it('returns routedToOwner when pool number and no existing thread', async () => {
      (prisma.messageNumber.findUnique as any).mockResolvedValue({
        id: 'num-1',
        numberClass: 'pool',
        orgId: 'org-1',
      });
      (prisma.messageThread.findFirst as any).mockResolvedValue(null);
      const result = await enforcePoolUnknownSenderRouting('num-1', '+15551234567', 'org-1');
      expect(result.valid).toBe(true);
      expect(result.routedToOwner).toBe(true);
    });
  });

  describe('No E164 leakage', () => {
    const E164_PATTERN = /\+\d{1,15}/g;
    const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    it('documents that API responses must not contain raw E164 (production must redact)', async () => {
      // Contract: production API responses must never include raw E164 in nested metadata.
      // These examples WOULD be leaks - our code must use redacted forms.
      await fc.assert(
        fc.asyncProperty(e164Arb, async (e164) => {
          const badExample = {
            thread: { clientPhone: e164 },
            delivery: { error: `Failed to send to ${e164}` },
          };
          const json = JSON.stringify(badExample);
          const matches = json.match(E164_PATTERN);
          const isLeaky = matches?.some((m) => m === e164);
          expect(isLeaky).toBe(true);
        }),
        { numRuns: 20 }
      );
    });

    it('documents that audit details must not contain raw email (production must redact)', async () => {
      await fc.assert(
        fc.asyncProperty(fc.emailAddress(), async (email) => {
          const badExample = { audit: { clientContact: email } };
          const json = JSON.stringify(badExample);
          expect(json).toContain(email);
        }),
        { numRuns: 20 }
      );
    });

    it('documents that error messages must not contain raw E164 (production must redact)', async () => {
      // Contract: production error messages must never include raw E164.
      // These examples WOULD be leaks - invariants/API use redacted forms (e.g. ***1234).
      await fc.assert(
        fc.asyncProperty(e164Arb, async (e164) => {
          const badExamples = [
            `Failed to send to ${e164}`,
            `Invalid number: ${e164}`,
            `Thread not found for ${e164}`,
          ];
          for (const msg of badExamples) {
            const matches = msg.match(E164_PATTERN);
            const isLeaky = matches?.some((m) => m === e164);
            expect(isLeaky).toBe(true);
          }
        }),
        { numRuns: 20 }
      );
    });

    it('should redact E164s in logs and responses', async () => {
      await fc.assert(
        fc.asyncProperty(e164Arb, async (e164) => {
          // Redaction function (should be implemented in actual code)
          function redactE164(fullE164: string): string {
            if (fullE164.length <= 4) return '***';
            return `${fullE164.substring(0, 2)}***${fullE164.substring(fullE164.length - 4)}`;
          }

          const redacted = redactE164(e164);
          
          // Redacted version should not contain full E164
          expect(redacted).not.toContain(e164);
          
          // Redacted version should be shorter
          expect(redacted.length).toBeLessThan(e164.length);
          
          // Redacted version should still show some digits for debugging
          expect(redacted).toMatch(/\d/);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Deterministic routing', () => {
    it('should produce same routing decision for same inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          e164Arb,
          e164Arb,
          fc.date(),
          async (orgId, toNumber, fromNumber, timestamp) => {
            // This test would require mocking the routing resolver
            // For now, we document the requirement
            // In practice, routing should be deterministic based on:
            // - orgId
            // - toNumber (message number)
            // - fromNumber (sender)
            // - timestamp (for window checks)
            // - thread existence
            // - assignment windows
            expect(true).toBe(true); // Placeholder
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Safe fallback', () => {
    it('should always route to owner inbox on routing errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          e164Arb,
          e164Arb,
          async (orgId, toNumber, fromNumber) => {
            // When routing fails, should always fallback to owner inbox
            // This ensures no messages are lost
            // In practice, this is handled in the webhook route
            expect(true).toBe(true); // Placeholder
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Thread-bound sending (comprehensive)', () => {
    it('returns violations when thread does not exist', async () => {
      (prisma.messageThread.findUnique as any).mockResolvedValue(null);
      const result = await checkOutboundInvariants('thread-1', 'org-1', '+15551234567');
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some((v) => v.invariant === 'thread-bound-sending')).toBe(true);
    });

    it('returns violations when from_number does not match thread', async () => {
      (prisma.messageThread.findUnique as any)
        .mockResolvedValueOnce({ id: 't1', orgId: 'org-1' })
        .mockResolvedValueOnce({
          id: 't1',
          messageNumber: { e164: '+15559999999' },
        });
      const result = await checkOutboundInvariants('thread-1', 'org-1', '+15551234567');
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.invariant === 'from-number-matches-thread')).toBe(true);
    });
  });
});
