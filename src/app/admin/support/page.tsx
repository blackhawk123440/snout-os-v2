'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Search, Users, Building2, AlertTriangle, Clock, Mail,
  KeyRound, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { AppErrorState } from '@/components/app';
import { Button } from '@/components/ui';
import { toastSuccess, toastError } from '@/lib/toast';

interface SearchResult {
  type: 'user' | 'org';
  id: string;
  name: string;
  email?: string;
  role?: string;
  orgName?: string;
}

interface ErrorEvent {
  id: string;
  action: string;
  status: string;
  level: string;
  message?: string;
  createdAt: string;
}

export default function AdminSupportPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: results, isLoading: searching } = useQuery<SearchResult[]>({
    queryKey: ['admin', 'support-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim()) return [];
      const res = await fetch('/api/ops/stats?range=30d');
      if (!res.ok) return [];
      const data = await res.json();
      const q = searchTerm.toLowerCase();
      const found: SearchResult[] = [];
      if (data.org?.name?.toLowerCase().includes(q)) {
        found.push({ type: 'org', id: data.org.id || 'default', name: data.org.name, orgName: data.org.name });
      }
      for (const u of (data.users ?? [])) {
        const name = u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim();
        if (name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)) {
          found.push({ type: 'user', id: u.id, name, email: u.email, role: u.role, orgName: data.org?.name });
        }
      }
      return found;
    },
    enabled: searchTerm.length >= 2,
  });

  const { data: errorEvents, isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useQuery<ErrorEvent[]>({
    queryKey: ['admin', 'support-errors'],
    queryFn: async () => {
      const res = await fetch('/api/ops/stats?range=7d');
      if (!res.ok) throw new Error('Failed to load error events');
      const data = await res.json();
      return (data.recentAlerts ?? [])
        .filter((e: any) => e.status === 'error' || e.level === 'error' || e.level === 'warn')
        .slice(0, 25);
    },
    refetchInterval: 60000,
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Failed to trigger reset');
    },
    onSuccess: () => toastSuccess('Password reset email sent'),
    onError: (err: Error) => toastError(err.message),
  });

  const handleSearch = () => {
    setSearchTerm(searchQuery.trim());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Support Tools</h1>
        <p className="mt-1 text-sm text-text-secondary">Search users and orgs, trigger password resets, view recent errors</p>
      </div>

      {/* Search */}
      <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-sm">
        <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">Search</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by email, user name, or org name..."
              className="w-full min-h-[44px] rounded-xl border border-border-default bg-surface-primary pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
          </div>
          <Button variant="primary" size="md" onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
            Search
          </Button>
        </div>

        {/* Results */}
        {searching && (
          <div className="mt-4 animate-pulse space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-surface-tertiary" />)}
          </div>
        )}
        {results && results.length > 0 && (
          <div className="mt-4 space-y-2">
            {results.map((r) => (
              <div key={`${r.type}-${r.id}`} className="flex items-center gap-3 rounded-xl border border-border-default p-3 min-h-[56px]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-tertiary text-accent-primary">
                  {r.type === 'org' ? <Building2 className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{r.name}</p>
                  <p className="text-xs text-text-tertiary truncate">
                    {r.type === 'org' ? 'Organization' : `${r.role || 'user'} · ${r.email || ''}`}
                    {r.orgName && r.type === 'user' ? ` · ${r.orgName}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {r.type === 'user' && r.email && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => resetPasswordMutation.mutate(r.email!)}
                      disabled={resetPasswordMutation.isPending}
                    >
                      <KeyRound className="w-3.5 h-3.5 mr-1" /> Reset PW
                    </Button>
                  )}
                  <Link href={r.type === 'org' ? `/admin/orgs/${r.id}` : `/admin/orgs/${r.id}`}>
                    <Button variant="secondary" size="sm">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> View
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
        {results && results.length === 0 && searchTerm && (
          <p className="mt-4 text-sm text-text-tertiary text-center py-4">No results for &ldquo;{searchTerm}&rdquo;</p>
        )}
      </div>

      {/* Recent Errors */}
      <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Recent Errors &amp; Warnings (24h)</h2>
          <span className="text-[11px] font-semibold text-status-warning-text tabular-nums">{errorEvents?.length ?? 0}</span>
        </div>
        {eventsLoading ? (
          <div className="px-5 pb-5 animate-pulse space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-surface-tertiary" />)}
          </div>
        ) : eventsError ? (
          <div className="px-5 pb-5">
            <AppErrorState title="Couldn't load errors" subtitle="" onRetry={() => void refetchEvents()} />
          </div>
        ) : !errorEvents || errorEvents.length === 0 ? (
          <div className="px-5 pb-5">
            <div className="flex items-center gap-3 rounded-xl bg-status-success-bg px-4 py-3">
              <Mail className="w-4 h-4 text-status-success-text shrink-0" />
              <p className="text-sm text-status-success-text">No recent errors or warnings</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border-muted">
            {errorEvents.map((e) => (
              <div key={e.id} className="flex items-start gap-3 px-5 py-3 min-h-[48px]">
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${e.status === 'error' || e.level === 'error' ? 'text-status-danger-text' : 'text-status-warning-text'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary">{e.action}</p>
                  {e.message && <p className="text-xs text-text-tertiary truncate mt-0.5">{e.message}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${
                    e.level === 'error' || e.status === 'error' ? 'bg-status-danger-bg text-status-danger-text' : 'bg-status-warning-bg text-status-warning-text'
                  }`}>{e.level || e.status}</span>
                  <p className="text-[10px] text-text-disabled tabular-nums mt-1">
                    {new Date(e.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
