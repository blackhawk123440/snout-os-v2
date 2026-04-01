'use client';

import { Suspense, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Calendar, FileText, BarChart3, CalendarCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-client';
import { useSitterDashboard } from '@/lib/api/sitter-dashboard-hooks';
import { statusDotClass, statusLabel } from '@/lib/status-colors';
import { formatServiceName } from '@/lib/format-utils';
import { Button } from '@/components/ui';
import {
  SitterCard,
  SitterCardBody,
  SitterPageHeader,
} from '@/components/sitter';

/* ─── Helpers ───────────────────────────────────────────────────────── */

const formatTime = (d: Date | string) =>
  new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });


/* ─── Main Content ──────────────────────────────────────────────────── */

function SitterDashboardContent() {
  const { user, isSitter, isOwner, isClient, loading: authLoading } = useAuth();
  const router = useRouter();
  const sitterId = (user as any)?.sitterId;
  const { data: dash, isLoading, refetch } = useSitterDashboard(sitterId);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 30s polling — pauses when tab is backgrounded, refreshes immediately on return
  useEffect(() => {
    const poll = () => { void refetch(); };
    pollRef.current = setInterval(poll, 30000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      } else {
        poll();
        pollRef.current = setInterval(poll, 30000);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refetch]);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-3xl pb-8">
        <DashboardSkeleton />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl pb-8">
        <SitterPageHeader title="Dashboard" subtitle="What's happening today" />
        <DashboardSkeleton />
      </div>
    );
  }

  if (!isSitter) {
    if (isOwner) router.push('/dashboard');
    else if (isClient) router.push('/client/home');
    else router.push('/login');
    return null;
  }

  if (!sitterId || !dash) {
    return (
      <div className="mx-auto max-w-3xl pb-8">
        <SitterPageHeader title="Dashboard" subtitle="Unable to load" />
        <SitterCard><SitterCardBody><p className="text-sm text-text-secondary">Please try logging in again.</p></SitterCardBody></SitterCard>
      </div>
    );
  }

  const todayVisits = dash.upcomingBookings || [];
  const completedVisits = dash.completedBookings || [];
  const pendingRequests = dash.pendingRequests || [];
  const allToday = [...todayVisits, ...completedVisits].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const inProgressCount = todayVisits.filter((b) => b.status === 'in_progress').length;
  const completedCount = completedVisits.length;
  const totalToday = allToday.length;
  const reportsNeeded = completedVisits.filter((b) => b.status === 'completed').length;
  const totalEarnings = completedVisits.reduce((s, b) => s + (b.totalPrice * 0.8), 0);

  // Next upcoming visit
  const now = Date.now();
  const nextVisit = todayVisits
    .filter((b) => ['confirmed', 'pending'].includes(b.status) && new Date(b.startAt).getTime() > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0];
  const minutesUntilNext = nextVisit ? Math.max(0, Math.floor((new Date(nextVisit.startAt).getTime() - now) / 60000)) : null;

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <SitterPageHeader
        title="Dashboard"
        subtitle="What's happening today"
        action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>Refresh</Button>}
      />

      <div className="space-y-4">
        <SitterFocusHero
          totalToday={totalToday}
          inProgressCount={inProgressCount}
          pendingRequests={pendingRequests.length}
          unreadMessages={dash.unreadMessageCount}
          nextVisit={nextVisit}
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-accent-tertiary p-4 sm:col-span-1">
            <p className="text-[11px] font-semibold text-accent-primary uppercase tracking-wider">Visits</p>
            <p className="mt-2 text-3xl font-bold text-accent-primary tabular-nums">{completedCount}<span className="text-base font-medium text-accent-primary/60">/{totalToday}</span></p>
            {inProgressCount > 0 && <p className="mt-1 text-xs font-medium text-accent-primary">{inProgressCount} in progress</p>}
          </div>
          <div className={`rounded-2xl p-4 ${pendingRequests.length > 0 ? 'bg-status-warning-bg' : 'bg-surface-primary shadow-sm'}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${pendingRequests.length > 0 ? 'text-status-warning-text' : 'text-text-tertiary'}`}>Pending</p>
            <p className={`mt-2 text-3xl font-bold tabular-nums ${pendingRequests.length > 0 ? 'text-status-warning-text' : 'text-text-primary'}`}>{pendingRequests.length}</p>
          </div>
          <div className="rounded-2xl bg-surface-primary shadow-sm p-4">
            <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Earned</p>
            <p className="mt-2 text-3xl font-bold text-text-primary tabular-nums">${Math.round(totalEarnings)}</p>
          </div>
          <div className="rounded-2xl bg-surface-primary shadow-sm p-4">
            <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Rating</p>
            <p className="mt-2 text-3xl font-bold text-text-primary tabular-nums">{dash.performance?.clientRating ? dash.performance.clientRating.toFixed(1) : '—'}</p>
            {dash.performance?.clientRating && <p className="mt-1 text-xs text-text-tertiary">out of 5.0</p>}
          </div>
        </div>

        {nextVisit ? (
          <div className="rounded-2xl bg-accent-tertiary p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-accent-primary uppercase tracking-wider">Next up</p>
                {minutesUntilNext != null && (
                  <p className="mt-1 text-sm font-bold text-accent-primary">
                    {minutesUntilNext < 60 ? `Starts in ${minutesUntilNext} min` : `Starts in ${Math.floor(minutesUntilNext / 60)}h ${minutesUntilNext % 60}m`}
                  </p>
                )}
                <p className="mt-3 text-lg font-bold text-text-primary">{formatServiceName(nextVisit.service)}</p>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {formatTime(nextVisit.startAt)} · {nextVisit.client ? `${nextVisit.client.firstName} ${nextVisit.client.lastName}` : `${nextVisit.firstName} ${nextVisit.lastName}`}
                </p>
                {nextVisit.pets?.length > 0 && (
                  <p className="mt-0.5 text-sm text-text-tertiary">{nextVisit.pets.map((p) => p.name || p.species).join(', ')}</p>
                )}
                {nextVisit.address && <p className="text-xs text-text-tertiary mt-1">{nextVisit.address}</p>}
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-primary text-text-inverse text-lg font-bold shadow-sm">
                {nextVisit.service?.[0] || 'V'}
              </div>
            </div>
            <Button variant="primary" size="md" className="w-full min-h-[44px] mt-4" onClick={() => router.push('/sitter/today')}>
              Start working
            </Button>
          </div>
        ) : totalToday === 0 ? (
          <div className="rounded-2xl bg-accent-tertiary p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary shadow-sm mb-4">
              <Calendar className="h-7 w-7 text-text-inverse" />
            </div>
            <p className="text-xl font-bold text-text-primary">No visits today</p>
            <p className="mt-2 text-sm text-text-secondary max-w-[280px] mx-auto leading-relaxed">You're all set. Check your calendar for upcoming bookings or update your availability.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/sitter/calendar">
                <Button variant="primary" size="md">View calendar</Button>
              </Link>
              <Link href="/sitter/availability">
                <Button variant="secondary" size="md">Set availability</Button>
              </Link>
            </div>
          </div>
        ) : null}

        {/* Action Required */}
        {(pendingRequests.length > 0 || dash.unreadMessageCount > 0 || reportsNeeded > 0) && (
          <div className="rounded-2xl bg-surface-primary shadow-sm p-5">
            <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">Action required</h3>
            <div className="space-y-2">
              {pendingRequests.length > 0 && (
                <Link href="/sitter/bookings" className="flex items-center justify-between min-h-[44px] rounded-xl bg-status-warning-bg px-4 py-2.5 hover:opacity-90 transition">
                  <span className="text-sm font-semibold text-status-warning-text">{pendingRequests.length} pending request{pendingRequests.length !== 1 ? 's' : ''}</span>
                  <ChevronRight className="h-4 w-4 text-status-warning-text" />
                </Link>
              )}
              {dash.unreadMessageCount > 0 && (
                <Link href="/sitter/inbox" className="flex items-center justify-between min-h-[44px] rounded-xl bg-surface-secondary px-4 py-2.5 hover:bg-surface-tertiary transition">
                  <span className="text-sm font-medium text-text-primary">{dash.unreadMessageCount} unread message{dash.unreadMessageCount !== 1 ? 's' : ''}</span>
                  <ChevronRight className="h-4 w-4 text-text-tertiary" />
                </Link>
              )}
              {reportsNeeded > 0 && (
                <Link href="/sitter/reports/new" className="flex items-center justify-between min-h-[44px] rounded-xl bg-surface-secondary px-4 py-2.5 hover:bg-surface-tertiary transition">
                  <span className="text-sm font-medium text-text-primary">{reportsNeeded} report{reportsNeeded !== 1 ? 's' : ''} due</span>
                  <ChevronRight className="h-4 w-4 text-text-tertiary" />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Schedule */}
        {allToday.length > 0 && (
          <div className="rounded-2xl bg-surface-primary shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Schedule</h3>
              <Link href="/sitter/today" className="text-xs font-semibold text-accent-primary hover:underline">Start working →</Link>
            </div>
            <div className="divide-y divide-border-muted">
              {allToday.slice(0, 3).map((b) => {
                const isCompleted = b.status === 'completed';
                const clientName = b.client ? `${b.client.firstName} ${b.client.lastName}` : `${b.firstName} ${b.lastName}`;
                return (
                  <div
                    key={b.id}
                    className={`flex items-center gap-3 px-5 py-3.5 min-h-[48px] cursor-pointer hover:bg-surface-secondary transition ${isCompleted ? 'opacity-40' : ''}`}
                    onClick={() => router.push(`/sitter/bookings/${b.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && router.push(`/sitter/bookings/${b.id}`)}
                  >
                    <div className="w-16 shrink-0 text-sm font-semibold tabular-nums text-text-primary">{formatTime(b.startAt)}</div>
                    <span className={`shrink-0 h-2.5 w-2.5 rounded-full ${statusDotClass(b.status)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary truncate">{formatServiceName(b.service)}</p>
                      <p className="text-xs text-text-secondary truncate">{clientName}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-text-tertiary">{statusLabel(b.status)}</span>
                  </div>
                );
              })}
              {allToday.length > 3 && (
                <Link href="/sitter/today" className="flex items-center justify-center px-5 py-3.5 min-h-[44px] text-sm font-semibold text-accent-primary hover:bg-surface-secondary transition">
                  +{allToday.length - 3} more — view full schedule
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Performance */}
        <div className="rounded-2xl bg-surface-primary shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Performance</h3>
            <Link href="/sitter/performance" className="text-xs font-semibold text-accent-primary hover:underline">Full metrics →</Link>
          </div>
          <div className="flex items-center gap-4">
            {dash.currentTier && (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-primary text-lg font-bold text-text-inverse shadow-sm">
                {dash.currentTier.name.charAt(0)}
              </div>
            )}
            <div className="flex-1">
              {dash.currentTier && <p className="text-sm font-bold text-text-primary mb-2">{dash.currentTier.name} tier</p>}
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-surface-secondary p-3">
              <div>
                <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Accept</p>
                <p className="mt-1 text-xl font-bold text-text-primary tabular-nums">{dash.performance?.acceptanceRate != null ? `${Math.round(dash.performance.acceptanceRate)}%` : '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Complete</p>
                <p className="mt-1 text-xl font-bold text-text-primary tabular-nums">{dash.performance?.completionRate != null ? `${Math.round(dash.performance.completionRate)}%` : '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">On-time</p>
                <p className="mt-1 text-xl font-bold text-text-primary tabular-nums">{dash.performance?.onTimeRate != null ? `${Math.round(dash.performance.onTimeRate)}%` : '—'}</p>
              </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Access */}
        <div>
          <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">Quick access</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/sitter/calendar" className="flex flex-col gap-1.5 rounded-2xl bg-surface-primary shadow-sm p-4 min-h-[88px] hover:shadow-md transition">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-secondary">
                <Calendar className="h-4.5 w-4.5 text-accent-primary" />
              </div>
              <span className="text-sm font-semibold text-text-primary">Calendar</span>
              <span className="text-[11px] text-text-tertiary leading-tight">Upcoming schedule</span>
            </Link>
            <Link href="/sitter/reports" className="flex flex-col gap-1.5 rounded-2xl bg-surface-primary shadow-sm p-4 min-h-[88px] hover:shadow-md transition">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-secondary">
                <FileText className="h-4.5 w-4.5 text-accent-primary" />
              </div>
              <span className="text-sm font-semibold text-text-primary">Reports</span>
              <span className="text-[11px] text-text-tertiary leading-tight">Visit updates</span>
            </Link>
            <Link href="/sitter/performance" className="flex flex-col gap-1.5 rounded-2xl bg-surface-primary shadow-sm p-4 min-h-[88px] hover:shadow-md transition">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-secondary">
                <BarChart3 className="h-4.5 w-4.5 text-accent-primary" />
              </div>
              <span className="text-sm font-semibold text-text-primary">Performance</span>
              <span className="text-[11px] text-text-tertiary leading-tight">Tier and metrics</span>
            </Link>
            <Link href="/sitter/availability" className="flex flex-col gap-1.5 rounded-2xl bg-surface-primary shadow-sm p-4 min-h-[88px] hover:shadow-md transition">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-secondary">
                <CalendarCheck className="h-4.5 w-4.5 text-accent-primary" />
              </div>
              <span className="text-sm font-semibold text-text-primary">Availability</span>
              <span className="text-[11px] text-text-tertiary leading-tight">Hours and block-offs</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SitterFocusHero({
  totalToday,
  inProgressCount,
  pendingRequests,
  unreadMessages,
  nextVisit,
}: {
  totalToday: number;
  inProgressCount: number;
  pendingRequests: number;
  unreadMessages: number;
  nextVisit: any;
}) {
  const topMessage = totalToday === 0
    ? 'No visits are scheduled today, so this is a good window to confirm availability, review upcoming work, or reset after a busy run.'
    : pendingRequests > 0
      ? 'Start by reviewing pending requests so your schedule stays clear and the office can respond faster.'
      : inProgressCount > 0
        ? 'You have active work underway. Stay focused on timing, updates, and clean report handoff.'
        : nextVisit
          ? 'Your day is set. Use this dashboard to stay ahead of your next stop and anything that needs follow-up.'
          : 'Your scheduled work is in good shape. Keep an eye on messages and reports so the day closes cleanly.';

  return (
    <div className="rounded-3xl border border-border-default bg-surface-primary p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full bg-accent-tertiary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-primary">
          Sitter hub
        </span>
        {pendingRequests > 0 && (
          <span className="inline-flex rounded-full bg-status-warning-bg px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-status-warning-text">
            {pendingRequests} pending
          </span>
        )}
        {unreadMessages > 0 && (
          <span className="inline-flex rounded-full bg-surface-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            {unreadMessages} unread
          </span>
        )}
      </div>
      <h2 className="text-2xl font-bold text-text-primary">
        {totalToday > 0 ? 'Stay clear on what matters today' : 'You have breathing room today'}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-text-secondary">
        {topMessage}
      </p>
    </div>
  );
}

/* ─── Skeleton ──────────────────────────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 min-w-[110px] rounded-xl border border-border-default bg-surface-primary p-3">
            <div className="h-3 w-14 rounded bg-surface-tertiary" />
            <div className="mt-2 h-8 w-10 rounded bg-surface-tertiary" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border-default bg-surface-primary p-4">
        <div className="h-4 w-24 rounded bg-surface-tertiary mb-3" />
        <div className="h-16 rounded bg-surface-tertiary" />
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border-default bg-surface-primary p-4">
          <div className="h-4 w-32 rounded bg-surface-tertiary mb-3" />
          {[1, 2, 3].map((j) => (
            <div key={j} className="flex items-center gap-3 py-2">
              <div className="h-4 w-14 rounded bg-surface-tertiary" />
              <div className="h-2.5 w-2.5 rounded-full bg-surface-tertiary" />
              <div className="flex-1 h-4 rounded bg-surface-tertiary" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Page Export ────────────────────────────────────────────────────── */

export default function SitterDashboardPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-3xl pb-8">
        <SitterPageHeader title="Dashboard" subtitle="Loading\u2026" />
        <DashboardSkeleton />
      </div>
    }>
      <SitterDashboardContent />
    </Suspense>
  );
}
