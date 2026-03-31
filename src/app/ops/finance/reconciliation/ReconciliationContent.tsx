'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { OwnerAppShell, LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { AppCard, AppCardBody, AppErrorState, getStatusPill } from '@/components/app';
import { Button, Input, EmptyState, DataTableShell, Table, useToast } from '@/components/ui';
import { PageSkeleton } from '@/components/ui/loading-state';
import { StatusChip } from '@/components/ui/status-chip';

interface ReconcileRun {
  id: string;
  rangeStart: string;
  rangeEnd: string;
  status: string;
  totalsJson?: Record<string, number>;
  mismatchJson?: {
    missingInDb?: unknown[];
    missingInStripe?: unknown[];
    amountDiffs?: unknown[];
    error?: string;
  };
  createdAt: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ReconciliationContent() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [runs, setRuns] = useState<ReconcileRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ops/finance/reconcile/runs?limit=20');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Failed to load runs');
        setRuns([]);
        return;
      }
      setRuns(json.runs || []);
    } catch {
      setError('Failed to load runs');
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
  }, [session, sessionStatus, router]);

  useEffect(() => {
    if (!session) return;
    const urlStart = searchParams.get('start');
    const urlEnd = searchParams.get('end');
    if (urlStart && urlEnd) {
      setStartInput(urlStart);
      setEndInput(urlEnd);
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const s = start.toISOString().slice(0, 10);
      const e = end.toISOString().slice(0, 10);
      setStartInput(s);
      setEndInput(e);
      router.replace(`${pathname}?start=${s}&end=${e}`);
    }
    void load();
  }, [session, load, searchParams, pathname, router]);

  const runReconciliation = async () => {
    const start = startInput ? new Date(startInput) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endInput ? new Date(endInput) : new Date();
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      showToast({ variant: 'error', message: 'Invalid date range' });
      return;
    }
    setRunning(true);
    try {
      const res = await fetch('/api/ops/finance/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: start.toISOString(), end: end.toISOString() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed');
      showToast({ variant: 'success', message: `Reconciliation enqueued: ${json.jobId}` });
      void load();
    } catch (e) {
      showToast({ variant: 'error', message: e instanceof Error ? e.message : 'Failed to run reconciliation' });
    } finally {
      setRunning(false);
    }
  };

  const exportLedger = (format: 'csv' | 'json') => {
    const start = startInput ? new Date(startInput) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endInput ? new Date(endInput) : new Date();
    const url = `/api/ops/finance/ledger/export?start=${start.toISOString()}&end=${end.toISOString()}&format=${format}`;
    window.open(url, '_blank');
  };

  if (sessionStatus === 'loading') {
    return (
      <OwnerAppShell>
        <LayoutWrapper>
          <PageHeader title="Finance Reconciliation" subtitle="Loading..." />
          <PageSkeleton />
        </LayoutWrapper>
      </OwnerAppShell>
    );
  }
  if (!session) return null;

  return (
    <OwnerAppShell>
      <LayoutWrapper>
        <PageHeader
          title="Finance Reconciliation"
          subtitle="Ledger vs Stripe comparison and audit export"
          actions={
            <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          }
        />
        <Section>
      {loading ? (
        <PageSkeleton />
      ) : error ? (
        <AppErrorState title="Couldn't load reconciliation" subtitle={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-4">
          <AppCard>
            <AppCardBody>
              <p className="mb-3 font-medium text-neutral-900">Run reconciliation</p>
              <p className="mb-3 text-sm text-neutral-600">
                Compare your internal payment records against Stripe to find discrepancies.
              </p>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <label className="text-sm text-neutral-700">Start</label>
                <Input
                  type="date"
                  value={startInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStartInput(v);
                    if (v && endInput) router.replace(`${pathname}?start=${v}&end=${endInput}`);
                  }}
                  className="max-w-[160px]"
                />
                <label className="text-sm text-neutral-700">End</label>
                <Input
                  type="date"
                  value={endInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEndInput(v);
                    if (startInput && v) router.replace(`${pathname}?start=${startInput}&end=${v}`);
                  }}
                  className="max-w-[160px]"
                />
                <Button variant="primary" size="sm" onClick={() => void runReconciliation()} disabled={running}>
                  {running ? 'Running...' : 'Run reconciliation'}
                </Button>
              </div>
            </AppCardBody>
          </AppCard>

          <AppCard>
            <AppCardBody>
              <p className="mb-3 font-medium text-neutral-900">Export ledger</p>
              <p className="mb-3 text-sm text-neutral-600">
                Export payment records for the selected date range.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => exportLedger('csv')}>
                  Export CSV
                </Button>
                <Button variant="secondary" size="sm" onClick={() => exportLedger('json')}>
                  Export JSON
                </Button>
              </div>
            </AppCardBody>
          </AppCard>

          <AppCard>
            <AppCardBody>
              <p className="mb-3 font-medium text-neutral-900">Recent runs</p>
              {runs.length === 0 ? (
                <EmptyState
                  title="No runs yet"
                  description="Run reconciliation above to compare ledger vs Stripe."
                  primaryAction={{ label: 'Run reconciliation', onClick: () => void runReconciliation() }}
                />
              ) : (
                <DataTableShell className="max-h-96" stickyHeader>
                  <Table<ReconcileRun>
                    columns={[
                      { key: 'range', header: 'Date range', mobileOrder: 1, mobileLabel: 'Range', render: (r) => (
                        <span className="font-medium">{formatDate(r.rangeStart)} – {formatDate(r.rangeEnd)}</span>
                      )},
                      { key: 'status', header: 'Status', mobileOrder: 2, mobileLabel: 'Status', render: (r) => (
                        <StatusChip
                          variant={r.status === 'succeeded' ? 'success' : 'danger'}
                          ariaLabel={`Reconciliation run status: ${r.status}`}
                        >
                          {getStatusPill(r.status).label}
                        </StatusChip>
                      )},
                      { key: 'totals', header: 'Totals', mobileOrder: 3, mobileLabel: 'Totals', hideBelow: 'md', render: (r) =>
                        r.totalsJson && Object.keys(r.totalsJson).length > 0
                          ? Object.entries(r.totalsJson).map(([k, v]) => `${k}=$${(v / 100).toFixed(2)}`).join(', ')
                          : '—'
                      },
                      { key: 'mismatch', header: 'Mismatches', mobileOrder: 4, mobileLabel: 'Mismatches', hideBelow: 'lg', render: (r) => {
                        const parts: string[] = [];
                        if (r.mismatchJson?.missingInDb?.length) parts.push(`Ledger: ${r.mismatchJson.missingInDb.length}`);
                        if (r.mismatchJson?.missingInStripe?.length) parts.push(`Stripe: ${r.mismatchJson.missingInStripe.length}`);
                        if (r.mismatchJson?.error) parts.push('Error');
                        return parts.length ? <span className="text-amber-700">{parts.join('; ')}</span> : '—';
                      }},
                    ]}
                    data={runs}
                    keyExtractor={(r) => r.id}
                    emptyMessage="No runs yet"
                    forceTableLayout
                  />
                </DataTableShell>
              )}
            </AppCardBody>
          </AppCard>
        </div>
      )}
        </Section>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}
