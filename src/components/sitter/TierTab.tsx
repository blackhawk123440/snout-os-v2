/**
 * Tier Tab Component
 *
 * Full tier system UI showing current tier, metrics, history, and improvement suggestions
 */

'use client';

import { Card, Badge, SectionHeader, Skeleton, EmptyState } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { useQuery } from '@tanstack/react-query';
import { TierProgression } from './TierProgression';
import { toCanonicalTierName } from '@/lib/tiers/tier-name-mapper';

interface TierDetailsData {
  currentTier: {
    name: string;
    id: string;
    reasons: string[];
    assignedAt: string;
  } | null;
  metrics7d: {
    avgResponseSeconds: number;
    medianResponseSeconds: number;
    responseRate: number;
    offerAcceptRate: number;
    offerDeclineRate: number;
    offerExpireRate: number;
    lastUpdated: string;
  } | null;
  metrics30d: {
    avgResponseSeconds: number;
    medianResponseSeconds: number;
    responseRate: number;
    offerAcceptRate: number;
    offerDeclineRate: number;
    offerExpireRate: number;
    lastUpdated: string;
  } | null;
  history: Array<{
    id: string;
    tierName: string;
    assignedAt: string;
    reason: string | null;
    metadata: string | null;
  }>;
}

interface TierTabProps {
  sitterId: string;
}

export function TierTab({ sitterId }: TierTabProps) {
  const { data, isLoading } = useQuery<TierDetailsData>({
    queryKey: ['sitter-tier-details', sitterId],
    queryFn: async () => {
      const res = await fetch(`/api/sitters/${sitterId}/tier/details`);
      if (!res.ok) throw new Error('Failed to fetch tier details');
      return res.json();
    },
  });

  const formatResponseTime = (seconds: number | null | undefined): string => {
    if (!seconds || seconds === 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatPercentage = (rate: number | null | undefined): string => {
    if (rate === null || rate === undefined) return 'N/A';
    return `${(rate * 100).toFixed(0)}%`;
  };

  // Use canonical tier names (Trainee/Certified/Trusted/Elite) for display
  const getCanonicalTierName = (tierName: string): string => {
    return toCanonicalTierName(tierName);
  };

  const tierColors: Record<string, string> = {
    Trainee: tokens.colors.neutral[500],
    Certified: tokens.colors.neutral[400],
    Trusted: tokens.colors.warning.DEFAULT,
    Elite: tokens.colors.info.DEFAULT,
    // Legacy support
    Bronze: tokens.colors.neutral[500],
    Silver: tokens.colors.neutral[400],
    Gold: tokens.colors.warning.DEFAULT,
    Platinum: tokens.colors.info.DEFAULT,
  };

  // Generate improvement hints from metrics
  const generateImprovementHints = (metrics: TierDetailsData['metrics7d']): string[] => {
    const hints: string[] = [];
    if (!metrics) return ['Complete more booking offers and respond to messages to build tier history'];

    if (metrics.avgResponseSeconds > 1800) {
      hints.push('Improve response time: Aim for < 30 minutes average');
    }
    if (metrics.responseRate < 0.70) {
      hints.push('Increase response rate: Respond to more messages requiring response');
    }
    if (metrics.offerAcceptRate < 0.50) {
      hints.push('Increase offer acceptance: Accept more booking offers when available');
    }
    if (metrics.offerExpireRate > 0.30) {
      hints.push('Reduce offer expiration: Respond to offers before they expire');
    }

    if (hints.length === 0) {
      hints.push('Maintain current performance to keep tier');
    }

    return hints;
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton height={400} />
      </div>
    );
  }

  // Foundation state - no data yet
  if (!data || (!data.currentTier && !data.metrics7d && !data.metrics30d && data.history.length === 0)) {
    return (
      <div className="p-4">
        <Card className="p-4">
          <SectionHeader title="Tier System" />
          <EmptyState
            title="Tier activates after activity"
            description="Tiers activate after you've received booking offers and responded to messages. Example: Respond to booking offers by SMS with YES/NO to build your tier history."
            icon="📊"
          />
        </Card>
      </div>
    );
  }

  const metrics = data.metrics7d || data.metrics30d;
  const improvementHints = generateImprovementHints(data.metrics7d);

  const canonicalTierName = data?.currentTier ? getCanonicalTierName(data.currentTier.name) : null;

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Tier Progression */}
      <TierProgression
        currentTierName={canonicalTierName}
        metrics={data?.metrics7d || null}
      />

      {/* Current Tier Panel */}
      {data && data.currentTier && (
        <Card className="p-4">
          <SectionHeader title="Current Tier" />
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Badge
                variant="default"
                style={{
                  backgroundColor: tierColors[canonicalTierName || data.currentTier.name] || tokens.colors.neutral[500],
                  color: 'white',
                  padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                }}
                className="text-lg"
              >
                {canonicalTierName || data.currentTier.name}
              </Badge>
              <div className="text-sm text-text-secondary">
                Assigned {new Date(data.currentTier.assignedAt).toLocaleDateString()}
              </div>
            </div>

            {/* Why you're in this tier */}
            {data.currentTier.reasons.length > 0 && (
              <div>
                <div className="font-semibold mb-2 text-sm">
                  Why you're in this tier:
                </div>
                <ul className="m-0 pl-4 text-sm">
                  {data.currentTier.reasons.map((reason, i) => (
                    <li key={i} className="mb-1">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Metrics Breakdown */}
      {metrics && (
        <Card className="p-4">
          <SectionHeader
            title="Metrics Breakdown"
            description={data.metrics7d ? 'Last 7 days' : 'Last 30 days'}
          />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-text-secondary mb-1">
                Avg Response Time
              </div>
              <div className="font-semibold">
                {formatResponseTime(metrics.avgResponseSeconds)}
              </div>
            </div>
            {metrics.medianResponseSeconds && (
              <div>
                <div className="text-text-secondary mb-1">
                  Median Response Time
                </div>
                <div className="font-semibold">
                  {formatResponseTime(metrics.medianResponseSeconds)}
                </div>
              </div>
            )}
            {metrics.responseRate !== null && metrics.responseRate !== undefined && (
              <div>
                <div className="text-text-secondary mb-1">
                  Response Rate
                </div>
                <div className="font-semibold">
                  {formatPercentage(metrics.responseRate)}
                </div>
              </div>
            )}
            <div>
              <div className="text-text-secondary mb-1">
                Offer Accept Rate
              </div>
              <div className="font-semibold">
                {formatPercentage(metrics.offerAcceptRate)}
              </div>
            </div>
            <div>
              <div className="text-text-secondary mb-1">
                Offer Decline Rate
              </div>
              <div className="font-semibold">
                {formatPercentage(metrics.offerDeclineRate)}
              </div>
            </div>
            <div>
              <div className="text-text-secondary mb-1">
                Offer Expire Rate
              </div>
              <div className="font-semibold">
                {formatPercentage(metrics.offerExpireRate)}
              </div>
            </div>
          </div>
          {metrics.lastUpdated && (
            <div className="mt-3 pt-3 border-t border-border-default text-xs text-text-secondary">
              Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
            </div>
          )}
        </Card>
      )}

      {/* Tier History Timeline */}
      {data && data.history.length > 0 && (
        <Card className="p-4">
          <SectionHeader title="Tier History" />
          <div className="flex flex-col gap-3">
            {data.history.map((entry, i) => {
              const canonicalName = getCanonicalTierName(entry.tierName);
              return (
                <div
                  key={entry.id}
                  className="p-3 bg-surface-secondary rounded-md"
                  style={{
                    borderLeft: `3px solid ${tierColors[canonicalName] || tokens.colors.neutral[500]}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="default"
                      style={{
                        backgroundColor: tierColors[canonicalName] || tokens.colors.neutral[500],
                        color: 'white',
                      }}
                    >
                      {canonicalName}
                    </Badge>
                  <div className="text-sm text-text-secondary">
                    {new Date(entry.assignedAt).toLocaleDateString()}
                  </div>
                </div>
                {entry.reason && (
                  <div className="text-xs text-text-secondary">
                    {entry.reason}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* How to Improve */}
      <Card className="p-4">
        <SectionHeader title="How to Improve" />
        <ul className="m-0 pl-4 text-sm">
          {improvementHints.map((hint, i) => (
            <li key={i} className="mb-2">
              {hint}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
