/**
 * Tier Summary Card
 *
 * Shows tier summary for Dashboard tab
 */

'use client';

import { Card, Badge, Button, SectionHeader, Skeleton, EmptyState } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { useQuery } from '@tanstack/react-query';
import { toCanonicalTierName } from '@/lib/tiers/tier-name-mapper';

interface TierSummaryData {
  currentTier: {
    name: string;
    id: string;
  } | null;
  metrics: {
    avgResponseSeconds: number;
    offerAcceptRate: number;
    offerDeclineRate: number;
    offerExpireRate: number;
    lastUpdated: string;
  } | null;
}

interface TierSummaryCardProps {
  sitterId: string;
  onViewDetails: () => void;
}

export function TierSummaryCard({ sitterId, onViewDetails }: TierSummaryCardProps) {
  const { data, isLoading } = useQuery<TierSummaryData>({
    queryKey: ['sitter-tier-summary', sitterId],
    queryFn: async () => {
      const res = await fetch(`/api/sitters/${sitterId}/tier/summary`);
      if (!res.ok) throw new Error('Failed to fetch tier summary');
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

  if (isLoading) {
    return (
      <Card className="p-4">
        <SectionHeader title="Tier Summary" />
        <Skeleton height={120} />
      </Card>
    );
  }

  // Foundation state - no data yet
  if (!data?.currentTier && !data?.metrics) {
    return (
      <Card className="p-4">
        <SectionHeader title="Tier Summary" />
        <EmptyState
          title="Tier activates after activity"
          description="Tier activates after you've received booking offers and responded to messages."
          icon="📊"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={onViewDetails}
          className="mt-3 w-full"
        >
          View Tier Details
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <SectionHeader title="Tier Summary" />
      <div className="flex flex-col gap-3">
        {/* Current Tier Badge */}
        {data.currentTier && (() => {
          const canonicalName = toCanonicalTierName(data.currentTier.name);
          return (
            <div className="flex items-center gap-2">
              <Badge
                variant="default"
                style={{
                  backgroundColor: tierColors[canonicalName] || tokens.colors.neutral[500],
                  color: 'white',
                }}
                className="text-base px-3 py-2"
              >
                {canonicalName}
              </Badge>
            </div>
          );
        })()}

        {/* Metrics */}
        {data.metrics && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-text-secondary mb-0.5">
                Avg Response
              </div>
              <div className="font-semibold">
                {formatResponseTime(data.metrics.avgResponseSeconds)}
              </div>
            </div>
            <div>
              <div className="text-text-secondary mb-0.5">
                Accept Rate
              </div>
              <div className="font-semibold">
                {formatPercentage(data.metrics.offerAcceptRate)}
              </div>
            </div>
            <div>
              <div className="text-text-secondary mb-0.5">
                Expire Rate
              </div>
              <div className="font-semibold">
                {formatPercentage(data.metrics.offerExpireRate)}
              </div>
            </div>
            {data.metrics.lastUpdated && (
              <div>
                <div className="text-text-secondary mb-0.5">
                  Last Updated
                </div>
                <div className="text-xs">
                  {new Date(data.metrics.lastUpdated).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* View Details Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onViewDetails}
          className="mt-2 w-full"
        >
          View Tier Details
        </Button>
      </div>
    </Card>
  );
}
