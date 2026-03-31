'use client';

import { useQuery } from '@tanstack/react-query';
import {
  DollarSign, TrendingUp, Building2, Users, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { AppErrorState } from '@/components/app';

interface BillingData {
  platformMrr: number;
  mrrGrowthPct: number;
  totalOrgs: number;
  activeOrgs: number;
  trialOrgs: number;
  suspendedOrgs: number;
  churnedOrgs: number;
  trialConversionRate: number;
  transactionFeeRevenue: number;
  churn30d: number;
  churn60d: number;
  churn90d: number;
  mrrByTier: Array<{ tier: string; mrr: number; count: number }>;
}

export default function AdminBillingPage() {
  const { data, isLoading, error, refetch } = useQuery<BillingData>({
    queryKey: ['admin', 'billing'],
    queryFn: async () => {
      const res = await fetch('/api/ops/stats?range=30d');
      if (!res.ok) throw new Error('Failed to load billing data');
      const d = await res.json();
      return {
        platformMrr: d.platformMrr ?? d.revenueTotal ?? 0,
        mrrGrowthPct: d.mrrGrowthPct ?? 0,
        totalOrgs: d.totalOrgs ?? 1,
        activeOrgs: d.activeOrgs ?? 1,
        trialOrgs: d.trialOrgs ?? 0,
        suspendedOrgs: d.suspendedOrgs ?? 0,
        churnedOrgs: d.churnedOrgs ?? 0,
        trialConversionRate: d.trialConversionRate ?? 0,
        transactionFeeRevenue: d.transactionFeeRevenue ?? 0,
        churn30d: d.churn30d ?? 0,
        churn60d: d.churn60d ?? 0,
        churn90d: d.churn90d ?? 0,
        mrrByTier: d.mrrByTier ?? [
          { tier: 'Starter', mrr: 0, count: 0 },
          { tier: 'Professional', mrr: d.revenueTotal ?? 0, count: d.activeOrgs ?? 1 },
          { tier: 'Enterprise', mrr: 0, count: 0 },
        ],
      };
    },
    refetchInterval: 120000,
  });

  if (isLoading) return <BillingSkeleton />;
  if (error) return <AppErrorState title="Couldn't load billing" subtitle={error instanceof Error ? error.message : ''} onRetry={() => void refetch()} />;
  if (!data) return null;

  const growthPositive = data.mrrGrowthPct >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">SaaS Revenue</h1>
        <p className="mt-1 text-sm text-text-secondary">Snout OS platform revenue and subscription metrics</p>
      </div>

      {/* MRR Hero */}
      <div className="rounded-2xl bg-accent-tertiary p-6">
        <p className="text-[11px] font-semibold text-accent-primary uppercase tracking-wider">Platform MRR</p>
        <div className="mt-2 flex items-baseline gap-3">
          <p className="text-5xl font-bold text-text-primary tabular-nums">${data.platformMrr.toLocaleString()}</p>
          <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
            growthPositive ? 'bg-status-success-bg text-status-success-text' : 'bg-status-danger-bg text-status-danger-text'
          }`}>
            {growthPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(data.mrrGrowthPct).toFixed(1)}%
          </span>
        </div>
        <p className="mt-1 text-sm text-accent-primary/60">Monthly recurring revenue across all organizations</p>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Transaction Fees" value={`$${data.transactionFeeRevenue.toLocaleString()}`} subtitle="15% platform cut" icon={<DollarSign className="w-4 h-4" />} />
        <StatCard label="Trial Conversion" value={`${data.trialConversionRate.toFixed(0)}%`} subtitle={`${data.trialOrgs} active trials`} icon={<TrendingUp className="w-4 h-4" />} />
        <StatCard label="Churn (30d)" value={data.churn30d} subtitle={`${data.churn60d} (60d), ${data.churn90d} (90d)`} icon={<ArrowDownRight className="w-4 h-4" />} />
        <StatCard label="Active Orgs" value={data.activeOrgs} subtitle={`${data.totalOrgs} total`} icon={<Building2 className="w-4 h-4" />} />
      </div>

      {/* MRR by Tier */}
      <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">MRR by Plan Tier</h2>
        </div>
        <div className="divide-y divide-border-muted">
          {data.mrrByTier.map((tier) => {
            const pct = data.platformMrr > 0 ? (tier.mrr / data.platformMrr) * 100 : 0;
            return (
              <div key={tier.tier} className="flex items-center gap-4 px-5 py-4 min-h-[56px]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">{tier.tier}</p>
                  <p className="text-xs text-text-tertiary">{tier.count} org{tier.count !== 1 ? 's' : ''}</p>
                </div>
                <div className="w-32 hidden sm:block">
                  <div className="h-2 overflow-hidden rounded-full bg-surface-tertiary">
                    <div className="h-full rounded-full bg-accent-primary transition-[width]" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
                <p className="text-sm font-bold text-text-primary tabular-nums shrink-0">${tier.mrr.toLocaleString()}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Org Status Breakdown */}
      <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm p-5">
        <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-4">Organization Status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <OrgStatusCard label="Active" count={data.activeOrgs} color="bg-status-success-bg text-status-success-text" />
          <OrgStatusCard label="Trial" count={data.trialOrgs} color="bg-status-info-bg text-status-info-text" />
          <OrgStatusCard label="Suspended" count={data.suspendedOrgs} color="bg-status-warning-bg text-status-warning-text" />
          <OrgStatusCard label="Churned" count={data.churnedOrgs} color="bg-surface-tertiary text-text-secondary" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subtitle, icon }: { label: string; value: string | number; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-primary shadow-sm p-4">
      <div className="text-text-tertiary mb-1">{icon}</div>
      <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-text-tertiary">{subtitle}</p>
    </div>
  );
}

function OrgStatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`rounded-xl p-3 ${color}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{count}</p>
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div><div className="h-7 w-40 rounded bg-surface-tertiary" /><div className="mt-2 h-4 w-64 rounded bg-surface-tertiary" /></div>
      <div className="h-32 rounded-2xl bg-surface-tertiary" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl bg-surface-tertiary" />)}</div>
      <div className="h-48 rounded-2xl bg-surface-tertiary" />
    </div>
  );
}
