'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, AlertTriangle, UserPlus } from 'lucide-react';
import { Button, Skeleton, EmptyState, Badge } from '@/components/ui';
import { LayoutWrapper } from '@/components/layout';
import { CoveragePlanner } from '@/components/calendar/CoveragePlanner';
import { toastSuccess, toastError } from '@/lib/toast';

/* ---------- Types ---------- */

interface DailyBooking {
  bookingId: string;
  service: string;
  clientName: string;
  address: string | null;
  startAt: string;
  endAt: string;
  status: string;
  paymentStatus: string;
  hasReport: boolean;
  pets: Array<{ name: string; species: string }>;
}

interface SitterSchedule {
  sitter: { id: string; firstName: string; lastName: string; isAvailable: boolean };
  visits: DailyBooking[];
}

interface DailyBoardResponse {
  sitterSchedules: SitterSchedule[];
  unassigned: DailyBooking[];
  stats: {
    totalVisits: number;
    completedVisits: number;
    inProgressVisits: number;
    upcomingVisits: number;
    unassignedVisits: number;
    activeSittersCount: number;
    todayRevenue: number;
    onTimeRate: number;
  };
}

/* ---------- Helpers ---------- */

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-status-warning-bg text-status-warning-text border-status-warning-border',
  confirmed: 'bg-status-info-bg text-status-info-text border-status-info-border',
  in_progress: 'bg-status-success-bg text-status-success-text border-status-success-border',
  completed: 'bg-surface-secondary text-text-secondary border-border-default',
};

const SERVICE_COLORS: Record<string, string> = {
  'Dog Walking': 'border-l-accent-primary',
  'Drop-ins': 'border-l-status-success-fill',
  'Housesitting': 'border-l-status-info-fill',
  '24/7 Care': 'border-l-status-warning-fill',
  'Pet Taxi': 'border-l-status-danger-fill',
};

/* ---------- Dispatch Calendar ---------- */

type View = 'day' | 'week';

export default function DispatchCalendarPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const [view, setView] = useState<View>('day');
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // Week view: compute Monday of current week
  const weekStart = useMemo(() => {
    const d = new Date(date + 'T12:00:00');
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(mon.getDate() - ((day + 6) % 7));
    return mon.toISOString().split('T')[0];
  }, [date]);

  const { data, isLoading, error, refetch } = useQuery<DailyBoardResponse>({
    queryKey: ['daily-board', date],
    queryFn: async () => {
      const res = await fetch(`/api/ops/daily-board?date=${date}`);
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
    refetchInterval: 30_000,
    enabled: view === 'day',
  });

  const handleQuickAssign = useCallback(async (bookingId: string, sitterId: string) => {
    setAssigningId(bookingId);
    try {
      const res = await fetch('/api/ops/daily-board/quick-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, sitterId }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.tierBlocked) {
          toastError(`Tier restriction: ${result.reasons?.[0] || 'Not eligible'}`);
        } else if (result.conflictBlocked) {
          toastError(`Conflict: ${result.conflicts?.[0]?.detail || 'Schedule conflict'}`);
        } else {
          toastError(result.error || 'Assignment failed');
        }
        return;
      }
      toastSuccess('Assigned');
      queryClient.invalidateQueries({ queryKey: ['daily-board'] });
    } catch {
      toastError('Assignment failed');
    } finally {
      setAssigningId(null);
    }
  }, [queryClient]);

  const isToday = date === todayStr();
  const sitterSchedules = data?.sitterSchedules ?? [];
  const unassigned = data?.unassigned ?? [];
  const stats = data?.stats;

  // Sort sitters: busiest first, then alphabetical
  const sortedSitters = useMemo(() =>
    [...sitterSchedules].sort((a, b) => {
      if (b.visits.length !== a.visits.length) return b.visits.length - a.visits.length;
      return a.sitter.firstName.localeCompare(b.sitter.firstName);
    }),
  [sitterSchedules]);

  return (
    <LayoutWrapper>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text-primary font-heading leading-tight">
            Dispatch Calendar
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {view === 'day' ? formatDate(date) : `Week of ${formatDate(weekStart)}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl border border-border-default overflow-hidden">
            <button
              onClick={() => setView('day')}
              className={`min-h-[44px] px-3 py-1.5 text-xs font-medium transition-colors ${
                view === 'day' ? 'bg-accent-primary text-text-inverse' : 'bg-surface-primary text-text-secondary hover:bg-surface-secondary'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 inline mr-1" />Day
            </button>
            <button
              onClick={() => setView('week')}
              className={`min-h-[44px] px-3 py-1.5 text-xs font-medium transition-colors ${
                view === 'week' ? 'bg-accent-primary text-text-inverse' : 'bg-surface-primary text-text-secondary hover:bg-surface-secondary'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 inline mr-1" />Week
            </button>
          </div>

          {/* Date nav */}
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, -1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {!isToday && (
              <Button variant="secondary" size="sm" onClick={() => setDate(todayStr())}>Today</Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Week View */}
      {view === 'week' && (
        <CoveragePlanner
          weekStart={weekStart}
          onWeekChange={(ws) => setDate(ws)}
        />
      )}

      {/* Day View */}
      {view === 'day' && (
        <>
          {/* KPI Strip */}
          {stats && (
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Total', value: stats.totalVisits, color: 'text-text-primary' },
                { label: 'Unassigned', value: stats.unassignedVisits, color: stats.unassignedVisits > 0 ? 'text-status-danger-text' : 'text-text-primary' },
                { label: 'In Progress', value: stats.inProgressVisits, color: 'text-status-success-text' },
                { label: 'Sitters Active', value: stats.activeSittersCount, color: 'text-text-primary' },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl border border-border-default bg-surface-primary px-3 py-2.5 text-center">
                  <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-[10px] text-text-tertiary uppercase tracking-wide">{kpi.label}</p>
                </div>
              ))}
            </div>
          )}

          {isLoading && <Skeleton height="400px" />}

          {error && (
            <div className="rounded-2xl border border-status-danger-border bg-status-danger-bg p-4 text-center">
              <p className="text-sm text-status-danger-text">Failed to load. <button onClick={() => refetch()} className="underline">Retry</button></p>
            </div>
          )}

          {!isLoading && !error && (
            <div className="space-y-4">
              {/* Unassigned Lane */}
              {unassigned.length > 0 && (
                <div className="rounded-2xl border-2 border-status-danger-border bg-status-danger-bg/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-status-danger-text" />
                    <h2 className="text-sm font-semibold text-status-danger-text">
                      Unassigned ({unassigned.length})
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {unassigned.map((b) => (
                      <div key={b.bookingId} className="flex items-center justify-between gap-3 rounded-xl bg-surface-primary border border-border-default p-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary truncate">{b.clientName}</p>
                          <p className="text-xs text-text-secondary">
                            {b.service} {'\u00b7'} {formatTime(b.startAt)}–{formatTime(b.endAt)}
                          </p>
                        </div>
                        <Button
                          variant="primary"
                                                    leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                          onClick={() => router.push(`/bookings/${b.bookingId}`)}
                        >
                          Assign
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sitter Lanes */}
              {sortedSitters.length === 0 && unassigned.length === 0 && (
                <EmptyState title="No bookings" description={`Nothing scheduled for ${formatDate(date)}.`} />
              )}

              {sortedSitters.map(({ sitter, visits }) => {
                const totalHours = visits.reduce((sum, v) => {
                  const dur = (new Date(v.endAt).getTime() - new Date(v.startAt).getTime()) / (1000 * 60 * 60);
                  return sum + dur;
                }, 0);
                const overloaded = totalHours > 8;

                return (
                  <div key={sitter.id} className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden">
                    {/* Sitter header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border-default bg-surface-secondary">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-tertiary text-xs font-bold text-accent-primary">
                          {sitter.firstName[0]}{sitter.lastName?.[0] || ''}
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-text-primary">
                            {sitter.firstName} {sitter.lastName}
                          </span>
                          {!sitter.isAvailable && (
                            <Badge variant="warning" className="ml-2">Unavailable</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-tertiary">
                          {visits.length} visit{visits.length !== 1 ? 's' : ''} {'\u00b7'} {totalHours.toFixed(1)}h
                        </span>
                        {overloaded && (
                          <Badge variant="error">Heavy</Badge>
                        )}
                      </div>
                    </div>

                    {/* Visits */}
                    {visits.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-text-tertiary italic">No visits scheduled</p>
                    ) : (
                      <div className="divide-y divide-border-default">
                        {visits
                          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
                          .map((v) => (
                            <button
                              key={v.bookingId}
                              type="button"
                              className={`w-full text-left px-4 py-2.5 hover:bg-surface-secondary transition-colors border-l-4 ${
                                SERVICE_COLORS[v.service] || 'border-l-border-default'
                              }`}
                              onClick={() => router.push(`/bookings/${v.bookingId}`)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-text-primary truncate">{v.clientName}</span>
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                      STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {v.status.replace('_', ' ')}
                                    </span>
                                  </div>
                                  <p className="text-xs text-text-secondary mt-0.5">
                                    {v.service} {'\u00b7'} {formatTime(v.startAt)}–{formatTime(v.endAt)}
                                    {v.pets?.length > 0 && ` \u00b7 ${v.pets.map((p) => p.name).join(', ')}`}
                                  </p>
                                </div>
                                {v.paymentStatus === 'unpaid' && (
                                  <Badge variant="warning">Unpaid</Badge>
                                )}
                                {v.hasReport && (
                                  <Badge variant="success">Report</Badge>
                                )}
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </LayoutWrapper>
  );
}
