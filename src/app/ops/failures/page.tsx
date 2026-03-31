'use client';

/**
 * Queue Failures - Admin view for QueueJobRecord.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSSE } from '@/hooks/useSSE';
import { OwnerAppShell, LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { AppErrorState } from '@/components/app';
import { getStatusPill } from '@/components/app/getStatusPill';
import { Button, DataTableShell, EmptyState, StatusChip, Table, TableSkeleton } from '@/components/ui';
import { PageSkeleton } from '@/components/ui/loading-state';
import { formatServiceName } from '@/lib/format-utils';

interface FailureItem {
  id: string;
  queueName: string;
  jobName: string;
  jobId: string;
  status: string;
  retryCount: number;
  lastError: string | null;
  providerErrorCode: string | null;
  subsystem: string;
  resourceType: string | null;
  resourceId: string | null;
  correlationId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastRetryAt: string | null;
  lastRetryBy: string | null;
  booking: { id: string; clientName: string; service: string; startAt: string; status: string } | null;
  sitter: { id: string; name: string; active: boolean } | null;
}

type StatusFilter = 'failed+dead' | 'failed' | 'dead' | 'all';

const STATUS_QUERY: Record<StatusFilter, string | null> = {
  'failed+dead': 'FAILED,DEAD_LETTERED',
  failed: 'FAILED',
  dead: 'DEAD_LETTERED',
  all: null,
};

const SUBSYSTEM_OPTIONS = [
  '',
  'automation',
  'calendar',
  'payout',
  'finance',
  'reminder',
  'srs',
  'summary',
  'reconciliation',
  'messaging',
  'system',
];

export default function QueueFailuresPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<FailureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('failed+dead');
  const [subsystem, setSubsystem] = useState('');
  const [correlationId, setCorrelationId] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    const statusParam = STATUS_QUERY[statusFilter];
    if (statusParam) params.set('status', statusParam);
    if (subsystem) params.set('subsystem', subsystem);
    if (correlationId) params.set('correlationId', correlationId);
    if (resourceType) params.set('resourceType', resourceType);
    if (resourceId) params.set('resourceId', resourceId);
    if (fromDate) params.set('from', `${fromDate}T00:00:00.000Z`);
    if (toDate) params.set('to', `${toDate}T23:59:59.999Z`);
    return params.toString();
  }, [statusFilter, subsystem, correlationId, resourceType, resourceId, fromDate, toDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = buildQuery();
      const url = query ? `/api/ops/failures?${query}` : '/api/ops/failures';
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Failed to load');
        setItems([]);
        return;
      }
      setItems(json.items || []);
    } catch {
      setError('Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
  }, [session, sessionStatus, router]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const sseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/realtime/ops/failures` : null;
  useSSE(sseUrl, () => void load(), !!session);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/ops/failures/${id}/retry`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        alert(json.error || 'Retry already queued');
        return;
      }
      if (!res.ok) {
        alert(json.error || 'Retry failed');
        return;
      }
      void load();
    } finally {
      setRetryingId(null);
    }
  };

  const tableRows = useMemo(() => items, [items]);

  if (sessionStatus === 'loading') {
    return (
      <OwnerAppShell>
        <LayoutWrapper>
          <PageHeader title="Queue Failures" subtitle="Loading..." />
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
          title="Queue Failures"
          subtitle="Failed background jobs with retry controls"
        />
        <Section>
          <div className="mb-4 grid gap-3 md:grid-cols-6">
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-text-secondary">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="failed+dead">Failed + Dead</option>
                <option value="failed">Failed</option>
                <option value="dead">Dead-lettered</option>
                <option value="all">All</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-text-secondary">System</label>
              <select
                value={subsystem}
                onChange={(e) => setSubsystem(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                {SUBSYSTEM_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option || 'All'}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-text-secondary">Type</label>
              <input
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                placeholder="booking"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-text-secondary">Reference ID</label>
              <input
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                placeholder="resource id"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-text-secondary">Trace ID</label>
              <input
                value={correlationId}
                onChange={(e) => setCorrelationId(e.target.value)}
                placeholder="corr id"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-1 flex items-end">
              <Button variant="secondary" onClick={() => void load()} disabled={loading}>
                Refresh
              </Button>
            </div>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-6">
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-text-secondary">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-text-secondary">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : error ? (
            <AppErrorState title="Couldn't load failures" subtitle={error} onRetry={() => void load()} />
          ) : tableRows.length === 0 ? (
            <EmptyState
              title="No queue failures"
              description="Failed jobs will appear here."
            />
          ) : (
            <DataTableShell stickyHeader>
              <Table<FailureItem>
                columns={[
                  {
                    key: 'job',
                    header: 'Job',
                    mobileLabel: 'Job',
                    mobileOrder: 1,
                    render: (row) => (
                      <div>
                        <p className="font-medium text-text-primary">{row.jobName}</p>
                        <p className="text-xs text-text-tertiary">{row.queueName} · {row.jobId}</p>
                        {row.correlationId && (
                          <p className="text-[11px] text-text-tertiary">Trace: {row.correlationId}</p>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    mobileLabel: 'Status',
                    mobileOrder: 2,
                    render: (row) => {
                      const pill = getStatusPill(String(row.status));
                      const variant =
                        pill.variant === 'success'
                          ? 'success'
                          : pill.variant === 'warning'
                            ? 'warning'
                            : pill.variant === 'error'
                              ? 'danger'
                              : pill.variant === 'info'
                                ? 'info'
                                : 'neutral';
                      return (
                        <div className="space-y-1">
                          <StatusChip variant={variant} ariaLabel={`Job status ${pill.label}`}>
                            {pill.label}
                          </StatusChip>
                          <p className="text-xs text-text-tertiary">Retry {row.retryCount}</p>
                        </div>
                      );
                    },
                  },
                  {
                    key: 'resource',
                    header: 'Resource',
                    mobileLabel: 'Resource',
                    mobileOrder: 3,
                    render: (row) => (
                      <div>
                        {row.booking ? (
                          <div>
                            <Link href={`/bookings?booking=${row.booking.id}`} className="text-sm text-text-primary hover:underline">
                              {row.booking.clientName || 'Booking'} · {formatServiceName(row.booking.service)}
                            </Link>
                            <p className="text-xs text-text-tertiary">Booking {row.booking.id}</p>
                          </div>
                        ) : row.sitter ? (
                          <div>
                            <p className="text-sm text-text-primary">{row.sitter.name || 'Sitter'}</p>
                            <p className="text-xs text-text-tertiary">Sitter {row.sitter.id}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm text-text-primary">{row.resourceType || '—'}</p>
                            <p className="text-xs text-text-tertiary">{row.resourceId || '—'}</p>
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'error',
                    header: 'Failure',
                    mobileLabel: 'Failure',
                    mobileOrder: 4,
                    hideBelow: 'md',
                    render: (row) => (
                      <div className="max-w-[520px]">
                        <p className="line-clamp-2 text-sm text-text-secondary">{row.lastError || 'No error detail'}</p>
                        <p className="text-xs text-text-tertiary">
                          {row.providerErrorCode ? `Provider: ${row.providerErrorCode}` : 'No provider code'}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: 'actions',
                    header: 'Actions',
                    mobileLabel: 'Actions',
                    mobileOrder: 5,
                    align: 'right',
                    render: (row) => {
                      const canRetry = row.status === 'FAILED' || row.status === 'DEAD_LETTERED';
                      if (!canRetry) {
                        return <span className="text-xs text-text-tertiary">—</span>;
                      }
                      return (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleRetry(row.id)}
                          disabled={retryingId === row.id}
                        >
                          {retryingId === row.id ? 'Retrying' : 'Retry'}
                        </Button>
                      );
                    },
                  },
                ]}
                data={tableRows}
                keyExtractor={(row) => row.id}
                emptyMessage="No queue failures"
                forceTableLayout
              />
            </DataTableShell>
          )}
        </Section>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}
