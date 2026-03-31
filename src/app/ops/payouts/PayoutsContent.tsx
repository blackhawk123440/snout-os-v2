'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useQueryState } from '@/hooks/useQueryState';
import { MobileFilterDrawer } from '@/components/app/MobileFilterDrawer';
import { OwnerAppShell, LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { AppErrorState, getStatusPill } from '@/components/app';
import { Button, EmptyState, StatusChip, Table, TableSkeleton, DataTableShell } from '@/components/ui';
import { formatDate as fmtDate } from '@/lib/format-utils';

interface PayoutItem {
  id: string;
  sitterId: string;
  sitterName: string;
  bookingId?: string | null;
  stripeTransferId?: string | null;
  amount: number;
  currency: string;
  status: string;
  lastError?: string | null;
  createdAt: string;
}

type StatusFilter = 'all' | 'paid' | 'pending' | 'failed' | 'reversed';

export function PayoutsContent() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [transfers, setTransfers] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useQueryState<StatusFilter>('status', 'all');
  const [sitterFilter] = useQueryState<string>('sitterId', '');
  const [payoutIdFilter] = useQueryState<string>('payoutId', '');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (sitterFilter) params.set('sitterId', sitterFilter);
      const res = await fetch(`/api/ops/payouts?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Failed to load payouts');
        setTransfers([]);
        return;
      }
      const incoming: PayoutItem[] = json.transfers || [];
      if (payoutIdFilter) {
        incoming.sort((a, b) => {
          if (a.id === payoutIdFilter) return -1;
          if (b.id === payoutIdFilter) return 1;
          return 0;
        });
      }
      setTransfers(incoming);
    } catch {
      setError('Failed to load payouts');
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sitterFilter, payoutIdFilter]);

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

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  if (sessionStatus === 'loading' || !session) return null;

  return (
    <OwnerAppShell>
      <LayoutWrapper>
        <PageHeader
          title="Payouts"
          subtitle="Sitter payout transfers and failures"
          actions={
            <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          }
        />
        <Section>
          <div className="mb-4">
            <MobileFilterDrawer
              triggerLabel="Status"
              activeCount={statusFilter !== 'all' ? 1 : 0}
            >
              <div className="flex flex-wrap gap-2">
                {(['all', 'paid', 'pending', 'failed', 'reversed'] as StatusFilter[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
                      statusFilter === s
                        ? 'bg-surface-inverse text-white'
                        : 'bg-surface-tertiary text-text-secondary hover:bg-surface-secondary'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </MobileFilterDrawer>
          </div>
      {loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : error ? (
        <AppErrorState title="Couldn't load payouts" subtitle={error} onRetry={() => void load()} />
      ) : transfers.length === 0 ? (
        <EmptyState
          title="No payouts"
          description="Transfers will appear here after completed bookings are paid out to sitters."
        />
      ) : (
        <DataTableShell stickyHeader>
          <Table<PayoutItem>
            columns={[
              { key: 'sitter', header: 'Sitter', mobileOrder: 1, mobileLabel: 'Sitter', render: (t) => (
                <div>
                  <p className="font-medium text-neutral-900">
                    {t.sitterName}
                    {payoutIdFilter && t.id === payoutIdFilter ? ' · Target' : ''}
                  </p>
                  <p className="text-sm text-neutral-600">
                    {fmtDate(t.createdAt)}
                    {t.bookingId && ` · Visit on ${fmtDate(t.createdAt)}`}
                  </p>
                  {t.lastError && (
                    <p className="mt-1 text-xs text-red-600" title={t.lastError}>
                      {t.lastError.slice(0, 80)}{t.lastError.length > 80 ? '…' : ''}
                    </p>
                  )}
                </div>
              )},
              { key: 'amount', header: 'Amount', mobileOrder: 2, mobileLabel: 'Amount', align: 'right', render: (t) => (
                <span className="tabular-nums font-medium">${(t.amount / 100).toFixed(2)} {t.currency.toUpperCase()}</span>
              )},
              { key: 'status', header: 'Status', mobileOrder: 3, mobileLabel: 'Status', hideBelow: 'md', render: (t) => (
                (() => {
                  const pill = getStatusPill(t.status);
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
                    <StatusChip
                      variant={variant}
                      ariaLabel={`Payout transfer status: ${pill.label}`}
                    >
                      {pill.label}
                    </StatusChip>
                  );
                })()
              )},
            ]}
            data={transfers}
            keyExtractor={(t) => t.id}
            emptyMessage="No payouts"
            forceTableLayout
          />
        </DataTableShell>
      )}
        </Section>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}
