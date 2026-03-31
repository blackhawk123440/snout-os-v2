'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Users, Calendar, Zap, MessageSquare, DollarSign,
  ClipboardList, CheckCircle, XCircle, Clock, ChevronRight,
} from 'lucide-react';
import { AppErrorState } from '@/components/app';
import { Button } from '@/components/ui';

/* ─── Types ────────────────────────────────────────────────────────── */

interface OrgDetail {
  id: string;
  name: string;
  plan: string | null;
  status: string;
  createdAt: string;
  ownerEmail: string | null;
  sitterCount: number;
  clientCount: number;
  bookingCount30d: number;
  revenue30d: number;
  stripeConnected: boolean;
  twilioConnected: boolean;
  calendarSynced: boolean;
}

interface OrgUser {
  id: string;
  email: string;
  name: string;
  role: string;
  lastLogin: string | null;
  active: boolean;
}

interface EventLogEntry {
  id: string;
  action: string;
  status: string;
  level?: string;
  message?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface FinanceSummary {
  totalCharges: number;
  totalRefunds: number;
  totalPayouts: number;
  netRevenue: number;
}

type TabId = 'overview' | 'users' | 'bookings' | 'automations' | 'messages' | 'finance' | 'events';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Building2 className="w-4 h-4" /> },
  { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  { id: 'bookings', label: 'Bookings', icon: <Calendar className="w-4 h-4" /> },
  { id: 'automations', label: 'Automations', icon: <Zap className="w-4 h-4" /> },
  { id: 'messages', label: 'Messages', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'finance', label: 'Finance', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'events', label: 'Event Log', icon: <ClipboardList className="w-4 h-4" /> },
];

const statusBadge = (s: string) => {
  if (s === 'active') return 'bg-status-success-bg text-status-success-text';
  if (s === 'trial') return 'bg-status-info-bg text-status-info-text';
  if (s === 'suspended') return 'bg-status-danger-bg text-status-danger-text';
  return 'bg-surface-tertiary text-text-secondary';
};

/* ─── Page ─────────────────────────────────────────────────────────── */

export default function AdminOrgDetailPage() {
  const params = useParams();
  const orgId = params?.id as string;
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const { data: org, isLoading, error, refetch } = useQuery<OrgDetail>({
    queryKey: ['admin', 'org', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/ops/stats?range=30d`);
      if (!res.ok) throw new Error('Failed to load org');
      const data = await res.json();
      return {
        id: orgId,
        name: data.org?.name || 'Organization',
        plan: data.org?.plan || 'professional',
        status: 'active',
        createdAt: data.org?.createdAt || new Date().toISOString(),
        ownerEmail: data.org?.ownerEmail || null,
        sitterCount: data.activeSitters ?? 0,
        clientCount: data.activeClients ?? 0,
        bookingCount30d: data.bookingsCreated ?? 0,
        revenue30d: data.revenueTotal ?? 0,
        stripeConnected: data.stripeConnected ?? false,
        twilioConnected: data.twilioConnected ?? false,
        calendarSynced: data.calendarSynced ?? false,
      };
    },
    enabled: !!orgId,
  });

  if (isLoading) return <OrgDetailSkeleton />;
  if (error || !org) {
    return (
      <AppErrorState
        title="Couldn't load organization"
        subtitle={error instanceof Error ? error.message : 'Not found'}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-tertiary text-lg font-bold text-accent-primary">
            {org.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary">{org.name}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(org.status)}`}>{org.status}</span>
            </div>
            <p className="text-sm text-text-secondary">
              {org.plan || 'No plan'} &middot; {org.ownerEmail || 'No owner'} &middot; Created {new Date(org.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface-secondary p-1 scrollbar-thin">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-surface-primary text-text-primary shadow-sm'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab org={org} />}
      {activeTab === 'users' && <UsersTab orgId={orgId} />}
      {activeTab === 'events' && <EventLogTab orgId={orgId} />}
      {activeTab === 'finance' && <FinanceTab orgId={orgId} />}
      {activeTab === 'bookings' && <PlaceholderTab label="Bookings" description="Booking activity and status breakdown for this org." />}
      {activeTab === 'automations' && <PlaceholderTab label="Automations" description="Automation run history and template usage for this org." />}
      {activeTab === 'messages' && <PlaceholderTab label="Messages" description="Message delivery stats and thread activity for this org." />}
    </div>
  );
}

/* ─── Overview Tab ─────────────────────────────────────────────────── */

function OverviewTab({ org }: { org: OrgDetail }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sitters" value={org.sitterCount} icon={<Users className="w-4 h-4" />} />
        <StatCard label="Clients" value={org.clientCount} icon={<Users className="w-4 h-4" />} />
        <StatCard label="Bookings (30d)" value={org.bookingCount30d} icon={<Calendar className="w-4 h-4" />} />
        <StatCard label="Revenue (30d)" value={`$${org.revenue30d.toLocaleString()}`} icon={<DollarSign className="w-4 h-4" />} />
      </div>

      <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-sm">
        <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-4">Integration Status</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <IntegrationRow label="Stripe" connected={org.stripeConnected} />
          <IntegrationRow label="Twilio" connected={org.twilioConnected} />
          <IntegrationRow label="Calendar Sync" connected={org.calendarSynced} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-primary shadow-sm p-4">
      <div className="text-text-tertiary mb-1">{icon}</div>
      <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary tabular-nums">{value}</p>
    </div>
  );
}

function IntegrationRow({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-default p-3">
      {connected
        ? <CheckCircle className="w-4 h-4 text-status-success-text shrink-0" />
        : <XCircle className="w-4 h-4 text-text-disabled shrink-0" />
      }
      <span className="text-sm text-text-primary">{label}</span>
      <span className={`ml-auto text-xs font-medium ${connected ? 'text-status-success-text' : 'text-text-tertiary'}`}>
        {connected ? 'Connected' : 'Not connected'}
      </span>
    </div>
  );
}

/* ─── Users Tab ────────────────────────────────────────────────────── */

function UsersTab({ orgId }: { orgId: string }) {
  const { data: users, isLoading, error, refetch } = useQuery<OrgUser[]>({
    queryKey: ['admin', 'org', orgId, 'users'],
    queryFn: async () => {
      const res = await fetch('/api/ops/stats?range=30d');
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      return (data.users ?? []).map((u: any) => ({
        id: u.id,
        email: u.email || '—',
        name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || '—',
        role: u.role || 'unknown',
        lastLogin: u.lastLogin || null,
        active: u.active !== false,
      }));
    },
  });

  if (isLoading) return <TabSkeleton />;
  if (error) return <AppErrorState title="Couldn't load users" subtitle={error instanceof Error ? error.message : ''} onRetry={() => void refetch()} />;

  if (!users || users.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-primary p-8 text-center shadow-sm">
        <Users className="mx-auto h-8 w-8 text-text-disabled mb-3" />
        <p className="text-sm font-semibold text-text-primary">No users found</p>
        <p className="mt-1 text-xs text-text-tertiary">Users will appear here when they join this organization.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
      <div className="hidden lg:grid lg:grid-cols-[2fr_2fr_1fr_1.5fr_1fr] gap-3 px-5 py-3 border-b border-border-muted text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
        <span>Name</span><span>Email</span><span>Role</span><span>Last Login</span><span>Status</span>
      </div>
      <div className="divide-y divide-border-muted">
        {users.map((u) => (
          <div key={u.id} className="flex flex-col gap-1 px-5 py-3 min-h-[56px] lg:grid lg:grid-cols-[2fr_2fr_1fr_1.5fr_1fr] lg:items-center lg:gap-3">
            <p className="text-sm font-medium text-text-primary truncate">{u.name}</p>
            <p className="text-sm text-text-secondary truncate">{u.email}</p>
            <span className="text-xs font-medium text-text-tertiary capitalize">{u.role}</span>
            <span className="text-xs text-text-tertiary tabular-nums">
              {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '—'}
            </span>
            <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${u.active ? 'bg-status-success-bg text-status-success-text' : 'bg-surface-tertiary text-text-secondary'}`}>
              {u.active ? 'Active' : 'Inactive'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Event Log Tab ────────────────────────────────────────────────── */

function EventLogTab({ orgId }: { orgId: string }) {
  const [filter, setFilter] = useState('');

  const { data: events, isLoading, error, refetch } = useQuery<EventLogEntry[]>({
    queryKey: ['admin', 'org', orgId, 'events'],
    queryFn: async () => {
      const res = await fetch('/api/ops/stats?range=30d');
      if (!res.ok) throw new Error('Failed to load events');
      const data = await res.json();
      return (data.recentEvents ?? data.recentAlerts ?? []).slice(0, 50);
    },
  });

  if (isLoading) return <TabSkeleton />;
  if (error) return <AppErrorState title="Couldn't load events" subtitle={error instanceof Error ? error.message : ''} onRetry={() => void refetch()} />;

  const filtered = (events ?? []).filter((e) =>
    !filter || e.action.toLowerCase().includes(filter.toLowerCase()) || (e.message?.toLowerCase().includes(filter.toLowerCase()) ?? false)
  );

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter events..."
        className="w-full min-h-[44px] rounded-xl border border-border-default bg-surface-primary px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
      />

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-surface-primary p-8 text-center shadow-sm">
          <ClipboardList className="mx-auto h-8 w-8 text-text-disabled mb-3" />
          <p className="text-sm font-semibold text-text-primary">No events found</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden divide-y divide-border-muted">
          {filtered.map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-5 py-3 min-h-[48px]">
              <Clock className="w-4 h-4 text-text-disabled shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text-primary">{e.action}</p>
                {e.message && <p className="text-xs text-text-tertiary mt-0.5 truncate">{e.message}</p>}
              </div>
              <div className="shrink-0 text-right">
                <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${
                  e.status === 'success' ? 'bg-status-success-bg text-status-success-text'
                  : e.status === 'error' ? 'bg-status-danger-bg text-status-danger-text'
                  : 'bg-surface-tertiary text-text-secondary'
                }`}>{e.status}</span>
                <p className="text-[10px] text-text-disabled tabular-nums mt-1">
                  {new Date(e.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Finance Tab ──────────────────────────────────────────────────── */

function FinanceTab({ orgId }: { orgId: string }) {
  const { data, isLoading, error, refetch } = useQuery<FinanceSummary>({
    queryKey: ['admin', 'org', orgId, 'finance'],
    queryFn: async () => {
      const res = await fetch('/api/ops/stats?range=30d');
      if (!res.ok) throw new Error('Failed to load finance');
      const d = await res.json();
      return {
        totalCharges: d.revenueTotal ?? 0,
        totalRefunds: d.refundsTotal ?? 0,
        totalPayouts: d.payoutsTotal ?? 0,
        netRevenue: (d.revenueTotal ?? 0) - (d.refundsTotal ?? 0),
      };
    },
  });

  if (isLoading) return <TabSkeleton />;
  if (error) return <AppErrorState title="Couldn't load finance data" subtitle={error instanceof Error ? error.message : ''} onRetry={() => void refetch()} />;

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Charges" value={fmt(data?.totalCharges ?? 0)} icon={<DollarSign className="w-4 h-4" />} />
      <StatCard label="Refunds" value={fmt(data?.totalRefunds ?? 0)} icon={<DollarSign className="w-4 h-4" />} />
      <StatCard label="Payouts" value={fmt(data?.totalPayouts ?? 0)} icon={<DollarSign className="w-4 h-4" />} />
      <StatCard label="Net Revenue" value={fmt(data?.netRevenue ?? 0)} icon={<DollarSign className="w-4 h-4" />} />
    </div>
  );
}

/* ─── Placeholder Tab ──────────────────────────────────────────────── */

function PlaceholderTab({ label, description }: { label: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-primary p-8 text-center shadow-sm">
      <p className="text-sm font-semibold text-text-primary">{label}</p>
      <p className="mt-1 text-xs text-text-tertiary max-w-[300px] mx-auto">{description}</p>
    </div>
  );
}

/* ─── Skeletons ────────────────────────────────────────────────────── */

function OrgDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-surface-tertiary" />
        <div className="space-y-2"><div className="h-7 w-48 rounded bg-surface-tertiary" /><div className="h-4 w-72 rounded bg-surface-tertiary" /></div>
      </div>
      <div className="h-12 rounded-xl bg-surface-tertiary" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl bg-surface-tertiary" />)}
      </div>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-primary p-4">
          <div className="h-4 w-4 rounded bg-surface-tertiary" />
          <div className="flex-1 space-y-2"><div className="h-4 w-40 rounded bg-surface-tertiary" /><div className="h-3 w-64 rounded bg-surface-tertiary" /></div>
        </div>
      ))}
    </div>
  );
}
