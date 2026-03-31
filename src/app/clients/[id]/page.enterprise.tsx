'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PawPrint } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OwnerAppShell, LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { AppErrorState, getStatusPill } from '@/components/app';
import { Button, Badge, DataTableShell, EmptyState, Input, Select, StatusChip, Table, TableSkeleton } from '@/components/ui';

type Booking = {
  id: string;
  service: string;
  startAt: string;
  endAt: string;
  status: string;
  totalPrice: number;
  paymentStatus: string;
  sitter?: { id: string; firstName: string; lastName: string } | null;
};

type ClientData = {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    address?: string;
  };
  stats: {
    totalBookings: number;
    totalRevenue: number;
    completedBookings: number;
    upcomingBookings: number;
  };
  bookings: Booking[];
};

export default function ClientDetailEnterprisePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const { data, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['owner', 'clients', clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load client');
      return json as ClientData;
    },
    enabled: !!clientId,
  });

  const nextBooking = useMemo(
    () =>
      data?.bookings
        ?.filter((b) => new Date(b.startAt).getTime() > Date.now())
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0],
    [data]
  );

  if (loading) {
    return (
      <OwnerAppShell>
        <LayoutWrapper variant="wide">
          <PageHeader title="Client" subtitle="Loading..." />
          <TableSkeleton rows={8} cols={5} />
        </LayoutWrapper>
      </OwnerAppShell>
    );
  }
  if (queryError || !data) {
    return (
      <OwnerAppShell>
        <LayoutWrapper variant="wide">
          <PageHeader title="Client" subtitle="Unable to load client" />
          <AppErrorState title="Couldn't load client" subtitle={queryError?.message || 'Unknown error'} onRetry={() => void refetch()} />
        </LayoutWrapper>
      </OwnerAppShell>
    );
  }

  const c = data.client;
  return (
    <OwnerAppShell>
      <LayoutWrapper variant="wide">
        <PageHeader
          title={`${c.firstName} ${c.lastName}`}
          subtitle="Client operator profile"
          actions={
            <div className="flex gap-2">
              <Link href="/clients"><Button variant="secondary">Back</Button></Link>
              <Link href={`/bookings/new?clientId=${c.id}`}><Button>New booking</Button></Link>
              <a href={`mailto:${c.email}`}><Button variant="secondary">Message</Button></a>
              <Link href={`/payments?clientId=${c.id}`}><Button variant="secondary">View payments</Button></Link>
            </div>
          }
        />

        <Section title="At a Glance">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-lg border p-3"><div className="text-xs text-text-secondary">Next booking</div><div>{nextBooking ? new Date(nextBooking.startAt).toLocaleString() : 'None'}</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-text-secondary">Last booking</div><div>{data.bookings[0] ? new Date(data.bookings[0].startAt).toLocaleDateString() : 'None'}</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-text-secondary">Total bookings</div><div>{data.stats.totalBookings}</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-text-secondary">Upcoming</div><div>{data.stats.upcomingBookings}</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-text-secondary">Revenue</div><div>${data.stats.totalRevenue.toFixed(2)}</div></div>
          </div>
        </Section>

        <ClientPetsSection clientId={c.id} />

        <ClientKeysSection clientId={c.id} clientName={`${c.firstName} ${c.lastName}`} />

        <ClientHouseholdSection clientId={c.id} clientName={`${c.firstName} ${c.lastName}`} />

        <Section title="Booking History">
          {data.bookings.length === 0 ? (
            <EmptyState title="No bookings yet" description="Create a booking to start client history." />
          ) : (
            <DataTableShell stickyHeader>
              <Table<Booking>
                forceTableLayout
                columns={[
                  { key: 'service', header: 'Service', mobileOrder: 1, mobileLabel: 'Service' },
                  {
                    key: 'startAt',
                    header: 'Scheduled',
                    mobileOrder: 2,
                    mobileLabel: 'Scheduled',
                    render: (r) => new Date(r.startAt).toLocaleString(),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    mobileOrder: 3,
                    mobileLabel: 'Status',
                    render: (r) => <StatusChip>{getStatusPill(r.status).label}</StatusChip>,
                  },
                  {
                    key: 'sitter',
                    header: 'Sitter',
                    mobileOrder: 4,
                    mobileLabel: 'Sitter',
                    hideBelow: 'md',
                    render: (r) => (r.sitter ? `${r.sitter.firstName} ${r.sitter.lastName}` : 'Unassigned'),
                  },
                  { key: 'total', header: 'Total', mobileOrder: 5, mobileLabel: 'Total', align: 'right', render: (r) => `$${r.totalPrice.toFixed(2)}` },
                ]}
                data={data.bookings}
                keyExtractor={(r) => r.id}
                onRowClick={(r) => router.push(`/bookings/${r.id}`)}
                emptyMessage="No bookings"
              />
            </DataTableShell>
          )}
        </Section>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}

/* ─── Pets section for owner view ───────────────────────────────────── */

type ClientPet = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  weight: number | null;
  photoUrl: string | null;
  feedingInstructions: string | null;
  medicationNotes: string | null;
};

function ClientPetsSection({ clientId }: { clientId: string }) {
  const [pets, setPets] = useState<ClientPet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/pets`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setPets(json.pets || []);
        }
      } catch { /* silent */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  return (
    <Section title="Pets">
      {loading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border bg-surface-tertiary" />
          ))}
        </div>
      ) : pets.length === 0 ? (
        <EmptyState title="No pets" description="This client has no pets on file." />
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {pets.map((p) => (
            <Link
              key={p.id}
              href={`/client/pets/${p.id}`}
              className="flex items-center gap-3 rounded-lg border border-border-default p-3 hover:bg-surface-secondary transition"
            >
              {p.photoUrl ? (
                <img src={p.photoUrl} alt={p.name} className="h-10 w-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-tertiary text-text-tertiary shrink-0">
                  <PawPrint className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{p.name}</p>
                <p className="text-xs text-text-secondary truncate">
                  {[p.species, p.breed, p.weight ? `${p.weight} lbs` : null].filter(Boolean).join(' \u00b7 ')}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ─── Access & Keys section ───────────────────────────────────── */

function ClientKeysSection({ clientId, clientName }: { clientId: string; clientName: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ keyStatus: 'none', keyHolder: '', keyLocation: '', lockboxCode: '', doorAlarmCode: '', keyNotes: '' });

  const { data, isLoading } = useQuery<{ keys: any[] }>({
    queryKey: ['keys', clientId],
    queryFn: async () => {
      const res = await fetch('/api/ops/keys');
      if (!res.ok) return { keys: [] };
      return res.json();
    },
  });

  const keyInfo = (data?.keys || []).find((k: any) => k.clientId === clientId);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ops/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, ...form }),
      });
      if (!res.ok) throw new Error('Save failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys', clientId] });
      setEditing(false);
    },
  });

  useEffect(() => {
    if (keyInfo) {
      setForm({
        keyStatus: keyInfo.keyStatus || 'none',
        keyHolder: keyInfo.keyHolder || '',
        keyLocation: keyInfo.keyLocation || '',
        lockboxCode: keyInfo.lockboxCode || '',
        doorAlarmCode: keyInfo.doorAlarmCode || '',
        keyNotes: keyInfo.keyNotes || '',
      });
    }
  }, [keyInfo]);

  if (isLoading) return <Section title="Access & Keys"><div className="h-16 animate-pulse rounded-lg bg-surface-tertiary" /></Section>;

  return (
    <Section title="Access & Keys">
      {!editing ? (
        <div>
          {keyInfo && keyInfo.keyStatus !== 'none' ? (
            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-text-secondary">Status</div>
                <Badge variant={keyInfo.keyStatus === 'with_client' ? 'success' : 'info'}>
                  {(keyInfo.keyStatus || 'none').replace(/_/g, ' ')}
                </Badge>
              </div>
              {keyInfo.keyHolder && <div className="rounded-lg border p-3"><div className="text-xs text-text-secondary">Holder</div><div>{keyInfo.keyHolder}</div></div>}
              {keyInfo.keyLocation && <div className="rounded-lg border p-3"><div className="text-xs text-text-secondary">Location</div><div>{keyInfo.keyLocation}</div></div>}
              {keyInfo.lockboxCode && <div className="rounded-lg border p-3"><div className="text-xs text-text-secondary">Lockbox Code</div><div className="font-mono">{keyInfo.lockboxCode}</div></div>}
              {keyInfo.keyNotes && <div className="rounded-lg border p-3 md:col-span-3"><div className="text-xs text-text-secondary">Notes</div><div className="text-sm">{keyInfo.keyNotes}</div></div>}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">No key information on file.</p>
          )}
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              {keyInfo?.keyStatus !== 'none' ? 'Edit Key Info' : 'Add Key Info'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Key Status</label>
            <Select value={form.keyStatus} onChange={(e) => setForm({ ...form, keyStatus: e.target.value })}
              options={[
                { value: 'none', label: 'None' }, { value: 'with_client', label: 'With Client' },
                { value: 'with_sitter', label: 'With Sitter' }, { value: 'with_owner', label: 'With Owner' },
                { value: 'lockbox', label: 'Lockbox' },
              ]} />
          </div>
          <div><label className="text-xs font-medium text-text-secondary block mb-1">Key Holder</label><Input value={form.keyHolder} onChange={(e) => setForm({ ...form, keyHolder: e.target.value })} placeholder="Name of person holding key" /></div>
          <div><label className="text-xs font-medium text-text-secondary block mb-1">Key Location</label><Input value={form.keyLocation} onChange={(e) => setForm({ ...form, keyLocation: e.target.value })} placeholder="Office lockbox, under mat, etc." /></div>
          <div><label className="text-xs font-medium text-text-secondary block mb-1">Lockbox Code</label><Input value={form.lockboxCode} onChange={(e) => setForm({ ...form, lockboxCode: e.target.value })} placeholder="1234" /></div>
          <div><label className="text-xs font-medium text-text-secondary block mb-1">Door Alarm Code</label><Input value={form.doorAlarmCode} onChange={(e) => setForm({ ...form, doorAlarmCode: e.target.value })} placeholder="5678" /></div>
          <div className="md:col-span-2"><label className="text-xs font-medium text-text-secondary block mb-1">Notes</label><Input value={form.keyNotes} onChange={(e) => setForm({ ...form, keyNotes: e.target.value })} placeholder="Special instructions" /></div>
          <div className="md:col-span-2 flex gap-2">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : 'Save'}</Button>
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ─── Household section ───────────────────────────────────── */

function ClientHouseholdSection({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data } = useQuery<{ households: any[] }>({
    queryKey: ['households'],
    queryFn: async () => {
      const res = await fetch('/api/ops/households');
      if (!res.ok) return { households: [] };
      return res.json();
    },
  });

  const household = (data?.households || []).find((h: any) =>
    h.memberClientIds?.includes(clientId) || h.primaryBillingClientId === clientId
  );

  return (
    <Section title="Household">
      {household ? (
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-primary">{household.name}</p>
              <p className="text-sm text-text-secondary">{(household.memberClientIds?.length || 0)} members</p>
              {household.primaryBillingClientId === clientId && (
                <Badge variant="info">Primary billing</Badge>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-tertiary">Not part of a household. Households can be managed from the Households page.</p>
      )}
    </Section>
  );
}
