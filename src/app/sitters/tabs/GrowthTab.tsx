'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, EmptyState } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';

type SitterReliability = {
  sitterId: string;
  sitter: { id: string; firstName: string; lastName: string; active: boolean };
  tier: string;
  score: number;
  provisional: boolean;
  atRisk: boolean;
};

type PolicyTier = {
  id: string;
  name: string;
  priorityLevel: number;
  commissionSplit: number;
};

export function GrowthTab() {
  const [srsSitters, setSrsSitters] = useState<SitterReliability[]>([]);
  const [policyTiers, setPolicyTiers] = useState<PolicyTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [srsRes, tiersRes] = await Promise.all([
          fetch('/api/sitters/srs'),
          fetch('/api/sitter-tiers'),
        ]);
        const srsBody = await srsRes.json().catch(() => ({}));
        const tiersBody = await tiersRes.json().catch(() => ({}));
        if (!srsRes.ok) throw new Error(srsBody.error || 'Failed to fetch sitter reliability data');
        if (!tiersRes.ok) throw new Error(tiersBody.error || 'Failed to fetch policy tiers');
        setSrsSitters(srsBody.sitters || []);
        setPolicyTiers(tiersBody.tiers || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load growth data');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const distribution = useMemo(() => {
    const buckets = { foundation: 0, reliant: 0, trusted: 0, preferred: 0 } as Record<string, number>;
    for (const sitter of srsSitters) {
      const key = sitter.tier?.toLowerCase?.();
      if (key in buckets) buckets[key] += 1;
    }
    return buckets;
  }, [srsSitters]);

  const sortedByScore = useMemo(() => [...srsSitters].sort((a, b) => b.score - a.score), [srsSitters]);
  const topPerformers = sortedByScore.slice(0, 5);
  const bottomPerformers = [...sortedByScore].reverse().slice(0, 5);

  const tierColor = (tier: string) => {
    switch ((tier || '').toLowerCase()) {
      case 'preferred': return tokens.colors.info.DEFAULT;
      case 'trusted': return tokens.colors.success.DEFAULT;
      case 'reliant': return tokens.colors.warning.DEFAULT;
      default: return tokens.colors.neutral[500];
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Link href="/settings?section=tiers">
          <Button variant="secondary" size="sm">Manage Policy Tiers</Button>
        </Link>
      </div>

      {loading ? (
        <Card><div className="p-4">Loading growth data...</div></Card>
      ) : error ? (
        <Card><div className="p-4 text-error">{error}</div></Card>
      ) : (
        <>
          <Card>
            <div className="p-4">
              <h3 className="font-semibold mb-3">Reliability Tier Distribution (SRS)</h3>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(distribution).map(([tier, count]) => (
                  <div key={tier} className="border border-border-default rounded-md p-3">
                    <p className="text-xs text-text-secondary capitalize">{tier}</p>
                    <p className="text-xl font-bold">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <h3 className="font-semibold mb-3">Top Performers (SRS)</h3>
              {topPerformers.length === 0 ? (
                <EmptyState title="No reliability snapshots yet" description="Run SRS snapshots to populate growth metrics." />
              ) : (
                <div className="flex flex-col gap-2">
                  {topPerformers.map((sitter) => (
                    <div key={sitter.sitterId} className="flex justify-between items-center border-b border-border-muted pb-2">
                      <div>
                        <Link href={`/sitters/${sitter.sitterId}`} className="font-semibold">{sitter.sitter.firstName} {sitter.sitter.lastName}</Link>
                        <div className="text-xs text-text-secondary">Score {sitter.score.toFixed(1)}</div>
                      </div>
                      <Badge variant="default" style={{ backgroundColor: tierColor(sitter.tier), color: '#fff' }}>{sitter.tier}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <h3 className="font-semibold mb-3">Bottom Performers (SRS)</h3>
              {bottomPerformers.length === 0 ? (
                <EmptyState title="No reliability snapshots yet" description="Run SRS snapshots to populate growth metrics." />
              ) : (
                <div className="flex flex-col gap-2">
                  {bottomPerformers.map((sitter) => (
                    <div key={sitter.sitterId} className="flex justify-between items-center border-b border-border-muted pb-2">
                      <div>
                        <Link href={`/sitters/${sitter.sitterId}`} className="font-semibold">{sitter.sitter.firstName} {sitter.sitter.lastName}</Link>
                        <div className="text-xs text-text-secondary">Score {sitter.score.toFixed(1)}</div>
                      </div>
                      <Badge variant="default" style={{ backgroundColor: tierColor(sitter.tier), color: '#fff' }}>{sitter.tier}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <h3 className="font-semibold mb-3">Policy Tier Coverage (Settings)</h3>
              {policyTiers.length === 0 ? (
                <EmptyState
                  title="No policy tiers configured"
                  description="Create policy tiers to control entitlement/routing rules."
                  action={{ label: 'Create Policy Tier', onClick: () => (window.location.href = '/settings/tiers/new') }}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {policyTiers.map((tier) => (
                    <div key={tier.id} className="border border-border-default rounded-md p-3">
                      <p className="font-semibold">{tier.name}</p>
                      <p className="text-sm text-text-secondary">Priority {tier.priorityLevel} &middot; Commission {tier.commissionSplit}%</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
