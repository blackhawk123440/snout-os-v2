'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Section } from '@/components/layout';
import { AppCard, AppCardBody, AppCardHeader, AppErrorState, AppFilterBar } from '@/components/app';
import { DataTableShell, EmptyState, Table, TableSkeleton, Button } from '@/components/ui';
import { MobileFilterDrawer } from '@/components/app/MobileFilterDrawer';

type ClientRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address?: string;
  totalBookings?: number;
  lastBooking?: string | null;
};

export function DirectoryTab() {
  const router = useRouter();
  const [filters, setFilters] = useState<Record<string, string>>({
    search: '',
    sort: 'recent',
    status: 'all',
  });
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['owner', 'clients', page, pageSize, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (filters.search) params.set('search', filters.search);
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      const res = await fetch(`/api/clients?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load clients');
      return { items: json.items || [], total: json.total || 0 };
    },
  });
  const rows = data?.items || [];
  const total = data?.total || 0;
  const error = queryError?.message || null;

  const filtered = useMemo(() => {
    if (filters.sort === 'name') {
      return [...rows].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
    }
    return [...rows].sort((a, b) => new Date(b.lastBooking || 0).getTime() - new Date(a.lastBooking || 0).getTime());
  }, [rows, filters.sort]);
  const directorySummary = useMemo(() => {
    const activeClients = rows.filter((row: ClientRow) => (row.totalBookings || 0) > 0).length;
    const returningClients = rows.filter((row: ClientRow) => (row.totalBookings || 0) > 1).length;
    const reachableClients = rows.filter((row: ClientRow) => Boolean(row.phone || row.email)).length;

    return {
      visible: rows.length,
      activeClients,
      returningClients,
      reachableClients,
    };
  }, [rows]);

  const activeFilterCount =
    Number(Boolean(filters.search)) + Number(filters.sort !== 'recent') + Number(filters.status !== 'all');

  return (
    <>
      <Section>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
          <AppCard className="bg-[radial-gradient(circle_at_top_left,_rgba(2,132,199,0.12),_transparent_44%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]">
            <AppCardHeader title="Client directory at a glance" />
            <AppCardBody className="space-y-4">
              <p className="max-w-3xl text-sm leading-6 text-text-secondary">
                A strong client directory should make it obvious who is active, who is returning, and who can be reached quickly when a booking change happens.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border-default bg-surface-primary/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Visible now</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{directorySummary.visible}</p>
                  <p className="mt-1 text-xs text-text-secondary">Clients on this page</p>
                </div>
                <div className="rounded-2xl border border-border-default bg-surface-primary/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Active clients</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{directorySummary.activeClients}</p>
                  <p className="mt-1 text-xs text-text-secondary">Families with at least one booking</p>
                </div>
                <div className="rounded-2xl border border-border-default bg-surface-primary/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Returning</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{directorySummary.returningClients}</p>
                  <p className="mt-1 text-xs text-text-secondary">Clients who have booked more than once</p>
                </div>
                <div className="rounded-2xl border border-border-default bg-surface-primary/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Reachable</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{directorySummary.reachableClients}</p>
                  <p className="mt-1 text-xs text-text-secondary">Clients with phone or email on file</p>
                </div>
              </div>
            </AppCardBody>
          </AppCard>

          <AppCard>
            <AppCardHeader title="Find the right household faster" />
            <AppCardBody className="space-y-3">
              <p className="text-sm leading-6 text-text-secondary">
                Search by name, phone, or email, then switch to a more specific operating view only when you need it.
              </p>
              <MobileFilterDrawer triggerLabel="Filters" activeCount={activeFilterCount}>
                <AppFilterBar
                  filters={[
                    { key: 'search', label: 'Search', type: 'search', placeholder: 'Name, phone, email' },
                    {
                      key: 'status',
                      label: 'Status',
                      type: 'select',
                      options: [
                        { value: 'all', label: 'All' },
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' },
                      ],
                    },
                    {
                      key: 'sort',
                      label: 'Sort',
                      type: 'select',
                      options: [
                        { value: 'recent', label: 'Most recent booking' },
                        { value: 'name', label: 'Name' },
                      ],
                    },
                  ]}
                  values={filters}
                  onChange={(k, v) => {
                    setFilters((p) => ({ ...p, [k]: v }));
                    setPage(1);
                  }}
                  onClear={() => {
                    setFilters({ search: '', sort: 'recent', status: 'all' });
                    setPage(1);
                  }}
                />
              </MobileFilterDrawer>
            </AppCardBody>
          </AppCard>
        </div>
      </Section>
      <Section>
        {loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : error ? (
          <AppErrorState title="Couldn't load clients" onRetry={() => void refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={activeFilterCount > 0 ? 'No clients match this view' : 'No clients yet'}
            description={activeFilterCount > 0
              ? 'Try broadening your search or clearing filters to bring households back into view.'
              : 'Client records will begin to build as bookings come in. Start with the first booking or add a client directly from the directory.'}
            primaryAction={{ label: 'Create booking', onClick: () => router.push('/bookings/new') }}
            secondaryAction={activeFilterCount > 0
              ? {
                  label: 'Clear filters',
                  onClick: () => {
                    setFilters({ search: '', sort: 'recent', status: 'all' });
                    setPage(1);
                  },
                }
              : undefined}
          />
        ) : (
          <>
            <DataTableShell stickyHeader>
              <Table<ClientRow>
                forceTableLayout
                columns={[
                  {
                    key: 'name',
                    header: 'Client',
                    mobileOrder: 1,
                    mobileLabel: 'Client',
                    render: (r) => (
                      <div>
                        <div className="font-medium">{r.firstName} {r.lastName}</div>
                        <div className="text-xs text-text-secondary">{r.email}</div>
                      </div>
                    ),
                  },
                  { key: 'phone', header: 'Phone', mobileOrder: 2, mobileLabel: 'Phone' },
                  {
                    key: 'bookings',
                    header: 'Bookings',
                    mobileOrder: 3,
                    mobileLabel: 'Bookings',
                    hideBelow: 'md',
                    render: (r) => String(r.totalBookings || 0),
                  },
                  {
                    key: 'lastBooking',
                    header: 'Last Booking',
                    mobileOrder: 4,
                    mobileLabel: 'Last Booking',
                    hideBelow: 'lg',
                    render: (r) => (r.lastBooking ? new Date(r.lastBooking).toLocaleDateString() : 'Never'),
                  },
                ]}
                data={filtered}
                keyExtractor={(r) => r.id}
                onRowClick={(r) => router.push(`/clients/${r.id}`)}
                emptyMessage="No clients"
              />
            </DataTableShell>
            <div className="mt-4 flex items-center justify-between border-t border-border-muted pt-3">
              <p className="text-xs text-text-tertiary tabular-nums">
                Showing {((page - 1) * pageSize) + 1}&ndash;{Math.min(page * pageSize, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page * pageSize >= total}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Section>
    </>
  );
}
