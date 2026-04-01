'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppCard, AppCardBody, AppCardHeader, AppErrorState } from '@/components/app';
import { Panel, Button, Badge, Skeleton, EmptyState, Flex } from '@/components/ui';
import { formatServiceName } from '@/lib/format-utils';

interface WaitlistEntry {
  id: string;
  clientName: string;
  service: string;
  preferredDate: string;
  preferredTimeStart: string;
  preferredTimeEnd: string;
  notes: string;
  status: 'waiting' | 'notified' | 'booked' | 'expired';
  position: number;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { variant: 'info' | 'success' | 'warning' | 'error'; label: string }> = {
  waiting: { variant: 'info', label: 'Waiting' },
  notified: { variant: 'warning', label: 'Notified' },
  booked: { variant: 'success', label: 'Booked' },
  expired: { variant: 'error', label: 'Expired' },
};

export function WaitlistTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading, error, refetch } = useQuery<{ entries: WaitlistEntry[] }>({
    queryKey: ['waitlist'],
    queryFn: async () => {
      const res = await fetch('/api/waitlist');
      if (!res.ok) throw new Error('Failed to load waitlist');
      return res.json();
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/waitlist/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['waitlist'] }),
  });

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/waitlist/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['waitlist'] }),
  });

  const entries = (data?.entries || []).filter(
    (e) => statusFilter === 'all' || e.status === statusFilter
  );
  const waitlistSummary = useMemo(() => {
    const allEntries = data?.entries || [];
    return {
      total: allEntries.length,
      waiting: allEntries.filter((entry) => entry.status === 'waiting').length,
      notified: allEntries.filter((entry) => entry.status === 'notified').length,
      booked: allEntries.filter((entry) => entry.status === 'booked').length,
    };
  }, [data?.entries]);

  return (
    <div className="space-y-3">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
        <AppCard className="bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.12),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]">
          <AppCardHeader title="Your waitlist should feel like pipeline, not overflow" />
          <AppCardBody className="space-y-4">
            <p className="max-w-3xl text-sm leading-6 text-text-secondary">
              A polished waitlist keeps demand visible and easy to act on. When availability opens up, the team should know exactly who to contact and which requests are most likely to convert into bookings.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border-default bg-surface-primary/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">All entries</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{waitlistSummary.total}</p>
              </div>
              <div className="rounded-2xl border border-border-default bg-surface-primary/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Waiting</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{waitlistSummary.waiting}</p>
              </div>
              <div className="rounded-2xl border border-border-default bg-surface-primary/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Notified</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{waitlistSummary.notified}</p>
              </div>
              <div className="rounded-2xl border border-border-default bg-surface-primary/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Booked</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{waitlistSummary.booked}</p>
              </div>
            </div>
          </AppCardBody>
        </AppCard>

        <AppCard>
          <AppCardHeader title="Best next moves" />
          <AppCardBody className="space-y-2 text-sm text-text-secondary">
            <p>Prioritize clients who are still waiting and keep follow-up tight when openings appear.</p>
            <p>Move notified requests forward quickly so the waitlist becomes booked revenue instead of stale demand.</p>
            <p>Use the status filters below to focus only on the households that need action right now.</p>
          </AppCardBody>
        </AppCard>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'waiting', 'notified', 'booked', 'expired'].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'primary' : 'secondary'}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton height="300px" />
      ) : error ? (
        <AppErrorState title="Couldn't load waitlist" subtitle="Check your connection and try again." onRetry={() => void refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState
          title={statusFilter === 'all' ? 'No waitlist entries yet' : `No ${statusFilter} waitlist entries`}
          description={statusFilter === 'all'
            ? 'When demand outpaces availability, households will appear here so the team can follow up quickly when openings return.'
            : `No ${statusFilter} entries are currently in view.`}
        />
      ) : (
        <Panel>
          <div className="flex flex-col">
            {entries.map((entry) => {
              const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.waiting;
              return (
                <div key={entry.id} className="p-4 border-b border-border-default flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <Flex align="center" gap={2}>
                      <span className="font-semibold text-text-primary">{entry.clientName}</span>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      <span className="text-xs text-text-tertiary">#{entry.position}</span>
                    </Flex>
                    <div className="text-sm text-text-secondary mt-1">
                      {formatServiceName(entry.service)} &middot; {entry.preferredDate ? new Date(entry.preferredDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Flexible date'}
                      {entry.preferredTimeStart && ` \u00b7 ${entry.preferredTimeStart}\u2013${entry.preferredTimeEnd}`}
                    </div>
                    {entry.notes && <div className="text-sm text-text-tertiary mt-1 italic">{entry.notes}</div>}
                    <div className="text-xs text-text-tertiary mt-1">
                      Added {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <Flex gap={1}>
                    {entry.status === 'waiting' && (
                      <Button size="sm" variant="primary" onClick={() => updateStatus.mutate({ id: entry.id, status: 'notified' })} disabled={updateStatus.isPending}>Notify</Button>
                    )}
                    {entry.status === 'notified' && (
                      <Button size="sm" variant="primary" onClick={() => updateStatus.mutate({ id: entry.id, status: 'booked' })} disabled={updateStatus.isPending}>Mark Booked</Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => removeEntry.mutate(entry.id)} disabled={removeEntry.isPending}>Remove</Button>
                  </Flex>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
