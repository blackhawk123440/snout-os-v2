'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, RefreshCw, MessageCircle,
  ChevronDown, ChevronUp, Check, Circle, AlertTriangle,
  TrendingUp, CalendarCheck, DollarSign, Clock, Plus,
  CalendarPlus, CheckCircle2, PhoneOff,
} from 'lucide-react';
import { OwnerAppShell, LayoutWrapper, PageHeader } from '@/components/layout';
import { AppErrorState } from '@/components/app';
import { KpiGrid } from '@/components/app/KpiGrid';
import { Button } from '@/components/ui';
import { useQuickAssign } from '@/lib/api/owner-hooks';
import { toastSuccess, toastError } from '@/lib/toast';
import { formatServiceName, formatDateTime } from '@/lib/format-utils';
import { statusDotClass, statusLabel } from '@/lib/status-colors';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface BoardStats {
  totalVisits: number;
  completedVisits: number;
  inProgressVisits: number;
  upcomingVisits: number;
  unassignedCount: number;
  activeSittersCount: number;
  todayRevenue: number;
  onTimeRate: number;
}

interface Visit {
  bookingId: string;
  service: string;
  clientName: string;
  address: string | null;
  startAt: string;
  endAt: string;
  status: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  pets: Array<{ name: string; species: string }>;
  paymentStatus: string;
  hasReport: boolean;
  threadId: string | null;
}

interface SitterSchedule {
  sitter: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    isAvailable: boolean;
  };
  visits: Visit[];
}

interface UnassignedVisit {
  bookingId: string;
  service: string;
  clientName: string;
  address: string | null;
  startAt: string;
  endAt: string;
  pets: Array<{ name: string; species: string }>;
}

interface AttentionItem {
  id: string;
  type: string;
  entityId?: string;
  actionEntityId?: string | null;
  actionMeta?: Record<string, unknown> | null;
  title: string;
  subtitle: string;
  severity: 'high' | 'medium' | 'low';
  dueAt?: string | null;
  createdAt?: string;
  primaryActionLabel: 'Fix' | 'Assign' | 'Retry' | 'Open' | string;
  primaryActionHref: string;
}

interface BoardData {
  date: string;
  stats: BoardStats;
  sitterSchedules: SitterSchedule[];
  unassigned: UnassignedVisit[];
  attention: {
    alerts: AttentionItem[];
    staffing: AttentionItem[];
  };
}

interface SitterOption {
  id: string;
  firstName: string;
  lastName: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const formatDateLabel = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};

const isToday = (dateStr: string) => {
  const today = new Date();
  return dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

// Status helpers — use shared utilities from status-colors.ts for cross-portal consistency
// statusDotClass and statusLabel are imported at the top of this file

const severityColor = (severity: string) => {
  switch (severity) {
    case 'high':
      return 'border-l-status-danger-fill';
    case 'medium':
      return 'border-l-status-warning-fill';
    default:
      return 'border-l-status-info-fill';
  }
};

const severityBadge = (severity: string) => {
  switch (severity) {
    case 'high':
      return 'bg-status-danger-bg text-status-danger-text';
    case 'medium':
      return 'bg-status-warning-bg text-status-warning-text';
    default:
      return 'bg-status-info-bg text-status-info-text';
  }
};

/* ─── Main Page ─────────────────────────────────────────────────────── */

export default function DashboardPage() {
  return (
    <Suspense fallback={<OwnerAppShell><LayoutWrapper variant="wide"><BoardSkeleton /></LayoutWrapper></OwnerAppShell>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');

  // Current date for the board
  const currentDate = dateParam || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // Messaging status for banner
  const { data: msgStatus } = useQuery({
    queryKey: ['owner', 'messaging-status'],
    queryFn: async () => {
      const res = await fetch('/api/ops/messaging-status');
      return res.ok ? res.json() : null;
    },
    staleTime: 300000,
  });

  // Payment analytics
  const { data: paymentStats } = useQuery({
    queryKey: ['owner', 'payment-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/ops/payment-analytics');
      return res.ok ? res.json() : null;
    },
    staleTime: 60000,
  });

  const { data: boardData, isLoading: boardLoading, error: boardError, refetch: refetchBoard } = useQuery({
    queryKey: ['owner', 'daily-board', currentDate],
    queryFn: async () => {
      const [boardRes, sittersRes] = await Promise.all([
        fetch(`/api/ops/daily-board?date=${currentDate}`),
        fetch('/api/sitters?page=1&pageSize=200'),
      ]);
      const board = await boardRes.json().catch(() => ({}));
      const sittersData = await sittersRes.json().catch(() => ({}));
      if (!boardRes.ok) throw new Error(board.error || 'Failed to load');
      return { ...board, sitters: Array.isArray(sittersData.items) ? sittersData.items : [] };
    },
    refetchInterval: 30000,
  });

  const { data: onboardingData } = useQuery({
    queryKey: ['owner', 'onboarding'],
    queryFn: async () => {
      const res = await fetch('/api/ops/onboarding');
      return res.ok ? res.json() : null;
    },
    staleTime: 120000,
  });

  // KPI overview (7d/30d)
  const [kpiRange, setKpiRange] = useState<'7d' | '30d'>('7d');
  const [kpiCollapsed, setKpiCollapsed] = useState(true);
  const { data: kpiStats } = useQuery({
    queryKey: ['owner', 'kpi-stats', kpiRange],
    queryFn: async () => {
      const res = await fetch(`/api/ops/stats?range=${kpiRange}`);
      return res.ok ? res.json() : null;
    },
    staleTime: 60000,
  });

  const stats = boardData?.stats;
  const sitterSchedules = boardData?.sitterSchedules || [];
  const unassigned = boardData?.unassigned || [];
  const attention = boardData?.attention;
  const sitters = boardData?.sitters || [];

  const navigateDate = (offset: number) => {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    const newDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    router.push(`/dashboard?date=${newDate}`);
  };

  const goToday = () => {
    router.push('/dashboard');
  };

  const quickAssignMutation = useQuickAssign();
  const quickAssign = (bookingId: string, sitterId: string) => {
    quickAssignMutation.mutate(
      { bookingId, sitterId },
      {
        onSuccess: () => {
          toastSuccess('Sitter assigned');
          void refetchBoard();
        },
        onError: (err: Error) => {
          toastError(err.message || 'Failed to assign sitter');
        },
      },
    );
  };

  const attentionCount =
    (attention?.alerts.length ?? 0) + (attention?.staffing.length ?? 0);
  const hasLiveWorkToday =
    (stats?.totalVisits ?? 0) > 0 || (stats?.unassignedCount ?? 0) > 0;
  const subtitle = boardData
    ? `${stats?.totalVisits ?? 0} visits today \u00b7 ${stats?.activeSittersCount ?? 0} sitters active${attentionCount > 0 ? ` \u00b7 ${attentionCount} need attention` : ''}`
    : '';

  return (
    <OwnerAppShell>
      <LayoutWrapper variant="wide">
        {/* Header */}
        <PageHeader
          title={boardData ? `Daily Operations \u2014 ${formatDateLabel(boardData.date)}` : 'Daily Operations'}
          subtitle={subtitle}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigateDate(-1)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-default bg-surface-primary text-text-secondary hover:bg-surface-secondary transition-all duration-fast"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {!isToday(currentDate) && (
                <button
                  type="button"
                  onClick={goToday}
                  className="min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 text-sm font-medium text-text-secondary hover:bg-surface-secondary transition-all duration-fast"
                >
                  Today
                </button>
              )}
              <button
                type="button"
                onClick={() => navigateDate(1)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-default bg-surface-primary text-text-secondary hover:bg-surface-secondary transition-all duration-fast"
                aria-label="Next day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void refetchBoard()}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-default bg-surface-primary text-text-secondary hover:bg-surface-secondary transition-all duration-fast"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${boardLoading ? 'animate-spin' : ''}`} />
              </button>
              <Link href="/bookings/new">
                <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>New booking</Button>
              </Link>
            </div>
          }
        />

        {/* Messaging status banner */}
        {msgStatus && !msgStatus.active && (
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-status-warning-border bg-status-warning-bg px-4 py-3">
            <div>
              <p className="text-sm font-medium text-status-warning-text">Messaging not configured</p>
              <p className="text-xs text-status-warning-text-secondary">Choose OpenPhone or Twilio if you want a connected U.S. business line.</p>
            </div>
            <Link href="/settings?section=integrations" className="min-h-[44px] inline-flex items-center rounded-lg border border-status-warning-border px-3 text-sm font-medium text-status-warning-text hover:opacity-90 transition">
              Review options
            </Link>
          </div>
        )}

        {/* Payment escalation strip — only shown when outstanding or failed payments need attention */}
        {paymentStats && (paymentStats.outstanding.count > 0 || paymentStats.failedPayments > 0) && (
          <div className="mb-4 flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
            {paymentStats.outstanding.count > 0 && (
              <div className="shrink-0 rounded-2xl border border-status-warning-border bg-status-warning-bg px-4 py-3 min-w-[140px]">
                <p className="text-[11px] text-status-warning-text-secondary tracking-wide uppercase">Outstanding</p>
                <p className="font-heading text-lg font-bold text-status-warning-text tabular-nums mt-0.5">${paymentStats.outstanding.amount.toFixed(0)}</p>
                <p className="text-xs text-status-warning-text-secondary mt-0.5">{paymentStats.outstanding.count} unpaid</p>
              </div>
            )}
            {paymentStats.failedPayments > 0 && (
              <div className="shrink-0 rounded-2xl border border-status-danger-border bg-status-danger-bg px-4 py-3 min-w-[140px]">
                <p className="text-[11px] text-status-danger-text-secondary tracking-wide uppercase">Failed</p>
                <p className="font-heading text-lg font-bold text-status-danger-text tabular-nums mt-0.5">{paymentStats.failedPayments}</p>
                <p className="text-xs text-status-danger-text-secondary mt-0.5">last 30 days</p>
              </div>
            )}
          </div>
        )}

        {boardLoading && !boardData ? (
          <BoardSkeleton />
        ) : boardError ? (
          <AppErrorState
            title="Couldn't load dashboard"
            subtitle="Unable to load daily operations. Please try again."
            onRetry={() => void refetchBoard()}
          />
        ) : boardData ? (
          <div className="space-y-6">
            <LaunchPriorityHero
              boardDate={boardData.date}
              stats={boardData.stats}
              hasLiveWorkToday={hasLiveWorkToday}
              onboardingData={onboardingData}
              msgStatus={msgStatus}
              paymentStats={paymentStats}
            />

            {/* ── 1. KPI Row — above the fold, business state in 3 seconds ── */}
            <QuickStatsStrip stats={boardData.stats} />

            {/* ── 2. Attention Items — what needs action right now ── */}
            <AttentionItemsStrip
              attention={boardData.attention}
              unassignedCount={stats?.unassignedCount ?? 0}
            />

            {/* ── 3. Today's Schedule — secondary, scrollable ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-primary">
                  {isToday(boardData.date) ? "Today's schedule" : `${formatDateLabel(boardData.date)} schedule`}
                </h2>
                <Link href="/bookings?view=calendar" className="text-xs font-medium text-accent-primary hover:underline">
                  Full calendar
                </Link>
              </div>

              {sitterSchedules.length === 0 && unassigned.length === 0 ? (
                <ZeroDayState
                  boardDate={boardData.date}
                  hasOnboardingWork={Boolean(onboardingData && !onboardingData.isComplete)}
                />
              ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,380px]">
                  <div className="space-y-4 min-w-0">
                    {sitterSchedules.map((schedule: SitterSchedule) => (
                      <SitterScheduleCard
                        key={schedule.sitter.id}
                        schedule={schedule}
                        boardDate={boardData.date}
                      />
                    ))}

                    {unassigned.length > 0 && (
                      <UnassignedCard
                        visits={unassigned}
                        sitters={sitters}
                        onAssign={quickAssign}
                      />
                    )}

                    <CalloutDispatchCard currentDate={currentDate} onRefresh={() => void refetchBoard()} />
                  </div>

                  <div className="min-w-0">
                    <AttentionQueue attention={boardData.attention} unassignedCount={stats?.unassignedCount ?? 0} />
                  </div>
                </div>
              )}
            </div>

            {/* Performance overview — collapsed by default, below schedule */}
            <div className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden">
              <button
                type="button"
                onClick={() => setKpiCollapsed(!kpiCollapsed)}
                className="flex w-full items-center justify-between px-4 py-3 lg:px-5 text-left hover:bg-surface-secondary transition min-h-[44px]"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-text-tertiary" />
                  <span className="text-sm font-semibold text-text-primary">Performance</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 rounded-md border border-border-default bg-surface-primary p-0.5" onClick={(e) => e.stopPropagation()}>
                    {(['7d', '30d'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setKpiRange(r)}
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          kpiRange === r
                            ? 'bg-surface-inverse text-text-inverse'
                            : 'text-text-secondary hover:bg-surface-tertiary'
                        }`}
                      >
                        {r === '7d' ? '7 days' : '30 days'}
                      </button>
                    ))}
                  </div>
                  {kpiCollapsed ? <ChevronDown className="w-4 h-4 text-text-disabled" /> : <ChevronUp className="w-4 h-4 text-text-disabled" />}
                </div>
              </button>
              {!kpiCollapsed && kpiStats && (
                <div className="px-4 pb-4 lg:px-5">
                  <KpiGrid
                    items={[
                      {
                        label: `Bookings (${kpiRange})`,
                        value: kpiStats.bookingsCreated ?? '—',
                        delta: kpiStats.trends?.bookingsCreated,
                        href: '/bookings',
                        icon: <CalendarPlus className="w-4 h-4" />,
                      },
                      {
                        label: `Visits completed (${kpiRange})`,
                        value: kpiStats.visitsCompleted ?? '—',
                        delta: kpiStats.trends?.visitsCompleted,
                        href: '/bookings?status=completed',
                        icon: <CheckCircle2 className="w-4 h-4" />,
                      },
                      {
                        label: `Revenue (${kpiRange})`,
                        value: kpiStats.revenue != null ? `$${kpiStats.revenue.toFixed(0)}` : '—',
                        delta: kpiStats.trends?.revenue,
                        href: '/money',
                        icon: <DollarSign className="w-4 h-4" />,
                      },
                      {
                        label: `Messages sent (${kpiRange})`,
                        value: kpiStats.messagesSent ?? '—',
                        delta: kpiStats.trends?.messagesSent,
                        href: '/messaging',
                        icon: <MessageCircle className="w-4 h-4" />,
                      },
                    ]}
                  />
                </div>
              )}
            </div>

            {/* Predictions + Onboarding */}
            <PredictionsCard />
            <OnboardingWizard data={onboardingData} />

            <div className="flex flex-wrap gap-3 border-t border-border-default pt-4">
              <Link href="/bookings?view=calendar" className="text-sm font-medium text-accent-primary hover:underline">
                Full calendar
              </Link>
              <Link href="/bookings" className="text-sm font-medium text-accent-primary hover:underline">
                All bookings
              </Link>
            </div>
          </div>
        ) : null}
      </LayoutWrapper>
    </OwnerAppShell>
  );
}

type LaunchPriorityHeroProps = {
  boardDate: string;
  stats: BoardStats;
  hasLiveWorkToday: boolean;
  onboardingData: any;
  msgStatus: any;
  paymentStats: any;
};

function LaunchPriorityHero({
  boardDate,
  stats,
  hasLiveWorkToday,
  onboardingData,
  msgStatus,
  paymentStats,
}: LaunchPriorityHeroProps) {
  const pendingOnboarding = Array.isArray(onboardingData?.steps)
    ? onboardingData.steps.filter((step: any) => !step.completed).slice(0, 3)
    : [];
  const onboardingIncomplete = Boolean(onboardingData && !onboardingData.isComplete);
  const outstandingPayments = paymentStats?.outstanding?.count ?? 0;
  const failedPayments = paymentStats?.failedPayments ?? 0;
  const topFocus = hasLiveWorkToday
    ? stats.unassignedCount > 0
      ? 'Assign unstaffed visits before they become last-minute coverage issues.'
      : stats.inProgressVisits > 0
        ? 'Active visits are underway. Keep an eye on reports, messages, and timing.'
        : 'Your board is stable. Stay ahead of messages, payments, and schedule changes.'
    : onboardingIncomplete
      ? 'Your workspace is still in launch mode. Finish the setup basics before inviting real customers.'
      : `No visits are scheduled for ${formatDateLabel(boardDate)}. This is a good time to review growth, messaging, and customer readiness.`;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-3xl border border-border-default bg-surface-primary p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex rounded-full bg-accent-tertiary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-primary">
            {hasLiveWorkToday ? 'Operator view' : onboardingIncomplete ? 'Launch mode' : 'Calm day'}
          </span>
          {onboardingIncomplete && (
            <span className="inline-flex rounded-full bg-status-warning-bg px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-status-warning-text">
              Setup still in progress
            </span>
          )}
        </div>
        <h2 className="text-2xl font-bold text-text-primary">
          {hasLiveWorkToday ? 'What matters most today' : onboardingIncomplete ? 'Build a launch-ready workspace' : 'Your operations are clear'}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          {topFocus}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {onboardingIncomplete && pendingOnboarding.length > 0 ? (
            pendingOnboarding.map((step: any) => (
              <Link
                key={step.key}
                href={STEP_LINKS[step.key] || '/settings'}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-border-default bg-surface-secondary px-4 text-sm font-medium text-text-primary hover:bg-surface-tertiary transition"
              >
                {step.label}
              </Link>
            ))
          ) : (
            <>
              <Link href="/bookings/new">
                <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>Create booking</Button>
              </Link>
              <Link href="/clients">
                <Button variant="secondary" size="sm">Open clients</Button>
              </Link>
              <Link href="/settings?section=integrations">
                <Button variant="secondary" size="sm">Review launch stack</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Messaging</p>
          <p className="mt-2 text-sm font-semibold text-text-primary">
            {msgStatus?.active ? (msgStatus.nativeMode ? 'Native phone mode live' : 'Connected business messaging live') : 'Optional connection not set'}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {msgStatus?.active
              ? msgStatus.message
              : 'You can keep things simple with native phone mode or add OpenPhone/Twilio later.'}
          </p>
        </div>
        <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Payments</p>
          <p className="mt-2 text-sm font-semibold text-text-primary">
            {outstandingPayments > 0 || failedPayments > 0
              ? `${outstandingPayments} outstanding · ${failedPayments} failed`
              : 'No billing fires right now'}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {outstandingPayments > 0 || failedPayments > 0
              ? 'Clear payment friction quickly so customers keep trusting the platform.'
              : 'Your billing view looks calm from the owner dashboard.'}
          </p>
        </div>
        <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Coverage</p>
          <p className="mt-2 text-sm font-semibold text-text-primary">
            {stats.unassignedCount > 0
              ? `${stats.unassignedCount} visit${stats.unassignedCount !== 1 ? 's' : ''} need staff`
              : `${stats.activeSittersCount} sitters active`}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {stats.unassignedCount > 0
              ? 'The fastest way to make the business feel responsive is getting every visit staffed.'
              : 'Staffing is in a healthy state for this board.'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Quick Stats Strip ─────────────────────────────────────────────── */

function QuickStatsStrip({ stats }: { stats: BoardStats }) {
  const cards = [
    {
      label: 'Visits',
      value: `${stats.completedVisits}/${stats.totalVisits}`,
      sub: stats.inProgressVisits > 0 ? `${stats.inProgressVisits} in progress` : undefined,
      icon: CalendarCheck,
    },
    {
      label: 'Unassigned',
      value: String(stats.unassignedCount),
      alert: stats.unassignedCount > 0,
      icon: AlertTriangle,
    },
    {
      label: "Today's revenue",
      value: `$${stats.todayRevenue.toLocaleString()}`,
      icon: DollarSign,
    },
    {
      label: 'On-time',
      value: `${stats.onTimeRate}%`,
      icon: Clock,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => {
        const IconComp = card.icon;
        return (
          <div
            key={card.label}
            className={`rounded-2xl p-4 ${
              card.alert
                ? 'border-2 border-status-danger-border bg-status-danger-bg'
                : 'bg-surface-primary shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${card.alert ? 'text-status-danger-text' : 'text-text-tertiary'}`}>
                {card.label}
              </p>
              <IconComp className={`w-4 h-4 ${card.alert ? 'text-status-danger-text' : 'text-text-disabled'}`} />
            </div>
            <p className={`text-3xl font-bold tabular-nums ${card.alert ? 'text-status-danger-text' : 'text-text-primary'}`}>
              {card.value}
            </p>
            {card.sub && (
              <p className="mt-1 text-xs text-text-tertiary">{card.sub}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ZeroDayState({
  boardDate,
  hasOnboardingWork,
}: {
  boardDate: string;
  hasOnboardingWork: boolean;
}) {
  return (
    <div className="rounded-3xl border border-border-default bg-surface-primary p-8">
      <div className="max-w-2xl">
        <div className="inline-flex rounded-full bg-surface-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
          {hasOnboardingWork ? 'Launch workspace' : 'Open capacity'}
        </div>
        <h3 className="mt-4 text-2xl font-bold text-text-primary">
          {hasOnboardingWork ? 'You are ready for launch prep, not busywork' : 'No visits are scheduled for this day'}
        </h3>
        <p className="mt-2 text-sm text-text-secondary">
          {hasOnboardingWork
            ? `Use ${formatDateLabel(boardDate)} to finish setup, rehearse the customer journey, and make your first real booking feel polished.`
            : `Nothing is scheduled for ${formatDateLabel(boardDate)}. This is a good chance to follow up with clients, review staffing, or add new bookings.`}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/bookings/new">
            <Button size="sm">Create booking</Button>
          </Link>
          <Link href="/clients">
            <Button variant="secondary" size="sm">Review clients</Button>
          </Link>
          <Link href={hasOnboardingWork ? '/setup' : '/calendar'}>
            <Button variant="secondary" size="sm">
              {hasOnboardingWork ? 'Open launch setup' : 'Open calendar'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Attention Items Strip (above the fold) ───────────────────────── */

function AttentionItemsStrip({
  attention,
  unassignedCount,
}: {
  attention: { alerts: AttentionItem[]; staffing: AttentionItem[] };
  unassignedCount: number;
}) {
  const allItems = [...attention.alerts, ...attention.staffing];
  if (allItems.length === 0 && unassignedCount === 0) return null;

  const displayItems = allItems.slice(0, 5);
  const hasMore = allItems.length > 5;

  return (
    <div className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-status-warning-text" />
          <span className="text-sm font-semibold text-text-primary">
            Needs attention ({allItems.length})
          </span>
        </div>
        {hasMore && (
          <Link href="/ops/automation-failures" className="text-xs font-medium text-accent-primary hover:underline">
            View all
          </Link>
        )}
      </div>
      <div className="divide-y divide-border-muted">
        {displayItems.map((item) => (
          <Link
            key={item.id}
            href={item.primaryActionHref}
            className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-secondary transition min-h-[44px]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`h-2 w-2 shrink-0 rounded-full ${
                item.severity === 'high' ? 'bg-status-danger-fill' :
                item.severity === 'medium' ? 'bg-status-warning-fill' :
                'bg-status-info-fill'
              }`} />
              <div className="min-w-0">
                <p className="text-sm text-text-primary truncate">{item.title}</p>
                <p className="text-xs text-text-tertiary truncate">{item.subtitle}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-md border border-border-default bg-surface-primary px-2 py-0.5 text-xs font-medium text-text-secondary">
              {item.primaryActionLabel}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── Sitter Schedule Card ──────────────────────────────────────────── */

interface GooglePersonalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
}

function SitterScheduleCard({ schedule, boardDate }: { schedule: SitterSchedule; boardDate: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GooglePersonalEvent[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const { sitter, visits } = schedule;

  // Fetch Google Calendar events for this sitter
  useEffect(() => {
    const dayStart = new Date(boardDate + 'T00:00:00').toISOString();
    const dayEnd = new Date(boardDate + 'T23:59:59').toISOString();
    fetch(`/api/ops/sitters/${sitter.id}/google-events?start=${dayStart}&end=${dayEnd}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setGoogleConnected(d.connected ?? false);
          setGoogleEvents(Array.isArray(d.events) ? d.events : []);
        }
      })
      .catch(() => {});
  }, [sitter.id, boardDate]);
  const inProgress = visits.filter((v) => v.status === 'in_progress').length;
  const completed = visits.filter((v) => v.status === 'completed').length;

  return (
    <div className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-4 py-3 lg:px-5 lg:py-4 text-left hover:bg-surface-secondary transition min-h-[44px]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tertiary text-sm font-bold text-accent-primary">
            {sitter.firstName.charAt(0)}{sitter.lastName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">
              {sitter.firstName} {sitter.lastName}
              {googleConnected && <span title="Google Calendar connected"><CalendarCheck className="inline w-3.5 h-3.5 ml-1 text-status-success-text" /></span>}
            </p>
            <p className="text-xs text-text-tertiary">
              {visits.length} visit{visits.length !== 1 ? 's' : ''}
              {inProgress > 0 && ` \u00b7 ${inProgress} in progress`}
              {completed > 0 && ` \u00b7 ${completed} done`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sitter.phone && (
            <a
              href={`sms:${sitter.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-default text-text-secondary hover:bg-surface-tertiary transition-all duration-fast"
              aria-label={`Message ${sitter.firstName}`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </a>
          )}
          {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-text-tertiary" /> : <ChevronUp className="w-3.5 h-3.5 text-text-tertiary" />}
        </div>
      </button>

      {/* Visits + Google Calendar events */}
      {!collapsed && (
        <div className="border-t border-border-default divide-y divide-border-muted">
          {/* Merge and sort Snout visits + Google events by start time */}
          {(() => {
            const allItems: Array<{ type: 'visit'; data: Visit } | { type: 'google'; data: GooglePersonalEvent }> = [
              ...visits.map((v) => ({ type: 'visit' as const, data: v })),
              ...googleEvents.map((e) => ({ type: 'google' as const, data: e })),
            ];
            allItems.sort((a, b) => {
              const aTime = a.type === 'visit' ? a.data.startAt : a.data.start;
              const bTime = b.type === 'visit' ? b.data.startAt : b.data.start;
              return new Date(aTime).getTime() - new Date(bTime).getTime();
            });
            return allItems.map((item) => {
              if (item.type === 'visit') return <VisitRow key={item.data.bookingId} visit={item.data} />;
              return (
                <div key={item.data.id} className="flex items-center gap-3 px-4 py-3 lg:px-5 min-h-[44px]">
                  <div className="w-20 shrink-0 text-sm tabular-nums text-text-tertiary">
                    {formatTime(item.data.start)}
                  </div>
                  <div className="shrink-0">
                    <span className="block h-2.5 w-2.5 rounded-full bg-surface-tertiary" />
                  </div>
                  <p className="text-sm text-text-tertiary italic truncate">
                    {item.data.summary} <span className="text-text-disabled">(Personal)</span>
                  </p>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}

/* ─── Visit Row ─────────────────────────────────────────────────────── */

function VisitRow({ visit }: { visit: Visit }) {
  const router = useRouter();
  const petNames = visit.pets.map((p) => p.name || p.species).join(', ');

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 lg:px-5 hover:bg-surface-secondary transition-colors cursor-pointer min-h-[44px]"
      onClick={() => router.push(`/bookings/${visit.bookingId}`)}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/bookings/${visit.bookingId}`)}
      role="button"
      tabIndex={0}
      aria-label={`${formatServiceName(visit.service)} for ${visit.clientName}`}
    >
      <div className="w-20 shrink-0 text-sm font-medium tabular-nums text-text-primary">
        {formatTime(visit.startAt)}
      </div>
      <span className={`shrink-0 h-2.5 w-2.5 rounded-full ${statusDotClass(visit.status)}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary truncate">
          {formatServiceName(visit.service)}
          {visit.clientName && <span className="font-normal text-text-secondary"> &middot; {visit.clientName}</span>}
        </p>
        {petNames && (
          <p className="text-xs text-text-tertiary truncate">{petNames}</p>
        )}
      </div>
      <span className="shrink-0 text-xs font-medium text-text-tertiary">
        {statusLabel(visit.status)}
      </span>
      {visit.paymentStatus === 'unpaid' && (
        <span className="shrink-0 rounded-full bg-status-warning-bg px-2 py-0.5 text-[11px] font-semibold text-status-warning-text">
          Unpaid
        </span>
      )}
    </div>
  );
}

/* ─── Unassigned Card ───────────────────────────────────────────────── */

function UnassignedCard({
  visits,
  sitters,
  onAssign,
}: {
  visits: UnassignedVisit[];
  sitters: SitterOption[];
  onAssign: (bookingId: string, sitterId: string) => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-status-danger-border bg-status-danger-bg overflow-hidden">
      <div className="px-4 py-3 lg:px-5 lg:py-4">
        <p className="text-sm font-semibold text-status-danger-text">
          Unassigned \u2014 {visits.length} visit{visits.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="border-t border-status-danger-border divide-y divide-status-danger-border">
        {visits.map((visit) => (
          <div key={visit.bookingId} className="px-4 py-3 lg:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">
                    {formatTime(visit.startAt)} \u2014 {formatServiceName(visit.service)}
                  </p>
                  {(() => {
                    const hoursUntil = (new Date(visit.startAt).getTime() - Date.now()) / 3600000;
                    return hoursUntil > 0 && hoursUntil < 4 ? (
                      <span className="shrink-0 rounded-full bg-status-danger-fill px-2 py-0.5 text-[10px] font-bold text-status-danger-text-on-fill uppercase">
                        Urgent
                      </span>
                    ) : null;
                  })()}
                </div>
                <p className="text-xs text-text-secondary truncate">{visit.clientName}</p>
              </div>
              {sitters.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) onAssign(visit.bookingId, e.target.value);
                  }}
                  className="min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                  aria-label={`Assign sitter to ${formatServiceName(visit.service)}`}
                >
                  <option value="">Assign...</option>
                  {sitters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Attention Queue ───────────────────────────────────────────────── */

const SAFE_SUBTITLE: Record<string, string> = {
  automation_failure: 'Automation run failed and needs attention.',
  calendar_repair: 'Calendar repair needs owner action.',
  payout_failure: 'Payout issue needs review.',
  coverage_gap: 'Coverage gap detected in schedule.',
  unassigned: 'Assignment workflow needs review.',
  overlap: 'Schedule overlap needs resolution.',
};
const safeSubtitle = (item: AttentionItem): string =>
  SAFE_SUBTITLE[item.type] || 'Operational issue needs attention.';

function AttentionQueue({
  attention,
  unassignedCount = 0,
}: {
  attention: { alerts: AttentionItem[]; staffing: AttentionItem[] };
  unassignedCount?: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'active' | 'snoozed' | 'handled'>('active');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rollbackByItemId, setRollbackByItemId] = useState<Record<string, string | null>>({});

  // For snoozed/handled views, fetch from command-center attention endpoint
  const { data: viewData } = useQuery({
    queryKey: ['owner', 'command-center', 'attention', view],
    queryFn: async () => {
      const res = await fetch(`/api/ops/command-center/attention?view=${view}`);
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
    enabled: view !== 'active',
    refetchInterval: 30000,
  });

  // Active view uses props from daily board; snoozed/handled use their own fetch
  const allItems: AttentionItem[] =
    view === 'active'
      ? [...attention.alerts, ...attention.staffing]
      : [
          ...(Array.isArray(viewData?.alerts) ? viewData.alerts : []),
          ...(Array.isArray(viewData?.staffing) ? viewData.staffing : []),
        ];

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['owner', 'daily-board'] });
    void queryClient.invalidateQueries({ queryKey: ['owner', 'command-center'] });
  };

  // ── Mutation: snooze / handle ──
  const attentionActionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'mark_handled' | 'snooze_1h' | 'snooze_tomorrow' }) => {
      const res = await fetch('/api/ops/command-center/attention/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to update item');
      }
      return { action };
    },
    onMutate: ({ id }) => setActionLoadingId(id),
    onSuccess: ({ action }) => {
      toastSuccess(action === 'mark_handled' ? 'Marked handled' : 'Snoozed');
      invalidateAll();
    },
    onError: (err: Error) => toastError(err.message),
    onSettled: () => setActionLoadingId(null),
  });

  // ── Mutation: staffing resolve (assign+notify / rollback) ──
  const staffingResolveMutation = useMutation({
    mutationFn: async ({ item, action }: { item: AttentionItem; action: 'assign_notify' | 'rollback' }) => {
      const res = await fetch('/api/ops/command-center/staffing/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          action,
          rollbackToken: action === 'rollback' ? rollbackByItemId[item.id] ?? null : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed staffing action');
      return { action, itemId: item.id, json };
    },
    onMutate: ({ item }) => setActionLoadingId(item.id),
    onSuccess: ({ action, itemId, json }) => {
      if (action === 'assign_notify') {
        toastSuccess('Assignment sent');
        setRollbackByItemId((prev) => ({
          ...prev,
          [itemId]: typeof json?.rollbackToken === 'string' ? json.rollbackToken : null,
        }));
      } else {
        toastSuccess('Rollback complete');
      }
      invalidateAll();
    },
    onError: (err: Error) => toastError(err.message),
    onSettled: () => setActionLoadingId(null),
  });

  // ── Mutation: quick fix (retry automation, calendar repair, payout) ──
  const quickFixMutation = useMutation({
    mutationFn: async (item: AttentionItem) => {
      let res: Response;
      if (item.type === 'automation_failure' && item.actionEntityId) {
        res = await fetch(`/api/ops/automation-failures/${encodeURIComponent(item.actionEntityId)}/retry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        res = await fetch('/api/ops/command-center/attention/fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id }),
        });
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to queue fix');
      }
      await res.json().catch(() => ({}));
      // Auto-mark automation failures as handled after successful retry
      if (item.type === 'automation_failure') {
        await fetch('/api/ops/command-center/attention/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, action: 'mark_handled' }),
        });
      }
      return item;
    },
    onMutate: (item) => setActionLoadingId(item.id),
    onSuccess: (item) => {
      if (item.type === 'automation_failure') {
        toastSuccess('Retry queued');
      } else if (item.type === 'calendar_repair') {
        toastSuccess('Calendar repair requested');
      } else if (item.type === 'payout_failure') {
        toastSuccess('Payout retry requested');
      }
      invalidateAll();
    },
    onError: (err: Error) => toastError(err.message),
    onSettled: () => setActionLoadingId(null),
  });

  // ── Primary action dispatcher ──
  const handlePrimaryAction = (item: AttentionItem) => {
    if (item.type === 'automation_failure' || item.type === 'calendar_repair') {
      quickFixMutation.mutate(item);
      return;
    }
    if (item.type === 'payout_failure') {
      router.push(item.primaryActionHref);
      return;
    }
    if (item.type === 'coverage_gap' || item.type === 'unassigned' || item.type === 'overlap') {
      staffingResolveMutation.mutate({ item, action: 'assign_notify' });
      return;
    }
    router.push(item.primaryActionHref);
  };

  return (
    <div className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden">
      <div className="px-4 py-3 lg:px-5 lg:py-4 border-b border-border-default">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">Attention Queue</p>
            {view === 'active' && (allItems.length > 0 || unassignedCount > 0) && (
              <p className="text-xs text-text-tertiary mt-0.5">
                {[
                  allItems.length > 0 ? `${allItems.length} alert${allItems.length !== 1 ? 's' : ''}` : null,
                  unassignedCount > 0 ? `${unassignedCount} unassigned` : null,
                ].filter(Boolean).join(' \u00b7 ')}
              </p>
            )}
          </div>
          <div className="flex gap-1 rounded-md border border-border-default bg-surface-primary p-1">
            {([
              ['active', 'Active'],
              ['snoozed', 'Snoozed'],
              ['handled', 'Handled 24h'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded px-2 py-1 text-xs font-medium ${
                  view === value ? 'bg-surface-inverse text-text-inverse' : 'text-text-secondary hover:bg-surface-tertiary'
                }`}
                onClick={() => setView(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {allItems.length === 0 ? (
        <div className="px-4 py-6 lg:px-5 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-status-success-bg text-status-success-text mb-2">
            <Check className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-status-success-text">All clear</p>
          <p className="text-xs text-text-tertiary mt-0.5">
            {view === 'active' ? 'No items need attention right now.' : `No ${view} items.`}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-muted max-h-[600px] overflow-y-auto">
          {allItems.map((item) => (
            <AttentionItemRow
              key={item.id}
              item={item}
              actionLoadingId={actionLoadingId}
              rollbackByItemId={rollbackByItemId}
              onPrimaryAction={handlePrimaryAction}
              onAttentionAction={(id, action) => attentionActionMutation.mutate({ id, action })}
              onStaffingResolve={(item, action) => staffingResolveMutation.mutate({ item, action })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AttentionItemRow({
  item,
  actionLoadingId,
  rollbackByItemId,
  onPrimaryAction,
  onAttentionAction,
  onStaffingResolve,
}: {
  item: AttentionItem;
  actionLoadingId: string | null;
  rollbackByItemId: Record<string, string | null>;
  onPrimaryAction: (item: AttentionItem) => void;
  onAttentionAction: (id: string, action: 'mark_handled' | 'snooze_1h' | 'snooze_tomorrow') => void;
  onStaffingResolve: (item: AttentionItem, action: 'assign_notify' | 'rollback') => void;
}) {
  const isLoading = actionLoadingId === item.id;
  const isStaffingType = item.type === 'coverage_gap' || item.type === 'unassigned' || item.type === 'overlap';
  const hasRollback = isStaffingType && Object.prototype.hasOwnProperty.call(rollbackByItemId, item.id);

  return (
    <div className={`border-l-4 ${severityColor(item.severity)} px-4 py-3 lg:px-5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${severityBadge(item.severity)}`}>
              {item.severity}
            </span>
            <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
          </div>
          <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{safeSubtitle(item)}</p>
          {item.dueAt && (
            <p className="text-[10px] text-text-tertiary mt-0.5">
              Due {formatDateTime(item.dueAt)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => onPrimaryAction(item)} disabled={isLoading}>
              {item.primaryActionLabel}
            </Button>
            {isStaffingType && (
              <Button variant="secondary" size="sm" onClick={() => onStaffingResolve(item, 'assign_notify')} disabled={isLoading}>
                Assign + notify
              </Button>
            )}
            {hasRollback && (
              <Button variant="secondary" size="sm" onClick={() => onStaffingResolve(item, 'rollback')} disabled={isLoading}>
                Rollback
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" className="text-[11px] text-text-tertiary hover:text-text-primary transition" onClick={() => onAttentionAction(item.id, 'snooze_1h')} disabled={isLoading}>Snooze 1h</button>
            <button type="button" className="text-[11px] text-text-tertiary hover:text-text-primary transition" onClick={() => onAttentionAction(item.id, 'snooze_tomorrow')} disabled={isLoading}>Tomorrow</button>
            <button type="button" className="text-[11px] text-text-tertiary hover:text-text-primary transition" onClick={() => onAttentionAction(item.id, 'mark_handled')} disabled={isLoading}>Handled</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Callout Dispatch Card ─────────────────────────────────────────── */

interface CalloutSuggestion {
  sitterId: string;
  sitterName: string;
  score: number;
  tierEligible: boolean;
  tierReasons: string[];
  conflictFree: boolean;
}

interface CalloutBooking {
  bookingId: string;
  service: string;
  clientName: string;
  clientId: string;
  startAt: string;
  endAt: string;
  currentSitterId: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  hoursUntil: number;
  topSuggestion: CalloutSuggestion | null;
  allSuggestions: CalloutSuggestion[];
}

interface CalloutDispatchData {
  affectedCount: number;
  bookings: CalloutBooking[];
  readyForOneClick: number;
  noReplacementCount: number;
  needsEscalation: Array<{
    bookingId: string;
    service: string;
    clientName: string;
    startAt: string;
    urgency: string;
    reason: string;
  }>;
}

const urgencyBadge = (u: string) => {
  switch (u) {
    case 'critical': return 'bg-status-danger-fill text-status-danger-text-on-fill';
    case 'high': return 'bg-status-danger-bg text-status-danger-text';
    case 'medium': return 'bg-status-warning-bg text-status-warning-text';
    default: return 'bg-status-info-bg text-status-info-text';
  }
};

function CalloutDispatchCard({ currentDate, onRefresh }: { currentDate: string; onRefresh: () => void }) {
  const queryClient = useQueryClient();
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatchingAll, setDispatchingAll] = useState(false);

  const { data, isLoading, error: queryError, refetch: refetchCallouts } = useQuery<CalloutDispatchData>({
    queryKey: ['owner', 'callout-dispatch', currentDate],
    queryFn: async () => {
      const res = await fetch(`/api/ops/callout-dispatch?date=${currentDate}`);
      if (!res.ok) throw new Error('Failed to load callout data');
      return res.json();
    },
    refetchInterval: 30000,
    retry: 1,
  });

  const dispatchMutation = useMutation({
    mutationFn: async (assignments: Array<{ bookingId: string; replacementSitterId: string }>) => {
      const res = await fetch('/api/ops/callout-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Dispatch failed');
      }
      return res.json();
    },
    onSuccess: (result) => {
      const failed = result.results?.filter((r: any) => !r.success) || [];
      if (failed.length > 0) {
        const reasons = [...new Set(failed.map((r: any) => r.error).filter(Boolean))];
        toastError(`${failed.length} failed: ${reasons.join(', ')}`);
      }
      if (result.succeeded > 0) {
        toastSuccess(`Dispatched ${result.succeeded} visit${result.succeeded !== 1 ? 's' : ''}`);
      }
      void queryClient.invalidateQueries({ queryKey: ['owner', 'callout-dispatch'] });
      void queryClient.invalidateQueries({ queryKey: ['owner', 'daily-board'] });
      onRefresh();
    },
    onError: (err: Error) => toastError(err.message),
    onSettled: () => { setDispatchingId(null); setDispatchingAll(false); },
  });

  // Don't render if loading, no data, or no affected bookings
  if (isLoading || (!data && !queryError)) return null;
  if (queryError) {
    return (
      <div className="rounded-2xl border border-status-danger-border bg-status-danger-bg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-status-danger-text" />
            <p className="text-sm font-medium text-status-danger-text">Callout dispatch failed to load</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void refetchCallouts()}>Retry</Button>
        </div>
      </div>
    );
  }
  if (!data || data.affectedCount === 0) return null;

  const handleSingleAssign = (bookingId: string, sitterId: string) => {
    setDispatchingId(bookingId);
    dispatchMutation.mutate([{ bookingId, replacementSitterId: sitterId }]);
  };

  const handleDispatchAll = () => {
    const ready = data.bookings.filter((b) => b.topSuggestion?.conflictFree && b.topSuggestion?.tierEligible);
    if (ready.length === 0) { toastError('No bookings have a conflict-free replacement ready'); return; }
    setDispatchingAll(true);
    dispatchMutation.mutate(ready.map((b) => ({ bookingId: b.bookingId, replacementSitterId: b.topSuggestion!.sitterId })));
  };

  return (
    <div className="rounded-2xl border-2 border-status-warning-border bg-status-warning-bg overflow-hidden">
      <div className="px-4 py-3 lg:px-5 lg:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <PhoneOff className="w-4 h-4 text-status-warning-text" />
          <div>
            <p className="text-sm font-semibold text-status-warning-text">
              Callout dispatch — {data.affectedCount} visit{data.affectedCount !== 1 ? 's' : ''} need reassignment
            </p>
            {data.readyForOneClick > 0 && (
              <p className="text-xs text-status-warning-text-secondary mt-0.5">
                {data.readyForOneClick} ready for one-click dispatch
                {data.noReplacementCount > 0 && ` · ${data.noReplacementCount} need manual attention`}
              </p>
            )}
          </div>
        </div>
        {data.readyForOneClick > 0 && (
          <Button
            size="sm"
            onClick={handleDispatchAll}
            disabled={dispatchingAll || dispatchMutation.isPending}
          >
            {dispatchingAll ? 'Dispatching…' : `Dispatch all (${data.readyForOneClick})`}
          </Button>
        )}
      </div>

      <div className="border-t border-status-warning-border divide-y divide-status-warning-border">
        {data.bookings.map((booking) => (
          <div key={booking.bookingId} className="px-4 py-3 lg:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${urgencyBadge(booking.urgency)}`}>
                    {booking.urgency}
                  </span>
                  <p className="text-sm font-medium text-text-primary">
                    {formatTime(booking.startAt)} — {formatServiceName(booking.service)}
                  </p>
                </div>
                <p className="text-xs text-text-secondary mt-0.5 truncate">{booking.clientName}</p>
              </div>

              {booking.topSuggestion ? (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSingleAssign(booking.bookingId, booking.topSuggestion!.sitterId)}
                    disabled={dispatchingId === booking.bookingId || dispatchMutation.isPending}
                  >
                    {dispatchingId === booking.bookingId ? 'Assigning…' : `Assign ${booking.topSuggestion.sitterName.split(' ')[0]}`}
                  </Button>
                  {booking.allSuggestions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setExpandedBooking(expandedBooking === booking.bookingId ? null : booking.bookingId)}
                      className="text-xs text-text-tertiary hover:text-text-primary transition"
                    >
                      +{booking.allSuggestions.length - 1} more
                    </button>
                  )}
                </div>
              ) : (
                <Link href={`/bookings/${booking.bookingId}`}>
                  <Button variant="secondary" size="sm">Assign manually</Button>
                </Link>
              )}
            </div>

            {/* Expanded suggestions */}
            {expandedBooking === booking.bookingId && booking.allSuggestions.length > 1 && (
              <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-border-default">
                {booking.allSuggestions.slice(1).map((sug) => (
                  <div key={sug.sitterId} className="flex items-center justify-between py-1">
                    <div className="min-w-0">
                      <span className="text-sm text-text-primary">{sug.sitterName}</span>
                      {!sug.tierEligible && <span className="ml-2 text-[10px] text-status-warning-text">Tier ineligible</span>}
                      {!sug.conflictFree && <span className="ml-2 text-[10px] text-status-danger-text">Has conflict</span>}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSingleAssign(booking.bookingId, sug.sitterId)}
                      disabled={dispatchMutation.isPending}
                    >
                      Assign
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Escalation items */}
        {data.needsEscalation.length > 0 && (
          <div className="px-4 py-3 lg:px-5 bg-status-danger-bg border-t border-status-danger-border">
            <p className="text-xs font-semibold text-status-danger-text mb-2">
              No replacements found — {data.needsEscalation.length} visit{data.needsEscalation.length !== 1 ? 's' : ''}
            </p>
            {data.needsEscalation.map((esc) => (
              <div key={esc.bookingId} className="flex items-center justify-between py-1">
                <p className="text-sm text-text-primary">{formatTime(esc.startAt)} — {esc.clientName}</p>
                <Link href={`/bookings/${esc.bookingId}`} className="text-xs font-medium text-accent-primary hover:underline">
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Loading Skeleton ──────────────────────────────────────────────── */

function BoardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats */}
      <div className="flex gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 min-w-[120px] rounded-2xl border border-border-default bg-surface-primary p-4">
            <div className="h-3 w-16 rounded bg-surface-tertiary" />
            <div className="mt-2 h-8 w-12 rounded bg-surface-tertiary" />
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,380px]">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border-default bg-surface-primary p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-surface-tertiary" />
                <div className="flex-1">
                  <div className="h-4 w-32 rounded bg-surface-tertiary" />
                  <div className="mt-1 h-3 w-20 rounded bg-surface-tertiary" />
                </div>
              </div>
              {[1, 2].map((j) => (
                <div key={j} className="flex items-center gap-3 py-2">
                  <div className="h-4 w-16 rounded bg-surface-tertiary" />
                  <div className="h-2.5 w-2.5 rounded-full bg-surface-tertiary" />
                  <div className="flex-1 h-4 rounded bg-surface-tertiary" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
          <div className="h-4 w-32 rounded bg-surface-tertiary mb-4" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="mb-3 h-16 rounded bg-surface-tertiary" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Predictions Card ─────────────────────────────────────────────── */

function PredictionsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'predictions'],
    queryFn: async () => {
      const res = await fetch('/api/ops/predictions');
      return res.ok ? res.json() : null;
    },
    staleTime: 300000,
  });

  if (isLoading || !data) return null;

  const alerts = data.missingBookingAlerts || [];
  const forecast = data.demandForecast || [];
  const revenue = data.revenueProjection;

  if (alerts.length === 0 && forecast.length === 0 && !revenue) return null;

  return (
    <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-text-tertiary" />
          <h3 className="font-heading text-sm font-semibold text-text-primary">Business forecast</h3>
        </div>
        <span className="text-[11px] text-text-disabled tracking-wide uppercase">Based on booking patterns</span>
      </div>

      {/* Missing booking alerts */}
      {alerts.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-status-warning-text mb-2">
            <AlertTriangle className="w-3 h-3" />
            Missing bookings
          </div>
          <div className="space-y-1.5">
            {alerts.slice(0, 3).map((a: any) => (
              <div key={a.clientId} className="flex items-center justify-between rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-sm">
                <span className="text-text-primary">{a.clientName} usually books on {a.usualDay}s</span>
                <span className="text-xs text-text-tertiary shrink-0 ml-2">{formatServiceName(a.service)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue projection */}
      {revenue && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border-default bg-surface-secondary p-3 text-center">
            <div className="text-[11px] text-text-tertiary tracking-wide uppercase mb-1">This month</div>
            <div className="font-heading text-lg font-bold tabular-nums text-text-primary">${(revenue.currentMonthTotal || 0).toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-accent-tertiary bg-accent-tertiary/30 p-3 text-center">
            <div className="text-[11px] text-text-tertiary tracking-wide uppercase mb-1">Projected</div>
            <div className="font-heading text-lg font-bold tabular-nums text-text-primary">${(revenue.projectedMonthEnd || 0).toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-border-default bg-surface-secondary p-3 text-center">
            <div className="text-[11px] text-text-tertiary tracking-wide uppercase mb-1">Last month</div>
            <div className="font-heading text-lg font-bold tabular-nums text-text-primary">${(revenue.lastMonthTotal || 0).toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Demand forecast */}
      {forecast.length > 0 && (
        <div>
          <div className="text-xs font-medium text-text-secondary mb-2">Next week forecast</div>
          <div className="grid grid-cols-7 gap-1.5">
            {forecast.slice(0, 7).map((d: any) => (
              <div key={d.date} className="rounded-lg border border-border-default bg-surface-primary p-2 text-center">
                <div className="text-[10px] font-medium text-text-disabled tracking-wide uppercase">{d.dayOfWeek?.slice(0, 3)}</div>
                <div className="font-heading text-sm font-bold tabular-nums text-text-primary mt-0.5">{d.predicted}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Owner Onboarding Wizard ────────────────────────────────────── */

const STEP_LINKS: Record<string, string> = {
  business_profile: '/settings?section=business',
  services_created: '/settings?section=services',
  team_setup: '/sitters',
  messaging_setup: '/settings?section=integrations',
  payments_setup: '/settings?section=integrations',
  branding_done: '/settings?section=branding',
  first_client: '/clients',
  first_booking: '/bookings/new',
};

function OnboardingWizard({ data }: { data: any }) {
  if (!data || data.isComplete) return null;

  const steps = data.steps || [];
  const completed = data.completedCount || 0;
  const total = data.totalSteps || steps.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="mb-4 rounded-2xl border border-border-default bg-surface-primary p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-text-primary">Launch checklist</h3>
        <span className="text-xs text-text-tertiary">{completed}/{total} steps</span>
      </div>
      <p className="mb-3 text-sm text-text-secondary">
        Keep the product sellable by finishing the essentials first: setup, team, billing, messaging, and a real booking rehearsal.
      </p>
      <div className="h-2 rounded-full bg-surface-tertiary mb-3 overflow-hidden">
        <div className="h-full rounded-full bg-accent-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-2">
        {steps.filter((s: any) => !s.completed).slice(0, 4).map((step: any) => (
          <Link
            key={step.key}
            href={STEP_LINKS[step.key] || '/settings'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-tertiary transition-all duration-fast"
          >
            <Circle className="w-2 h-2 fill-status-warning-fill text-status-warning-fill" />
            {step.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
