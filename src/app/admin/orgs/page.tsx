'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, Search, ChevronRight } from 'lucide-react';
import { AppErrorState } from '@/components/app';
import { Button } from '@/components/ui';

interface OrgRow {
  id: string;
  name: string;
  ownerEmail: string | null;
  plan: string | null;
  status: string;
  sitterCount: number;
  clientCount: number;
  bookingCount30d: number;
  createdAt: string;
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'active': return 'bg-status-success-bg text-status-success-text';
    case 'trial': return 'bg-status-info-bg text-status-info-text';
    case 'suspended': return 'bg-status-danger-bg text-status-danger-text';
    case 'churned': return 'bg-surface-tertiary text-text-secondary';
    default: return 'bg-surface-tertiary text-text-secondary';
  }
};

export default function AdminOrgsPage() {
  const [search, setSearch] = useState('');

  const { data: orgs, isLoading, error, refetch } = useQuery<OrgRow[]>({
    queryKey: ['admin', 'orgs'],
    queryFn: async () => {
      const res = await fetch('/api/ops/stats?range=30d');
      if (!res.ok) throw new Error('Failed to load orgs');
      const data = await res.json();
      if (data.org) {
        return [{
          id: data.org.id || 'default',
          name: data.org.name || 'Snout',
          ownerEmail: data.org.ownerEmail || null,
          plan: data.org.plan || 'professional',
          status: 'active',
          sitterCount: data.activeSitters ?? 0,
          clientCount: data.activeClients ?? 0,
          bookingCount30d: data.bookingsCreated ?? 0,
          createdAt: data.org.createdAt || new Date().toISOString(),
        }];
      }
      return [];
    },
  });

  const filtered = (orgs ?? []).filter((o) =>
    !search || o.name.toLowerCase().includes(search.toLowerCase()) || (o.ownerEmail?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Tenant Management</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {orgs?.length ?? 0} organization{(orgs?.length ?? 0) !== 1 ? 's' : ''} on the platform
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by org name or owner email..."
          className="w-full min-h-[44px] rounded-xl border border-border-default bg-surface-primary pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
        />
      </div>

      {isLoading ? (
        <OrgsSkeleton />
      ) : error ? (
        <AppErrorState
          title="Couldn't load organizations"
          subtitle={error instanceof Error ? error.message : 'Unable to load'}
          onRetry={() => void refetch()}
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-accent-tertiary p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary shadow-sm mb-4">
            <Building2 className="h-7 w-7 text-text-inverse" />
          </div>
          <p className="text-xl font-bold text-text-primary">
            {search ? 'No matching organizations' : 'No organizations'}
          </p>
          <p className="mt-2 text-sm text-text-secondary max-w-[280px] mx-auto">
            {search ? 'Try a different search term.' : 'Organizations will appear here when tenants sign up.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
          {/* Header row — hidden on mobile, visible on desktop */}
          <div className="hidden lg:grid lg:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3 border-b border-border-muted text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
            <span>Organization</span>
            <span>Owner</span>
            <span>Plan</span>
            <span>Sitters</span>
            <span>Clients</span>
            <span>Bookings (30d)</span>
            <span>Status</span>
          </div>

          {/* Rows — card layout on mobile, table on desktop */}
          <div className="divide-y divide-border-muted">
            {filtered.map((org) => (
              <Link
                key={org.id}
                href={`/admin/orgs/${org.id}`}
                className="flex flex-col gap-2 px-5 py-4 hover:bg-surface-secondary transition-colors lg:grid lg:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_auto] lg:items-center lg:gap-3 min-h-[64px]"
              >
                {/* Org name */}
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-tertiary text-sm font-bold text-accent-primary">
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{org.name}</p>
                    <p className="text-xs text-text-tertiary lg:hidden">{org.ownerEmail || 'No owner'}</p>
                  </div>
                </div>

                {/* Owner — desktop only */}
                <p className="hidden text-sm text-text-secondary truncate lg:block">{org.ownerEmail || '—'}</p>

                {/* Mobile: stats row */}
                <div className="flex items-center gap-4 text-xs text-text-secondary lg:contents">
                  <span className="lg:text-sm">{org.plan || '—'}</span>
                  <span className="lg:text-sm tabular-nums">{org.sitterCount}</span>
                  <span className="lg:text-sm tabular-nums">{org.clientCount}</span>
                  <span className="lg:text-sm tabular-nums">{org.bookingCount30d}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge(org.status)}`}>
                    {org.status}
                  </span>
                </div>

                {/* Chevron — desktop */}
                <ChevronRight className="hidden h-4 w-4 text-text-disabled shrink-0 lg:block" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrgsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-11 w-full rounded-xl bg-surface-tertiary" />
      <div className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-4 border-b border-border-muted last:border-b-0">
            <div className="h-9 w-9 rounded-lg bg-surface-tertiary shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-surface-tertiary" />
              <div className="h-3 w-48 rounded bg-surface-tertiary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
