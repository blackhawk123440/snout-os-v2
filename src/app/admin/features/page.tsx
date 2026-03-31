'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ToggleLeft, Globe, Building2 } from 'lucide-react';
import { AppErrorState } from '@/components/app';
import { toastSuccess, toastError } from '@/lib/toast';

interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  scope: 'global' | 'org';
  description: string;
  orgOverrides?: Array<{ orgId: string; orgName: string; enabled: boolean }>;
}

const ENV_FLAGS: Array<{ key: string; description: string; envVar: string }> = [
  { key: 'messaging_v1', description: 'New messaging system', envVar: 'ENABLE_MESSAGING_V1' },
  { key: 'resonance_v1', description: 'AI suggestions layer', envVar: 'ENABLE_RESONANCE_V1' },
  { key: 'google_bidirectional_sync', description: 'Two-way Google Calendar sync', envVar: 'ENABLE_GOOGLE_BIDIRECTIONAL_SYNC' },
  { key: 'calendar_v1', description: 'Calendar V1 features', envVar: 'NEXT_PUBLIC_ENABLE_CALENDAR_V1' },
  { key: 'form_mapper_v1', description: 'New booking form mapper', envVar: 'ENABLE_FORM_MAPPER_V1' },
  { key: 'pricing_engine_v1', description: 'Pricing engine V1', envVar: 'USE_PRICING_ENGINE_V1' },
  { key: 'sitter_messages_v1', description: 'Sitter messaging features', envVar: 'ENABLE_SITTER_MESSAGES_V1' },
  { key: 'ops_srs', description: 'SRS system operations', envVar: 'ENABLE_OPS_SRS' },
  { key: 'auth_protection', description: 'Auth middleware enforcement', envVar: 'ENABLE_AUTH_PROTECTION' },
  { key: 'webhook_validation', description: 'Twilio webhook signature verification', envVar: 'ENABLE_WEBHOOK_VALIDATION' },
];

export default function AdminFeaturesPage() {
  const queryClient = useQueryClient();

  const { data: dbFlags, isLoading, error, refetch } = useQuery<FeatureFlag[]>({
    queryKey: ['admin', 'feature-flags'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/ops/stats?range=7d');
        if (!res.ok) return [];
        const data = await res.json();
        return (data.featureFlags ?? []).map((f: any) => ({
          id: f.id || f.key,
          key: f.key,
          enabled: f.enabled ?? false,
          scope: f.scope || 'global',
          description: f.description || f.key,
          orgOverrides: f.orgOverrides ?? [],
        }));
      } catch { return []; }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const res = await fetch('/api/ops/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-flag', key, enabled }),
      });
      if (!res.ok) throw new Error('Failed to toggle flag');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feature-flags'] });
      toastSuccess('Flag updated');
    },
    onError: (err: Error) => toastError(err.message),
  });

  if (isLoading) return <FeaturesSkeleton />;
  if (error) return <AppErrorState title="Couldn't load feature flags" subtitle={error instanceof Error ? error.message : ''} onRetry={() => void refetch()} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Feature Flags</h1>
        <p className="mt-1 text-sm text-text-secondary">Toggle features globally or per-org</p>
      </div>

      {/* Environment Flags */}
      <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-text-tertiary" />
          <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Environment Flags</h2>
        </div>
        <p className="px-5 pb-3 text-xs text-text-tertiary">These flags are controlled by environment variables. Values shown are from the current runtime.</p>
        <div className="divide-y divide-border-muted">
          {ENV_FLAGS.map((flag) => (
            <div key={flag.key} className="flex items-center justify-between gap-4 px-5 py-3 min-h-[56px]">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">{flag.description}</p>
                <p className="text-xs text-text-tertiary font-mono">{flag.envVar}</p>
              </div>
              <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium bg-surface-tertiary text-text-secondary">
                env
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* DB Feature Flags */}
      <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-text-tertiary" />
          <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Database Flags</h2>
        </div>
        <p className="px-5 pb-3 text-xs text-text-tertiary">Toggleable per-org flags stored in the FeatureFlag table.</p>
        {(!dbFlags || dbFlags.length === 0) ? (
          <div className="px-5 pb-5">
            <div className="rounded-xl bg-surface-secondary p-6 text-center">
              <ToggleLeft className="mx-auto h-8 w-8 text-text-disabled mb-3" />
              <p className="text-sm font-semibold text-text-primary">No database flags configured</p>
              <p className="mt-1 text-xs text-text-tertiary">Feature flags from the FeatureFlag model will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border-muted">
            {dbFlags.map((flag) => (
              <div key={flag.id} className="flex items-center justify-between gap-4 px-5 py-3 min-h-[56px]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{flag.description || flag.key}</p>
                  <p className="text-xs text-text-tertiary font-mono">{flag.key}</p>
                  {flag.orgOverrides && flag.orgOverrides.length > 0 && (
                    <p className="text-xs text-accent-primary mt-0.5">{flag.orgOverrides.length} org override{flag.orgOverrides.length !== 1 ? 's' : ''}</p>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={flag.enabled}
                  onClick={() => toggleMutation.mutate({ key: flag.key, enabled: !flag.enabled })}
                  disabled={toggleMutation.isPending}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 disabled:opacity-50 ${
                    flag.enabled ? 'bg-accent-primary' : 'bg-surface-tertiary'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface-primary shadow ring-0 transition ${
                    flag.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FeaturesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div><div className="h-7 w-40 rounded bg-surface-tertiary" /><div className="mt-2 h-4 w-64 rounded bg-surface-tertiary" /></div>
      {[1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-border-default bg-surface-primary p-5">
          <div className="h-3 w-32 rounded bg-surface-tertiary mb-4" />
          {[1, 2, 3, 4].map((j) => <div key={j} className="flex items-center justify-between py-3"><div className="h-4 w-48 rounded bg-surface-tertiary" /><div className="h-6 w-11 rounded-full bg-surface-tertiary" /></div>)}
        </div>
      ))}
    </div>
  );
}
