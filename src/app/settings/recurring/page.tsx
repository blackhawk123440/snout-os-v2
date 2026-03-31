'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OwnerAppShell, LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { AppErrorState } from '@/components/app';
import { Button, EmptyState } from '@/components/ui';
import { PageSkeleton } from '@/components/ui/loading-state';
import { toastSuccess, toastError } from '@/lib/toast';
import { useAuth } from '@/lib/auth-client';
import { formatServiceName } from '@/lib/format-utils';

interface Schedule {
  id: string;
  clientId: string;
  clientName: string;
  sitterId: string | null;
  sitterName: string | null;
  service: string;
  frequency: string;
  daysOfWeek: string | null;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  lastGeneratedAt: string | null;
  invoicingMode: string;
  petIds: string | null;
  address: string | null;
  notes: string | null;
}

interface ClientOption { id: string; firstName: string; lastName: string; }
interface SitterOption { id: string; firstName: string; lastName: string; }
interface PetOption { id: string; name: string; species: string; }

const SERVICES = ['Dog Walking', 'Housesitting', 'Drop-ins', 'Pet Taxi', 'Meet & Greet'];
const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const inputClass = 'w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none';
const fmtDate = (d: string) => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
const fmtFreq = (f: string) => FREQUENCIES.find((x) => x.value === f)?.label || f;
const fmtDays = (json: string | null) => {
  if (!json) return 'Every day';
  try {
    const arr: number[] = JSON.parse(json);
    return arr.map((d) => DAYS[d]).join(', ');
  } catch { return json; }
};

export default function RecurringSchedulesPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [sitters, setSitters] = useState<SitterOption[]>([]);

  const { data: schedulesData, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['owner', 'recurring-schedules'],
    queryFn: async () => {
      const res = await fetch('/api/ops/recurring-schedules');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      return json.schedules || [];
    },
    enabled: !authLoading && !!user,
  });
  const schedules: Schedule[] = schedulesData || [];
  const error = queryError ? (queryError as Error).message || 'Failed to load' : null;

  // Load clients + sitters for the form
  useEffect(() => {
    if (!showForm) return;
    Promise.all([
      fetch('/api/clients?page=1&pageSize=200').then((r) => r.ok ? r.json() : null),
      fetch('/api/sitters?page=1&pageSize=200').then((r) => r.ok ? r.json() : null),
    ]).then(([cJson, sJson]) => {
      if (cJson?.items) setClients(cJson.items.map((c: any) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName })));
      if (sJson?.items) setSitters(sJson.items.filter((s: any) => s.active !== false).map((s: any) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName })));
    }).catch(() => {});
  }, [showForm]);

  const cancelMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/ops/recurring-schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed');
      return status;
    },
    onSuccess: (status) => {
      toastSuccess(`Schedule ${status}`);
      queryClient.invalidateQueries({ queryKey: ['owner', 'recurring-schedules'] });
    },
    onError: () => {
      toastError('Failed');
    },
  });

  const handleAction = async (id: string, action: 'generate' | 'pause' | 'resume' | 'cancel' | 'invoice') => {
    try {
      if (action === 'generate') {
        const res = await fetch(`/api/ops/recurring-schedules/${id}/generate`, { method: 'POST' });
        const json = await res.json().catch(() => ({}));
        if (res.ok) toastSuccess(`Created ${json.created} booking${json.created !== 1 ? 's' : ''}, ${json.skipped} skipped`);
        else toastError(json.error || 'Failed');
        queryClient.invalidateQueries({ queryKey: ['owner', 'recurring-schedules'] });
      } else if (action === 'invoice') {
        const res = await fetch(`/api/ops/recurring-schedules/${id}/generate-invoice`, { method: 'POST' });
        const json = await res.json().catch(() => ({}));
        if (res.ok) toastSuccess(`Invoice for $${json.total?.toFixed(2) || 0} (${json.count} visits)`);
        else toastError(json.error || 'Failed');
        queryClient.invalidateQueries({ queryKey: ['owner', 'recurring-schedules'] });
      } else {
        const status = action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'cancelled';
        cancelMutation.mutate({ id, status });
      }
    } catch { toastError('Action failed'); }
  };

  const generateAll = async () => {
    try {
      const res = await fetch('/api/ops/recurring-schedules/generate-all', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) toastSuccess(`Generated ${json.totalCreated} bookings across ${json.schedulesProcessed} schedules`);
      else toastError(json.error || 'Failed');
    } catch { toastError('Failed'); }
  };

  if (authLoading) return <OwnerAppShell><LayoutWrapper variant="wide"><PageHeader title="Recurring" subtitle="Loading..." /><PageSkeleton /></LayoutWrapper></OwnerAppShell>;
  if (!user) return null;

  return (
    <OwnerAppShell>
      <LayoutWrapper variant="wide">
        <PageHeader
          title="Recurring Schedules"
          subtitle="Automated booking generation"
          actions={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => void generateAll()}>Generate all</Button>
              <Button size="sm" onClick={() => setShowForm(true)}>New schedule</Button>
            </div>
          }
        />
        <Section>
          {loading ? <PageSkeleton /> : error ? (
            <AppErrorState title="Couldn't load" subtitle={error} onRetry={() => void refetch()} />
          ) : (
            <>
              {showForm && (
                <NewScheduleForm
                  clients={clients}
                  sitters={sitters}
                  onCreated={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['owner', 'recurring-schedules'] }); }}
                  onCancel={() => setShowForm(false)}
                />
              )}

              {schedules.length === 0 && !showForm ? (
                <EmptyState
                  title="No recurring schedules"
                  description="Create a recurring schedule to auto-generate bookings for regular clients."
                  primaryAction={{ label: 'New schedule', onClick: () => setShowForm(true) }}
                />
              ) : (
                <div className="space-y-3 mt-4">
                  {schedules.map((s) => (
                    <div key={s.id} className="rounded-xl border border-border-default bg-surface-primary p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text-primary">
                            {s.clientName} \u00b7 {formatServiceName(s.service)}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {fmtFreq(s.frequency)} \u00b7 {fmtDays(s.daysOfWeek)} \u00b7 {s.startTime}\u2013{s.endTime}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            ${s.totalPrice}/visit \u00b7 {s.invoicingMode.replace('_', ' ')}
                            {s.sitterName && ` \u00b7 ${s.sitterName}`}
                            {s.lastGeneratedAt && ` \u00b7 Last generated ${fmtDate(s.lastGeneratedAt)}`}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.status === 'active' ? 'bg-status-success-bg text-status-success-text' :
                          s.status === 'paused' ? 'bg-status-warning-bg text-status-warning-text' :
                          'bg-surface-tertiary text-text-secondary'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => handleAction(s.id, 'generate')} className="min-h-[36px] rounded-lg border border-border-default px-2.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary">Generate</button>
                        {s.status === 'active' && <button type="button" onClick={() => handleAction(s.id, 'pause')} className="min-h-[36px] rounded-lg border border-border-default px-2.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary">Pause</button>}
                        {s.status === 'paused' && <button type="button" onClick={() => handleAction(s.id, 'resume')} className="min-h-[36px] rounded-lg border border-border-default px-2.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary">Resume</button>}
                        {s.status !== 'cancelled' && <button type="button" onClick={() => handleAction(s.id, 'cancel')} className="min-h-[36px] rounded-lg border border-status-danger-border px-2.5 text-xs font-medium text-status-danger-text-secondary hover:bg-status-danger-bg">Cancel</button>}
                        {s.invoicingMode !== 'per_visit' && <button type="button" onClick={() => handleAction(s.id, 'invoice')} className="min-h-[36px] rounded-lg border border-border-default px-2.5 text-xs font-medium text-accent-primary hover:bg-surface-secondary">Send invoice</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Section>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}

/* ─── New Schedule Form ─────────────────────────────────────────────── */

function NewScheduleForm({
  clients, sitters, onCreated, onCancel,
}: {
  clients: ClientOption[];
  sitters: SitterOption[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [clientPets, setClientPets] = useState<PetOption[]>([]);
  const [form, setForm] = useState({
    clientId: '',
    sitterId: '',
    service: 'Dog Walking',
    frequency: 'weekly',
    daysOfWeek: [1, 2, 3, 4, 5] as number[],
    startTime: '09:00',
    endTime: '09:30',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveUntil: '',
    totalPrice: '35',
    address: '',
    notes: '',
    petIds: [] as string[],
    invoicingMode: 'per_visit',
  });

  // Fetch client pets when client changes (G32)
  useEffect(() => {
    if (!form.clientId) { setClientPets([]); return; }
    fetch(`/api/clients/${form.clientId}/pets`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.pets) setClientPets(d.pets.map((p: any) => ({ id: p.id, name: p.name, species: p.species })));
      })
      .catch(() => {});
  }, [form.clientId]);

  const toggleDay = (day: number) => {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day) ? f.daysOfWeek.filter((d) => d !== day) : [...f.daysOfWeek, day].sort(),
    }));
  };

  const togglePet = (petId: string) => {
    setForm((f) => ({
      ...f,
      petIds: f.petIds.includes(petId) ? f.petIds.filter((id) => id !== petId) : [...f.petIds, petId],
    }));
  };

  const handleSubmit = async () => {
    if (!form.clientId || !form.service) { toastError('Client and service are required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/ops/recurring-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: form.clientId,
          sitterId: form.sitterId || undefined,
          service: form.service,
          frequency: form.frequency,
          daysOfWeek: form.frequency !== 'monthly' ? form.daysOfWeek : undefined,
          startTime: form.startTime,
          endTime: form.endTime,
          effectiveFrom: form.effectiveFrom,
          effectiveUntil: form.effectiveUntil || undefined,
          totalPrice: parseFloat(form.totalPrice) || 0,
          address: form.address || undefined,
          notes: form.notes || undefined,
          petIds: form.petIds.length > 0 ? form.petIds : undefined,
          invoicingMode: form.invoicingMode,
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); toastError(j.error || 'Failed'); return; }
      toastSuccess('Recurring schedule created');
      onCreated();
    } catch { toastError('Failed to create'); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-border-default bg-surface-primary p-4 mb-4 space-y-4">
      <p className="text-sm font-semibold text-text-primary">New Recurring Schedule</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-text-tertiary mb-1">Client *</label>
          <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value, petIds: [] }))} className={inputClass}>
            <option value="">Select client...</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-tertiary mb-1">Preferred sitter</label>
          <select value={form.sitterId} onChange={(e) => setForm((f) => ({ ...f, sitterId: e.target.value }))} className={inputClass}>
            <option value="">Auto-assign</option>
            {sitters.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-text-tertiary mb-1">Service *</label>
          <select value={form.service} onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))} className={inputClass}>
            {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-tertiary mb-1">Frequency *</label>
          <select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))} className={inputClass}>
            {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {form.frequency !== 'monthly' && (
        <div>
          <label className="block text-xs text-text-tertiary mb-1">Days of week</label>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((day, i) => (
              <button key={day} type="button" onClick={() => toggleDay(i)} className={`min-h-[36px] rounded-full px-3 text-xs font-medium transition ${form.daysOfWeek.includes(i) ? 'bg-accent-primary text-text-inverse' : 'border border-border-default bg-surface-primary text-text-secondary hover:bg-surface-secondary'}`}>
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="block text-xs text-text-tertiary mb-1">Start time</label><input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className={inputClass} /></div>
        <div><label className="block text-xs text-text-tertiary mb-1">End time</label><input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className={inputClass} /></div>
        <div><label className="block text-xs text-text-tertiary mb-1">Price per visit ($)</label><input type="number" min="0" step="0.01" value={form.totalPrice} onChange={(e) => setForm((f) => ({ ...f, totalPrice: e.target.value }))} className={inputClass} /></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="block text-xs text-text-tertiary mb-1">Start date *</label><input type="date" value={form.effectiveFrom} onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))} className={inputClass} /></div>
        <div><label className="block text-xs text-text-tertiary mb-1">End date (optional)</label><input type="date" value={form.effectiveUntil} onChange={(e) => setForm((f) => ({ ...f, effectiveUntil: e.target.value }))} className={inputClass} /></div>
      </div>

      {/* Client pets (G32) */}
      {clientPets.length > 0 && (
        <div>
          <label className="block text-xs text-text-tertiary mb-1">Pets</label>
          <div className="flex flex-wrap gap-1.5">
            {clientPets.map((p) => (
              <button key={p.id} type="button" onClick={() => togglePet(p.id)} className={`min-h-[36px] rounded-full px-3 text-xs font-medium transition ${form.petIds.includes(p.id) ? 'bg-accent-primary text-text-inverse' : 'border border-border-default bg-surface-primary text-text-secondary hover:bg-surface-secondary'}`}>
                {p.name} ({p.species})
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs text-text-tertiary mb-1">Invoicing</label>
        <select value={form.invoicingMode} onChange={(e) => setForm((f) => ({ ...f, invoicingMode: e.target.value }))} className={inputClass}>
          <option value="per_visit">Per visit</option>
          <option value="weekly">Weekly batch</option>
          <option value="monthly">Monthly batch</option>
        </select>
      </div>

      <div><label className="block text-xs text-text-tertiary mb-1">Address</label><input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Client's address" className={inputClass} /></div>
      <div><label className="block text-xs text-text-tertiary mb-1">Notes</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputClass} resize-y`} /></div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="min-h-[44px] px-4 text-sm font-medium text-text-secondary">Cancel</button>
        <button type="button" onClick={handleSubmit} disabled={saving} className="min-h-[44px] rounded-lg bg-accent-primary px-4 text-sm font-semibold text-text-inverse hover:opacity-90 disabled:opacity-50">{saving ? 'Creating\u2026' : 'Create schedule'}</button>
      </div>
    </div>
  );
}
