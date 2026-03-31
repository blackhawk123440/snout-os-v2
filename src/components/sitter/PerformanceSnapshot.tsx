/**
 * Performance Snapshot Component
 *
 * Shows key performance metrics, current tier with badge, composite SRS score,
 * lowest 3 scoring dimensions, and points needed to reach the next tier.
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, StatCard } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { Shield, TrendingUp, AlertTriangle } from 'lucide-react';

interface PerformanceMetrics {
  acceptanceRate: number | null;
  completionRate: number | null;
  onTimeRate: number | null;
  clientRating: number | null;
  totalEarnings: number | null;
  completedBookingsCount: number;
}

interface PerformanceSnapshotProps {
  performance: PerformanceMetrics;
  currentTier: {
    id: string;
    name: string;
    priorityLevel: number | null;
  } | null;
}

// Tier thresholds from CLAUDE.md SRS system
const TIERS = [
  { name: 'Foundation', minScore: 0, badgeBg: 'bg-surface-tertiary', badgeText: 'text-text-secondary' },
  { name: 'Reliant', minScore: 40, badgeBg: 'bg-status-success-bg', badgeText: 'text-status-success-text' },
  { name: 'Trusted', minScore: 60, badgeBg: 'bg-status-info-bg', badgeText: 'text-status-info-text' },
  { name: 'Preferred', minScore: 80, badgeBg: 'bg-status-warning-bg', badgeText: 'text-status-warning-text' },
];

const DIMENSION_LABELS: Record<string, string> = {
  responsiveness: 'Responsiveness',
  acceptance: 'Acceptance',
  timeliness: 'Timeliness',
  accuracy: 'Accuracy',
  engagement: 'Engagement',
  conduct: 'Conduct',
  completion: 'Completion',
};

interface SrsData {
  tier: string;
  score: number;
  breakdown: Record<string, number>;
}

export function PerformanceSnapshot({ performance, currentTier }: PerformanceSnapshotProps) {
  const [srs, setSrs] = useState<SrsData | null>(null);

  useEffect(() => {
    fetch('/api/sitter/me/srs')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.tier != null) setSrs(data); })
      .catch(() => {});
  }, []);

  const formatPercentage = (value: number | null) => {
    if (value === null) return 'N/A';
    return `${(value * 100).toFixed(0)}%`;
  };

  const formatRating = (value: number | null) => {
    if (value === null) return 'N/A';
    return value.toFixed(1);
  };

  const tierName = srs?.tier || currentTier?.name || 'Foundation';
  const tierIdx = TIERS.findIndex((t) => t.name.toLowerCase() === tierName.toLowerCase());
  const tierInfo = TIERS[tierIdx >= 0 ? tierIdx : 0];
  const nextTier = tierIdx >= 0 && tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1] : null;
  const score = srs?.score ?? 0;
  const pointsToNext = nextTier ? Math.max(0, nextTier.minScore - score) : 0;

  const breakdown = srs?.breakdown || {};
  const lowest3 = Object.entries(breakdown)
    .filter(([key]) => key in DIMENSION_LABELS)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3);

  return (
    <Card style={{ padding: tokens.spacing[4] }}>
      <h3 style={{
        fontSize: tokens.typography.fontSize.lg[0],
        fontWeight: tokens.typography.fontWeight.semibold,
        marginBottom: tokens.spacing[4],
      }}>
        Performance Snapshot
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: tokens.spacing[3],
      }}>
        <StatCard label="Acceptance Rate" value={formatPercentage(performance.acceptanceRate)} />
        <StatCard label="Completion Rate" value={formatPercentage(performance.completionRate)} />
        <StatCard label="On-Time Rate" value={formatPercentage(performance.onTimeRate)} />
        <StatCard label="Client Rating" value={formatRating(performance.clientRating)} />
      </div>

      {/* Tier Progression */}
      <div className="mt-4 rounded-lg border border-border-default bg-surface-secondary p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-text-tertiary" />
            <span className="text-sm font-semibold text-text-primary">Tier Progress</span>
          </div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tierInfo.badgeBg} ${tierInfo.badgeText}`}>
            {tierInfo.name}
          </span>
        </div>

        {srs ? (
          <>
            {/* Score bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-text-tertiary mb-1">
                <span>Composite score</span>
                <span className="font-semibold text-text-primary">{Math.round(score)}/100</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-tertiary">
                <div
                  className="h-full rounded-full bg-accent-primary transition-[width] duration-500"
                  style={{ width: `${Math.min(100, score)}%` }}
                />
              </div>
              {nextTier && pointsToNext > 0 && (
                <p className="mt-2 text-xs text-text-tertiary">
                  <TrendingUp className="inline h-3 w-3 mr-0.5" />
                  {Math.round(pointsToNext)} points to reach {nextTier.name}
                </p>
              )}
              {nextTier && pointsToNext === 0 && (
                <p className="mt-2 text-xs text-status-success-text font-medium">
                  Ready for promotion to {nextTier.name}!
                </p>
              )}
              {!nextTier && tierIdx === TIERS.length - 1 && (
                <p className="mt-2 text-xs text-status-success-text font-medium">
                  Top tier reached
                </p>
              )}
            </div>

            {/* Lowest 3 dimensions */}
            {lowest3.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border-default">
                <p className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Areas to improve
                </p>
                <div className="space-y-2">
                  {lowest3.map(([key, value]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-text-secondary">{DIMENSION_LABELS[key] || key}</span>
                        <span className="text-text-tertiary tabular-nums">{Math.round(value)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-tertiary">
                        <div
                          className="h-full rounded-full bg-status-warning-fill transition-[width] duration-500"
                          style={{ width: `${Math.min(100, value)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : currentTier ? (
          <p className="mt-2 text-xs text-text-tertiary">
            Current tier: <strong>{currentTier.name}</strong>. Complete more visits to see detailed progress.
          </p>
        ) : (
          <p className="mt-2 text-xs text-text-tertiary">
            Complete more visits to see your tier progress.
          </p>
        )}
      </div>
    </Card>
  );
}
