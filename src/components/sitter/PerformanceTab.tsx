/**
 * Performance Tab
 *
 * Full performance evaluation view with metrics, trends, and SLA tracking
 */

'use client';

import { Card, SectionHeader, EmptyState, Skeleton } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { PerformanceSnapshot } from './PerformanceSnapshot';
import { useQuery } from '@tanstack/react-query';

interface PerformanceData {
  acceptanceRate: number | null;
  completionRate: number | null;
  onTimeRate: number | null;
  clientRating: number | null;
  totalEarnings: number | null;
  completedBookingsCount: number;
  cancellations: number;
  slaBreaches: number;
  trends?: {
    acceptanceRate: number; // Change over period
    completionRate: number;
    onTimeRate: number;
  };
}

interface PerformanceTabProps {
  sitterId: string;
}

export function PerformanceTab({ sitterId }: PerformanceTabProps) {
  const { data, isLoading } = useQuery<PerformanceData>({
    queryKey: ['sitter-performance', sitterId],
    queryFn: async () => {
      const res = await fetch(`/api/sitters/${sitterId}/performance`);
      if (!res.ok) {
        // If endpoint doesn't exist, return foundation state data
        if (res.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch performance data');
      }
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton height={400} />
      </div>
    );
  }

  // Foundation state - no data yet
  if (!data) {
    return (
      <div className="p-4">
        <Card className="p-4">
          <SectionHeader title="Performance Evaluation" />
          <EmptyState
            title="Performance tracking activates after activity"
            description="Performance metrics will appear here once the sitter has completed bookings and received offers. This includes acceptance rates, completion rates, on-time arrival rates, and client ratings."
            icon="📊"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Performance Snapshot */}
      <PerformanceSnapshot
        performance={{
          acceptanceRate: data.acceptanceRate,
          completionRate: data.completionRate,
          onTimeRate: data.onTimeRate,
          clientRating: data.clientRating,
          totalEarnings: data.totalEarnings,
          completedBookingsCount: data.completedBookingsCount,
        }}
        currentTier={null} // Tier shown in Tier tab
      />

      {/* Additional Metrics */}
      <Card className="p-4">
        <SectionHeader title="Additional Metrics" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 text-sm">
          <div>
            <div className="text-text-secondary mb-1">
              Cancellations
            </div>
            <div className="font-semibold">
              {data.cancellations || 0}
            </div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">
              SLA Breaches
            </div>
            <div className="font-semibold">
              {data.slaBreaches || 0}
            </div>
          </div>
        </div>
      </Card>

      {/* Trends (if available) */}
      {data.trends && (
        <Card className="p-4">
          <SectionHeader title="Trends (Last 30 Days)" />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 text-sm">
            <div>
              <div className="text-text-secondary mb-1">
                Acceptance Rate Change
              </div>
              <div
                className="font-semibold"
                style={{
                  color: data.trends.acceptanceRate >= 0 ? tokens.colors.success.DEFAULT : tokens.colors.error.DEFAULT,
                }}
              >
                {data.trends.acceptanceRate >= 0 ? '+' : ''}{(data.trends.acceptanceRate * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-text-secondary mb-1">
                Completion Rate Change
              </div>
              <div
                className="font-semibold"
                style={{
                  color: data.trends.completionRate >= 0 ? tokens.colors.success.DEFAULT : tokens.colors.error.DEFAULT,
                }}
              >
                {data.trends.completionRate >= 0 ? '+' : ''}{(data.trends.completionRate * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-text-secondary mb-1">
                On-Time Rate Change
              </div>
              <div
                className="font-semibold"
                style={{
                  color: data.trends.onTimeRate >= 0 ? tokens.colors.success.DEFAULT : tokens.colors.error.DEFAULT,
                }}
              >
                {data.trends.onTimeRate >= 0 ? '+' : ''}{(data.trends.onTimeRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
