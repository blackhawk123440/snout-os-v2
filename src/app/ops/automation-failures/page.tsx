'use client';

/**
 * Automation Failures - Admin view: Failures, Dead, Successes tabs + Retry.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { OwnerAppShell, LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { AppErrorState } from '@/components/app';
import { getStatusPill } from '@/components/app/getStatusPill';
import { Button, DataTableShell, EmptyState, StatusChip, Table, TableSkeleton } from '@/components/ui';
import { formatDateTime } from '@/lib/format-utils';
import { PageSkeleton } from '@/components/ui/loading-state';

interface FailureItem {
  id: string;
  eventType?: string;
  automationType: string;
  status: string;
  error: string | null;
  bookingId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

type Tab = 'fail' | 'dead' | 'success';

export default function AutomationFailuresPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<FailureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('fail');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ops/automation-failures?limit=50&tab=${tab}`);
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
  }, [tab]);

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

  const handleRetry = async (eventLogId: string) => {
    setRetryingId(eventLogId);
    try {
      const res = await fetch(`/api/ops/automation-failures/${eventLogId}/retry`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        alert(json.error || 'Job already succeeded');
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

  if (sessionStatus === 'loading') {
    return (
      <OwnerAppShell>
        <LayoutWrapper>
          <PageHeader title="Automation Failures" subtitle="Loading..." />
          <PageSkeleton />
        </LayoutWrapper>
      </OwnerAppShell>
    );
  }
  if (!session) return null;

  const canRetry = tab === 'fail' || tab === 'dead';

  return (
    <OwnerAppShell>
      <LayoutWrapper>
        <PageHeader
          title="Automation Failures"
          subtitle="Failed and recent automation jobs with retry controls"
        />
        <Section>
          <div className="mb-4 flex gap-2">
            {(['fail', 'dead', 'success'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  tab === t
                    ? 'bg-surface-inverse text-white'
                    : 'bg-surface-tertiary text-text-secondary hover:bg-surface-secondary'
                }`}
              >
                {t === 'fail' ? 'Failures' : t === 'dead' ? 'Dead' : 'Recent Successes'}
              </button>
            ))}
          </div>
      {loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : error ? (
        <AppErrorState title="Couldn't load" subtitle={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={tab === 'success' ? 'No recent successes' : `No ${tab} events`}
          description={tab === 'success' ? 'Successful automation runs will appear here.' : 'Jobs are processing successfully.'}
        />
      ) : (
        <DataTableShell stickyHeader>
          <Table<FailureItem>
            columns={[
              {
                key: 'automationType',
                header: 'Automation',
                mobileLabel: 'Automation',
                mobileOrder: 1,
                render: (row) => (
                  <div>
                    <p className="font-medium text-text-primary">{row.automationType}</p>
                    <p className="text-xs text-text-tertiary">{formatDateTime(row.createdAt)}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                mobileLabel: 'Status',
                mobileOrder: 2,
                render: (row) => {
                  const pill = getStatusPill(row.status);
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
                    <StatusChip variant={variant} ariaLabel={`Automation status ${pill.label}`}>
                      {pill.label}
                    </StatusChip>
                  );
                },
              },
              {
                key: 'detail',
                header: 'Detail',
                mobileLabel: 'Detail',
                mobileOrder: 3,
                hideBelow: 'md',
                render: (row) => (
                  <div className="max-w-[520px]">
                    <p className="line-clamp-2 text-sm text-text-secondary">{row.error || 'No error detail'}</p>
                    {row.bookingId && <p className="text-xs text-text-tertiary">Booking: {row.bookingId}</p>}
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                mobileLabel: 'Actions',
                mobileOrder: 4,
                align: 'right',
                render: (row) =>
                  canRetry ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleRetry(row.id)}
                      disabled={retryingId === row.id}
                    >
                      {retryingId === row.id ? 'Retrying' : 'Re-run'}
                    </Button>
                  ) : (
                    <span className="text-xs text-text-tertiary">—</span>
                  ),
              },
            ]}
            data={items}
            keyExtractor={(row) => row.id}
            emptyMessage="No automation events"
            forceTableLayout
          />
        </DataTableShell>
      )}
        </Section>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}
