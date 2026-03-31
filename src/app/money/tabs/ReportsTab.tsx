'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { KpiGrid, type KpiItem } from '@/components/app/KpiGrid';
import { Card, Skeleton, Button } from '@/components/ui';

type KpiWithTrend = {
  value: number;
  previousValue?: number;
  deltaPercent?: number | null;
  trend?: 'up' | 'down' | 'neutral';
};

type KpisPayload = {
  range: string;
  periodStart: string;
  periodEnd: string;
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  revenue: KpiWithTrend;
  bookingsToday: number;
  bookingsWeek: number;
  bookingsMonth: number;
  bookings: KpiWithTrend;
  activeClients: KpiWithTrend;
  activeSitters: KpiWithTrend;
  utilization: number;
  utilizationPrevious?: number;
  cancellationRate: KpiWithTrend;
  failedPaymentCount: KpiWithTrend;
  automationFailureCount: KpiWithTrend;
  payoutVolume: KpiWithTrend;
  averageBookingValue: KpiWithTrend;
  repeatBookingRate: KpiWithTrend;
  messageResponseLag: { value: number } | null;
};

const RANGE_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export function ReportsTab() {
  const [range, setRange] = useState('30d');

  const { data: kpis, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['owner', 'report-kpis', range],
    queryFn: async () => {
      const res = await fetch(`/api/ops/reports/kpis?range=${range}`);
      return res.json().catch(() => ({}));
    },
  });

  const error = queryError?.message ?? null;

  const kpiItems: KpiItem[] = kpis
    ? [
        { label: 'Revenue (period)', value: kpis.revenue?.value != null ? `$${kpis.revenue.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '\u2014', delta: kpis.revenue?.deltaPercent ?? undefined, href: '/money' },
        { label: 'Bookings (period)', value: kpis.bookings?.value ?? '\u2014', delta: kpis.bookings?.deltaPercent ?? undefined, href: '/bookings' },
        { label: 'Active clients', value: kpis.activeClients?.value ?? '\u2014', delta: kpis.activeClients?.deltaPercent ?? undefined, href: '/clients' },
        { label: 'Active sitters', value: kpis.activeSitters?.value ?? '\u2014', delta: kpis.activeSitters?.deltaPercent ?? undefined, href: '/sitters' },
        { label: 'Cancellation rate', value: kpis.cancellationRate?.value != null ? `${kpis.cancellationRate.value.toFixed(1)}%` : '\u2014', delta: kpis.cancellationRate?.deltaPercent ?? undefined },
        { label: 'Failed payments', value: kpis.failedPaymentCount?.value ?? '\u2014', delta: kpis.failedPaymentCount?.deltaPercent ?? undefined, href: '/money' },
        { label: 'Automation failures', value: kpis.automationFailureCount?.value ?? '\u2014', delta: kpis.automationFailureCount?.deltaPercent ?? undefined, href: '/ops/automation-failures' },
        { label: 'Payout volume', value: kpis.payoutVolume?.value != null ? `$${kpis.payoutVolume.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '\u2014', delta: kpis.payoutVolume?.deltaPercent ?? undefined, href: '/ops/payouts' },
        { label: 'Avg booking value', value: kpis.averageBookingValue?.value != null ? `$${kpis.averageBookingValue.value.toFixed(2)}` : '\u2014', delta: kpis.averageBookingValue?.deltaPercent ?? undefined },
        { label: 'Repeat booking rate', value: kpis.repeatBookingRate?.value != null ? `${kpis.repeatBookingRate.value.toFixed(1)}%` : '\u2014', delta: kpis.repeatBookingRate?.deltaPercent ?? undefined, href: '/clients' },
        { label: 'Message response lag', value: kpis.messageResponseLag?.value != null ? `${kpis.messageResponseLag.value} min` : 'Not enough data' },
      ]
    : [];

  const hasIssues = kpis && ((kpis.failedPaymentCount?.value ?? 0) > 0 || (kpis.automationFailureCount?.value ?? 0) > 0 || (kpis.cancellationRate?.value ?? 0) >= 20);
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? range;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-lg border border-border-strong bg-surface-primary px-3 py-2 text-sm text-text-primary" aria-label="Period">
          {RANGE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
        <Link href="/money?tab=analytics"><Button variant="secondary" size="sm">View analytics</Button></Link>
      </div>

      {error && (
        <Card className="border-status-warning-border bg-status-warning-bg p-4">
          <p className="text-sm text-status-warning-text">{error}</p>
          <Button size="sm" className="mt-2" onClick={() => void refetch()}>Retry</Button>
        </Card>
      )}

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (<Skeleton key={i} height={100} />))}
        </div>
      )}

      {!loading && kpis && (
        <>
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Key metrics</h3>
            <KpiGrid items={kpiItems} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" />
          </div>

          {hasIssues && (
            <Card className="border-border-default bg-surface-secondary p-4">
              <p className="text-sm font-medium text-text-primary">Items that may need attention this period:</p>
              <ul className="mt-2 flex flex-wrap gap-3 text-sm">
                {(kpis.failedPaymentCount?.value ?? 0) > 0 && (
                  <li><Link href="/money" className="text-teal-600 hover:underline">{kpis.failedPaymentCount!.value} failed payment{kpis.failedPaymentCount!.value !== 1 ? 's' : ''}</Link></li>
                )}
                {(kpis.automationFailureCount?.value ?? 0) > 0 && (
                  <li><Link href="/ops/automation-failures" className="text-teal-600 hover:underline">{kpis.automationFailureCount!.value} automation failure{kpis.automationFailureCount!.value !== 1 ? 's' : ''}</Link></li>
                )}
                {(kpis.cancellationRate?.value ?? 0) >= 20 && (
                  <li><span className="text-text-secondary">Cancellation rate at {kpis.cancellationRate!.value.toFixed(1)}%</span><Link href="/bookings" className="ml-1 text-teal-600 hover:underline">View bookings</Link></li>
                )}
              </ul>
            </Card>
          )}

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Operational summary</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="p-4">
                <p className="text-xs text-text-tertiary">Bookings ({rangeLabel})</p>
                <p className="mt-1 text-lg font-semibold text-text-primary">{kpis.bookings?.value ?? 0}</p>
                <Link href="/bookings" className="mt-2 inline-block text-sm text-teal-600 hover:underline">View all bookings &rarr;</Link>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-text-tertiary">Revenue ({rangeLabel})</p>
                <p className="mt-1 text-lg font-semibold text-text-primary">${(kpis.revenue?.value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <Link href="/money" className="mt-2 inline-block text-sm text-teal-600 hover:underline">View payments &rarr;</Link>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-text-tertiary">Active sitters</p>
                <p className="mt-1 text-lg font-semibold text-text-primary">{kpis.activeSitters?.value ?? 0}</p>
                <Link href="/sitters" className="mt-2 inline-block text-sm text-teal-600 hover:underline">View sitters &rarr;</Link>
              </Card>
            </div>
          </div>
        </>
      )}

      {!loading && !kpis && !error && (
        <Card className="p-8 text-center text-sm text-text-tertiary">No data available. Select a period or try again later.</Card>
      )}
    </div>
  );
}
