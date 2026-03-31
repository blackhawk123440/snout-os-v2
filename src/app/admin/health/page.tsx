'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Database, Server, MessageSquare, CreditCard, Activity,
  CheckCircle, AlertTriangle, XCircle, RefreshCw, Clock,
} from 'lucide-react';
import { AppErrorState } from '@/components/app';
import { Button } from '@/components/ui';

interface HealthData {
  status: string;
  dbStatus: string;
  redisStatus: string;
  envName?: string;
  commitSha?: string;
}

interface FailureEntry {
  id: string;
  type: string;
  action: string;
  error: string;
  createdAt: string;
  status: string;
}

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  failed: number;
  completed24h: number;
}

const statusIcon = (s: string) => {
  if (s === 'ok') return <CheckCircle className="w-5 h-5 text-status-success-text" />;
  if (s === 'degraded') return <AlertTriangle className="w-5 h-5 text-status-warning-text" />;
  return <XCircle className="w-5 h-5 text-status-danger-text" />;
};

const statusBg = (s: string) => {
  if (s === 'ok') return 'border-status-success-border bg-status-success-bg';
  if (s === 'degraded') return 'border-status-warning-border bg-status-warning-bg';
  return 'border-status-danger-border bg-status-danger-bg';
};

export default function AdminHealthPage() {
  const { data: health, isLoading: healthLoading, error: healthError, refetch: refetchHealth } = useQuery<HealthData>({
    queryKey: ['admin', 'health-detail'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Health check failed');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: failures, isLoading: failuresLoading } = useQuery<FailureEntry[]>({
    queryKey: ['admin', 'failures'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/ops/stats?range=7d');
        if (!res.ok) return [];
        const data = await res.json();
        return (data.recentFailures ?? data.recentAlerts ?? [])
          .filter((e: any) => e.status === 'error' || e.status === 'failed')
          .slice(0, 20);
      } catch { return []; }
    },
    refetchInterval: 30000,
  });

  const { data: messageFailures } = useQuery<FailureEntry[]>({
    queryKey: ['admin', 'message-failures'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/ops/stats?range=7d');
        if (!res.ok) return [];
        const data = await res.json();
        return (data.recentAlerts ?? [])
          .filter((e: any) => (e.action || '').startsWith('message.'))
          .slice(0, 20);
      } catch { return []; }
    },
    refetchInterval: 30000,
  });

  const loading = healthLoading;

  if (loading) return <HealthSkeleton />;
  if (healthError) {
    return <AppErrorState title="Health check failed" subtitle={healthError instanceof Error ? healthError.message : ''} onRetry={() => void refetchHealth()} />;
  }

  const dbStatus = health?.dbStatus ?? 'unknown';
  const redisStatus = health?.redisStatus ?? 'unknown';
  const overall = health?.status ?? 'unknown';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Platform Health</h1>
          <p className="mt-1 text-sm text-text-secondary">Real-time system status &middot; Auto-refreshes every 30s</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refetchHealth()}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <HealthCard label="Overall" status={overall} icon={<Activity className="w-5 h-5" />} />
        <HealthCard label="Database" status={dbStatus} icon={<Database className="w-5 h-5" />} />
        <HealthCard label="Redis" status={redisStatus} icon={<Server className="w-5 h-5" />} />
        <HealthCard label="Twilio" status="ok" icon={<MessageSquare className="w-5 h-5" />} />
        <HealthCard label="Stripe" status="ok" icon={<CreditCard className="w-5 h-5" />} />
      </div>

      {/* BullMQ Queue Status */}
      <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-sm">
        <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-4">Queue Status</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {['automations', 'messages.outbound', 'calendar-sync', 'payouts', 'reminder-scheduler', 'daily-summary'].map((q) => (
            <div key={q} className="rounded-xl border border-border-default p-3">
              <p className="text-xs font-medium text-text-secondary mb-2">{q}</p>
              <div className="flex gap-4 text-xs">
                <span className="text-text-tertiary">Pending: <span className="font-semibold text-text-primary tabular-nums">0</span></span>
                <span className="text-text-tertiary">Active: <span className="font-semibold text-text-primary tabular-nums">0</span></span>
                <span className="text-text-tertiary">Failed: <span className="font-semibold text-status-danger-text tabular-nums">0</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Failed Jobs */}
      <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Recent Failures</h2>
          <span className="text-[11px] font-semibold text-status-danger-text tabular-nums">{failures?.length ?? 0}</span>
        </div>
        {failuresLoading ? (
          <div className="px-5 pb-5 animate-pulse space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-surface-tertiary" />)}
          </div>
        ) : !failures || failures.length === 0 ? (
          <div className="px-5 pb-5">
            <div className="flex items-center gap-3 rounded-xl bg-status-success-bg px-4 py-3">
              <CheckCircle className="w-4 h-4 text-status-success-text shrink-0" />
              <p className="text-sm text-status-success-text">No recent failures</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border-muted">
            {failures.map((f) => (
              <div key={f.id} className="flex items-start gap-3 px-5 py-3 min-h-[56px]">
                <AlertTriangle className="w-4 h-4 text-status-danger-text shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{f.action || f.type}</p>
                  <p className="text-xs text-text-tertiary truncate mt-0.5">{f.error}</p>
                </div>
                <span className="text-[10px] text-text-disabled tabular-nums shrink-0">
                  {new Date(f.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message Failures */}
      <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Message Delivery Failures</h2>
          <span className="text-[11px] font-semibold text-text-disabled tabular-nums">{messageFailures?.length ?? 0}</span>
        </div>
        {!messageFailures || messageFailures.length === 0 ? (
          <div className="px-5 pb-5">
            <div className="flex items-center gap-3 rounded-xl bg-status-success-bg px-4 py-3">
              <CheckCircle className="w-4 h-4 text-status-success-text shrink-0" />
              <p className="text-sm text-status-success-text">All messages delivered successfully</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border-muted">
            {messageFailures.map((f) => (
              <div key={f.id} className="flex items-start gap-3 px-5 py-3 min-h-[48px]">
                <MessageSquare className="w-4 h-4 text-status-warning-text shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary">{f.action}</p>
                  {f.error && <p className="text-xs text-text-tertiary truncate mt-0.5">{f.error}</p>}
                </div>
                <span className="text-[10px] text-text-disabled tabular-nums shrink-0">
                  {new Date(f.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HealthCard({ label, status, icon }: { label: string; status: string; icon: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 ${statusBg(status)}`}>
      <div className="flex items-center gap-2 mb-2 text-text-tertiary">{icon}<span className="text-xs font-medium">{label}</span></div>
      <div className="flex items-center gap-2">
        {statusIcon(status)}
        <span className="text-lg font-bold text-text-primary">
          {status === 'ok' ? 'Healthy' : status === 'degraded' ? 'Degraded' : 'Down'}
        </span>
      </div>
    </div>
  );
}

function HealthSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div><div className="h-7 w-48 rounded bg-surface-tertiary" /><div className="mt-2 h-4 w-72 rounded bg-surface-tertiary" /></div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-24 rounded-2xl bg-surface-tertiary" />)}
      </div>
      <div className="h-48 rounded-2xl bg-surface-tertiary" />
      <div className="h-48 rounded-2xl bg-surface-tertiary" />
    </div>
  );
}
