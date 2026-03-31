/**
 * Tier Progression Component
 *
 * Enterprise-grade tier progression visualization with icons, year/level markers,
 * and progress indicators toward next tier.
 */

'use client';

import { Card, SectionHeader, Badge } from '@/components/ui';
import { Lock, Circle } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import {
  getAllTiers,
  getTierLevel,
  getTierIcon,
  getTierColor,
  toCanonicalTierName,
  type CanonicalTierName
} from '@/lib/tiers/tier-name-mapper';

interface TierProgressionProps {
  currentTierName: string | null;
  metrics?: {
    avgResponseSeconds: number | null;
    responseRate: number | null;
    offerAcceptRate: number | null;
    offerExpireRate: number | null;
  } | null;
}

export function TierProgression({ currentTierName, metrics }: TierProgressionProps) {
  const allTiers = getAllTiers();
  const currentTier = currentTierName ? toCanonicalTierName(currentTierName) : null;
  const currentLevel = currentTier ? getTierLevel(currentTier) : 0;

  // Calculate progress toward next tier
  const getNextTierRequirements = (): string[] => {
    if (!currentTier || !metrics) {
      return ['Complete booking offers and respond to messages to build tier history'];
    }

    const requirements: string[] = [];
    const nextLevel = currentLevel + 1;

    if (nextLevel > 4) {
      return ['You\'ve reached the highest tier! Maintain your performance.'];
    }

    const nextTier = allTiers[nextLevel - 1] as CanonicalTierName;

    // Bronze -> Silver (Certified)
    if (currentTier === 'Trainee' && nextTier === 'Certified') {
      if (metrics.avgResponseSeconds && metrics.avgResponseSeconds > 1800) {
        requirements.push(`Improve response time: Currently ${Math.floor(metrics.avgResponseSeconds / 60)}min avg, target < 30min`);
      }
      if (metrics.responseRate !== null && metrics.responseRate < 0.70) {
        requirements.push(`Increase response rate: Currently ${(metrics.responseRate * 100).toFixed(0)}%, target ≥70%`);
      }
      if (metrics.offerAcceptRate !== null && metrics.offerAcceptRate < 0.50) {
        requirements.push(`Accept more offers: Currently ${(metrics.offerAcceptRate * 100).toFixed(0)}%, target ≥50%`);
      }
      if (metrics.offerExpireRate !== null && metrics.offerExpireRate >= 0.30) {
        requirements.push(`Reduce expired offers: Currently ${(metrics.offerExpireRate * 100).toFixed(0)}%, target <30%`);
      }
    }
    // Silver -> Gold (Trusted)
    else if (currentTier === 'Certified' && nextTier === 'Trusted') {
      if (metrics.avgResponseSeconds && metrics.avgResponseSeconds > 600) {
        requirements.push(`Improve response time: Currently ${Math.floor(metrics.avgResponseSeconds / 60)}min avg, target < 10min`);
      }
      if (metrics.responseRate !== null && metrics.responseRate < 0.85) {
        requirements.push(`Increase response rate: Currently ${(metrics.responseRate * 100).toFixed(0)}%, target ≥85%`);
      }
      if (metrics.offerAcceptRate !== null && metrics.offerAcceptRate < 0.70) {
        requirements.push(`Accept more offers: Currently ${(metrics.offerAcceptRate * 100).toFixed(0)}%, target ≥70%`);
      }
      if (metrics.offerExpireRate !== null && metrics.offerExpireRate >= 0.20) {
        requirements.push(`Reduce expired offers: Currently ${(metrics.offerExpireRate * 100).toFixed(0)}%, target <20%`);
      }
    }
    // Gold -> Platinum (Elite)
    else if (currentTier === 'Trusted' && nextTier === 'Elite') {
      if (metrics.avgResponseSeconds && metrics.avgResponseSeconds > 300) {
        requirements.push(`Improve response time: Currently ${Math.floor(metrics.avgResponseSeconds / 60)}min avg, target < 5min`);
      }
      if (metrics.responseRate !== null && metrics.responseRate < 0.95) {
        requirements.push(`Increase response rate: Currently ${(metrics.responseRate * 100).toFixed(0)}%, target ≥95%`);
      }
      if (metrics.offerAcceptRate !== null && metrics.offerAcceptRate < 0.80) {
        requirements.push(`Accept more offers: Currently ${(metrics.offerAcceptRate * 100).toFixed(0)}%, target ≥80%`);
      }
      if (metrics.offerExpireRate !== null && metrics.offerExpireRate >= 0.10) {
        requirements.push(`Reduce expired offers: Currently ${(metrics.offerExpireRate * 100).toFixed(0)}%, target <10%`);
      }
    }

    if (requirements.length === 0) {
      requirements.push('Maintain current performance to progress');
    }

    return requirements;
  };

  const nextTierRequirements = getNextTierRequirements();

  return (
    <Card className="p-4">
      <SectionHeader title="Tier Progression" />
      <div className="flex flex-col gap-4">
        {/* Tier Stepper */}
        <div className="flex flex-col gap-3 relative">
          {allTiers.map((tier, index) => {
            const level = index + 1;
            const isCurrent = currentTier === tier;
            const isUnlocked = currentLevel >= level;
            const tierColor = getTierColor(tier);
            const tierIcon = getTierIcon(tier);

            return (
              <div
                key={tier}
                className="flex items-center gap-3 p-3 rounded-md relative"
                style={{
                  backgroundColor: isCurrent ? 'var(--color-surface-tertiary)' : 'transparent',
                  border: isCurrent ? `2px solid ${tierColor}` : `1px solid var(--color-border-default)`,
                }}
              >
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0"
                  style={{
                    backgroundColor: isUnlocked ? tierColor : tokens.colors.neutral[200],
                    color: isUnlocked ? 'white' : tokens.colors.text.secondary,
                  }}
                >
                  <Icon name={tierIcon} size={20} />
                </div>

                {/* Tier Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-bold text-base">
                      {tier}
                    </div>
                    <Badge variant={isCurrent ? 'success' : isUnlocked ? 'default' : 'error'}>
                      Level {level}
                    </Badge>
                    {isCurrent && (
                      <Badge variant="info" className="text-xs">
                        Current
                      </Badge>
                    )}
                    {!isUnlocked && (
                      <Badge variant="error" className="text-xs">
                        <Lock className="w-3.5 h-3.5 mr-1" />
                        Locked
                      </Badge>
                    )}
                  </div>
                  {isCurrent && nextTierRequirements.length > 0 && index < allTiers.length - 1 && (
                    <div className="text-xs text-text-secondary mt-1">
                      Next: {allTiers[index + 1]} — {nextTierRequirements[0]}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Indicators */}
        {currentTier && metrics && (
          <div className="p-3 bg-surface-secondary rounded-md border border-border-default">
            <div className="font-semibold text-sm mb-2">
              Progress Toward Next Tier
            </div>
            <div className="flex flex-col gap-2">
              {nextTierRequirements.map((req, i) => (
                <div key={i} className="text-xs text-text-secondary flex items-center gap-2">
                  <Circle className="w-1 h-1 fill-current text-accent-primary" />
                  {req}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Foundation State */}
        {!currentTier && (
          <div className="p-4 text-center bg-surface-secondary rounded-md">
            <div className="text-sm text-text-secondary">
              Complete booking offers and respond to messages to unlock your first tier.
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
