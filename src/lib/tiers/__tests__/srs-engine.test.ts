/**
 * SRS Engine Tests
 * 
 * Tests that prove:
 * - Median response time uses only messages that require response
 * - Responses outside assignment windows are excluded
 * - PTO excludes responsiveness tracking
 * - Weekly evaluation doesn't whiplash (stability rule)
 * - Corrective action triggers conduct score drop + tier restriction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateSRS } from '../srs-engine';
import { checkPromotionEligibility, checkDemotionRequired, checkAtRisk } from '../tier-rules';
import { prisma } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  prisma: {
    messageThread: {
      findFirst: vi.fn(),
    },
    assignmentWindow: {
      findFirst: vi.fn(),
    },
    booking: {
      findFirst: vi.fn(),
    },
    messageResponseLink: {
      findMany: vi.fn(),
    },
    sitterTimeOff: {
      findMany: vi.fn(),
    },
    offerEvent: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    visitEvent: {
      findMany: vi.fn(),
    },
    sitterServiceEvent: {
      findMany: vi.fn(),
    },
    sitterTierSnapshot: {
      findFirst: vi.fn(),
    },
  },
}));

describe('SRS Engine Tests', () => {
  const orgId = 'test-org';
  const sitterId = 'test-sitter';
  const asOfDate = new Date('2024-01-15');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Responsiveness Calculation', () => {
    it('should use only messages that require response', async () => {
      // Mock assignment window
      (prisma as any).assignmentWindow.findMany.mockResolvedValue([
        { id: 'window-1', startAt: new Date('2024-01-01'), endAt: new Date('2024-01-31'), status: 'active' },
      ]);

      // Mock time offs (none)
      (prisma as any).sitterTimeOff.findMany.mockResolvedValue([]);

      // Mock response links - mix of requiring and non-requiring
      (prisma as any).messageResponseLink.findMany.mockResolvedValue([
        {
          requiresResponseEvent: { createdAt: new Date('2024-01-10T10:00:00Z') },
          responseEvent: { createdAt: new Date('2024-01-10T10:05:00Z') },
          withinAssignmentWindow: true,
          excluded: false,
        },
        {
          requiresResponseEvent: { createdAt: new Date('2024-01-11T10:00:00Z') },
          responseEvent: { createdAt: new Date('2024-01-11T10:10:00Z') },
          withinAssignmentWindow: true,
          excluded: false,
        },
      ]);

      // Mock other categories
      (prisma as any).offerEvent.findMany.mockResolvedValue([]);
      (prisma as any).visitEvent.findMany.mockResolvedValue([]);
      (prisma as any).sitterServiceEvent.findMany.mockResolvedValue([]);
      (prisma as any).sitterTierSnapshot.findFirst.mockResolvedValue({ tier: 'foundation' });

      const result = await calculateSRS(orgId, sitterId, asOfDate);

      // Should calculate median from response links
      expect((prisma as any).messageResponseLink.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            requiresResponseEvent: expect.objectContaining({
              requiresResponse: true,
            }),
          }),
        })
      );

      // Median of 5 and 10 minutes = 7.5, should score in 5-10 band (16 points)
      expect(result.breakdown.responsiveness).toBeGreaterThan(0);
    });

    it('should exclude responses outside assignment windows', async () => {
      (prisma as any).assignmentWindow.findMany.mockResolvedValue([
        { id: 'window-1', startAt: new Date('2024-01-01'), endAt: new Date('2024-01-31'), status: 'active' },
      ]);

      (prisma as any).sitterTimeOff.findMany.mockResolvedValue([]);

      // Response outside window
      (prisma as any).messageResponseLink.findMany.mockResolvedValue([
        {
          requiresResponseEvent: { createdAt: new Date('2024-01-10T10:00:00Z') },
          responseEvent: { createdAt: new Date('2024-01-10T10:05:00Z') },
          withinAssignmentWindow: false, // Outside window
          excluded: false,
        },
      ]);

      (prisma as any).offerEvent.findMany.mockResolvedValue([]);
      (prisma as any).visitEvent.findMany.mockResolvedValue([]);
      (prisma as any).sitterServiceEvent.findMany.mockResolvedValue([]);
      (prisma as any).sitterTierSnapshot.findFirst.mockResolvedValue({ tier: 'foundation' });

      const result = await calculateSRS(orgId, sitterId, asOfDate);

      // Should have 0 responsiveness (no valid responses)
      expect(result.breakdown.responsiveness).toBe(0);
    });

    it('should exclude PTO periods from responsiveness tracking', async () => {
      (prisma as any).assignmentWindow.findMany.mockResolvedValue([
        { id: 'window-1', startAt: new Date('2024-01-01'), endAt: new Date('2024-01-31'), status: 'active' },
      ]);

      // PTO period
      (prisma as any).sitterTimeOff.findMany.mockResolvedValue([
        {
          startsAt: new Date('2024-01-10'),
          endsAt: new Date('2024-01-12'),
        },
      ]);

      // Response during PTO
      (prisma as any).messageResponseLink.findMany.mockResolvedValue([
        {
          requiresResponseEvent: { createdAt: new Date('2024-01-11T10:00:00Z') }, // During PTO
          responseEvent: { createdAt: new Date('2024-01-11T10:05:00Z') },
          withinAssignmentWindow: true,
          excluded: false,
        },
      ]);

      (prisma as any).offerEvent.findMany.mockResolvedValue([]);
      (prisma as any).visitEvent.findMany.mockResolvedValue([]);
      (prisma as any).sitterServiceEvent.findMany.mockResolvedValue([]);
      (prisma as any).sitterTierSnapshot.findFirst.mockResolvedValue({ tier: 'foundation' });

      const result = await calculateSRS(orgId, sitterId, asOfDate);

      // Should have 0 responsiveness (PTO excluded)
      expect(result.breakdown.responsiveness).toBe(0);
    });
  });

  describe('Tier Evaluation Stability', () => {
    it('should not whiplash on weekly evaluation (stability rule)', async () => {
      const orgId = 'test-org';
      const sitterId = 'test-sitter';
      const asOfDate = new Date('2024-01-15');

      // Mock: 1 week dip (should be atRisk but not demoted)
      (prisma as any).sitterTierSnapshot.findMany.mockResolvedValue([
        {
          asOfDate: new Date('2024-01-08'),
          rolling30dScore: 85, // Above tier min (80 for trusted)
          tier: 'trusted',
        },
        {
          asOfDate: new Date('2024-01-15'),
          rolling30dScore: 75, // Below tier min (dip)
          tier: 'trusted',
        },
      ]);

      (prisma as any).sitterServiceEvent.findMany.mockResolvedValue([]);

      const atRiskCheck = await checkAtRisk(orgId, sitterId, 'trusted', asOfDate);

      // Should be at risk but not demoted
      expect(atRiskCheck.atRisk).toBe(true);

      const demotionCheck = await checkDemotionRequired(orgId, sitterId, 'trusted', asOfDate);

      // Should NOT demote (only 1 week dip)
      expect(demotionCheck.demote).toBe(false);
    });
  });

  describe('Corrective Action Impact', () => {
    it('should trigger conduct score drop and tier restriction', async () => {
      // Mock corrective action
      (prisma as any).sitterServiceEvent.findMany.mockResolvedValue([
        {
          level: 'corrective',
          effectiveFrom: new Date('2024-01-10'),
          effectiveTo: null,
        },
      ]);

      const result = await calculateSRS(orgId, sitterId, asOfDate);

      // Conduct score should be 2 (corrective action)
      expect(result.breakdown.conduct).toBe(2);

      // Check promotion eligibility (should be blocked)
      (prisma as any).sitterTierSnapshot.findMany.mockResolvedValue([
        {
          asOfDate: new Date('2024-01-08'),
          rolling30dScore: 85,
          tier: 'trusted',
          visits30d: 20,
        },
        {
          asOfDate: new Date('2024-01-15'),
          rolling30dScore: 90, // Meets preferred threshold
          tier: 'trusted',
          visits30d: 20,
        },
      ]);

      const promotionCheck = await checkPromotionEligibility(
        orgId,
        sitterId,
        'trusted',
        'preferred',
        asOfDate
      );

      // Should NOT be eligible (corrective action in last 30 days)
      expect(promotionCheck.eligible).toBe(false);
      expect(promotionCheck.reason).toContain('Corrective action');
    });
  });
});
