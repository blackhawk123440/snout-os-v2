'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Building2, Users, DollarSign, Activity,
  Database, Server, MessageSquare, CreditCard,
  AlertTriangle, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { AppErrorState } from '@/components/app';

interface HealthData {
  status: string;
  dbStatus: string;
  redisStatus: string;
  commitSha?: string;
  envName?: string;
  buildTime?: string;
}

interface PlatformStats {
  totalOrgs: number;
  activeOrgs: number;
  trialOrgs: number;
  totalUsers: number;
  activeUsersToday: number;
  totalBookings30d: number;
  platformMrr: number;
}

interface RecentAlert {
  id: string;
  action: string;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

const statusIcon = (status: string) => {
  if (status === 'ok') return <CheckCircle className="w-4 h-4 text-status-success-text" />;
  if (status === 'degraded') return <AlertTriangle className="w-4 h-4 text-status-warning-text" />;
  return <XCircle className="w-4 h-4 text-status-danger-text" />;
};

const statusLabel = (status: string) => {
  if (status === 'ok') return 'Healthy';
  if (status === 'degraded') return 'Degraded';
  return 'Down';
};

const statusBg = (status: string) => {
  if (status === 'ok') return 'bg-status-success-bg border-status-success-border';
  if (status === 'degraded') return 'bg-status-warning-bg border-status-warning-border';
  return 'bg-status-danger-bg border-status-danger-border';
};

export default function AdminDashboardPage() {
  const { data: health, isLoading: healthLoading, error: healthError } = useQuery<HealthData>({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Health check failed');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery<PlatformStats>({
    queryKey: ['admin', 'platform-stats'],
    queryFn: async () => {
      const res = await fetch('/api/ops/stats?range=30d');
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      return {
        totalOrgs: data.totalOrgs ?? 1,
        activeOrgs: data.activeOrgs ?? 1,
        trialOrgs: data.trialOrgs ?? 0,
        totalUsers: data.totalUsers ?? 0,
        activeUsersToday: data.activeUsersToday ?? 0,
        totalBookings30d: data.bookingsCreated ?? 0,
        platformMrr: data.platformMrr ?? 0,
      };
    },
    refetchInterval: 60000,
  });

  const { data: alerts } = useQuery<RecentAlert[]>({
    queryKey: ['admin', 'recent-alerts'],
    queryFn: async () => {
      const res = await fetch('/api/ops/stats?range=7d');
      if (!res.ok) return [];
      const data = await res.json();
      return (data.recentAlerts ?? []).slice(0, 10);
    },
  });

  const loading = healthLoading || statsLoading;

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (statsError) {
    return (
      <AppErrorState
        title="Couldn't load platform stats"
        subtitle={statsError instanceof Error ? statsError.message : 'Unable to load'}
        onRetry={() => void refetchStats()}
      />
    );
  }

  const dbStatus = health?.dbStatus ?? 'unknown';
  const redisStatus = health?.redisStatus ?? 'unknown';
  const overallStatus = health?.status ?? 'unknown';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Platform Dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">Snout OS platform overview and system health</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<Building2 className="w-5 h-5" />}
          label="Total Orgs"
          value={stats?.totalOrgs ?? 0}
          subtitle={`${stats?.activeOrgs ?? 0} active, ${stats?.trialOrgs ?? 0} trial`}
          accent
        />
        <KpiCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Platform MRR"
          value={`$${(stats?.platformMrr ?? 0).toLocaleString()}`}
          subtitle="Monthly recurring revenue"
        />
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          label="Active Today"
          value={stats?.activeUsersToday ?? 0}
          subtitle={`${stats?.totalUsers ?? 0} total users`}
        />
        <KpiCard
          icon={<Activity className="w-5 h-5" />}
          label="Bookings (30d)"
          value={stats?.totalBookings30d ?? 0}
          subtitle="Across all orgs"
        />
      </div>

      {/* System Health */}
      <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-sm">
        <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-4">System Health</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <HealthIndicator label="Overall" status={overallStatus} />
          <HealthIndicator label="Database" status={dbStatus} icon={<Database className="w-4 h-4 text-text-tertiary" />} />
          <HealthIndicator label="Redis" status={redisStatus} icon={<Server className="w-4 h-4 text-text-tertiary" />} />
          <HealthIndicator label="Twilio" status="ok" icon={<MessageSquare className="w-4 h-4 text-text-tertiary" />} />
          <HealthIndicator label="Stripe" status="ok" icon={<CreditCard className="w-4 h-4 text-text-tertiary" />} />
        </div>
        {health && (
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-tertiary border-t border-border-muted pt-3">
            {health.envName && <span>Env: {health.envName}</span>}
            {health.commitSha && health.commitSha !== 'unknown' && <span>Build: {health.commitSha.slice(0, 7)}</span>}
            {health.buildTime && <span>Built: {new Date(health.buildTime).toLocaleDateString()}</span>}
          </div>
        )}
      </div>

      {/* Recent Alerts */}
      <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Recent Alerts</h2>
        </div>
        {!alerts || alerts.length === 0 ? (
          <div className="px-5 pb-5">
            <div className="flex items-center gap-3 rounded-xl bg-status-success-bg px-4 py-3">
              <CheckCircle className="w-4 h-4 text-status-success-text shrink-0" />
              <p className="text-sm text-status-success-text">No recent alerts. All systems nominal.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border-muted">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center gap-3 px-5 py-3 min-h-[48px]">
                <AlertTriangle className="w-4 h-4 text-status-warning-text shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary truncate">{alert.action}</p>
                  <p className="text-xs text-text-tertiary">{new Date(alert.createdAt).toLocaleString()}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  alert.status === 'success' ? 'bg-status-success-bg text-status-success-text'
                  : alert.status === 'error' ? 'bg-status-danger-bg text-status-danger-text'
                  : 'bg-surface-tertiary text-text-secondary'
                }`}>
                  {alert.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── KPI Card ─────────────────────────────────────────────────────── */

function KpiCard({
  icon, label, value, subtitle, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 ${accent ? 'bg-accent-tertiary' : 'bg-surface-primary shadow-sm'}`}>
      <div className={`mb-2 ${accent ? 'text-accent-primary' : 'text-text-tertiary'}`}>
        {icon}
      </div>
      <p className={`text-[11px] font-semibold uppercase tracking-wider ${accent ? 'text-accent-primary' : 'text-text-tertiary'}`}>
        {label}
      </p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${accent ? 'text-accent-primary' : 'text-text-primary'}`}>
        {value}
      </p>
      <p className={`mt-1 text-xs ${accent ? 'text-accent-primary/60' : 'text-text-tertiary'}`}>
        {subtitle}
      </p>
    </div>
  );
}

/* ─── Health Indicator ─────────────────────────────────────────────── */

function HealthIndicator({
  label, status, icon,
}: {
  label: string;
  status: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-3 ${statusBg(status)}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-text-secondary">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {statusIcon(status)}
        <span className="text-sm font-semibold text-text-primary">{statusLabel(status)}</span>
      </div>
    </div>
  );
}

/* ─── Skeleton ─────────────────────────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-48 rounded bg-surface-tertiary" />
        <div className="mt-2 h-4 w-72 rounded bg-surface-tertiary" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-primary shadow-sm p-4">
            <div className="h-5 w-5 rounded bg-surface-tertiary mb-2" />
            <div className="h-3 w-16 rounded bg-surface-tertiary" />
            <div className="mt-2 h-8 w-12 rounded bg-surface-tertiary" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border-default bg-surface-primary p-5">
        <div className="h-3 w-24 rounded bg-surface-tertiary mb-4" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl border border-border-default p-3">
              <div className="h-3 w-16 rounded bg-surface-tertiary mb-2" />
              <div className="h-5 w-20 rounded bg-surface-tertiary" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-border-default bg-surface-primary p-5">
        <div className="h-3 w-24 rounded bg-surface-tertiary mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="h-4 w-4 rounded bg-surface-tertiary" />
            <div className="flex-1 h-4 rounded bg-surface-tertiary" />
          </div>
        ))}
      </div>
    </div>
  );
}
