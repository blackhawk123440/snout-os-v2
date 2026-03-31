'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppChartCard } from '@/components/app';
import { KpiGrid, type KpiItem } from '@/components/app/KpiGrid';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { DailyLineChart } from '@/components/charts/DailyLineChart';
import { Card, Skeleton, Button, StatusChip } from '@/components/ui';

type KpiWithTrend = {
  value: number;
  previousValue?: number;
  deltaPercent?: number | null;
  trend?: 'up' | 'down' | 'neutral';
};

type KpisPayload = {
  range: string;
  revenue: KpiWithTrend;
  bookings: KpiWithTrend;
  activeClients: KpiWithTrend;
  activeSitters: KpiWithTrend;
  cancellationRate: KpiWithTrend;
  failedPaymentCount: KpiWithTrend;
  automationFailureCount: KpiWithTrend;
  payoutVolume: KpiWithTrend;
  averageBookingValue: KpiWithTrend;
  repeatBookingRate: KpiWithTrend;
  messageResponseLag: { value: number } | null;
};

type TrendPayload = {
  range: string;
  daily: { date: string; amount?: number; count?: number }[];
};

const RANGE_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export function AnalyticsTab() {
  const [range, setRange] = useState('30d');
  const [kpis, setKpis] = useState<KpisPayload | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<TrendPayload | null>(null);
  const [bookingsTrend, setBookingsTrend] = useState<TrendPayload | null>(null);
  const [payoutTrend, setPayoutTrend] = useState<TrendPayload | null>(null);
  const [automationTrend, setAutomationTrend] = useState<TrendPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpisRes, revRes, bookRes, payRes, autoRes] = await Promise.all([
        fetch(`/api/analytics/kpis?range=${range}`),
        fetch(`/api/analytics/trends/revenue?range=${range}`),
        fetch(`/api/analytics/trends/bookings?range=${range}`),
        fetch(`/api/analytics/trends/payout-volume?range=${range}`),
        fetch(`/api/analytics/trends/automation-failures?range=${range}`),
      ]);
      if (!kpisRes.ok) {
        const j = await kpisRes.json().catch(() => ({}));
        setError(j.message || kpisRes.statusText || 'Failed to load');
        setKpis(null);
        return;
      }
      const [kpisJson, revJson, bookJson, payJson, autoJson] = await Promise.all([
        kpisRes.json(),
        revRes.ok ? revRes.json() : { daily: [] },
        bookRes.ok ? bookRes.json() : { daily: [] },
        payRes.ok ? payRes.json() : { daily: [] },
        autoRes.ok ? autoRes.json() : { daily: [] },
      ]);
      setKpis(kpisJson);
      setRevenueTrend(revJson);
      setBookingsTrend(bookJson);
      setPayoutTrend(payJson);
      setAutomationTrend(autoJson);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  const revenueDaily = revenueTrend?.daily ?? [];
  const bookingsDaily = (bookingsTrend?.daily ?? []).map((d) => ({ date: d.date, count: (d as { count?: number }).count ?? 0 }));
  const payoutDaily = payoutTrend?.daily ?? [];
  const automationDaily = (automationTrend?.daily ?? []).map((d) => ({ date: d.date, count: (d as { count?: number }).count ?? 0 }));

  const kpiItems: KpiItem[] = kpis
    ? [
        { label: 'Revenue', value: `$${kpis.revenue.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, delta: kpis.revenue.deltaPercent ?? undefined, href: '/money' },
        { label: 'Bookings', value: kpis.bookings.value, delta: kpis.bookings.deltaPercent ?? undefined, href: '/bookings' },
        { label: 'Active clients', value: kpis.activeClients.value, delta: kpis.activeClients.deltaPercent ?? undefined, href: '/clients' },
        { label: 'Active sitters', value: kpis.activeSitters.value, delta: kpis.activeSitters.deltaPercent ?? undefined, href: '/sitters' },
        { label: 'Cancellation rate', value: `${kpis.cancellationRate.value.toFixed(1)}%`, delta: kpis.cancellationRate.deltaPercent ?? undefined },
        { label: 'Failed payments', value: kpis.failedPaymentCount.value, delta: kpis.failedPaymentCount.deltaPercent ?? undefined, href: '/money' },
        { label: 'Automation failures', value: kpis.automationFailureCount.value, delta: kpis.automationFailureCount.deltaPercent ?? undefined, href: '/ops/automation-failures' },
        { label: 'Payout volume', value: `$${kpis.payoutVolume.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, delta: kpis.payoutVolume.deltaPercent ?? undefined, href: '/ops/payouts' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-lg border border-border-strong bg-surface-primary px-3 py-2 text-sm text-text-primary" aria-label="Date range">
          {RANGE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
        <Link href="/money?tab=reports"><Button variant="secondary" size="sm">Executive summary</Button></Link>
      </div>

      {error && (
        <Card className="border-status-warning-border bg-status-warning-bg p-4">
          <p className="text-sm text-status-warning-text">{error}</p>
          <Button size="sm" className="mt-2" onClick={() => void load()}>Retry</Button>
        </Card>
      )}

      {loading && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">{[1, 2, 3, 4].map((i) => (<Skeleton key={i} height={280} />))}</div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (<Skeleton key={i} height={96} />))}</div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Trends</h3>
            <div className="grid gap-6 lg:grid-cols-2">
              <AppChartCard title="Revenue trend" subtitle="Daily revenue" timeframe={range} onTimeframeChange={(v) => setRange(v)} loading={false} empty={revenueDaily.length === 0}>
                {revenueDaily.length > 0 && <RevenueChart daily={revenueDaily.map((d) => ({ date: d.date, amount: (d as { amount?: number }).amount ?? 0 }))} />}
              </AppChartCard>
              <AppChartCard title="Bookings trend" subtitle="Daily bookings created" timeframe={range} onTimeframeChange={(v) => setRange(v)} loading={false} empty={bookingsDaily.length === 0}>
                {bookingsDaily.length > 0 && <DailyLineChart daily={bookingsDaily} valueLabel="Bookings" valueKey="count" maxPoints={range === '90d' ? 90 : range === '7d' ? 7 : 30} />}
              </AppChartCard>
              <AppChartCard title="Payout volume" subtitle="Daily payouts (paid)" timeframe={range} onTimeframeChange={(v) => setRange(v)} loading={false} empty={payoutDaily.length === 0}>
                {payoutDaily.length > 0 && <DailyLineChart daily={payoutDaily.map((d) => ({ date: d.date, amount: (d as { amount?: number }).amount ?? 0 }))} valueLabel="Payout ($)" valueKey="amount" maxPoints={range === '90d' ? 90 : range === '7d' ? 7 : 30} />}
              </AppChartCard>
              <AppChartCard title="Automation failures" subtitle="Daily automation.failed / automation.dead" timeframe={range} onTimeframeChange={(v) => setRange(v)} loading={false} empty={automationDaily.length === 0}>
                {automationDaily.length > 0 && <DailyLineChart daily={automationDaily} valueLabel="Failures" valueKey="count" maxPoints={range === '90d' ? 90 : range === '7d' ? 7 : 30} />}
              </AppChartCard>
            </div>
          </div>

          {kpis && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">Supporting metrics</h3>
              <KpiGrid items={kpiItems} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
            </div>
          )}
        </>
      )}

      {!loading && error && !kpis && (
        <Card className="p-8 text-center text-sm text-text-tertiary">No data available. Try another range or retry.</Card>
      )}

      <ChurnRiskSection />
    </div>
  );
}

function ChurnRiskSection() {
  const [clients, setClients] = useState<Array<{
    clientId: string; clientName: string; lastBookingDate: string;
    daysSinceLastBooking: number; totalBookings: number; lifetimeValue: number;
    riskLevel: string;
  }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/ops/analytics/churn-risk')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.clients) setClients(d.clients); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || clients.length === 0) return null;

  const sendWinBack = async (clientId: string) => {
    try {
      const res = await fetch(`/api/ops/clients/${clientId}/win-back`, { method: 'POST' });
      if (res.ok) {
        const { toastSuccess } = await import('@/lib/toast');
        toastSuccess('Win-back message sent');
      }
    } catch { /* silent */ }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">At-risk clients ({clients.length})</h3>
      <div className="space-y-2">
        {clients.slice(0, 15).map((c) => (
          <div key={c.clientId} className="flex items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-primary px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-text-primary">{c.clientName}</p>
                <StatusChip variant={c.riskLevel === 'high' ? 'danger' : 'warning'}>{c.riskLevel}</StatusChip>
              </div>
              <p className="text-xs text-text-tertiary">{c.daysSinceLastBooking}d ago &middot; {c.totalBookings} visits &middot; ${c.lifetimeValue.toFixed(0)} lifetime</p>
            </div>
            <button type="button" onClick={() => sendWinBack(c.clientId)} className="shrink-0 min-h-[36px] rounded-lg border border-border-default px-2.5 text-xs font-medium text-accent-primary hover:bg-surface-secondary">Win back</button>
          </div>
        ))}
      </div>
    </div>
  );
}
