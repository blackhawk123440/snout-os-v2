'use client';

import { useMemo, useState } from 'react';
import { DollarSign, ClipboardList } from 'lucide-react';
import { Button, Drawer, DataTableShell, Table } from '@/components/ui';
import { LayoutWrapper } from '@/components/layout';
import { StatusChip } from '@/components/ui/status-chip';
import {
  SitterPageHeader,
  SitterSkeletonList,
  SitterErrorState,
} from '@/components/sitter';
import { calculateTransferSummary } from './earnings-helpers';
import { formatServiceName, formatDate as formatDateUtil } from '@/lib/format-utils';
import { useSitterEarnings, useSitterCompletedJobs, useSitterTransfers } from '@/lib/api/sitter-portal-hooks';

interface EarningsData {
  commissionPercentage: number;
  grossTotal: number;
  earningsTotal: number;
  grossThisMonth: number;
  earningsThisMonth: number;
  grossLastMonth: number;
  earningsLastMonth: number;
  completedBookingsCount: number;
  completedThisMonthCount: number;
  completedLastMonthCount: number;
  averagePerVisit: number;
  scheduledPayoutAmount: number;
  scheduledPayoutCount: number;
  nextPayoutReleaseAt: string | null;
  periodEarnings?: number;
  periodCount?: number;
}

interface CompletedJob {
  id: string;
  service: string;
  startAt: string;
  endAt: string;
  clientName: string;
  pets: Array<{ id: string; name?: string | null; species?: string | null }>;
  base: number;
  tip: number;
  addOns: number;
  gross: number;
  afterSplit: number;
  commissionPercentage: number;
}

interface PayoutTransfer {
  id: string;
  bookingId?: string | null;
  stripeTransferId?: string | null;
  amount: number;
  currency: string;
  status: string;
  lastError?: string | null;
  createdAt: string;
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

type PeriodKey = 'all' | 'this_week' | 'this_month' | 'last_month';

function getPeriodDates(key: PeriodKey): { from?: string; to?: string; label: string } {
  const now = new Date();
  if (key === 'this_week') {
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: now.toISOString(), label: 'This week' };
  }
  if (key === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString(), to: now.toISOString(), label: 'This month' };
  }
  if (key === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString(), label: 'Last month' };
  }
  return { label: 'All time' };
}

export default function SitterEarningsPage() {
  const [selectedJob, setSelectedJob] = useState<CompletedJob | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('all');

  const periodDates = getPeriodDates(period);
  const earningsQuery = useSitterEarnings(periodDates.from, periodDates.to);
  const jobsQuery = useSitterCompletedJobs();
  const transfersQuery = useSitterTransfers();

  const loading = earningsQuery.isLoading || jobsQuery.isLoading || transfersQuery.isLoading;
  const data = earningsQuery.data;
  const error = earningsQuery.error;
  const completedJobs = jobsQuery.data?.jobs || [];
  const transfers = transfersQuery.data?.transfers || [];
  const jobsLoading = jobsQuery.isLoading;
  const transfersLoading = transfersQuery.isLoading;

  const transferSummary = useMemo(() => calculateTransferSummary(transfers), [transfers]);

  return (
    <LayoutWrapper variant="narrow">
      <SitterPageHeader
        title="Earnings"
        subtitle="Your commission summary"
        action={
          <Button variant="secondary" size="sm" onClick={() => { earningsQuery.refetch(); jobsQuery.refetch(); transfersQuery.refetch(); }} disabled={loading}>
            Refresh
          </Button>
        }
      />
      {loading ? (
        <SitterSkeletonList count={3} />
      ) : error ? (
        <SitterErrorState
          title="Couldn't load earnings"
          subtitle={error?.message}
          onRetry={() => { earningsQuery.refetch(); jobsQuery.refetch(); transfersQuery.refetch(); }}
        />
      ) : data ? (
        <div className="space-y-4">
          {/* Period selector */}
          <div className="flex gap-1.5 rounded-xl bg-surface-secondary p-1">
            {([['all', 'All time'], ['this_week', 'This week'], ['this_month', 'This month'], ['last_month', 'Last month']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`flex-1 min-h-[44px] rounded-lg px-2 py-2 text-xs font-semibold transition ${
                  period === key ? 'bg-surface-primary text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Earnings hero */}
          <div className="rounded-2xl bg-accent-tertiary p-6">
            <p className="text-[11px] font-semibold text-accent-primary uppercase tracking-wider">
              {period === 'all' ? 'Total earnings' : periodDates.label}
            </p>
            <p className="mt-3 text-4xl font-bold text-text-primary tabular-nums">
              ${(period !== 'all' && data.periodEarnings != null ? data.periodEarnings : data.earningsTotal).toFixed(2)}
            </p>
            <div className="mt-3 flex items-center gap-3 text-sm text-text-secondary">
              <span>{period !== 'all' && data.periodCount != null ? data.periodCount : data.completedBookingsCount} visits</span>
              <span className="text-text-disabled">·</span>
              <span>{data.commissionPercentage}% commission</span>
            </div>
            {data.completedBookingsCount > 0 && period === 'all' && (
              <p className="mt-1 text-sm text-text-tertiary tabular-nums">
                ${data.averagePerVisit.toFixed(2)} avg per visit
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-surface-primary shadow-sm p-5">
            <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Next release</p>
            {data.nextPayoutReleaseAt ? (
              <>
                <p className="mt-2 text-2xl font-bold text-text-primary">
                  {formatDateUtil(data.nextPayoutReleaseAt)}
                </p>
                <p className="mt-1 text-xs text-text-tertiary">
                  {data.scheduledPayoutCount} visit{data.scheduledPayoutCount !== 1 ? 's' : ''} in queue
                </p>
              </>
            ) : transferSummary.hasPaidHistory && transferSummary.nextPayoutDate ? (
              <>
                <p className="mt-2 text-2xl font-bold text-text-primary">
                  {formatDateUtil(transferSummary.nextPayoutDate)}
                </p>
                <p className="mt-1 text-xs text-text-tertiary">Based on recent transfer history</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-text-secondary">After your first paid, completed visit</p>
            )}
          </div>

          {/* Financial Detail */}
          <div className="rounded-2xl bg-surface-primary shadow-sm overflow-hidden">
            {/* Period summary */}
            <div className="grid grid-cols-2 divide-x divide-border-muted border-b border-border-muted">
              <div className="p-5">
                <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">This month</p>
                <p className="mt-2 text-2xl font-bold text-text-primary tabular-nums">${data.earningsThisMonth.toFixed(2)}</p>
                <p className="mt-1 text-xs text-text-tertiary">{data.completedThisMonthCount} visits</p>
              </div>
              <div className="p-5">
                <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Last month</p>
                <p className="mt-2 text-2xl font-bold text-text-primary tabular-nums">${data.earningsLastMonth.toFixed(2)}</p>
                <p className="mt-1 text-xs text-text-tertiary">{data.completedLastMonthCount} visits</p>
              </div>
            </div>
            {/* Payout status */}
            <div className="grid grid-cols-2 divide-x divide-border-muted border-b border-border-muted">
              <div className="p-5 bg-accent-tertiary/50">
                <p className="text-[11px] font-semibold text-accent-primary uppercase tracking-wider">Scheduled</p>
                <p className="mt-2 text-xl font-bold text-text-primary tabular-nums">${data.scheduledPayoutAmount.toFixed(2)}</p>
                <p className="mt-1 text-xs text-text-tertiary">Releases 7 days after completion</p>
              </div>
              <div className="p-5">
                <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Paid (30d)</p>
                <p className="mt-2 text-xl font-bold text-text-primary tabular-nums">${(transferSummary.paid30dCents / 100).toFixed(2)}</p>
                <p className="mt-1 text-xs text-text-tertiary">Last 30 days</p>
              </div>
            </div>

            {/* Payout transfers */}
            <div className="border-b border-border-muted">
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Payout transfers</h3>
              </div>
              {transfersLoading ? (
                <div className="px-5 pb-5"><SitterSkeletonList count={2} /></div>
              ) : transfers.length === 0 ? (
                <div className="px-5 py-8 text-center bg-surface-secondary/50">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-secondary mb-3">
                    <DollarSign className="h-5 w-5 text-accent-primary" />
                  </div>
                  <p className="text-sm font-semibold text-text-primary">No payouts available</p>
                  <p className="mt-1 text-xs text-text-tertiary max-w-[220px] mx-auto">Transfers will appear here after completed bookings are paid out.</p>
                </div>
              ) : (
                <DataTableShell stickyHeader>
                  <Table
                    columns={[
                      { key: 'amount', header: 'Amount', mobileOrder: 1, mobileLabel: 'Amount', render: (t) => (
                        <span className="tabular-nums font-medium">${(t.amount / 100).toFixed(2)} {t.currency.toUpperCase()}</span>
                      )},
                      { key: 'date', header: 'Date', mobileOrder: 2, mobileLabel: 'Date', hideBelow: 'md', render: (t) =>
                        t.createdAt ? formatDate(t.createdAt) : '—'
                      },
                      { key: 'status', header: 'Status', mobileOrder: 3, mobileLabel: 'Status', render: (t) => (
                        <span className="flex items-center gap-1">
                          <StatusChip
                            variant={t.status === 'paid' ? 'success' : t.status === 'failed' ? 'danger' : 'neutral'}
                            ariaLabel={`Transfer status: ${t.status}`}
                          >
                            {t.status}
                          </StatusChip>
                          {t.lastError && (
                            <span className="text-status-danger-text" title={t.lastError}>(failed)</span>
                          )}
                        </span>
                      )},
                    ]}
                    data={transfers}
                    keyExtractor={(t) => t.id}
                    emptyMessage="No payouts available"
                    forceTableLayout
                  />
                </DataTableShell>
              )}
            </div>

            {/* Completed jobs */}
            <div>
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Completed jobs</h3>
              </div>
              {jobsLoading ? (
                <div className="px-5 pb-5"><SitterSkeletonList count={2} /></div>
              ) : completedJobs.length === 0 ? (
                <div className="px-5 py-8 text-center bg-surface-secondary/50">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-secondary mb-3">
                    <ClipboardList className="h-5 w-5 text-accent-primary" />
                  </div>
                  <p className="text-sm font-semibold text-text-primary">No completed jobs</p>
                  <p className="mt-1 text-xs text-text-tertiary max-w-[220px] mx-auto">Your earnings breakdown will appear here after visits are completed.</p>
                </div>
              ) : (
                <DataTableShell stickyHeader>
                  <Table
                    columns={[
                      { key: 'client', header: 'Client', mobileOrder: 1, mobileLabel: 'Client', render: (job) => job.clientName },
                      { key: 'service', header: 'Service', mobileOrder: 2, mobileLabel: 'Service', hideBelow: 'md', render: (job) => formatServiceName(job.service) },
                      { key: 'date', header: 'Date', mobileOrder: 3, mobileLabel: 'Date', render: (job) => formatDate(job.endAt) },
                      { key: 'amount', header: 'Amount', mobileOrder: 4, mobileLabel: 'Amount', render: (job) => (
                        <span className="tabular-nums font-semibold">${job.afterSplit.toFixed(2)}</span>
                      )},
                    ]}
                    data={completedJobs}
                    keyExtractor={(job) => job.id}
                    emptyMessage="No completed jobs"
                    onRowClick={(job) => setSelectedJob(job as CompletedJob)}
                    forceTableLayout
                  />
                </DataTableShell>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-text-tertiary">
            Completed paid bookings enter a 7-day hold, then payouts are sent to your connected Stripe account automatically.
          </p>
        </div>
      ) : null}

      <Drawer
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        title={selectedJob ? `${formatServiceName(selectedJob.service)} · ${selectedJob.clientName}` : ''}
        placement="right"
        width="min(380px, 100vw)"
      >
        {selectedJob && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              {formatDate(selectedJob.startAt)}
              {selectedJob.pets.length > 0 && ` · ${selectedJob.pets.map((p) => p.name || p.species || 'Pet').join(', ')}`}
            </p>
            <div className="space-y-2 rounded-2xl border border-border-default bg-surface-secondary p-4">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Base</span>
                <span className="font-medium">${selectedJob.base.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Tip</span>
                <span className="font-medium">${selectedJob.tip.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Add-ons</span>
                <span className="font-medium">${selectedJob.addOns.toFixed(2)}</span>
              </div>
              <div className="border-t border-border-default pt-2 flex justify-between text-sm font-medium">
                <span>After split ({selectedJob.commissionPercentage}%)</span>
                <span className="text-text-primary">${selectedJob.afterSplit.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </LayoutWrapper>
  );
}
