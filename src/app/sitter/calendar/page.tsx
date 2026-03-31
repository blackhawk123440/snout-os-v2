'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, PawPrint, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  SitterCard,
  SitterCardBody,
  SitterPageHeader,
  SitterSkeletonList,
  SitterErrorState,
  SitterEmptyState,
} from '@/components/sitter';
import { statusBlockClass, statusDotClass } from '@/lib/status-colors';
import { formatServiceName } from '@/lib/format-utils';
import { useSitterCalendar, useSitterGoogleEvents } from '@/lib/api/sitter-portal-hooks';

/* ─── Types ─────────────────────────────────────────────────────────── */

type ViewMode = 'day' | 'week' | 'list';

interface CalendarBooking {
  id: string;
  status: string;
  service: string;
  startAt: string;
  endAt: string;
  address: string | null;
  clientName: string;
  pets: Array<{ id: string; name?: string | null; species?: string | null }>;
  threadId: string | null;
}

interface GoogleEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  source: 'google';
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

const DAY_START = 6;
const DAY_END = 21;
const TOTAL_MINUTES = (DAY_END - DAY_START) * 60;

function getBlockPosition(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  const topPct = Math.max(0, ((startMin - DAY_START * 60) / TOTAL_MINUTES) * 100);
  const heightPct = Math.max(3, ((endMin - startMin) / TOTAL_MINUTES) * 100);
  return { top: `${topPct}%`, height: `${heightPct}%` };
}

const formatTime = (d: string) =>
  new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const formatDateLabel = (d: Date) =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isSameDay = (a: Date, b: Date) => isoDate(a) === isoDate(b);
const isToday = (d: Date) => isSameDay(d, new Date());

const PetIcon = ({ species }: { species: string | null }) => (
  <PawPrint className="inline-block w-3 h-3 text-text-tertiary mr-0.5" />
);

/* ─── Main Page ─────────────────────────────────────────────────────── */

export default function SitterCalendarPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: calData, isLoading: loading, error, refetch } = useSitterCalendar();
  const bookings: CalendarBooking[] = calData?.bookings || [];
  const googleConnected = calData?.calendarConnected ?? calData?.connected ?? false;

  const weekStartDate = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);
  const weekEndDate = useMemo(() => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekStartDate]);
  const weekStart = weekStartDate.toISOString();
  const weekEnd = weekEndDate.toISOString();

  const { data: googleData } = useSitterGoogleEvents(weekStart, weekEnd);
  const googleEvents: GoogleEvent[] = googleData?.events || [];

  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    const active = bookings.filter((b) => !['cancelled', 'completed'].includes(b.status));
    const sorted = [...active].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    for (let i = 0; i < sorted.length - 1; i++) {
      if (new Date(sorted[i].endAt).getTime() > new Date(sorted[i + 1].startAt).getTime()) {
        ids.add(sorted[i].id);
        ids.add(sorted[i + 1].id);
      }
    }
    return ids;
  }, [bookings]);

  const navigateDate = (offset: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + offset);
    setCurrentDate(d);
  };
  const goToday = () => setCurrentDate(new Date());

  const bookingsForDay = (date: Date) => bookings.filter((b) => isSameDay(new Date(b.startAt), date));
  const googleForDay = (date: Date) => googleEvents.filter((e) => !e.allDay && isSameDay(new Date(e.start), date));

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    if (viewMode === 'week') start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  }, [currentDate, viewMode]);

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <SitterPageHeader title="Calendar" subtitle={formatDateLabel(currentDate)} action={<Button variant="secondary" size="sm" onClick={() => void refetch()} disabled={loading}>Refresh</Button>} />

      {/* Google Calendar connection */}
      {!googleConnected && (
        <SitterCard className="mb-4 border-status-info-border bg-status-info-bg">
          <SitterCardBody>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-status-info-text">Connect Google Calendar</p>
                <p className="text-xs text-status-info-text">See all your events and auto-sync Snout visits.</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API route triggers OAuth redirect, not client navigation */}
              <a href="/api/integrations/google/start?returnUrl=/sitter/calendar" className="min-h-[44px] inline-flex items-center rounded-lg bg-accent-primary px-4 text-sm font-semibold text-text-inverse hover:opacity-90 transition">Connect</a>
            </div>
          </SitterCardBody>
        </SitterCard>
      )}
      {googleConnected && (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-text-tertiary"><span className="h-2 w-2 rounded-full bg-status-success-fill" /> Google Calendar synced</p>
      )}

      {/* View mode + navigation */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-xl border border-border-default p-0.5">
          {(['day', 'week', 'list'] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => setViewMode(mode)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition min-h-[44px] ${viewMode === mode ? 'bg-surface-tertiary text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => navigateDate(viewMode === 'week' ? -7 : -1)} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border-default text-text-secondary hover:bg-surface-secondary transition" aria-label="Previous"><ChevronLeft className="h-4 w-4" /></button>
          {!isToday(currentDate) && (<button type="button" onClick={goToday} className="min-h-[44px] rounded-lg border border-border-default px-3 text-xs font-medium text-text-secondary hover:bg-surface-secondary transition">Today</button>)}
          <button type="button" onClick={() => navigateDate(viewMode === 'week' ? 7 : 1)} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border-default text-text-secondary hover:bg-surface-secondary transition" aria-label="Next"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {loading ? (<SitterSkeletonList count={3} />) : error ? (<SitterErrorState title="Couldn't load calendar" subtitle={error instanceof Error ? error.message : String(error)} onRetry={() => void refetch()} />) : viewMode === 'list' ? (
        <ListView bookings={bookings} googleEvents={googleEvents} conflictIds={conflictIds} onView={(id) => router.push(`/sitter/bookings/${id}`)} />
      ) : viewMode === 'day' ? (
        <DayView date={currentDate} bookings={bookingsForDay(currentDate)} googleEvents={googleForDay(currentDate)} conflictIds={conflictIds} onView={(id) => router.push(`/sitter/bookings/${id}`)} />
      ) : (
        <WeekView days={weekDays} bookingsForDay={bookingsForDay} googleForDay={googleForDay} conflictIds={conflictIds} currentDate={currentDate} onView={(id) => router.push(`/sitter/bookings/${id}`)} />
      )}
    </div>
  );
}

/* ─── Day View ──────────────────────────────────────────────────────── */

function DayView({ date, bookings, googleEvents, conflictIds, onView }: { date: Date; bookings: CalendarBooking[]; googleEvents: GoogleEvent[]; conflictIds: Set<string>; onView: (id: string) => void }) {
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  return (
    <div className="relative rounded-xl border border-border-default bg-surface-primary overflow-hidden" style={{ minHeight: '600px' }}>
      {hours.map((h) => {
        const topPct = ((h - DAY_START) * 60 / TOTAL_MINUTES) * 100;
        return (<div key={h} className="absolute left-0 right-0 border-t border-border-muted" style={{ top: `${topPct}%` }}><span className="absolute -top-2.5 left-1 text-[10px] text-text-tertiary tabular-nums">{h > 12 ? h - 12 : h}{h >= 12 ? 'pm' : 'am'}</span></div>);
      })}
      {bookings.map((b) => {
        const pos = getBlockPosition(b.startAt, b.endAt);
        const hasConflict = conflictIds.has(b.id);
        return (
          <button key={b.id} type="button" onClick={() => onView(b.id)} className={`absolute left-10 right-2 rounded-lg border px-2 py-1 text-left overflow-hidden transition hover:opacity-90 min-h-[24px] ${statusBlockClass(b.status)} ${hasConflict ? 'ring-2 ring-status-danger-fill' : ''}`} style={{ top: pos.top, height: pos.height, zIndex: 10 }}>
            <p className="text-xs font-semibold text-text-primary truncate"><PetIcon species={b.pets?.[0]?.species ?? null} />{formatServiceName(b.service)}</p>
            <p className="text-[10px] text-text-secondary truncate">{formatTime(b.startAt)}\u2013{formatTime(b.endAt)} \u00b7 {b.clientName}</p>
            {hasConflict && <p className="text-[10px] text-status-danger-text font-medium flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> Conflict</p>}
          </button>
        );
      })}
      {googleEvents.map((e) => {
        const pos = getBlockPosition(e.start, e.end);
        return (
          <div key={e.id} className="absolute left-10 right-2 rounded-lg border border-border-muted bg-surface-tertiary/50 px-2 py-1 overflow-hidden min-h-[24px]" style={{ top: pos.top, height: pos.height, zIndex: 5 }}>
            <p className="text-xs text-text-tertiary truncate italic">{e.summary}</p>
            <p className="text-[10px] text-text-disabled truncate">{formatTime(e.start)}\u2013{formatTime(e.end)} (Personal)</p>
          </div>
        );
      })}
      {bookings.length === 0 && googleEvents.length === 0 && (<div className="flex items-center justify-center h-full"><p className="text-sm text-text-tertiary">No events for {formatDateLabel(date)}</p></div>)}
    </div>
  );
}

/* ─── Week View ─────────────────────────────────────────────────────── */

function WeekView({ days, bookingsForDay, googleForDay, conflictIds, currentDate, onView }: { days: Date[]; bookingsForDay: (d: Date) => CalendarBooking[]; googleForDay: (d: Date) => GoogleEvent[]; conflictIds: Set<string>; currentDate: Date; onView: (id: string) => void }) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const dayBookings = bookingsForDay(day);
        const dayGoogle = googleForDay(day);
        const today = isToday(day);
        return (
          <div key={isoDate(day)} className={`rounded-lg border p-1.5 min-h-[120px] ${today ? 'border-accent-primary bg-accent-tertiary/20' : 'border-border-default bg-surface-primary'}`}>
            <p className={`text-xs font-medium mb-1 ${today ? 'text-accent-primary' : 'text-text-secondary'}`}>{day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}</p>
            <div className="space-y-0.5">
              {dayBookings.map((b) => (
                <button key={b.id} type="button" onClick={() => onView(b.id)} className={`w-full rounded px-1 py-0.5 text-left ${statusBlockClass(b.status)} ${conflictIds.has(b.id) ? 'ring-1 ring-status-danger-fill' : ''}`}>
                  <p className="text-[10px] text-text-primary font-medium truncate">{formatTime(b.startAt)} {formatServiceName(b.service)}</p>
                </button>
              ))}
              {dayGoogle.map((e) => (
                <div key={e.id} className="rounded bg-surface-tertiary/50 px-1 py-0.5 text-[10px] text-text-tertiary truncate italic">{formatTime(e.start)} {e.summary}</div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── List View ─────────────────────────────────────────────────────── */

function ListView({ bookings, googleEvents, conflictIds, onView }: { bookings: CalendarBooking[]; googleEvents: GoogleEvent[]; conflictIds: Set<string>; onView: (id: string) => void }) {
  if (bookings.length === 0 && googleEvents.length === 0) return <SitterEmptyState title="No upcoming events" subtitle="Check back when you have visits scheduled." />;
  return (
    <div className="space-y-2">
      {bookings.map((b) => (
        <button key={b.id} type="button" onClick={() => onView(b.id)} className={`w-full rounded-xl border bg-surface-primary px-4 py-3 text-left transition hover:bg-surface-secondary min-h-[44px] ${conflictIds.has(b.id) ? 'border-status-danger-border' : 'border-border-default'}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary">{b.clientName}</p>
              <p className="text-xs text-text-secondary">{formatServiceName(b.service)} \u00b7 {formatTime(b.startAt)}\u2013{formatTime(b.endAt)}</p>
              {b.pets?.length > 0 && <p className="text-xs text-text-tertiary">{b.pets.map((p) => p.name || p.species || 'Pet').join(', ')}</p>}
              {conflictIds.has(b.id) && <p className="text-xs font-medium text-status-danger-text flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Schedule conflict</p>}
            </div>
            <span className={`shrink-0 h-2.5 w-2.5 rounded-full mt-1.5 ${statusDotClass(b.status)}`} />
          </div>
        </button>
      ))}
      {googleEvents.map((e) => (
        <div key={e.id} className="rounded-xl border border-border-muted bg-surface-tertiary/30 px-4 py-3">
          <p className="text-sm text-text-tertiary italic">{e.summary}</p>
          <p className="text-xs text-text-disabled">{formatTime(e.start)}\u2013{formatTime(e.end)} (Personal)</p>
        </div>
      ))}
    </div>
  );
}
