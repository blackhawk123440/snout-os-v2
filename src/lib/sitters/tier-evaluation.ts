/**
 * Automated sitter tier evaluation.
 * Compares metrics against tier thresholds and promotes/demotes.
 */

import { prisma } from '@/lib/db';
import { whereOrg } from '@/lib/org-scope';

export async function evaluateAllSitterTiers(orgId: string): Promise<{
  evaluated: number;
  promoted: number;
  demoted: number;
  unchanged: number;
}> {
  const sitters = await (prisma as any).sitter.findMany({
    where: whereOrg(orgId, { active: true, deletedAt: null }),
    select: { id: true, currentTierId: true, commissionPercentage: true },
  });

  const tiers = await (prisma as any).sitterTier.findMany({
    where: whereOrg(orgId, {}),
    orderBy: { priorityLevel: 'asc' },
  });

  if (tiers.length === 0) return { evaluated: sitters.length, promoted: 0, demoted: 0, unchanged: sitters.length };

  let promoted = 0;
  let demoted = 0;
  let unchanged = 0;

  for (const sitter of sitters) {
    const [totalOffers, acceptedOffers, totalBookings, completedBookings] = await Promise.all([
      (prisma as any).offerEvent.count({ where: whereOrg(orgId, { sitterId: sitter.id }) }),
      (prisma as any).offerEvent.count({ where: whereOrg(orgId, { sitterId: sitter.id, status: 'accepted' }) }),
      (prisma as any).booking.count({ where: whereOrg(orgId, { sitterId: sitter.id }) }),
      (prisma as any).booking.count({ where: whereOrg(orgId, { sitterId: sitter.id, status: 'completed' }) }),
    ]);

    const acceptanceRate = totalOffers > 0 ? (acceptedOffers / totalOffers) * 100 : 0;
    const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;

    // Find the highest tier the sitter qualifies for
    let qualifiedTier = tiers[0]; // Default to lowest
    for (const tier of tiers) {
      const meetsCompletion = !tier.minCompletionRate || completionRate >= tier.minCompletionRate;
      const meetsResponse = !tier.minResponseRate || acceptanceRate >= tier.minResponseRate;
      const meetsPoints = completedBookings >= (tier.pointTarget || 0);
      if (meetsCompletion && meetsResponse && meetsPoints) {
        qualifiedTier = tier;
      }
    }

    if (qualifiedTier.id !== sitter.currentTierId) {
      const currentIdx = tiers.findIndex((t: any) => t.id === sitter.currentTierId);
      const newIdx = tiers.findIndex((t: any) => t.id === qualifiedTier.id);
      const isPromotion = newIdx > currentIdx;

      await (prisma as any).sitter.update({
        where: { id: sitter.id },
        data: { currentTierId: qualifiedTier.id },
      });

      await (prisma as any).sitterTierHistory.create({
        data: {
          orgId,
          sitterId: sitter.id,
          tierId: qualifiedTier.id,
          points: completedBookings,
          completionRate,
          responseRate: acceptanceRate,
          periodStart: new Date(),
          changedBy: 'system',
          reason: isPromotion ? 'auto_promotion' : 'auto_demotion',
        },
      });

      // Notify sitter on promotion
      if (isPromotion) {
        void import('@/lib/notifications/triggers').then(({ notifySitterTierPromotion }) => {
          notifySitterTierPromotion({
            orgId,
            sitterId: sitter.id,
            tierName: qualifiedTier.name,
            commissionPercentage: sitter.commissionPercentage ?? 80,
          });
        }).catch(() => {});
      }

      if (isPromotion) promoted++;
      else demoted++;
    } else {
      unchanged++;
    }
  }

  return { evaluated: sitters.length, promoted, demoted, unchanged };
}
