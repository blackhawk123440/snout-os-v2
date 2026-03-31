/**
 * Sitter SRS Card Component
 *
 * Shows sitter's Service Reliability Score, tier, and next actions
 */

'use client';

import { Card, Badge, SectionHeader } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { useQuery } from '@tanstack/react-query';

interface SitterSRSData {
  tier: string;
  score: number;
  provisional: boolean;
  atRisk: boolean;
  atRiskReason?: string;
  breakdown: {
    responsiveness: number;
    acceptance: number;
    completion: number;
    timeliness: number;
    accuracy: number;
    engagement: number;
    conduct: number;
  };
  visits30d: number;
  rolling26w?: number;
  compensation?: {
    basePay: number;
    nextReviewDate?: string;
  };
  perks: {
    priority: boolean;
    multipliers: { holiday: number };
    mentorship: boolean;
    reducedOversight: boolean;
  };
  nextActions: string[];
}

export function SitterSRSCard() {
  const { data, isLoading, error } = useQuery<SitterSRSData>({
    queryKey: ['sitter-srs'],
    queryFn: async () => {
      const res = await fetch('/api/sitter/me/srs');
      if (!res.ok) {
        // If 404, return null to show empty state
        if (res.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch SRS');
      }
      return res.json();
    },
    retry: false, // Don't retry on error
  });

  // Always render the card, even on error or no data
  if (isLoading) {
    return (
      <Card className="p-4">
        <SectionHeader
          title="Your Level"
          description="Service Reliability Score and tier status"
        />
        <div className="text-sm text-text-secondary">
          Loading your performance score...
        </div>
      </Card>
    );
  }

  // Show empty state if no data or error
  if (error || !data) {
    return (
      <Card className="p-4">
        <SectionHeader
          title="Your Level"
          description="Service Reliability Score and tier status"
        />
        <div className="p-4 text-center text-text-secondary text-sm">
          {error ? (
            <div>
              <div className="mb-2">
                Unable to load performance score.
              </div>
              <div className="text-xs">
                Complete your first visits to generate a performance score.
              </div>
            </div>
          ) : (
            'Complete your first visits to generate a performance score.'
          )}
        </div>
      </Card>
    );
  }

  const tierColors: Record<string, string> = {
    foundation: tokens.colors.neutral[500],
    reliant: tokens.colors.info.DEFAULT,
    trusted: tokens.colors.success.DEFAULT,
    preferred: tokens.colors.warning.DEFAULT,
  };

  const tierLabels: Record<string, string> = {
    foundation: 'Foundation',
    reliant: 'Reliant',
    trusted: 'Trusted',
    preferred: 'Preferred',
  };

  return (
    <Card className="p-4">
      <SectionHeader
        title="Your Level"
        description="Service Reliability Score and tier status"
      />
      <div className="flex flex-col gap-4">
        {/* Tier Badge */}
        <div className="flex items-center gap-3">
          <Badge
            variant="default"
            style={{
              backgroundColor: tierColors[data.tier] || tokens.colors.neutral[500],
              color: 'white',
              padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
            }}
            className="text-base"
          >
            {tierLabels[data.tier] || data.tier}
          </Badge>
          {data.provisional && (
            <Badge variant="warning">Provisional</Badge>
          )}
          {data.atRisk && (
            <Badge variant="error">At Risk</Badge>
          )}
        </div>

        {/* Score */}
        <div>
          <div className="text-xl font-bold mb-1">
            Service Reliability Score: {data.score.toFixed(1)}/100
          </div>
          {data.rolling26w && (
            <div className="text-sm text-text-secondary">
              26-week average: {data.rolling26w.toFixed(1)}
            </div>
          )}
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Responsiveness: {data.breakdown.responsiveness.toFixed(1)}/20</div>
          <div>Acceptance: {data.breakdown.acceptance.toFixed(1)}/12</div>
          <div>Completion: {data.breakdown.completion.toFixed(1)}/8</div>
          <div>Timeliness: {data.breakdown.timeliness.toFixed(1)}/20</div>
          <div>Accuracy: {data.breakdown.accuracy.toFixed(1)}/20</div>
          <div>Engagement: {data.breakdown.engagement.toFixed(1)}/10</div>
          <div>Conduct: {data.breakdown.conduct.toFixed(1)}/10</div>
        </div>

        {/* At Risk Reason */}
        {data.atRisk && data.atRiskReason && (
          <div className="p-3 bg-status-danger-bg rounded-md text-sm text-status-danger-text">
            <strong>At Risk:</strong> {data.atRiskReason}
          </div>
        )}

        {/* Next Actions */}
        {data.nextActions.length > 0 && (
          <div>
            <div className="font-semibold mb-2">
              Next Actions:
            </div>
            <ul className="m-0 pl-4 text-sm">
              {data.nextActions.map((action, i) => (
                <li key={i} className="mb-1">
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Perks */}
        {(data.perks.priority || data.perks.mentorship || data.perks.reducedOversight) && (
          <div>
            <div className="font-semibold mb-2">
              Perks Unlocked:
            </div>
            <div className="text-sm">
              {data.perks.priority && '✓ Priority booking access\n'}
              {data.perks.mentorship && '✓ Mentorship opportunities\n'}
              {data.perks.reducedOversight && '✓ Reduced oversight\n'}
              {data.perks.multipliers.holiday > 1 && `✓ ${data.perks.multipliers.holiday}x holiday pay`}
            </div>
          </div>
        )}

        {/* Compensation */}
        {data.compensation && (
          <div className="p-3 bg-surface-secondary rounded-md">
            <div className="text-sm">
              <strong>Current Pay:</strong> ${data.compensation.basePay.toFixed(2)}/hour
            </div>
            {data.compensation.nextReviewDate && (
              <div className="text-sm text-text-secondary mt-1">
                Next review: {new Date(data.compensation.nextReviewDate).toLocaleDateString()}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
