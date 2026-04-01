'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, SlidersHorizontal, X, CheckSquare, MoreVertical, Trash2 } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { DropdownMenu, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/DropdownMenu';
import { formatDateTime, formatServiceName } from '@/lib/format-utils';
import { OwnerAppShell, LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { AppCard, AppCardBody, AppCardHeader, AppErrorState, getStatusPill } from '@/components/app';
import { DataTableShell, EmptyState, Table, TableSkeleton, Button } from '@/components/ui';
import { StatusChip, StatusChipVariant } from '@/components/ui/status-chip';
import type { StatusPillVariant } from '@/components/app';

const CalendarContainer = dynamic(
  () => import('@/components/calendar/CalendarContainer').then(mod => ({ default: mod.CalendarContainer })),
  { loading: () => <TableSkeleton rows={8} cols={6} /> }
);

const pillToChip: Record<StatusPillVariant, StatusChipVariant> = {
  default: 'neutral',
  success: 'success',
  warning: 'warning',
  error: 'danger',
  info: 'info',
};

type BookingRow = {
  id: string;
  firstName: string;
  lastName: string;
  service: string;
  startAt: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  sitter?: { id: string; firstName: string; lastName: string } | null;
  client?: { id: string; firstName: string; lastName: string } | null;
  hasReport?: boolean;
};

export default function BookingsEnterprisePage() {
  return (
    <Suspense fallback={<OwnerAppShell><LayoutWrapper variant="wide"><TableSkeleton rows={8} cols={6} /></LayoutWrapper></OwnerAppShell>}>
      <BookingsContent />
    </Suspense>
  );
}

function BookingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');
  const [activeView, setActiveView] = useState<'list' | 'calendar'>(
    viewParam === 'calendar' || viewParam === 'grid' ? 'calendar' : 'list'
  );

  const changeView = (view: 'list' | 'calendar') => {
    setActiveView(view);
    const params = new URLSearchParams(window.location.search);
    if (view === 'list') params.delete('view');
    else params.set('view', view);
    router.replace(`/bookings${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
  };

  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Record<string, string>>({
    search: '',
    status: 'all',
    payment: 'all',
    from: '',
    to: '',
    sitterId: '',
    clientId: '',
  });
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 50;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSitterId, setBulkSitterId] = useState('');
  const [showBulkAssign, setShowBulkAssign] = useState(false);

  const { data: sittersData } = useQuery({
    queryKey: ['owner', 'sitters-list'],
    queryFn: async () => {
      const res = await fetch('/api/sitters?page=1&pageSize=200');
      const json = await res.json().catch(() => ({}));
      return Array.isArray(json.items) ? json.items : [];
    },
    staleTime: 120000,
    enabled: showBulkAssign,
  });
  const sitterOptions: Array<{ id: string; firstName: string; lastName: string }> = sittersData || [];

  const bulkReassignMutation = useMutation({
    mutationFn: async ({ sitterId, bookingIds }: { sitterId: string; bookingIds: string[] }) => {
      const res = await fetch('/api/ops/daily-board/bulk-reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: bookingIds.map((bookingId) => ({ bookingId, sitterId })),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Bulk reassign failed');
      }
      return res.json();
    },
    onSuccess: (result) => {
      const failed = result.results?.filter((r: any) => !r.success) || [];
      if (failed.length > 0) {
        const reasons = [...new Set(failed.map((r: any) => r.error).filter(Boolean))];
        toastError(`${failed.length} failed: ${reasons.join(', ')}`);
      }
      const succeeded = result.results?.filter((r: any) => r.success).length || 0;
      if (succeeded > 0) toastSuccess(`Reassigned ${succeeded} booking${succeeded !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      setBulkSitterId('');
      void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
    },
    onError: (err: Error) => toastError(err.message),
  });

  const MAX_BULK_SELECT = 50;

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const DELETABLE_STATUSES = ['cancelled', 'expired', 'pending'];

  const deleteMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Delete failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toastSuccess('Booking deleted');
      void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
    },
    onError: (err: Error) => toastError(err.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (bookingIds: string[]) => {
      const results = await Promise.allSettled(
        bookingIds.map((id) => fetch(`/api/bookings/${id}`, { method: 'DELETE' }).then(async (res) => {
          if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Failed'); }
          return id;
        })),
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      return { succeeded, failed };
    },
    onSuccess: (result) => {
      if (result.failed > 0) toastError(`${result.failed} booking(s) could not be deleted`);
      if (result.succeeded > 0) toastSuccess(`Deleted ${result.succeeded} booking(s)`);
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
      void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
    },
    onError: (err: Error) => toastError(err.message),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_BULK_SELECT) {
          toastError(`Maximum ${MAX_BULK_SELECT} bookings can be selected at once`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      const toSelect = rows.slice(0, MAX_BULK_SELECT).map((r: BookingRow) => r.id);
      if (rows.length > MAX_BULK_SELECT) {
        toastError(`Selected first ${MAX_BULK_SELECT} of ${rows.length} (API limit)`);
      }
      setSelectedIds(new Set(toSelect));
    }
  };

  const { data, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['owner', 'bookings', page, pageSize, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (filters.search) params.set('search', filters.search);
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters.payment && filters.payment !== 'all') params.set('paymentStatus', filters.payment);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.sitterId) params.set('sitterId', filters.sitterId);
      if (filters.clientId) params.set('clientId', filters.clientId);
      const res = await fetch(`/api/bookings?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load bookings');
      return { items: json.items || [], total: json.total || 0 };
    },
    enabled: activeView === 'list',
  });
  const rows = data?.items || [];
  const total = data?.total || 0;
  const error = queryError?.message || null;

  const filtered = useMemo(() => rows, [rows]);
  const bookingSummary = useMemo(() => {
    const confirmed = rows.filter((row: BookingRow) => row.status === 'confirmed').length;
    const unassigned = rows.filter((row: BookingRow) => !row.sitter).length;
    const paymentAttention = rows.filter((row: BookingRow) => (
      ['confirmed', 'completed'].includes(row.status) && row.paymentStatus !== 'paid'
    )).length;
    const pending = rows.filter((row: BookingRow) => ['pending', 'pending_payment'].includes(row.status)).length;

    return {
      visible: rows.length,
      confirmed,
      unassigned,
      paymentAttention,
      pending,
    };
  }, [rows]);

  // Count only secondary filters (search is always visible)
  const activeFilterCount =
    Number(filters.status !== 'all') +
    Number(filters.payment !== 'all') +
    Number(Boolean(filters.from)) +
    Number(Boolean(filters.to)) +
    Number(Boolean(filters.sitterId)) +
    Number(Boolean(filters.clientId));

  const subtitle =
    activeView === 'calendar'
      ? 'See upcoming care on the calendar and spot coverage gaps before they become customer issues.'
      : total > 0
      ? `${((page - 1) * pageSize) + 1}\u2013${Math.min(page * pageSize, total)} of ${total} bookings in your live operating queue`
      : 'Manage upcoming visits, assignments, and payment follow-through from one place.';

  return (
    <OwnerAppShell>
      <LayoutWrapper variant="wide">
        <PageHeader
          title="Bookings"
          subtitle={subtitle}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-lg border border-border-default bg-surface-primary p-0.5">
                {([
                  { id: 'list', label: 'List' },
                  { id: 'calendar', label: 'Calendar' },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => changeView(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      activeView === tab.id
                        ? 'bg-surface-inverse text-text-inverse'
                        : 'text-text-secondary hover:bg-surface-tertiary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <Link href="/bookings/new">
                <Button leftIcon={<Plus className="w-3.5 h-3.5" />}>New booking</Button>
              </Link>
            </div>
          }
        />

        <Section>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
            <AppCard className="bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.12),_transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]">
              <AppCardHeader title={activeView === 'calendar' ? 'Your care calendar' : 'Your bookings workspace'} />
              <AppCardBody className="space-y-4">
                <p className="max-w-3xl text-sm leading-6 text-text-secondary">
                  {activeView === 'calendar'
                    ? 'Use the calendar to see where the week is full, where coverage is thin, and which visits may need quick owner attention.'
                    : 'Track every visit from request to completion with a calmer, customer-ready operating view. Search fast, catch assignment gaps, and keep the team focused on what needs action today.'}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border-default bg-surface-primary/80 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Visible now</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{bookingSummary.visible}</p>
                    <p className="mt-1 text-xs text-text-secondary">Bookings on this page right now</p>
                  </div>
                  <div className="rounded-2xl border border-border-default bg-surface-primary/80 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Ready to deliver</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{bookingSummary.confirmed}</p>
                    <p className="mt-1 text-xs text-text-secondary">Confirmed visits with the schedule in motion</p>
                  </div>
                  <div className="rounded-2xl border border-border-default bg-surface-primary/80 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Needs coverage</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{bookingSummary.unassigned}</p>
                    <p className="mt-1 text-xs text-text-secondary">Visits without a sitter assigned yet</p>
                  </div>
                  <div className="rounded-2xl border border-border-default bg-surface-primary/80 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Needs follow-through</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{bookingSummary.pending + bookingSummary.paymentAttention}</p>
                    <p className="mt-1 text-xs text-text-secondary">Pending approvals or unpaid completed work</p>
                  </div>
                </div>
              </AppCardBody>
            </AppCard>

            <AppCard>
              <AppCardHeader title="Best next moves" />
              <AppCardBody className="space-y-3">
                <div className="rounded-2xl border border-border-default bg-surface-secondary px-4 py-3">
                  <p className="text-sm font-semibold text-text-primary">Keep the launch path simple</p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    New workspaces usually ship fastest when the team focuses on clean booking intake, clear assignment, and one reliable communication path.
                  </p>
                </div>
                <div className="space-y-2 text-sm text-text-secondary">
                  <p>{bookingSummary.unassigned > 0 ? `${bookingSummary.unassigned} booking${bookingSummary.unassigned !== 1 ? 's' : ''} still need sitter coverage.` : 'All visible bookings have sitter coverage assigned.'}</p>
                  <p>{bookingSummary.pending > 0 ? `${bookingSummary.pending} booking${bookingSummary.pending !== 1 ? 's' : ''} are still pending confirmation.` : 'No visible bookings are waiting on confirmation.'}</p>
                  <p>{bookingSummary.paymentAttention > 0 ? `${bookingSummary.paymentAttention} booking${bookingSummary.paymentAttention !== 1 ? 's' : ''} may need payment follow-up.` : 'No visible bookings are showing payment follow-up risk.'}</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href="/bookings/new">
                    <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>Add booking</Button>
                  </Link>
                  <Button size="sm" variant="secondary" onClick={() => changeView(activeView === 'list' ? 'calendar' : 'list')}>
                    Open {activeView === 'list' ? 'calendar' : 'list'}
                  </Button>
                </div>
              </AppCardBody>
            </AppCard>
          </div>
        </Section>

        {activeView === 'list' && (
          <>
            <Section>
              <div className="rounded-2xl border border-border-default bg-surface-primary p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-1">
                  <p className="text-sm font-semibold text-text-primary">Find and manage live bookings</p>
                  <p className="text-sm leading-6 text-text-secondary">
                    Search across clients, services, or sitters, then narrow the queue only when you need a closer operating view.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => { setFilters((p) => ({ ...p, search: e.target.value })); setPage(1); }}
                      placeholder="Search client, service, sitter..."
                      className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 pl-10 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
                    />
                    <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowBulkAssign((p) => !p); if (showBulkAssign) { setSelectedIds(new Set()); setBulkSitterId(''); } }}
                    className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      showBulkAssign
                        ? 'border-accent-primary bg-accent-secondary text-accent-primary'
                        : 'border-border-default bg-surface-primary text-text-secondary hover:bg-surface-secondary'
                    }`}
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Select</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFilters((p) => !p)}
                    className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      showFilters || activeFilterCount > 0
                        ? 'border-accent-primary bg-accent-secondary text-accent-primary'
                        : 'border-border-default bg-surface-primary text-text-secondary hover:bg-surface-secondary'
                    }`}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="hidden sm:inline">Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent-primary px-1.5 text-xs font-semibold text-text-inverse">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </Section>

            {showFilters && (
              <Section>
                <div className="rounded-xl border border-border-default bg-surface-primary p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Refine this view</p>
                      <p className="mt-1 text-sm text-text-secondary">Use filters when you need to isolate a date range, payment state, or coverage issue.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFilters((p) => ({ ...p, status: 'all', payment: 'all', from: '', to: '', sitterId: '', clientId: '' }));
                            setPage(1);
                          }}
                          className="text-xs font-medium text-accent-primary hover:underline"
                        >
                          Clear all
                        </button>
                      )}
                      <button type="button" onClick={() => setShowFilters(false)} className="rounded p-1 text-text-tertiary hover:bg-surface-secondary">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {/* ui-primitive-ok — filter panel uses inline inputs for compact grid layout */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">From</label>
                      <input type="date" value={filters.from} onChange={(e) => { setFilters((p) => ({ ...p, from: e.target.value })); setPage(1); }} className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm text-text-primary focus:border-border-focus focus:outline-none" />                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">To</label>
                      <input type="date" value={filters.to} onChange={(e) => { setFilters((p) => ({ ...p, to: e.target.value })); setPage(1); }} className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm text-text-primary focus:border-border-focus focus:outline-none" />                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Status</label>
                      <select value={filters.status} onChange={(e) => { setFilters((p) => ({ ...p, status: e.target.value })); setPage(1); }} className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm text-text-primary focus:border-border-focus focus:outline-none">                        <option value="all">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Payment</label>
                      <select value={filters.payment} onChange={(e) => { setFilters((p) => ({ ...p, payment: e.target.value })); setPage(1); }} className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm text-text-primary focus:border-border-focus focus:outline-none">                        <option value="all">All payments</option>
                        <option value="paid">Paid</option>
                        <option value="unpaid">Unpaid</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Sitter</label>
                      <input type="text" value={filters.sitterId} onChange={(e) => { setFilters((p) => ({ ...p, sitterId: e.target.value })); setPage(1); }} placeholder="Name or ID" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none" />                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Client</label>
                      <input type="text" value={filters.clientId} onChange={(e) => { setFilters((p) => ({ ...p, clientId: e.target.value })); setPage(1); }} placeholder="Name or ID" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none" />                    </div>
                  </div>
                </div>
              </Section>
            )}

            <Section>
              {loading ? (
                <TableSkeleton rows={8} cols={6} />
              ) : error ? (
                <AppErrorState title="Couldn't load bookings" onRetry={() => void refetch()} />
              ) : filtered.length === 0 ? (
                <EmptyState
                  title={activeFilterCount > 0 || Boolean(filters.search) ? 'No bookings match this view' : 'No bookings yet'}
                  description={activeFilterCount > 0 || Boolean(filters.search)
                    ? 'Try clearing filters or broadening your search to bring more bookings back into view.'
                    : 'Your booking workspace is ready. Add the first visit to start building a reliable operating rhythm for clients and sitters.'}
                  primaryAction={{ label: 'Create booking', onClick: () => router.push('/bookings/new') }}
                  secondaryAction={activeFilterCount > 0 || Boolean(filters.search)
                    ? { label: 'Clear filters', onClick: () => { setFilters({ search: '', status: 'all', payment: 'all', from: '', to: '', sitterId: '', clientId: '' }); setPage(1); } }
                    : undefined}
                />
              ) : (
                <>
                  {/* Bulk action bar */}
                  {showBulkAssign && selectedIds.size > 0 && (
                    <div className="mb-3 flex items-center gap-3 rounded-xl border border-accent-primary bg-accent-secondary px-4 py-3">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-sm font-medium text-accent-primary hover:underline"
                      >
                        {selectedIds.size === rows.length ? 'Deselect all' : `${selectedIds.size} selected`}
                      </button>
                      <select
                        value={bulkSitterId}
                        onChange={(e) => setBulkSitterId(e.target.value)}
                        className="min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                      >
                        <option value="">Assign selected bookings to...</option>
                        {sitterOptions.map((s) => (
                          <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={!bulkSitterId || bulkReassignMutation.isPending}
                        onClick={() => {
                          if (!bulkSitterId) return;
                          bulkReassignMutation.mutate({ sitterId: bulkSitterId, bookingIds: Array.from(selectedIds) });
                        }}
                      >
                        {bulkReassignMutation.isPending ? 'Updating…' : 'Update sitter'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={bulkDeleteMutation.isPending}
                        onClick={() => {
                          const eligible = Array.from(selectedIds).filter((id) => {
                            const row = rows.find((r: BookingRow) => r.id === id);
                            return row && DELETABLE_STATUSES.includes(row.status);
                          });
                          if (eligible.length === 0) { toastError('No selected bookings are deletable (must be cancelled, expired, or pending)'); return; }
                          setConfirmBulkDelete(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                      <button
                        type="button"
                        onClick={() => { setSelectedIds(new Set()); setBulkSitterId(''); }}
                        className="text-xs text-text-tertiary hover:text-text-primary"
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  {/* Bulk delete confirmation */}
                  {confirmBulkDelete && (
                    <div className="mb-3 flex items-center gap-3 rounded-xl border border-status-danger-border bg-status-danger-bg px-4 py-3">
                      <p className="text-sm font-medium text-status-danger-text">
                        Delete {Array.from(selectedIds).filter((id) => { const r = rows.find((r: BookingRow) => r.id === id); return r && DELETABLE_STATUSES.includes(r.status); }).length} booking(s)? This cannot be undone.
                      </p>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={bulkDeleteMutation.isPending}
                        onClick={() => {
                          const eligible = Array.from(selectedIds).filter((id) => { const r = rows.find((r: BookingRow) => r.id === id); return r && DELETABLE_STATUSES.includes(r.status); });
                          bulkDeleteMutation.mutate(eligible);
                        }}
                      >
                        {bulkDeleteMutation.isPending ? 'Deleting…' : 'Confirm delete'}
                      </Button>
                      <button type="button" onClick={() => setConfirmBulkDelete(false)} className="text-xs text-text-tertiary hover:text-text-primary">Cancel</button>
                    </div>
                  )}

                  {/* Single delete confirmation */}
                  {confirmDeleteId && (
                    <div className="mb-3 flex items-center gap-3 rounded-xl border border-status-danger-border bg-status-danger-bg px-4 py-3">
                      <p className="text-sm font-medium text-status-danger-text">Delete this booking? This cannot be undone.</p>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => { deleteMutation.mutate(confirmDeleteId); setConfirmDeleteId(null); }}
                      >
                        {deleteMutation.isPending ? 'Deleting…' : 'Confirm'}
                      </Button>
                      <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-xs text-text-tertiary hover:text-text-primary">Cancel</button>
                    </div>
                  )}

                  <DataTableShell stickyHeader>
                    <Table<BookingRow>
                      forceTableLayout
                      columns={[
                        ...(showBulkAssign ? [{
                          key: 'select' as const,
                          header: '',
                          width: '40px',
                          render: (r: BookingRow) => (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(r.id)}
                              onChange={() => toggleSelect(r.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 rounded border-border-default text-accent-primary focus:ring-accent-primary cursor-pointer"
                            />
                          ),
                        }] : []),
                        {
                          key: 'client',
                          header: 'Client',
                          mobileOrder: 1,
                          mobileLabel: 'Client',
                          render: (r) => (
                            <div>
                              <div className="font-medium">{r.firstName} {r.lastName}</div>
                              <div className="text-xs text-text-secondary">{formatServiceName(r.service)}</div>
                            </div>
                          ),
                        },
                        {
                          key: 'startAt',
                          header: 'Scheduled',
                          mobileOrder: 2,
                          mobileLabel: 'Scheduled',
                          render: (r) => formatDateTime(r.startAt),
                        },
                        {
                          key: 'status',
                          header: 'Status',
                          mobileOrder: 3,
                          mobileLabel: 'Status',
                          render: (r) => {
                            const pill = getStatusPill(r.status);
                            return <StatusChip variant={pillToChip[pill.variant]} ariaLabel={`Booking status: ${pill.label}`}>{pill.label}</StatusChip>;
                          },
                        },
                        {
                          key: 'sitter',
                          header: 'Sitter',
                          mobileOrder: 4,
                          mobileLabel: 'Sitter',
                          hideBelow: 'md',
                          render: (r) => (r.sitter ? `${r.sitter.firstName} ${r.sitter.lastName}` : 'Unassigned'),
                        },
                        {
                          key: 'payment',
                          header: 'Payment',
                          mobileOrder: 5,
                          mobileLabel: 'Payment',
                          hideBelow: 'lg',
                          render: (r) => {
                            const ps = r.paymentStatus;
                            if (ps === 'paid') return <StatusChip variant="success">Paid</StatusChip>;
                            if (ps === 'refunded') return <StatusChip variant="neutral">Refunded</StatusChip>;
                            if (['confirmed', 'completed'].includes(r.status)) return <StatusChip variant="warning">Unpaid</StatusChip>;
                            return <StatusChip variant="neutral">Pending</StatusChip>;
                          },
                        },
                        {
                          key: 'total',
                          header: 'Total',
                          mobileOrder: 6,
                          mobileLabel: 'Total',
                          align: 'right',
                          render: (r) => `$${Number(r.totalPrice).toFixed(2)}`,
                        },
                        {
                          key: 'actions' as const,
                          header: '',
                          width: '48px',
                          render: (r: BookingRow) => (
                            <div onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu
                                trigger={
                                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-secondary hover:text-text-primary">
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                }
                                placement="bottom-end"
                              >
                                <DropdownMenuGroup>
                                  <DropdownMenuItem onClick={() => router.push(`/bookings/${r.id}`)}>View</DropdownMenuItem>
                                  {['pending', 'pending_payment'].includes(r.status) && (
                                    <DropdownMenuItem onClick={() => {
                                      void fetch(`/api/bookings/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'confirmed' }) })
                                        .then(async (res) => { if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Confirm failed'); toastSuccess('Booking confirmed'); void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] }); })
                                        .catch((e) => toastError(e instanceof Error ? e.message : 'Confirm failed'));
                                    }}>Confirm</DropdownMenuItem>
                                  )}
                                  {r.status === 'confirmed' && (
                                    <DropdownMenuItem onClick={() => {
                                      void fetch(`/api/bookings/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'pending' }) })
                                        .then(async (res) => { if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Unconfirm failed'); toastSuccess('Booking moved to pending'); void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] }); })
                                        .catch((e) => toastError(e instanceof Error ? e.message : 'Unconfirm failed'));
                                    }}>Unconfirm</DropdownMenuItem>
                                  )}
                                  {!['cancelled', 'completed', 'expired'].includes(r.status) && (
                                    <DropdownMenuItem onClick={() => {
                                      void fetch(`/api/bookings/${r.id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Owner cancelled' }) })
                                        .then(async (res) => { if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Cancel failed'); toastSuccess('Booking cancelled'); void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] }); })
                                        .catch((e) => toastError(e instanceof Error ? e.message : 'Cancel failed'));
                                    }}>Cancel</DropdownMenuItem>
                                  )}
                                </DropdownMenuGroup>
                                {DELETABLE_STATUSES.includes(r.status) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuGroup>
                                      <DropdownMenuItem variant="danger" onClick={() => setConfirmDeleteId(r.id)}>Delete</DropdownMenuItem>
                                    </DropdownMenuGroup>
                                  </>
                                )}
                              </DropdownMenu>
                            </div>
                          ),
                        },
                      ]}
                      data={filtered}
                      keyExtractor={(r) => r.id}
                      onRowClick={(r) => router.push(`/bookings/${r.id}`)}
                      emptyMessage="No bookings"
                    />
                  </DataTableShell>
                  <div className="mt-4 flex items-center justify-between border-t border-border-muted pt-3">
                    <p className="text-[12px] text-text-tertiary tabular-nums">
                      {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page * pageSize >= total}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Section>
          </>
        )}

        {activeView === 'calendar' && (
          <CalendarContainer />
        )}
      </LayoutWrapper>
    </OwnerAppShell>
  );
}
