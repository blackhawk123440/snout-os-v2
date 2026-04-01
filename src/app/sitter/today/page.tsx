'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MapPin, RefreshCw, Clock, CalendarCheck, TrendingUp, ChevronRight, AlertTriangle, Navigation, UtensilsCrossed, Pill, PawPrint,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { statusBadgeClass, statusLabel } from '@/lib/status-colors';
import { formatServiceName } from '@/lib/format-utils';
import { toastSuccess, toastError, toastWarning } from '@/lib/toast';
import { useAuth } from '@/lib/auth-client';
import { useOffline } from '@/hooks/useOffline';
import { useSSE } from '@/hooks/useSSE';
import { usePageVisible } from '@/hooks/usePageVisible';
import { saveTodayVisits, getTodayVisits } from '@/lib/offline';
import { enqueueAction } from '@/lib/offline';
import {
  SitterCard,
  SitterCardHeader,
  SitterCardBody,
  SitterCardActions,
  SitterPageHeader,
  SitterSkeletonList,
  SitterErrorState,
  VisitTimerDisplay,
} from '@/components/sitter';
import { OnboardingChecklist } from '@/components/app/OnboardingChecklist';
import { RouteMap } from '@/components/sitter/RouteMap';
import {
  getShowCancelledFromQuery,
  groupTodayVisits,
  normalizeTodayBooking,
  pickNextUpVisit,
  type TodayVisitLike,
} from './today-helpers';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'in_progress' | string;

interface TodayBooking extends TodayVisitLike {
  id: string;
  status: BookingStatus;
  service: string;
  startAt: string;
  endAt: string;
  address: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  clientName: string;
  pets: Array<{ id: string; name?: string | null; species?: string | null }>;
  threadId: string | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  clientPhone?: string | null;
  hasReport?: boolean;
  latestReportId?: string | null;
  mapLink?: { apple: string; google: string } | null;
}

function useCountdown(targetDate: string | null): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();
    const tick = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setText('Started');
        return;
      }
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      if (hrs >= 1) setText(`Starts in ${hrs}h ${mins % 60}m`);
      else if (mins >= 1) setText(`Starts in ${mins} min`);
      else setText('Starts in <1 min');
    };
    tick();
    const intervalMs = 60000; // every minute when <1hr
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [targetDate]);
  return text;
}

// Use shared statusLabel for consistent vocabulary across portals
const statusPillLabel = statusLabel;

function OnMyWayButton({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const handleSend = async () => {
    if (state !== 'idle') return;
    setState('sending');
    try {
      const res = await fetch(`/api/sitter/bookings/${bookingId}/on-my-way`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      setState('sent');
    } catch {
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <Button variant="secondary" size="sm" disabled>
        <Navigation className="h-3.5 w-3.5 mr-1" /> Sent!
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => void handleSend()}
      disabled={state === 'sending'}
    >
      <Navigation className="h-3.5 w-3.5 mr-1" />
      {state === 'sending' ? 'Sending…' : 'On my way'}
    </Button>
  );
}

/** Visit execution flow: Start → In progress → End → Write report */
const getStatusSubtitle = (booking: TodayBooking) => {
  const start = new Date(booking.startAt);
  const end = new Date(booking.endAt);
  const timeStr = `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (['pending', 'confirmed'].includes(booking.status)) return `Starts ${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (booking.status === 'in_progress') return `In progress · ${timeStr}`;
  if (booking.status === 'completed') return `Completed · ${timeStr}`;
  return timeStr;
};

function NextVisitHero({
  booking,
  onCheckIn,
  onCheckOut,
  onMessage,
  onRunningLate,
  checkingInId,
  checkingOutId,
  nowMs,
}: {
  booking: TodayBooking;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
  onMessage: (b: TodayBooking) => void;
  onRunningLate: (id: string) => void;
  checkingInId: string | null;
  checkingOutId: string | null;
  nowMs: number;
}) {
  const router = useRouter();
  const countdown = useCountdown(
    ['pending', 'confirmed'].includes(booking.status) ? booking.startAt : null
  );
  const addressSnippet = booking.address
    ? booking.address.split(',')[0].trim().slice(0, 40) + (booking.address.length > 40 ? '…' : '')
    : null;

  const petNames = booking.pets.length > 0
    ? booking.pets.map((p) => p.name || p.species || 'Pet').join(', ')
    : '—';

  return (
    <SitterCard className="mb-4 border-2 border-status-info-border bg-status-info-bg">
      <SitterCardHeader>
        <p className="text-xs font-medium uppercase tracking-wide text-status-info-text">Next up</p>
        {countdown && (
          <p className="mt-1 text-sm font-semibold text-status-info-text">{countdown}</p>
        )}
          <div className="mt-2 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tabular-nums text-text-primary">
              {formatTimeRange(booking.startAt, booking.endAt)}
            </p>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-text-tertiary">
              {getStatusSubtitle(booking)}
            </p>
            <VisitTimerDisplay
              status={booking.status}
              checkedInAt={booking.checkedInAt}
              checkedOutAt={booking.checkedOutAt}
              nowMs={nowMs}
              className="mt-0.5"
            />
            <p className="mt-0.5 font-medium text-text-primary">{formatServiceName(booking.service)}</p>
            <p className="text-sm text-text-secondary">{petNames}</p>
            <p className="text-sm text-text-tertiary">{booking.clientName}</p>
            {addressSnippet && (
              <p className="mt-0.5 truncate text-xs text-text-tertiary" title={booking.address ?? undefined}>
                {addressSnippet}
              </p>
            )}
          </div>
          {booking.pets.length > 0 && (
            <div className="flex -space-x-2 shrink-0">
              {booking.pets.slice(0, 3).map((pet) => (
                <div
                  key={pet.id}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-status-warning-bg text-sm font-medium text-status-warning-text"
                  title={pet.name || pet.species || 'Pet'}
                >
                  {(pet.name || pet.species || '?').charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          )}
        </div>
      </SitterCardHeader>
      <SitterCardActions>
        {['pending', 'confirmed'].includes(booking.status) && (
          <>
            {booking.status === 'confirmed' && (() => {
              const startMs = new Date(booking.startAt).getTime();
              const nowMs = Date.now();
              const minsUntilStart = (startMs - nowMs) / 60000;
              const showOnMyWay = minsUntilStart <= 90 && minsUntilStart > -30;
              if (!showOnMyWay) return null;
              return (
                <OnMyWayButton bookingId={booking.id} />
              );
            })()}
            <Button
              variant="primary"
              size="md"
              onClick={() => void onCheckIn(booking.id)}
              disabled={checkingInId === booking.id}
            >
              {checkingInId === booking.id ? 'Saving…' : 'Start visit'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRunningLate(booking.id)}
            >
              Running late
            </Button>
          </>
        )}
        {booking.status === 'in_progress' && (
          <Button
            variant="primary"
            size="md"
            onClick={() => void onCheckOut(booking.id)}
            disabled={checkingOutId === booking.id}
          >
            {checkingOutId === booking.id ? 'Saving…' : 'End visit'}
          </Button>
        )}
        {booking.status === 'completed' && (
          booking.hasReport && booking.latestReportId
            ? (
              <Button variant="primary" size="md" onClick={() => router.push(`/sitter/reports/edit/${booking.latestReportId}`)}>
                View report
              </Button>
            )
            : (
              <Button variant="primary" size="md" onClick={() => router.push(`/sitter/reports/new?bookingId=${booking.id}`)}>
                Write report
              </Button>
            )
        )}
        <Button variant="secondary" size="sm" onClick={() => onMessage(booking)}>
          Message
        </Button>
        <span className="inline-flex min-h-[40px] items-center rounded-lg border border-border-strong bg-surface-primary px-3 text-sm font-medium text-text-secondary">
          Client calls are routed through office
        </span>
        {booking.mapLink?.google && (
          <a href={booking.mapLink.google} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center rounded-lg border border-border-strong bg-surface-primary px-3 text-sm font-medium text-text-secondary">
            Directions
          </a>
        )}
        <Button variant="secondary" size="sm" onClick={() => router.push(`/sitter/bookings/${booking.id}`)}>
          Details
        </Button>
      </SitterCardActions>
    </SitterCard>
  );
}

function QuickInsightsStrip({
  visitsRemaining,
  totalVisits,
  completedCount,
}: {
  visitsRemaining: number;
  totalVisits: number;
  completedCount: number;
}) {
  return (
    <div className="mb-4 grid grid-cols-3 gap-3">
      <div className="rounded-xl bg-accent-tertiary px-4 py-3">
        <div className="flex items-center gap-1.5 mb-1">
          <CalendarCheck className="w-3.5 h-3.5 text-text-disabled" />
          <span className="text-[11px] font-semibold text-accent-primary tracking-wider uppercase">Remaining</span>
        </div>
        <span className="font-heading text-xl font-bold text-text-primary tabular-nums">{visitsRemaining}</span>
        <span className="text-xs text-text-tertiary ml-1">of {totalVisits}</span>
      </div>
      <div className="rounded-xl bg-surface-secondary px-4 py-3">
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingUp className="w-3.5 h-3.5 text-text-disabled" />
          <span className="text-[11px] text-text-tertiary tracking-wide uppercase">Completed</span>
        </div>
        <span className="font-heading text-xl font-bold text-text-primary tabular-nums">{completedCount}</span>
        <span className="text-xs text-text-tertiary ml-1">visits</span>
      </div>
      <div className="rounded-xl bg-surface-secondary px-4 py-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Clock className="w-3.5 h-3.5 text-text-disabled" />
          <span className="text-[11px] text-text-tertiary tracking-wide uppercase">Progress</span>
        </div>
        <span className={`text-sm font-semibold ${visitsRemaining === 0 && totalVisits > 0 ? 'text-status-success-text' : 'text-text-primary'}`}>
          {totalVisits === 0 ? 'No visits' : visitsRemaining === 0 ? 'All done' : `${visitsRemaining} left`}
        </span>
      </div>
    </div>
  );
}

function PetQuickView({ petId, petName }: { petId: string; petName: string }) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<{ feedingInstructions?: string | null; medicationNotes?: string | null; behaviorNotes?: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (data) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sitter/pets/${petId}`);
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  };

  return (
    <span className="inline" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={toggle}
        className="inline min-h-[44px] text-sm text-accent-primary hover:underline font-medium"
        aria-label={`View care info for ${petName}`}
      >
        {petName}
      </button>
      {expanded && (
        <div className="mt-1 mb-2 rounded-lg border border-border-default bg-surface-secondary p-3 text-left" onClick={(e) => e.stopPropagation()}>
          {loading ? (
            <p className="text-xs text-text-tertiary">Loading care info...</p>
          ) : data ? (
            <div className="space-y-1.5">
              {data.feedingInstructions && (
                <div><p className="text-xs font-medium text-text-tertiary flex items-center gap-1"><UtensilsCrossed className="w-3 h-3" /> Feeding</p><p className="text-sm text-text-secondary">{data.feedingInstructions}</p></div>
              )}
              {data.medicationNotes && (
                <div><p className="text-xs font-medium text-text-tertiary flex items-center gap-1"><Pill className="w-3 h-3" /> Medications</p><p className="text-sm text-text-secondary">{data.medicationNotes}</p></div>
              )}
              {data.behaviorNotes && (
                <div><p className="text-xs font-medium text-text-tertiary flex items-center gap-1"><PawPrint className="w-3 h-3" /> Behavior</p><p className="text-sm text-text-secondary">{data.behaviorNotes}</p></div>
              )}
              {!data.feedingInstructions && !data.medicationNotes && !data.behaviorNotes && (
                <p className="text-xs text-text-tertiary italic">No care details saved.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-text-tertiary">Could not load care info.</p>
          )}
        </div>
      )}
    </span>
  );
}

function VisitCard({
  booking,
  nowMs,
  checkingInId,
  checkingOutId,
  onCheckIn,
  onCheckOut,
  onMessage,
}: {
  booking: TodayBooking;
  nowMs: number;
  checkingInId: string | null;
  checkingOutId: string | null;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
  onMessage: (b: TodayBooking) => void;
}) {
  const router = useRouter();

  const runPrimary = () => {
    if (['pending', 'confirmed'].includes(booking.status)) return onCheckIn(booking.id);
    if (booking.status === 'in_progress') return onCheckOut(booking.id);
    if (booking.status === 'completed') {
      if (booking.hasReport && booking.latestReportId) {
        router.push(`/sitter/reports/edit/${booking.latestReportId}`);
      } else {
        router.push(`/sitter/reports/new?bookingId=${booking.id}`);
      }
      return;
    }
    router.push(`/sitter/bookings/${booking.id}`);
  };

  return (
    <SitterCard key={booking.id} onClick={() => router.push(`/sitter/bookings/${booking.id}`)}>
      <SitterCardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tabular-nums text-text-primary">
              {formatTimeRange(booking.startAt, booking.endAt)}
            </p>
            <p className="font-medium text-text-primary">{formatServiceName(booking.service)}</p>
            <p className="text-sm text-text-secondary">
              {booking.pets.length > 0
                ? booking.pets.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ', '}
                      <PetQuickView petId={p.id} petName={p.name || p.species || 'Pet'} />
                    </span>
                  ))
                : '\u2014'}
            </p>
            <p className="text-sm text-text-tertiary">{booking.clientName}</p>
            <VisitTimerDisplay
              status={booking.status}
              checkedInAt={booking.checkedInAt}
              checkedOutAt={booking.checkedOutAt}
              nowMs={nowMs}
              className="mt-0.5"
            />
            {booking.pickupAddress && (
              <p className="mt-0.5 text-xs text-text-tertiary"><span className="font-medium">Pickup:</span> {booking.pickupAddress}</p>
            )}
            {booking.dropoffAddress && (
              <p className="mt-0.5 text-xs text-text-tertiary"><span className="font-medium">Dropoff:</span> {booking.dropoffAddress}</p>
            )}
            {!booking.pickupAddress && !booking.dropoffAddress && booking.address && booking.address.length <= 60 && (
              <p className="mt-0.5 truncate text-xs text-text-tertiary" title={booking.address}>{booking.address}</p>
            )}
          </div>
          <div className="flex shrink-0 items-start">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(booking.status)}`}>
              {statusPillLabel(booking.status)}
            </span>
          </div>
        </div>
      </SitterCardHeader>
      <SitterCardActions stopPropagation>
        <Button
          variant="primary"
          size="md"
          className="h-10 w-full"
          onClick={() => runPrimary()}
          disabled={checkingInId === booking.id || checkingOutId === booking.id}
        >
          {checkingInId === booking.id || checkingOutId === booking.id ? 'Saving…' : getPrimaryActionLabel(booking)}
        </Button>
        <div className="flex w-full flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => onMessage(booking)}>
            Message
          </Button>
          {booking.status === 'in_progress' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/sitter/bookings/${booking.id}?emergency=true`)}
              className="border-status-danger-border text-status-danger-text hover:bg-status-danger-bg"
            >
              Emergency
            </Button>
          )}
          {/* Multi-day daily update prompt */}
          {booking.status === 'in_progress' && (() => {
            const startMs = new Date(booking.startAt).getTime();
            const endMs = new Date(booking.endAt).getTime();
            const isMultiDay = endMs - startMs > 24 * 60 * 60 * 1000;
            if (!isMultiDay) return null;
            const dayNumber = Math.floor((Date.now() - startMs) / (24 * 60 * 60 * 1000)) + 1;
            const totalDays = Math.ceil((endMs - startMs) / (24 * 60 * 60 * 1000));
            return (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push(`/sitter/reports/new?bookingId=${booking.id}&postCheckout=true`)}
              >
                Daily update (Day {dayNumber}/{totalDays})
              </Button>
            );
          })()}
          <span className="inline-flex min-h-[36px] items-center rounded-lg border border-border-strong bg-surface-primary px-3 text-xs font-medium text-text-secondary">
            Office handles calls
          </span>
          {booking.mapLink?.google && (
            <a href={booking.mapLink.google} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[36px] items-center rounded-lg border border-border-strong bg-surface-primary px-3 text-xs font-medium text-text-secondary">
              Navigate
            </a>
          )}
        </div>
      </SitterCardActions>
    </SitterCard>
  );
}

const formatTimeRange = (startAt: string, endAt: string) => {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
};

const getPrimaryActionLabel = (booking: TodayBooking) => {
  if (['pending', 'confirmed'].includes(booking.status)) return 'Start';
  if (booking.status === 'in_progress') return 'End';
  if (booking.status === 'completed') return booking.hasReport ? 'View report' : 'Write report';
  return 'View details';
};

const TODAY_KEY = () => new Date().toISOString().slice(0, 10);

export default function SitterTodayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { isOnline, refreshQueuedCount } = useOffline();
  const [bookings, setBookings] = useState<TodayBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const showCancelled = getShowCancelledFromQuery(searchParams.get('showCancelled'));

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }),
    []
  );

  const loadBookings = useCallback(async (opts?: { preserveScroll?: boolean }) => {
    const preserveScroll = !!opts?.preserveScroll;
    const prevScrollY = preserveScroll && typeof window !== 'undefined' ? window.scrollY : null;
    setLoading(true);
    setLoadError(null);
    const dateKey = TODAY_KEY();
    try {
      if (navigator.onLine) {
        const res = await fetch('/api/sitter/today');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const cached = await getTodayVisits(dateKey);
          if (cached && Array.isArray((cached as { bookings?: unknown[] }).bookings)) {
            setBookings(((cached as { bookings: unknown[] }).bookings || []).map((item) => normalizeTodayBooking(item) as TodayBooking));
            setLoadError(null);
          } else {
            setLoadError(data.error || 'Unable to load today\'s bookings');
            setBookings([]);
          }
          return;
        }
        const list = Array.isArray(data.bookings) ? data.bookings.map((item: unknown) => normalizeTodayBooking(item)) : [];
        setBookings(list);
        await saveTodayVisits(dateKey, { bookings: list });
      } else {
        const cached = await getTodayVisits(dateKey);
        if (cached && Array.isArray((cached as { bookings?: unknown[] }).bookings)) {
          setBookings(((cached as { bookings: unknown[] }).bookings || []).map((item) => normalizeTodayBooking(item) as TodayBooking));
        } else {
          setLoadError('Offline — no cached data. Connect to load.');
          setBookings([]);
        }
      }
    } catch {
      const cached = await getTodayVisits(dateKey);
      if (cached && Array.isArray((cached as { bookings?: unknown[] }).bookings)) {
        setBookings(((cached as { bookings: unknown[] }).bookings || []).map((item) => normalizeTodayBooking(item) as TodayBooking));
      } else {
        setLoadError('Unable to load today\'s bookings');
        setBookings([]);
      }
    } finally {
      setLoading(false);
      if (prevScrollY != null && typeof window !== 'undefined') {
        requestAnimationFrame(() => window.scrollTo(0, prevScrollY));
      }
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const sseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/realtime/sitter/today` : null;
  const pageVisible = usePageVisible();
  useSSE(sseUrl, () => void loadBookings({ preserveScroll: true }), pageVisible);

  const getGeo = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });

  const handleCheckIn = async (bookingId: string) => {
    setCheckingInId(bookingId);
    const orgId = user?.orgId || 'default';
    const sitterId = user?.sitterId || '';
    try {
      const geo = await getGeo();
      if (!geo && navigator.onLine) {
        toastWarning("Couldn't get location — continuing without it.");
      }
      const payload = geo ? { lat: geo.lat, lng: geo.lng } : {};
      if (!navigator.onLine) {
        await enqueueAction('visit.checkin', { orgId, sitterId, bookingId, payload });
        const nowIso = new Date().toISOString();
        setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'in_progress', checkedInAt: nowIso } : b)));
        toastSuccess('Queued — will sync when online');
        void refreshQueuedCount();
        return;
      }
      const res = await fetch(`/api/bookings/${bookingId}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(data.error || 'Check in failed');
        setCheckingInId(null);
        return;
      }
      const nowIso = new Date().toISOString();
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'in_progress', checkedInAt: nowIso } : b)));
      toastSuccess('Checked in');
      void loadBookings();
    } catch {
      toastError('Check in failed');
      void loadBookings();
    } finally {
      setCheckingInId(null);
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    setCheckingOutId(bookingId);
    const orgId = user?.orgId || 'default';
    const sitterId = user?.sitterId || '';
    try {
      const geo = await getGeo();
      if (!geo && navigator.onLine) {
        toastWarning("Couldn't get location — continuing without it.");
      }
      const payload = geo ? { lat: geo.lat, lng: geo.lng } : {};
      if (!navigator.onLine) {
        await enqueueAction('visit.checkout', { orgId, sitterId, bookingId, payload });
        const nowIso = new Date().toISOString();
        setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'completed', checkedOutAt: nowIso } : b)));
        toastSuccess('Queued — will sync when online');
        void refreshQueuedCount();
        return;
      }
      const res = await fetch(`/api/bookings/${bookingId}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(data.error || 'Check out failed');
        setCheckingOutId(null);
        return;
      }
      const nowIso = new Date().toISOString();
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'completed', checkedOutAt: nowIso } : b)));
      toastSuccess('Visit ended — write your report');
      router.push(`/sitter/reports/new?bookingId=${bookingId}&postCheckout=true`);
    } catch {
      toastError('Check out failed');
      void loadBookings();
    } finally {
      setCheckingOutId(null);
    }
  };

  const handleOpenChat = (booking: TodayBooking) => {
    const query = booking.threadId ? `?thread=${encodeURIComponent(booking.threadId)}` : '';
    router.push(`/sitter/inbox${query}`);
  };

  const [lateBookingId, setLateBookingId] = useState<string | null>(null);
  const [lateMinutes, setLateMinutes] = useState(15);
  const [lateSending, setLateSending] = useState(false);

  const handleRunningLate = (bookingId: string) => {
    setLateBookingId(bookingId);
    setLateMinutes(15);
  };

  const handleSendLate = async () => {
    if (!lateBookingId) return;
    setLateSending(true);
    try {
      const res = await fetch('/api/sitter/running-late', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: lateBookingId, delayMinutes: lateMinutes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toastSuccess(`Notified — new ETA: ${data.etaDisplay}`);
      setLateBookingId(null);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setLateSending(false);
    }
  };

  const toggleShowCancelled = () => {
    const next = !showCancelled;
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('showCancelled', '1');
    else params.delete('showCancelled');
    router.replace(`/sitter/today${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const [routeUrl, setRouteUrl] = useState<string | null>(null);
  useEffect(() => {
    if (bookings.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      fetch(`/api/sitter/route?date=${today}`)
        .then((r) => r.json())
        .then((d) => setRouteUrl(d.googleMapsUrl || null))
        .catch(() => setRouteUrl(null));
    } else {
      setRouteUrl(null);
    }
  }, [bookings.length]);

  const sections = useMemo(() => groupTodayVisits(bookings, showCancelled), [bookings, showCancelled]);
  const nextUp = useMemo(() => pickNextUpVisit(bookings, showCancelled), [bookings, showCancelled]);

  return (
    <>
      <div className="mx-auto max-w-3xl pb-8">
        <div className="mb-6">
          <OnboardingChecklist />
        </div>
        <SitterPageHeader
          title="Today"
          subtitle={`${todayLabel} · You have ${bookings.length} ${bookings.length === 1 ? 'visit' : 'visits'}`}
          action={
            <div className="flex gap-2">
              {routeUrl && (
                <a
                  href={routeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-border-strong bg-surface-primary px-3 text-sm font-medium text-text-secondary transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-border-focus"
                >
                  <MapPin className="w-3.5 h-3.5 mr-1.5" />
                  Open in Maps
                </a>
              )}
              <Button variant="secondary" size="sm" onClick={() => void loadBookings()} disabled={loading}>
                Refresh
              </Button>
            </div>
          }
        />
        {!loading && (
          <TodayWorkHero
            upcomingCount={sections.upNext.length + sections.laterToday.length}
            inProgressCount={sections.inProgress.length}
            completedCount={sections.completed.length}
            nextVisit={nextUp}
          />
        )}
        {!loading && nextUp && (
          <>
            <NextVisitHero
              booking={nextUp}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
              onMessage={handleOpenChat}
              onRunningLate={handleRunningLate}
              checkingInId={checkingInId}
              checkingOutId={checkingOutId}
              nowMs={nowMs}
            />
            <QuickInsightsStrip
              visitsRemaining={bookings.filter((b) => !['completed', 'cancelled'].includes(b.status)).length}
              totalVisits={bookings.length}
              completedCount={bookings.filter((b) => b.status === 'completed').length}
            />
          </>
        )}

        {/* Route map visualization */}
        {!loading && bookings.length > 1 && (
          <div className="mb-4">
            <RouteMap showShare />
          </div>
        )}

        {loading ? (
          <SitterSkeletonList count={3} />
        ) : loadError ? (
          <SitterErrorState
            title="Couldn't load visits"
            subtitle={loadError}
            onRetry={() => void loadBookings()}
          />
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl bg-accent-tertiary p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary shadow-sm mb-5">
              <CalendarCheck className="h-7 w-7 text-text-inverse" />
            </div>
            <p className="text-xl font-bold text-text-primary">You're all set</p>
            <p className="mt-2 text-sm text-text-secondary max-w-[300px] mx-auto leading-relaxed">No visits scheduled for today. Check your calendar for upcoming assignments or update your availability.</p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <Button variant="primary" size="md" onClick={() => router.push('/sitter/calendar')}>
                View calendar
              </Button>
              <Button variant="secondary" size="md" onClick={() => router.push('/sitter/availability')}>
                Update availability
              </Button>
            </div>
            {/* Secondary context for empty days */}
            <div className="mt-4 rounded-2xl bg-surface-primary shadow-sm p-5">
              <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">While you're off</h3>
              <div className="space-y-3">
                <button type="button" onClick={() => router.push('/sitter/reports')} className="flex items-center gap-3 w-full text-left min-h-[44px] rounded-xl bg-surface-secondary px-4 py-2.5 hover:bg-surface-tertiary transition">
                  <span className="text-sm font-medium text-text-primary">Catch up on reports</span>
                  <ChevronRight className="h-4 w-4 text-text-tertiary ml-auto" />
                </button>
                <button type="button" onClick={() => router.push('/sitter/performance')} className="flex items-center gap-3 w-full text-left min-h-[44px] rounded-xl bg-surface-secondary px-4 py-2.5 hover:bg-surface-tertiary transition">
                  <span className="text-sm font-medium text-text-primary">Review your performance</span>
                  <ChevronRight className="h-4 w-4 text-text-tertiary ml-auto" />
                </button>
                <button type="button" onClick={() => router.push('/sitter/training')} className="flex items-center gap-3 w-full text-left min-h-[44px] rounded-xl bg-surface-secondary px-4 py-2.5 hover:bg-surface-tertiary transition">
                  <span className="text-sm font-medium text-text-primary">Continue training</span>
                  <ChevronRight className="h-4 w-4 text-text-tertiary ml-auto" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Today's visits</h2>
              <button
                type="button"
                onClick={toggleShowCancelled}
                className="rounded-lg border border-border-strong bg-surface-primary px-3 py-1.5 text-xs font-medium text-text-secondary"
              >
                {showCancelled ? 'Hide cancelled' : 'Show cancelled'}
              </button>
            </div>

            {sections.inProgress.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">In progress</h3>
                  <span className="text-xs text-text-tertiary">{sections.inProgress.length}</span>
                </div>
                {sections.inProgress.map((booking) => (
                  <VisitCard
                    key={booking.id}
                    booking={booking}
                    nowMs={nowMs}
                    checkingInId={checkingInId}
                    checkingOutId={checkingOutId}
                    onCheckIn={handleCheckIn}
                    onCheckOut={handleCheckOut}
                    onMessage={handleOpenChat}
                  />
                ))}
              </section>
            )}

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Up next</h3>
                <span className="text-xs text-text-tertiary">{sections.upNext.length}</span>
              </div>
              {sections.upNext.length === 0 ? (
                <SitterCard><SitterCardBody><p className="text-sm text-text-tertiary">No upcoming visits in this section.</p></SitterCardBody></SitterCard>
              ) : (
                sections.upNext.map((booking) => (
                  <VisitCard
                    key={booking.id}
                    booking={booking}
                    nowMs={nowMs}
                    checkingInId={checkingInId}
                    checkingOutId={checkingOutId}
                    onCheckIn={handleCheckIn}
                    onCheckOut={handleCheckOut}
                    onMessage={handleOpenChat}
                  />
                ))
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Later today</h3>
                <span className="text-xs text-text-tertiary">{sections.laterToday.length}</span>
              </div>
              {sections.laterToday.map((booking) => (
                <VisitCard
                  key={booking.id}
                  booking={booking}
                  nowMs={nowMs}
                  checkingInId={checkingInId}
                  checkingOutId={checkingOutId}
                  onCheckIn={handleCheckIn}
                  onCheckOut={handleCheckOut}
                  onMessage={handleOpenChat}
                />
              ))}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Completed today</h3>
                <span className="text-xs text-text-tertiary">{sections.completed.length}</span>
              </div>
              {sections.completed.map((booking) => (
                <VisitCard
                  key={booking.id}
                  booking={booking}
                  nowMs={nowMs}
                  checkingInId={checkingInId}
                  checkingOutId={checkingOutId}
                  onCheckIn={handleCheckIn}
                  onCheckOut={handleCheckOut}
                  onMessage={handleOpenChat}
                />
              ))}
            </section>
          </div>
        )}
      </div>

      {/* Running late quick picker */}
      {lateBookingId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => !lateSending && setLateBookingId(null)}>
          <div
            className="w-full max-w-lg rounded-t-2xl bg-surface-primary p-5 pb-8 shadow-xl animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-status-warning-text" />
              <h3 className="text-lg font-semibold text-text-primary">Running late</h3>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              How late will you be? We&apos;ll notify the client and your manager.
            </p>
            <div className="flex gap-2 mb-4">
              {[10, 15, 20, 30].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setLateMinutes(mins)}
                  className={`flex-1 min-h-[44px] rounded-xl border text-sm font-semibold transition-colors ${
                    lateMinutes === mins
                      ? 'border-accent-primary bg-accent-tertiary text-accent-primary'
                      : 'border-border-default bg-surface-primary text-text-secondary hover:border-border-hover'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" size="md" className="flex-1" onClick={() => setLateBookingId(null)} disabled={lateSending}>
                Cancel
              </Button>
              <Button variant="primary" size="md" className="flex-1" onClick={handleSendLate} isLoading={lateSending}>
                Notify
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TodayWorkHero({
  upcomingCount,
  inProgressCount,
  completedCount,
  nextVisit,
}: {
  upcomingCount: number;
  inProgressCount: number;
  completedCount: number;
  nextVisit: TodayBooking | null;
}) {
  const summary = inProgressCount > 0
    ? 'You have active visits underway. Keep updates tight, timing clean, and reports ready when each visit ends.'
    : nextVisit
      ? 'Your next visit is queued up below with the details you need to start smoothly.'
      : upcomingCount === 0 && completedCount === 0
        ? 'No visits are on the board right now. This is a good time to confirm your schedule or check tomorrow.'
        : 'Your current visits are complete. Review reports or messages before you sign off for the day.';

  return (
    <div className="mb-4 rounded-3xl border border-border-default bg-surface-primary p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full bg-accent-tertiary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-primary">
          Workday view
        </span>
      </div>
      <h2 className="text-2xl font-bold text-text-primary">
        {inProgressCount > 0 ? 'Focus on the visits in motion' : nextVisit ? 'Everything you need for the next stop' : 'Your day is under control'}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-text-secondary">
        {summary}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border-default bg-surface-secondary p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Upcoming</p>
          <p className="mt-1 text-lg font-bold text-text-primary tabular-nums">{upcomingCount}</p>
        </div>
        <div className="rounded-2xl border border-border-default bg-surface-secondary p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">In progress</p>
          <p className="mt-1 text-lg font-bold text-text-primary tabular-nums">{inProgressCount}</p>
        </div>
        <div className="rounded-2xl border border-border-default bg-surface-secondary p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Completed</p>
          <p className="mt-1 text-lg font-bold text-text-primary tabular-nums">{completedCount}</p>
        </div>
      </div>
    </div>
  );
}
