'use client';

import { Section } from '@/components/layout';
import { AppErrorState } from '@/components/app';
import { Button, EmptyState } from '@/components/ui';
import { PageSkeleton } from '@/components/ui/loading-state';
import { toastSuccess, toastError } from '@/lib/toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface RankedSitter {
  id: string;
  name: string;
  tier: string;
  commissionPct: number;
  acceptanceRate: number;
  completionRate: number;
  onTimeRate: number;
  totalBookings: number;
  completedBookings: number;
  compositeScore: number;
}

const metricColor = (value: number, threshold: number) =>
  value >= threshold ? 'text-status-success-text' : value >= threshold * 0.8 ? 'text-status-warning-text' : 'text-status-danger-text';

export function RankingsTab() {
  const queryClient = useQueryClient();

  const { data: rankings = [], isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['owner', 'sitter-rankings'],
    queryFn: async () => {
      const res = await fetch('/api/ops/sitters/rankings');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed');
      return json.rankings || [];
    },
  });

  const error = queryError?.message ?? null;

  const evaluateTiersMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ops/sitters/evaluate-tiers', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed');
      return json;
    },
    onSuccess: (json) => {
      toastSuccess(`Evaluated ${json.evaluated} sitters: ${json.promoted} promoted, ${json.demoted} demoted`);
      queryClient.invalidateQueries({ queryKey: ['owner', 'sitter-rankings'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Failed'),
  });

  return (
    <>
      <div className="flex items-center justify-end mb-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => evaluateTiersMutation.mutate()}
          disabled={evaluateTiersMutation.isPending}
        >
          {evaluateTiersMutation.isPending ? 'Evaluating\u2026' : 'Evaluate tiers'}
        </Button>
      </div>

      <Section>
        {loading ? <PageSkeleton /> : error ? (
          <AppErrorState title="Couldn't load" subtitle={error} onRetry={() => void refetch()} />
        ) : rankings.length === 0 ? (
          <EmptyState title="No active sitters" description="Add sitters to see performance rankings." />
        ) : (
          <div className="space-y-2">
            {rankings.map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-4 rounded-xl border border-border-default bg-surface-primary px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-tertiary text-sm font-bold text-text-secondary">
                  {i === 0 ? '\ud83c\udfc6' : `#${i + 1}`}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">{s.name}</p>
                    <span className="rounded-full bg-accent-tertiary px-2 py-0.5 text-[10px] font-medium text-accent-primary">{s.tier}</span>
                    {i === 0 && <span className="rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-bold text-status-warning-text">Top performer</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                    <span className={metricColor(s.acceptanceRate, 70)}>Accept: {s.acceptanceRate}%</span>
                    <span className={metricColor(s.completionRate, 90)}>Complete: {s.completionRate}%</span>
                    <span className={metricColor(s.onTimeRate, 85)}>On-time: {s.onTimeRate}%</span>
                    <span className="text-text-tertiary">{s.completedBookings} visits</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold text-text-primary">{s.compositeScore}</p>
                  <p className="text-[10px] text-text-tertiary">score</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
