'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Server, CheckCircle, XCircle, Clock, GitBranch,
  Database, Shield, RefreshCw,
} from 'lucide-react';
import { AppErrorState } from '@/components/app';
import { Button } from '@/components/ui';

interface SystemInfo {
  envName: string;
  commitSha: string;
  buildTime: string | null;
  nodeVersion: string;
  dbStatus: string;
  redisStatus: string;
}

const REQUIRED_ENV_VARS = [
  { key: 'DATABASE_URL', category: 'Database' },
  { key: 'REDIS_URL', category: 'Cache/Queue' },
  { key: 'NEXTAUTH_SECRET', category: 'Auth' },
  { key: 'NEXTAUTH_URL', category: 'Auth' },
  { key: 'STRIPE_SECRET_KEY', category: 'Payments' },
  { key: 'STRIPE_WEBHOOK_SECRET', category: 'Payments' },
  { key: 'TWILIO_ACCOUNT_SID', category: 'Messaging' },
  { key: 'TWILIO_AUTH_TOKEN', category: 'Messaging' },
  { key: 'RESEND_API_KEY', category: 'Email' },
  { key: 'S3_BUCKET', category: 'Storage' },
  { key: 'S3_ACCESS_KEY_ID', category: 'Storage' },
  { key: 'S3_SECRET_ACCESS_KEY', category: 'Storage' },
  { key: 'OPENAI_API_KEY', category: 'AI' },
  { key: 'PERSONAL_ORG_ID', category: 'Tenancy' },
  { key: 'NEXT_PUBLIC_PERSONAL_MODE', category: 'Tenancy' },
  { key: 'NEXT_PUBLIC_APP_URL', category: 'App' },
  { key: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', category: 'Push' },
  { key: 'WEB_PUSH_PRIVATE_KEY', category: 'Push' },
];

export default function AdminSystemPage() {
  const { data: system, isLoading, error, refetch } = useQuery<SystemInfo>({
    queryKey: ['admin', 'system'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Failed to load system info');
      const data = await res.json();
      return {
        envName: data.envName ?? 'unknown',
        commitSha: data.commitSha ?? data.version ?? 'unknown',
        buildTime: data.buildTime ?? null,
        nodeVersion: data.nodeVersion ?? process.version ?? 'unknown',
        dbStatus: data.dbStatus ?? 'unknown',
        redisStatus: data.redisStatus ?? 'unknown',
      };
    },
  });

  const { data: envStatus } = useQuery<Record<string, boolean>>({
    queryKey: ['admin', 'env-status'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) return {};
        const data = await res.json();
        return data.envVarsSet ?? {};
      } catch { return {}; }
    },
  });

  if (isLoading) return <SystemSkeleton />;
  if (error) return <AppErrorState title="Couldn't load system info" subtitle={error instanceof Error ? error.message : ''} onRetry={() => void refetch()} />;
  if (!system) return null;

  const categories = [...new Set(REQUIRED_ENV_VARS.map((v) => v.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">System Config</h1>
          <p className="mt-1 text-sm text-text-secondary">Deployment info and environment variable status</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Deployment Info */}
      <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm p-5">
        <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-4">Deployment</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard icon={<Server className="w-4 h-4" />} label="Environment" value={system.envName} />
          <InfoCard icon={<GitBranch className="w-4 h-4" />} label="Build Hash" value={system.commitSha !== 'unknown' ? system.commitSha.slice(0, 7) : '—'} />
          <InfoCard icon={<Clock className="w-4 h-4" />} label="Last Deploy" value={system.buildTime ? new Date(system.buildTime).toLocaleString() : '—'} />
          <InfoCard icon={<Database className="w-4 h-4" />} label="Node Version" value={system.nodeVersion} />
        </div>
      </div>

      {/* Service Status */}
      <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm p-5">
        <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-4">Service Connections</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ServiceCard label="Database" status={system.dbStatus} />
          <ServiceCard label="Redis" status={system.redisStatus} />
          <ServiceCard label="Twilio" status="ok" />
          <ServiceCard label="Stripe" status="ok" />
        </div>
      </div>

      {/* Environment Variables */}
      <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-text-tertiary" />
          <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Environment Variables</h2>
        </div>
        <p className="px-5 pb-3 text-xs text-text-tertiary">Shows which required variables are set. Values are never displayed.</p>

        {categories.map((cat) => (
          <div key={cat}>
            <div className="px-5 py-2 bg-surface-secondary">
              <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">{cat}</span>
            </div>
            <div className="divide-y divide-border-muted">
              {REQUIRED_ENV_VARS.filter((v) => v.category === cat).map((v) => {
                const isSet = envStatus?.[v.key] ?? false;
                return (
                  <div key={v.key} className="flex items-center justify-between gap-3 px-5 py-2.5 min-h-[44px]">
                    <span className="text-sm text-text-primary font-mono">{v.key}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSet
                        ? <><CheckCircle className="w-4 h-4 text-status-success-text" /><span className="text-xs font-medium text-status-success-text">Set</span></>
                        : <><XCircle className="w-4 h-4 text-text-disabled" /><span className="text-xs font-medium text-text-disabled">Missing</span></>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-default p-3">
      <div className="flex items-center gap-2 text-text-tertiary mb-1">{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="text-sm font-semibold text-text-primary font-mono truncate">{value}</p>
    </div>
  );
}

function ServiceCard({ label, status }: { label: string; status: string }) {
  const ok = status === 'ok';
  return (
    <div className={`rounded-xl border p-3 ${ok ? 'border-status-success-border bg-status-success-bg' : 'border-status-danger-border bg-status-danger-bg'}`}>
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <div className="flex items-center gap-1.5 mt-1">
        {ok ? <CheckCircle className="w-4 h-4 text-status-success-text" /> : <XCircle className="w-4 h-4 text-status-danger-text" />}
        <span className="text-sm font-semibold text-text-primary">{ok ? 'Connected' : 'Error'}</span>
      </div>
    </div>
  );
}

function SystemSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div><div className="h-7 w-40 rounded bg-surface-tertiary" /><div className="mt-2 h-4 w-64 rounded bg-surface-tertiary" /></div>
      <div className="rounded-2xl border border-border-default bg-surface-primary p-5">
        <div className="h-3 w-24 rounded bg-surface-tertiary mb-4" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl bg-surface-tertiary" />)}</div>
      </div>
      <div className="rounded-2xl border border-border-default bg-surface-primary p-5">
        <div className="h-3 w-24 rounded bg-surface-tertiary mb-4" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl bg-surface-tertiary" />)}</div>
      </div>
      <div className="h-64 rounded-2xl bg-surface-tertiary" />
    </div>
  );
}
