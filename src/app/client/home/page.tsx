'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, Circle, ChevronRight, Calendar,
  PawPrint, MessageCircle, CreditCard, Plus,
} from 'lucide-react';
import { LayoutWrapper, ClientRefreshButton } from '@/components/layout';
import { AppErrorState } from '@/components/app';
import { Button } from '@/components/ui';
import { statusDotClass, statusLabel } from '@/lib/status-colors';
import { formatServiceName } from '@/lib/format-utils';
import { renderClientPreview } from '@/lib/strip-emojis';
import { useClientHome, useClientOnboardingStatus, useClientMessages } from '@/lib/api/client-hooks';

/* ─── Helpers ───────────────────────────────────────────────────────── */

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

const formatTime = (d: string) =>
  new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const formatShortDate = (d: string) => {
  const date = new Date(d);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/* ─── Main Content ──────────────────────────────────────────────────── */

function ClientHomeContent() {
  const router = useRouter();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('snout-onboarding-dismissed');
      if (dismissed) {
        const ts = parseInt(dismissed, 10);
        if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) setOnboardingDismissed(true);
      }
    } catch { /* ignore */ }
  }, []);

  const { data, isLoading: loading, error, refetch } = useClientHome();
  const { data: onboarding } = useClientOnboardingStatus(!onboardingDismissed);
  const { data: messagesData } = useClientMessages();
  const { data: balanceData } = useQuery({
    queryKey: ['client', 'outstanding-balance'],
    queryFn: async () => {
      const res = await fetch('/api/client/outstanding-balance');
      return res.ok ? res.json() : null;
    },
    staleTime: 60000,
  });

  const firstName = data?.clientName?.split(' ')[0] || 'there';
  const petsCount = data?.pets?.length || 0;
  const upcomingBookings = data?.upcomingBookings || [];
  const pendingBookings = upcomingBookings.filter(b =>
    ['pending', 'requested'].includes(b.status.toLowerCase())
  );
  const nextVisit = upcomingBookings[0];
  const now = Date.now();
  const minutesUntilNext = nextVisit
    ? Math.max(0, Math.floor((new Date(nextVisit.startAt).getTime() - now) / 60000))
    : null;

  const threadCount = messagesData?.threads?.length ?? null;
  const onboardingRemaining = onboarding
    ? [
        !onboarding.hasPets ? 'Add your pets' : null,
        !onboarding.hasEmergencyContact ? 'Add an emergency contact' : null,
        !onboarding.hasAddress ? 'Confirm your home address' : null,
        !onboarding.hasHomeAccess ? 'Add home access details' : null,
      ].filter(Boolean) as string[]
    : [];

  const daysSinceReport = data?.latestReport
    ? Math.floor((now - new Date(data.latestReport.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const reportLabel = daysSinceReport === null ? '—'
    : daysSinceReport === 0 ? 'Today'
    : daysSinceReport === 1 ? '1d ago'
    : `${daysSinceReport}d ago`;

  const getCountdown = () => {
    if (minutesUntilNext == null) return null;
    if (minutesUntilNext < 60) return `In ${minutesUntilNext} min`;
    if (minutesUntilNext < 1440) {
      const h = Math.floor(minutesUntilNext / 60);
      const m = minutesUntilNext % 60;
      return m > 0 ? `In ${h}h ${m}m` : `In ${h}h`;
    }
    const days = Math.floor(minutesUntilNext / 1440);
    return days === 1 ? 'Tomorrow' : `In ${days} days`;
  };

  return (
    <LayoutWrapper variant="narrow">
      {loading ? (
        <ClientHomeSkeleton />
      ) : error ? (
        <AppErrorState
          title="Couldn't load your dashboard"
          subtitle={error.message || 'Unable to load'}
          onRetry={() => void refetch()}
        />
      ) : data ? (
        <div className="space-y-4">
          <ClientPriorityHero
            firstName={firstName}
            nextVisit={nextVisit}
            pendingBookingsCount={pendingBookings.length}
            hasOutstandingBalance={Boolean(balanceData?.hasOutstanding)}
            onboardingRemaining={onboardingRemaining}
          />

          {/* ─── Page Header ───────────────────────────────────── */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-text-primary leading-tight lg:text-2xl">
                Welcome back, {firstName}
              </h1>
              <p className="text-sm text-text-secondary mt-0.5">
                {data.upcomingCount > 0
                  ? `${data.upcomingCount} upcoming visit${data.upcomingCount !== 1 ? 's' : ''}${petsCount > 0 ? ` \u00b7 ${petsCount} pet${petsCount !== 1 ? 's' : ''}` : ''}`
                  : petsCount > 0
                    ? `${petsCount} pet${petsCount !== 1 ? 's' : ''} registered`
                    : "Here\u2019s what\u2019s happening with your pets"
                }
              </p>
            </div>
            <ClientRefreshButton onRefresh={refetch} loading={loading} />
          </div>

          {/* ─── Outstanding Balance Banner ─────────────────────── */}
          {balanceData?.hasOutstanding && (
            <div className="rounded-2xl bg-status-danger-bg border border-status-danger-border p-4">
              <p className="text-sm font-semibold text-status-danger-text">
                Outstanding balance: ${balanceData.totalOutstanding.toFixed(2)}
              </p>
              <p className="mt-0.5 text-xs text-status-danger-text">
                Pay your existing bookings to continue booking new visits.
              </p>
              <div className="mt-2 space-y-1">
                {balanceData.bookings?.slice(0, 3).map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between text-sm">
                    <span className="text-text-primary">{b.service} · ${b.totalPrice.toFixed(2)}</span>
                    {b.paymentLink && (
                      <a href={b.paymentLink} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent-primary hover:underline">
                        Pay now
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── KPI Strip ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-accent-tertiary p-4">
              <p className="text-[11px] font-semibold text-accent-primary uppercase tracking-wider">Upcoming</p>
              <p className="mt-2 text-3xl font-bold text-accent-primary tabular-nums">{data.upcomingCount}</p>
              {nextVisit && (
                <p className="mt-1 text-xs font-medium text-accent-primary">{getCountdown()}</p>
              )}
            </div>
            <div className="rounded-2xl bg-surface-primary shadow-sm p-4">
              <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Pets</p>
              <p className="mt-2 text-3xl font-bold text-text-primary tabular-nums">{petsCount}</p>
              {petsCount === 0 && (
                <p className="mt-1 text-xs text-text-tertiary">Add a pet</p>
              )}
            </div>
            <div className="rounded-2xl bg-surface-primary shadow-sm p-4">
              <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Messages</p>
              <p className="mt-2 text-3xl font-bold text-text-primary tabular-nums">
                {threadCount !== null ? threadCount : '\u2014'}
              </p>
            </div>
            <div className="rounded-2xl bg-surface-primary shadow-sm p-4">
              <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Visits</p>
              <p className="mt-2 text-3xl font-bold text-text-primary tabular-nums">
                {data.recentBookings.filter(b => b.status === 'completed').length}
              </p>
              {data.latestReport && (
                <p className="mt-1 text-xs text-text-tertiary">Report {reportLabel.toLowerCase()}</p>
              )}
            </div>
          </div>

          {/* ─── Onboarding ────────────────────────────────────── */}
          {onboarding && onboarding.completionPercent < 100 && !onboardingDismissed && (
            <div className="rounded-2xl bg-surface-primary shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-text-primary">Complete your profile</p>
                <button
                  type="button"
                  onClick={() => {
                    setOnboardingDismissed(true);
                    try { localStorage.setItem('snout-onboarding-dismissed', String(Date.now())); } catch {}
                  }}
                  className="min-h-[44px] text-xs text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  Skip for now
                </button>
              </div>
              <div className="space-y-1">
                {[
                  { done: onboarding.hasAccount, label: 'Create account', href: '#' },
                  { done: onboarding.hasPets, label: `Add your pets${onboarding.hasPets ? '' : ' (0/1)'}`, href: '/client/pets/new' },
                  { done: onboarding.hasEmergencyContact, label: 'Add emergency contact', href: '/client/profile' },
                  { done: onboarding.hasAddress, label: 'Add home address', href: '/client/profile' },
                  { done: onboarding.hasHomeAccess, label: 'Add home access info', href: '/client/profile' },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-2 py-2 min-h-[44px] text-sm transition-all duration-fast ${
                      item.done
                        ? 'text-text-tertiary'
                        : 'text-text-primary hover:bg-surface-secondary font-medium'
                    }`}
                  >
                    {item.done
                      ? <CheckCircle2 className="w-4.5 h-4.5 text-status-success-fill shrink-0" />
                      : <Circle className="w-4.5 h-4.5 text-text-disabled shrink-0" />
                    }
                    <span className={item.done ? 'line-through' : ''}>{item.label}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-tertiary">
                <div className="h-full rounded-full bg-accent-primary transition-[width]" style={{ width: `${onboarding.completionPercent}%` }} />
              </div>
            </div>
          )}

          {/* ─── Next Visit Hero ────────────────────────────────── */}
          {nextVisit ? (
            <div className="rounded-2xl bg-accent-tertiary p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-primary">Next visit</p>
                  {getCountdown() && (
                    <p className="mt-1 text-sm font-bold text-accent-primary">{getCountdown()}</p>
                  )}
                  <h2 className="mt-3 text-lg font-bold text-text-primary leading-snug">
                    {formatServiceName(nextVisit.service)}
                  </h2>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {formatDate(nextVisit.startAt)} at {formatTime(nextVisit.startAt)}
                  </p>
                  {nextVisit.sitterName && (
                    <p className="mt-0.5 text-sm text-text-tertiary">with {nextVisit.sitterName}</p>
                  )}
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-primary text-text-inverse text-lg font-bold shadow-sm">
                  {nextVisit.service?.[0] || 'V'}
                </div>
              </div>
              <div className="mt-4">
                <Link href={`/client/bookings/${nextVisit.id}`}>
                  <Button variant="primary" size="md">View details</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-accent-tertiary p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary shadow-sm mb-4">
                <Calendar className="h-7 w-7 text-text-inverse" />
              </div>
              <p className="text-xl font-bold text-text-primary">No upcoming visits yet</p>
              <p className="mt-2 text-sm text-text-secondary max-w-[280px] mx-auto leading-relaxed">
                {onboardingRemaining.length > 0
                  ? 'Finish a few essentials, then book with confidence knowing your care team has what they need.'
                  : 'Book a visit when you are ready and your care team will take it from there.'}
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link href="/client/bookings/new">
                  <Button variant="primary" size="md">Book a visit</Button>
                </Link>
                <Link href="/client/meet-greet">
                  <Button variant="secondary" size="md">Meet &amp; greet</Button>
                </Link>
              </div>
            </div>
          )}

          {/* ─── Action Required ─────────────────────────────── */}
          {(pendingBookings.length > 0 || (threadCount !== null && threadCount > 0)) && (
            <div className="rounded-2xl bg-surface-primary shadow-sm p-5">
              <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">Action required</h3>
              <div className="space-y-2">
                {pendingBookings.length > 0 && (
                  <Link
                    href="/client/bookings"
                    className="flex items-center justify-between min-h-[44px] rounded-xl bg-status-warning-bg px-4 py-2.5 hover:opacity-90 transition"
                  >
                    <span className="text-sm font-semibold text-status-warning-text">
                      {pendingBookings.length} booking{pendingBookings.length !== 1 ? 's' : ''} pending confirmation
                    </span>
                    <ChevronRight className="h-4 w-4 text-status-warning-text" />
                  </Link>
                )}
                {threadCount !== null && threadCount > 0 && (
                  <Link
                    href="/client/messages"
                    className="flex items-center justify-between min-h-[44px] rounded-xl bg-surface-secondary px-4 py-2.5 hover:bg-surface-tertiary transition"
                  >
                    <span className="text-sm font-medium text-text-primary">
                      {threadCount} message thread{threadCount !== 1 ? 's' : ''}
                    </span>
                    <ChevronRight className="h-4 w-4 text-text-tertiary" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ─── Upcoming Visits ────────────────────────────────── */}
          {upcomingBookings.length > 1 && (
            <div className="rounded-2xl bg-surface-primary shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Upcoming visits</h3>
                <Link href="/client/bookings" className="text-xs font-semibold text-accent-primary hover:underline">All bookings &rarr;</Link>
              </div>
              <div className="divide-y divide-border-muted">
                {upcomingBookings.slice(1, 4).map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 px-5 py-3.5 min-h-[48px] cursor-pointer hover:bg-surface-secondary transition-colors"
                    onClick={() => router.push(`/client/bookings/${b.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && router.push(`/client/bookings/${b.id}`)}
                  >
                    <div className="w-16 shrink-0">
                      <p className="text-sm font-semibold tabular-nums text-text-primary">{formatTime(b.startAt)}</p>
                      <p className="text-[11px] text-text-tertiary tabular-nums">{formatShortDate(b.startAt)}</p>
                    </div>
                    <span className={`shrink-0 h-2.5 w-2.5 rounded-full ${statusDotClass(b.status)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary truncate">{formatServiceName(b.service)}</p>
                      {b.sitterName && <p className="text-xs text-text-secondary truncate">{b.sitterName}</p>}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-text-tertiary">{statusLabel(b.status)}</span>
                  </div>
                ))}
                {upcomingBookings.length > 4 && (
                  <Link
                    href="/client/bookings"
                    className="flex items-center justify-center px-5 py-3.5 min-h-[44px] text-sm font-semibold text-accent-primary hover:bg-surface-secondary transition-colors"
                  >
                    +{upcomingBookings.length - 4} more &mdash; view all bookings
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ─── Latest Report ──────────────────────────────────── */}
          {data.latestReport && <LatestReportCard report={data.latestReport} />}

          {/* ─── Quick Rebook ──────────────────────────────────── */}
          <QuickRebookCard />

          {/* ─── Quick Access ──────────────────────────────────── */}
          <div>
            <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">Quick access</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/client/bookings/new" className="flex flex-col gap-1.5 rounded-2xl bg-surface-primary shadow-sm p-4 min-h-[88px] hover:shadow-md transition">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-secondary">
                  <Plus className="h-4.5 w-4.5 text-accent-primary" />
                </div>
                <span className="text-sm font-semibold text-text-primary">Book a visit</span>
                <span className="text-[11px] text-text-tertiary leading-tight">Schedule pet care</span>
              </Link>
              <Link href="/client/pets" className="flex flex-col gap-1.5 rounded-2xl bg-surface-primary shadow-sm p-4 min-h-[88px] hover:shadow-md transition">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-secondary">
                  <PawPrint className="h-4.5 w-4.5 text-accent-primary" />
                </div>
                <span className="text-sm font-semibold text-text-primary">My pets</span>
                <span className="text-[11px] text-text-tertiary leading-tight">Profiles and info</span>
              </Link>
              <Link href="/client/messages" className="flex flex-col gap-1.5 rounded-2xl bg-surface-primary shadow-sm p-4 min-h-[88px] hover:shadow-md transition">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-secondary">
                  <MessageCircle className="h-4.5 w-4.5 text-accent-primary" />
                </div>
                <span className="text-sm font-semibold text-text-primary">Messages</span>
                <span className="text-[11px] text-text-tertiary leading-tight">Chat with your sitter</span>
              </Link>
              <Link href="/client/billing" className="flex flex-col gap-1.5 rounded-2xl bg-surface-primary shadow-sm p-4 min-h-[88px] hover:shadow-md transition">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-secondary">
                  <CreditCard className="h-4.5 w-4.5 text-accent-primary" />
                </div>
                <span className="text-sm font-semibold text-text-primary">Billing</span>
                <span className="text-[11px] text-text-tertiary leading-tight">Invoices and payments</span>
              </Link>
            </div>
          </div>

        </div>
      ) : null}
    </LayoutWrapper>
  );
}

function ClientPriorityHero({
  firstName,
  nextVisit,
  pendingBookingsCount,
  hasOutstandingBalance,
  onboardingRemaining,
}: {
  firstName: string;
  nextVisit: any;
  pendingBookingsCount: number;
  hasOutstandingBalance: boolean;
  onboardingRemaining: string[];
}) {
  const topMessage = nextVisit
    ? 'Your next visit is lined up. Check updates, messages, and reports here.'
    : onboardingRemaining.length > 0
      ? 'Finish a few setup details before your first booking.'
      : 'Book care any time and keep everything in one place.';

  return (
    <div className="rounded-3xl border border-border-default bg-surface-primary p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="inline-flex rounded-full bg-accent-tertiary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-primary">
          Client care hub
        </span>
        {pendingBookingsCount > 0 && (
          <span className="inline-flex rounded-full bg-status-warning-bg px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-status-warning-text">
            {pendingBookingsCount} pending
          </span>
        )}
        {hasOutstandingBalance && (
          <span className="inline-flex rounded-full bg-status-danger-bg px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-status-danger-text">
            Billing attention
          </span>
        )}
      </div>
      <h2 className="text-2xl font-bold text-text-primary">
        {nextVisit ? `Everything for ${firstName}'s care is here` : `Welcome, ${firstName}`}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-text-secondary">
        {topMessage}
      </p>
      {onboardingRemaining.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onboardingRemaining.slice(0, 3).map((item) => (
            <span
              key={item}
              className="inline-flex rounded-xl border border-border-default bg-surface-secondary px-3 py-2 text-xs font-medium text-text-primary"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Latest Report Card ────────────────────────────────────────────── */

function LatestReportCard({ report }: {
  report: { id: string; content: string; createdAt: string; service?: string; mediaUrls?: string | null };
}) {
  const router = useRouter();
  const reportPhotoUrl = (() => {
    if (!report.mediaUrls) return null;
    try {
      const parsed = typeof report.mediaUrls === 'string' ? JSON.parse(report.mediaUrls) : report.mediaUrls;
      return Array.isArray(parsed) && typeof parsed[0] === 'string' ? parsed[0] : null;
    } catch { return null; }
  })();

  return (
    <div
      className="rounded-2xl bg-surface-primary overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition"
      onClick={() => router.push(`/client/reports/${report.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/client/reports/${report.id}`)}
    >
      {reportPhotoUrl && (
        <img src={reportPhotoUrl} alt="Visit photo" className="w-full h-[180px] object-cover" loading="lazy" />
      )}
      <div className="p-5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Latest report</p>
          <Link href="/client/reports" onClick={(e) => e.stopPropagation()} className="text-xs font-medium text-accent-primary hover:underline">
            All reports
          </Link>
        </div>
        <h3 className="text-base font-semibold text-text-primary">{report.service ? formatServiceName(report.service) : 'Update'}</h3>
        <p className="text-sm text-text-secondary mt-1 leading-relaxed line-clamp-2">
          {renderClientPreview(report.content)}
        </p>
        <p className="text-xs text-text-tertiary mt-2 tabular-nums">
          {new Date(report.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

/* ─── Quick Rebook Card ────────────────────────────────────────────── */

function QuickRebookCard() {
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ['client', 'quick-rebook'],
    queryFn: async () => {
      const res = await fetch('/api/client/quick-rebook');
      return res.ok ? res.json() : null;
    },
    staleTime: 300000,
  });

  if (!data?.canQuickRebook || !data.lastBooking) return null;

  return (
    <div className="rounded-2xl bg-surface-primary p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Quick rebook</p>
      <h3 className="text-base font-semibold text-text-primary">
        {formatServiceName(data.suggestedService || data.lastBooking.service)}
      </h3>
      {data.suggestedSitter && (
        <p className="text-sm text-text-secondary mt-0.5">with {data.suggestedSitter.name}</p>
      )}
      <p className="text-sm text-text-tertiary mt-0.5">Based on your booking history</p>
      <div className="mt-4">
        <Button variant="primary" size="md" onClick={() => router.push(`/client/bookings/new?rebookFrom=${data.lastBooking.id}`)}>Book again</Button>
      </div>
    </div>
  );
}

/* ─── Skeleton ──────────────────────────────────────────────────────── */

function ClientHomeSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div>
        <div className="h-7 w-52 rounded bg-surface-tertiary" />
        <div className="mt-2 h-4 w-36 rounded bg-surface-tertiary" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-primary shadow-sm p-4">
            <div className="h-3 w-14 rounded bg-surface-tertiary" />
            <div className="mt-3 h-8 w-10 rounded bg-surface-tertiary" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-primary shadow-sm p-5">
        <div className="h-3 w-16 rounded bg-surface-tertiary mb-3" />
        <div className="h-6 w-40 rounded bg-surface-tertiary" />
        <div className="mt-2 h-4 w-32 rounded bg-surface-tertiary" />
      </div>
      <div className="rounded-2xl bg-surface-primary shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <div className="h-3 w-24 rounded bg-surface-tertiary" />
        </div>
        {[1, 2, 3].map((j) => (
          <div key={j} className="flex items-center gap-3 px-5 py-3.5">
            <div className="h-4 w-14 rounded bg-surface-tertiary" />
            <div className="h-2.5 w-2.5 rounded-full bg-surface-tertiary" />
            <div className="flex-1 h-4 rounded bg-surface-tertiary" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-primary shadow-sm p-4 min-h-[88px]">
            <div className="h-9 w-9 rounded-xl bg-surface-tertiary" />
            <div className="mt-2 h-4 w-20 rounded bg-surface-tertiary" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Page Export ────────────────────────────────────────────────────── */

export default function ClientHomePage() {
  return (
    <Suspense fallback={
      <LayoutWrapper variant="narrow">
        <ClientHomeSkeleton />
      </LayoutWrapper>
    }>
      <ClientHomeContent />
    </Suspense>
  );
}
