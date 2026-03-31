/**
 * Sitter Growth Tab (Owner View)
 *
 * Shows all sitters with SRS scores, tiers, and breakdowns
 * Located in /messages → internal tab "Sitters → Growth"
 */

'use client';

import { useState } from 'react';
import { Card, Badge, Button, SectionHeader, Table, TableColumn } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { useQuery } from '@tanstack/react-query';

interface SitterSRSData {
  sitterId: string;
  sitter: {
    id: string;
    firstName: string;
    lastName: string;
    active: boolean;
  };
  tier: string;
  score: number;
  provisional: boolean;
  atRisk: boolean;
  atRiskReason?: string;
  visits30d: number;
  lastUpdated: string;
  breakdown: {
    responsiveness: number;
    acceptance: number;
    completion: number;
    timeliness: number;
    accuracy: number;
    engagement: number;
    conduct: number;
  };
}

interface SitterSRSDetail {
  snapshot: {
    rolling30dScore: number;
    rolling26wScore: number | null;
    breakdown: any;
    visits30d: number;
    offers30d: number;
    atRisk: boolean;
    atRiskReason?: string;
    asOfDate: string;
  } | null;
  current: any;
  rolling26w: any;
  compensation: any;
}

export function SitterGrowthTab() {
  const [selectedSitterId, setSelectedSitterId] = useState<string | null>(null);

  const { data: sittersData, isLoading } = useQuery<{ sitters: SitterSRSData[] }>({
    queryKey: ['sitters-srs'],
    queryFn: async () => {
      const res = await fetch('/api/sitters/srs');
      if (!res.ok) throw new Error('Failed to fetch SRS data');
      return res.json();
    },
  });

  const { data: detailData } = useQuery<SitterSRSDetail>({
    queryKey: ['sitter-srs-detail', selectedSitterId],
    queryFn: async () => {
      if (!selectedSitterId) return null;
      const res = await fetch(`/api/sitters/${selectedSitterId}/srs`);
      if (!res.ok) throw new Error('Failed to fetch SRS detail');
      return res.json();
    },
    enabled: !!selectedSitterId,
  });

  const tierColors: Record<string, string> = {
    foundation: 'var(--color-text-tertiary)',
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

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="text-sm text-text-secondary">
          Loading sitter growth data...
        </div>
      </Card>
    );
  }

  const sitters = sittersData?.sitters || [];

  const columns: TableColumn<SitterSRSData>[] = [
    {
      key: 'sitter',
      header: 'Sitter',
      render: (row) => (
        <div>
          <div className="font-semibold">
            {row.sitter.firstName} {row.sitter.lastName}
          </div>
          <div className="text-sm text-text-secondary">
            {row.sitter.active ? 'Active' : 'Inactive'}
          </div>
        </div>
      ),
    },
    {
      key: 'tier',
      header: 'Tier',
      render: (row) => (
        <Badge
          variant="default"
          style={{
            backgroundColor: tierColors[row.tier] || 'var(--color-text-tertiary)',
            color: 'white',
          }}
        >
          {tierLabels[row.tier] || row.tier}
        </Badge>
      ),
    },
    {
      key: 'score',
      header: 'SRS 30d',
      render: (row) => (
        <div>
          <div className="font-semibold">
            {row.score.toFixed(1)}
            {row.provisional && <span className="ml-1 text-xs">*</span>}
          </div>
          {row.provisional && (
            <div className="text-xs text-text-secondary">
              Provisional
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'atRisk',
      header: 'Status',
      render: (row) => (
        <div>
          {row.atRisk ? (
            <Badge variant="error">At Risk</Badge>
          ) : (
            <Badge variant="success">On Track</Badge>
          )}
          {row.atRiskReason && (
            <div className="text-xs text-text-secondary mt-1">
              {row.atRiskReason}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'breakdown',
      header: 'Breakdown',
      render: (row) => (
        <div className="flex gap-1 text-xs">
          <div style={{ width: '20px', height: '4px', backgroundColor: row.breakdown.responsiveness >= 15 ? tokens.colors.success.DEFAULT : tokens.colors.error.DEFAULT }} />
          <div style={{ width: '20px', height: '4px', backgroundColor: (row.breakdown.acceptance + row.breakdown.completion) >= 15 ? tokens.colors.success.DEFAULT : tokens.colors.error.DEFAULT }} />
          <div style={{ width: '20px', height: '4px', backgroundColor: row.breakdown.timeliness >= 15 ? tokens.colors.success.DEFAULT : tokens.colors.error.DEFAULT }} />
          <div style={{ width: '20px', height: '4px', backgroundColor: row.breakdown.accuracy >= 15 ? tokens.colors.success.DEFAULT : tokens.colors.error.DEFAULT }} />
          <div style={{ width: '20px', height: '4px', backgroundColor: row.breakdown.engagement >= 8 ? tokens.colors.success.DEFAULT : tokens.colors.error.DEFAULT }} />
          <div style={{ width: '20px', height: '4px', backgroundColor: row.breakdown.conduct >= 7 ? tokens.colors.success.DEFAULT : tokens.colors.error.DEFAULT }} />
        </div>
      ),
    },
    {
      key: 'lastUpdated',
      header: 'Last Updated',
      render: (row) => (
        <div className="text-sm text-text-secondary">
          {new Date(row.lastUpdated).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSelectedSitterId(row.sitterId)}
        >
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionHeader
          title="Sitter Growth Levels"
          description="Service Reliability Scores and tier status for all sitters"
        />
        <div className="p-4">
          {sitters.length === 0 ? (
            <div className="p-6 text-center text-text-secondary">
              No sitter data available. Run snapshot to generate scores.
            </div>
          ) : (
            <Table
              data={sitters}
              columns={columns}
            />
          )}
        </div>
      </Card>

      {/* Drilldown Drawer */}
      {selectedSitterId && detailData && (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <SectionHeader
              title={`${sitters.find(s => s.sitterId === selectedSitterId)?.sitter.firstName} ${sitters.find(s => s.sitterId === selectedSitterId)?.sitter.lastName} - SRS Details`}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedSitterId(null)}
            >
              Close
            </Button>
          </div>
          <div className="p-4 flex flex-col gap-4">
            {detailData.snapshot ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-text-secondary mb-1">
                      Rolling 30-Day Score
                    </div>
                    <div className="text-xl font-bold">
                      {detailData.snapshot.rolling30dScore.toFixed(1)}/100
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-text-secondary mb-1">
                      Rolling 26-Week Score
                    </div>
                    <div className="text-xl font-bold">
                      {detailData.snapshot.rolling26wScore ? detailData.snapshot.rolling26wScore.toFixed(1) : 'N/A'}/100
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-semibold mb-2">
                    Category Breakdown
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Responsiveness: {detailData.snapshot.breakdown.responsiveness.toFixed(1)}/20</div>
                    <div>Acceptance: {detailData.snapshot.breakdown.acceptance.toFixed(1)}/12</div>
                    <div>Completion: {detailData.snapshot.breakdown.completion.toFixed(1)}/8</div>
                    <div>Timeliness: {detailData.snapshot.breakdown.timeliness.toFixed(1)}/20</div>
                    <div>Accuracy: {detailData.snapshot.breakdown.accuracy.toFixed(1)}/20</div>
                    <div>Engagement: {detailData.snapshot.breakdown.engagement.toFixed(1)}/10</div>
                    <div>Conduct: {detailData.snapshot.breakdown.conduct.toFixed(1)}/10</div>
                  </div>
                </div>

                <div>
                  <div className="font-semibold mb-2">
                    Sample Sizes
                  </div>
                  <div className="text-sm">
                    <div>Visits (30d): {detailData.snapshot.visits30d}</div>
                    <div>Offers (30d): {detailData.snapshot.offers30d}</div>
                  </div>
                </div>

                {detailData.snapshot.atRisk && (
                  <div className="p-3 bg-status-danger-bg rounded-md">
                    <div className="font-semibold mb-1">
                      At Risk
                    </div>
                    <div className="text-sm">
                      {detailData.snapshot.atRiskReason || 'Score below tier minimum'}
                    </div>
                  </div>
                )}

                <div className="text-sm text-text-secondary">
                  Last snapshot: {new Date(detailData.snapshot.asOfDate).toLocaleString()}
                </div>
              </>
            ) : (
              <div className="text-text-secondary">
                No snapshot data available. Run snapshot to generate.
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
