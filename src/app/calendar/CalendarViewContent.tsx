/**
 * Calendar View Content - UI Constitution V1 Phase 4
 *
 * Extracted from page.tsx for reuse as an embeddable calendar component.
 * Zero ad hoc styling. Zero violations.
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Filter, Search, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Grid,
  GridCol,
  Panel,
  Button,
  IconButton,
  Tabs,
  DataTable,
  CardList,
  Skeleton,
  EmptyState,
  Flex,
  useToast,
} from '@/components/ui';
import { CommandLauncher } from '@/components/command';
import { Command, CommandResult } from '@/commands/types';
import { useCommands } from '@/hooks/useCommands';
import { useMobile } from '@/lib/use-mobile';
import { PageHeader, Section } from '@/components/layout';
import { AppErrorState, AppFilterBar, AppDrawer } from '@/components/app';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { createCalendarEventCommands } from '@/commands/calendar-commands';
import { registerCommand } from '@/commands/registry';
import { CalendarGrid } from './CalendarGrid';
import { detectCalendarSignals } from '@/lib/resonance';
import { formatServiceName } from '@/lib/format-utils';

interface Booking {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  address?: string;
  service: string;
  startAt: string | Date;
  endAt: string | Date;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  totalPrice: number;
  paymentStatus?: 'paid' | 'unpaid' | 'partial';
  pets?: Array<{ species: string; name?: string }>;
  sitter?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  timeSlots?: Array<{
    id?: string;
    startAt: string | Date;
    endAt: string | Date;
  }>;
  locationZone?: string;
}

type CalendarView = 'day' | 'week' | 'month';

/** Service-based color coding for booking cards */
function getServiceColor(service: string): { bg: string; border: string; text: string } {
  const s = service.toLowerCase();
  if (s.includes('walk')) return { bg: 'var(--color-status-info-bg)', border: 'var(--color-status-info-border)', text: 'var(--color-status-info-text)' };
  if (s.includes('drop') || s.includes('visit')) return { bg: 'var(--color-status-success-bg)', border: 'var(--color-status-success-border)', text: 'var(--color-status-success-text)' };
  if (s.includes('house') || s.includes('sitting') || s.includes('24/7')) return { bg: 'var(--color-status-purple-bg)', border: 'var(--color-status-purple-border)', text: 'var(--color-status-purple-text)' };
  if (s.includes('taxi') || s.includes('transport')) return { bg: 'var(--color-status-warning-bg)', border: 'var(--color-status-warning-border)', text: 'var(--color-status-warning-text)' };
  return { bg: 'var(--color-status-info-bg)', border: 'var(--color-status-info-border)', text: 'var(--color-status-info-text)' };
}

export function CalendarViewContent({ hideHeader = false }: { hideHeader?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMobile();
  const { showToast } = useToast();
  const { context: commandContext } = useCommands();
  const { open: openCommandPalette } = useCommandPalette();

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showBookingDrawer, setShowBookingDrawer] = useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  const [viewMode, setViewMode] = useState<CalendarView>('month');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    service: 'all',
    status: 'all',
    sitter: 'all',
    locationZone: 'all',
    paid: 'all',
    completed: 'all',
    unpaid: 'all',
    conflicts: 'all',
  });

  // Feature flags
  const ENABLE_CALENDAR_V1 = process.env.NEXT_PUBLIC_ENABLE_CALENDAR_V1 === 'true';
  const ENABLE_RESONANCE_V1 = process.env.NEXT_PUBLIC_ENABLE_RESONANCE_V1 === 'true';

  // Listen for calendar command events
  useEffect(() => {
    const handleJumpToday = () => {
      setCurrentDate(new Date());
      setSelectedDate(new Date());
    };
    const handleNextPeriod = () => {
      const next = new Date(currentDate);
      if (viewMode === 'month') {
        next.setMonth(next.getMonth() + 1);
      } else if (viewMode === 'week') {
        next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + 1);
      }
      setCurrentDate(next);
    };
    const handlePrevPeriod = () => {
      const prev = new Date(currentDate);
      if (viewMode === 'month') {
        prev.setMonth(prev.getMonth() - 1);
      } else if (viewMode === 'week') {
        prev.setDate(prev.getDate() - 7);
      } else {
        prev.setDate(prev.getDate() - 1);
      }
      setCurrentDate(prev);
    };

    window.addEventListener('calendar-jump-today', handleJumpToday);
    window.addEventListener('calendar-next-period', handleNextPeriod);
    window.addEventListener('calendar-prev-period', handlePrevPeriod);

    return () => {
      window.removeEventListener('calendar-jump-today', handleJumpToday);
      window.removeEventListener('calendar-next-period', handleNextPeriod);
      window.removeEventListener('calendar-prev-period', handlePrevPeriod);
    };
  }, [currentDate, viewMode]);

  // Load view preference and URL params (e.g. ?conflicts=show_only from command center)
  useEffect(() => {
    const conflictsParam = searchParams.get('conflicts');
    if (conflictsParam === 'show_only' || conflictsParam === 'hide') {
      setFilterValues((prev) => ({ ...prev, conflicts: conflictsParam }));
    }
  }, [searchParams]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('calendar-view') as CalendarView;
      if (saved && ['day', 'week', 'month'].includes(saved)) {
        setViewMode(saved);
      }
    }
  }, []);

  // Keyboard shortcuts for calendar navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = new Date(currentDate);
        if (viewMode === 'month') prev.setMonth(prev.getMonth() - 1);
        else if (viewMode === 'week') prev.setDate(prev.getDate() - 7);
        else prev.setDate(prev.getDate() - 1);
        setCurrentDate(prev);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = new Date(currentDate);
        if (viewMode === 'month') next.setMonth(next.getMonth() + 1);
        else if (viewMode === 'week') next.setDate(next.getDate() + 7);
        else next.setDate(next.getDate() + 1);
        setCurrentDate(next);
      } else if (e.key === 't' && !e.metaKey && !e.ctrlKey) {
        // 't' for Today
        setCurrentDate(new Date());
        setSelectedDate(new Date());
      } else if (e.key === 'd' && !e.metaKey && !e.ctrlKey) {
        setViewMode('day');
      } else if (e.key === 'w' && !e.metaKey && !e.ctrlKey) {
        setViewMode('week');
      } else if (e.key === 'm' && !e.metaKey && !e.ctrlKey) {
        setViewMode('month');
      } else if (e.key === 'Escape') {
        setShowBookingDrawer(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDate, viewMode]);

  // Save view preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('calendar-view', viewMode);
    }
  }, [viewMode]);

  // Compute week start for query key
  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  }, [currentDate]);

  // Fetch data via TanStack Query
  const { data: calData, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['owner', 'calendar', weekStart],
    queryFn: async () => {
      if (!ENABLE_CALENDAR_V1) {
        // Use mock data when feature flag is off
        return {
          bookings: [] as Booking[],
          sitters: [] as Array<{ id: string; firstName: string; lastName: string }>,
          conflictBookingIds: new Set<string>(),
        };
      }

      const [bookingsRes, sittersRes, conflictsRes] = await Promise.all([
        fetch('/api/bookings?page=1&pageSize=200').catch(() => null),
        fetch('/api/sitters?page=1&pageSize=200').catch(() => null),
        fetch('/api/bookings/conflicts').catch(() => null),
      ]);

      let bookings: Booking[] = [];
      if (bookingsRes?.ok) {
        const data = await bookingsRes.json();
        bookings = data.items || [];
      } else if (bookingsRes && !bookingsRes.ok && bookingsRes.status !== 404) {
        throw new Error('Failed to fetch bookings');
      }

      let sitters: Array<{ id: string; firstName: string; lastName: string }> = [];
      if (sittersRes?.ok) {
        const data = await sittersRes.json();
        sitters = Array.isArray(data?.items) ? data.items : [];
      }

      let conflictBookingIds = new Set<string>();
      if (conflictsRes?.ok) {
        const data = await conflictsRes.json();
        conflictBookingIds = new Set(data.conflictBookingIds || []);
      }

      return { bookings, sitters, conflictBookingIds };
    },
  });

  const bookings = calData?.bookings ?? [];
  const sitters = calData?.sitters ?? [];
  const conflictBookingIds = calData?.conflictBookingIds ?? new Set<string>();

  const filteredBookings = useMemo(() => {
    const svc = filterValues.service ?? 'all';
    const st = filterValues.status ?? 'all';
    const sit = filterValues.sitter ?? 'all';
    const loc = filterValues.locationZone ?? 'all';
    const paid = filterValues.paid ?? 'all';
    const completed = filterValues.completed ?? 'all';
    const unpaid = filterValues.unpaid ?? 'all';
    const conflictsFilter = filterValues.conflicts ?? 'all';
    return bookings.filter((booking) => {
      if (svc !== 'all' && booking.service !== svc) return false;
      if (st !== 'all' && booking.status !== st) return false;
      if (sit !== 'all' && booking.sitter?.id !== sit) return false;
      if (loc !== 'all' && booking.locationZone !== loc) return false;
      if (paid !== 'all' && booking.paymentStatus !== paid) return false;
      if (completed === 'hide' && booking.status === 'completed') return false;
      if (unpaid === 'hide' && booking.paymentStatus === 'unpaid') return false;
      const inConflict = conflictBookingIds.has(booking.id);
      if (conflictsFilter === 'show_only' && !inConflict) return false;
      if (conflictsFilter === 'hide' && inConflict) return false;
      return true;
    });
  }, [bookings, filterValues, conflictBookingIds]);

  // Get bookings for selected date/range
  const selectedBookings = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = selectedDate.toISOString().split('T')[0];
    return filteredBookings.filter((booking) => {
      const startAt = new Date(booking.startAt);
      const startDateStr = startAt.toISOString().split('T')[0];
      return startDateStr === dateStr;
    });
  }, [filteredBookings, selectedDate]);

  // Resonance: Detect calendar signals
  const calendarEvents = useMemo(() => {
    if (!ENABLE_RESONANCE_V1) return [];
    return filteredBookings.map(b => ({
      id: b.id,
      startAt: b.startAt,
      endAt: b.endAt,
      sitter: b.sitter,
    }));
  }, [filteredBookings, ENABLE_RESONANCE_V1]);

  const calendarSignals = useMemo(() => {
    if (!ENABLE_RESONANCE_V1) return [];
    return detectCalendarSignals(calendarEvents);
  }, [calendarEvents, ENABLE_RESONANCE_V1]);

  // Get signals for a specific booking (resonance + conflict overlay)
  const getEventSignals = useCallback((eventId: string) => {
    const base = ENABLE_RESONANCE_V1 ? calendarSignals.filter(s => s.entityId === eventId) : [];
    if (conflictBookingIds.has(eventId)) {
      return [...base, { id: 'conflict', severity: 'critical' as const, label: 'Schedule conflict' }];
    }
    return base;
  }, [calendarSignals, conflictBookingIds, ENABLE_RESONANCE_V1]);

  // Calendar days for month view
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    const lastDay = new Date(year, month + 1, 0);
    const lastDate = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0);
    const prevMonthLastDate = prevMonthLastDay.getDate();

    const days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean; bookings: Booking[] }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Previous month days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDate - i);
      date.setHours(0, 0, 0, 0);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        bookings: getBookingsForDate(date),
      });
    }

    // Current month days
    for (let day = 1; day <= lastDate; day++) {
      const date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        bookings: getBookingsForDate(date),
      });
    }

    // Next month days to fill week
    const remaining = 42 - days.length;
    for (let day = 1; day <= remaining; day++) {
      const date = new Date(year, month + 1, day);
      date.setHours(0, 0, 0, 0);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        bookings: getBookingsForDate(date),
      });
    }

    return days;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getBookingsForDate uses filteredBookings; adding causes unnecessary reruns
  }, [currentDate, filteredBookings]);

  function getBookingsForDate(date: Date): Booking[] {
    const dateStr = date.toISOString().split('T')[0];
    return filteredBookings.filter((booking) => {
      const startAt = new Date(booking.startAt);
      const startDateStr = startAt.toISOString().split('T')[0];
      return startDateStr === dateStr;
    });
  }

  // Day view: single day's bookings sorted by start time
  const dayViewBookings = useMemo(() => {
    const d = new Date(currentDate);
    d.setHours(0, 0, 0, 0);
    const dateStr = d.toISOString().split('T')[0];
    return filteredBookings
      .filter((b) => new Date(b.startAt).toISOString().split('T')[0] === dateStr)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [currentDate, filteredBookings]);

  // Week view: 7 days (Sun–Sat) containing currentDate, each with bookings
  const weekViewDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    const days: Array<{ date: Date; isToday: boolean; bookings: Booking[] }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      const dayBookings = filteredBookings.filter((b) => new Date(b.startAt).toISOString().split('T')[0] === dateStr);
      days.push({
        date,
        isToday: date.getTime() === today.getTime(),
        bookings: dayBookings.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
      });
    }
    return days;
  }, [currentDate, filteredBookings]);

  // Register event commands when booking selected
  useEffect(() => {
    if (selectedBooking) {
      const eventCommands = createCalendarEventCommands({
        bookingId: selectedBooking.id,
        clientId: selectedBooking.email ? 'client-' + selectedBooking.id : undefined,
        hasSitter: !!selectedBooking.sitter,
        isPaid: selectedBooking.paymentStatus === 'paid',
      });
      eventCommands.forEach(cmd => {
        try {
          registerCommand(cmd);
        } catch (error) {
          // Command may already be registered
        }
      });
    }
  }, [selectedBooking]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const periodLabel = useMemo(() => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (viewMode === 'week') {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return formatDate(currentDate);
  }, [viewMode, currentDate]);

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // In day view, keep Event List in sync with the single day shown
  useEffect(() => {
    if (viewMode === 'day') {
      setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
    }
  }, [viewMode, currentDate]);

  // Drag-drop reschedule handler
  const handleReschedule = useCallback(async (bookingId: string, newDate: Date) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const originalStart = new Date(booking.startAt);
    const originalEnd = new Date(booking.endAt);
    const durationMs = originalEnd.getTime() - originalStart.getTime();

    // Preserve the original time, just change the date
    const newStart = new Date(newDate);
    newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);

    const dateLabel = newStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    try {
      const res = await fetch(`/api/bookings/${bookingId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.conflict) {
          showToast({
            message: `Conflict: ${data.conflict.clientName} (${formatServiceName(data.conflict.service)}) already booked at that time`,
            variant: 'error',
          });
        } else {
          showToast({ message: data.error || 'Reschedule failed', variant: 'error' });
        }
        return;
      }

      showToast({
        message: `${booking.firstName} ${booking.lastName} moved to ${dateLabel}`,
        variant: 'success',
      });
      refetch();
    } catch (err) {
      showToast({ message: 'Network error', variant: 'error' });
    }
  }, [bookings, showToast, refetch]);

  // Day view: single day timeline list
  const renderDayView = () => {
    if (isLoading) {
      return (
        <div className="p-6">
          <Skeleton height="400px" />
        </div>
      );
    }
    if (queryError) {
      return <AppErrorState title="Couldn't load calendar" onRetry={refetch} />;
    }
    return (
      <div className="p-4">
        <div className="text-sm text-text-secondary mb-3">
          {dayViewBookings.length} {dayViewBookings.length === 1 ? 'booking' : 'bookings'}
        </div>
        {dayViewBookings.length === 0 ? (
          <EmptyState
            title="No bookings"
            description="No bookings scheduled for this day."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {dayViewBookings.map((booking) => {
              const inConflict = conflictBookingIds.has(booking.id);
              const svcColor = getServiceColor(booking.service);
              const sitterInitial = booking.sitter
                ? (booking.sitter.firstName || '?').charAt(0).toUpperCase()
                : '?';
              return (
                <div
                  key={booking.id}
                  className="p-3 rounded-md bg-surface-primary relative"
                  style={{
                    border: `1px solid ${inConflict ? 'var(--color-status-danger-border)' : svcColor.border}`,
                    borderLeft: `4px solid ${svcColor.border}`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBooking(booking);
                      setShowBookingDrawer(true);
                    }}
                    className="w-full text-left cursor-pointer bg-transparent border-none p-0"
                    onMouseEnter={(e) => {
                      e.currentTarget.closest('div')!.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--color-accent-secondary').trim();
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.closest('div')!.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--color-surface-primary').trim();
                    }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold">
                        {formatTime(booking.startAt)} – {formatTime(booking.endAt)}
                      </span>
                      {inConflict && (
                        <span className="text-error text-xs">
                          <AlertCircle className="inline h-3 w-3" /> Conflict
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Sitter avatar initial */}
                      <span
                        className="inline-flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          width: 28, height: 28, borderRadius: 14,
                          backgroundColor: svcColor.bg, color: svcColor.text,
                        }}
                      >
                        {sitterInitial}
                      </span>
                      <div>
                        <div className="text-text-primary">
                          {booking.firstName} {booking.lastName}
                        </div>
                        <div className="text-sm text-text-secondary">
                          {formatServiceName(booking.service)}
                          {booking.sitter ? ` · ${booking.sitter.firstName} ${booking.sitter.lastName}` : ' · Unassigned'}
                        </div>
                      </div>
                    </div>
                  </button>
                  <Button
                    variant="tertiary"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setSelectedBooking(booking);
                      setShowBookingDrawer(true);
                    }}
                  >
                    View details
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Week view: 7 columns, each day with its bookings
  const renderWeekView = () => {
    if (isLoading) {
      return (
        <div className="p-6">
          <Skeleton height="400px" />
        </div>
      );
    }
    if (queryError) {
      return <AppErrorState title="Couldn't load calendar" onRetry={refetch} />;
    }
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="grid grid-cols-7 gap-2 p-4" style={{ minHeight: 320 }}>
        {weekViewDays.map((day, colIndex) => (
          <div
            key={day.date.getTime()}
            className={`border border-border-default rounded-sm p-2 ${day.isToday ? 'bg-accent-secondary' : 'bg-surface-primary'}`}
          >
            <div
              className={`text-sm mb-2 ${day.isToday ? 'font-bold text-primary' : 'font-semibold text-text-secondary'}`}
            >
              {dayHeaders[colIndex]}
            </div>
            <div className="text-xs text-text-tertiary mb-2">
              {day.date.getDate()} {day.date.toLocaleDateString('en-US', { month: 'short' })}
            </div>
            <div className="flex flex-col gap-1">
              {day.bookings.length === 0 ? (
                <span className="text-xs text-text-tertiary">No bookings</span>
              ) : (
                day.bookings.map((booking) => {
                  const inConflict = conflictBookingIds.has(booking.id);
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => {
                        setSelectedBooking(booking);
                        setShowBookingDrawer(true);
                      }}
                      className="p-2 rounded-sm bg-surface-primary text-left cursor-pointer text-xs w-full"
                      style={{
                        border: `1px solid ${inConflict ? 'var(--color-status-danger-border)' : 'var(--color-border-default)'}`,
                      }}
                      title={`${booking.firstName} ${booking.lastName} · ${formatServiceName(booking.service)}${inConflict ? ' · Conflict' : ''}`}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--color-accent-secondary').trim();
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--color-surface-primary').trim();
                      }}
                    >
                      <div className="flex items-center gap-1">
                        {inConflict && <AlertCircle className="shrink-0 text-error" size={14} />}
                        <span className="font-medium">{formatTime(booking.startAt)}</span>
                      </div>
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                        {booking.firstName} {booking.lastName}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render calendar grid
  const renderCalendarGrid = () => {
    if (isLoading) {
      return (
        <div className="p-6">
          <Skeleton height="400px" />
        </div>
      );
    }

    if (queryError) {
      return (
        <AppErrorState title="Couldn't load calendar" onRetry={refetch} />
      );
    }

    return (
      <CalendarGrid
        days={calendarDays.map(day => ({
          ...day,
          bookings: day.bookings.map(booking => ({
            id: booking.id,
            firstName: booking.firstName,
            lastName: booking.lastName,
            service: booking.service,
            startAt: booking.startAt,
            endAt: booking.endAt,
            sitter: booking.sitter,
          })),
        }))}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          // If clicking same date twice, zoom into day view
          if (selectedDate && date.getTime() === selectedDate.getTime()) {
            setViewMode('day');
            setCurrentDate(date);
          }
          setSelectedDate(date);
        }}
        onEventClick={(booking) => {
          const fullBooking = bookings.find(b => b.id === booking.id);
          if (fullBooking) {
            setSelectedBooking(fullBooking);
            setShowBookingDrawer(true);
          }
        }}
        formatTime={formatTime}
        getEventSignals={getEventSignals}
        onReschedule={handleReschedule}
      />
    );
  };

  const calendarFilterBar = (
    <AppFilterBar
      filters={[
        { key: 'service', label: 'Service', type: 'select', options: [
          { value: 'all', label: 'All' }, { value: 'Dog Walking', label: 'Dog Walking' },
          { value: 'Drop-in Visit', label: 'Drop-in Visit' }, { value: 'Housesitting', label: 'Housesitting' },
          { value: '24/7 Care', label: '24/7 Care' },
        ]},
        { key: 'status', label: 'Status', type: 'select', options: [
          { value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' },
          { value: 'confirmed', label: 'Confirmed' }, { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
        ]},
        { key: 'sitter', label: 'Sitter', type: 'select', options: [
          { value: 'all', label: 'All' }, ...sitters.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` })),
        ]},
        { key: 'paid', label: 'Paid', type: 'select', options: [
          { value: 'all', label: 'All' }, { value: 'paid', label: 'Paid' },
          { value: 'unpaid', label: 'Unpaid' }, { value: 'partial', label: 'Partial' },
        ]},
        { key: 'completed', label: 'Completed', type: 'select', options: [
          { value: 'all', label: 'Show' }, { value: 'hide', label: 'Hide' },
        ]},
        { key: 'unpaid', label: 'Unpaid', type: 'select', options: [
          { value: 'all', label: 'Show' }, { value: 'hide', label: 'Hide' },
        ]},
        { key: 'conflicts', label: 'Conflicts', type: 'select', options: [
          { value: 'all', label: 'All' },
          { value: 'show_only', label: 'Show only conflicts' },
          { value: 'hide', label: 'Hide conflicts' },
        ]},
      ]}
      values={filterValues}
      onChange={(k, v) => setFilterValues((p) => ({ ...p, [k]: v }))}
      onClear={() => setFilterValues({
        service: 'all', status: 'all', sitter: 'all', locationZone: 'all',
        paid: 'all', completed: 'all', unpaid: 'all', conflicts: 'all',
      })}
    />
  );

  // Agenda summary
  const todayBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredBookings.filter(b => {
      const startAt = new Date(b.startAt);
      startAt.setHours(0, 0, 0, 0);
      return startAt.getTime() === today.getTime();
    });
  }, [filteredBookings]);

  const upcomingBookings = useMemo(() => {
    const now = new Date();
    return filteredBookings
      .filter(b => new Date(b.startAt) > now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 3);
  }, [filteredBookings]);

  // Command context for launcher
  const calendarCommandContext = useMemo(() => ({
    ...commandContext,
    currentRoute: '/calendar',
    selectedEntity: selectedBooking ? {
      type: 'booking' as const,
      id: selectedBooking.id,
      data: selectedBooking,
    } : null,
  }), [commandContext, selectedBooking]);

  return (
    <>
      {!hideHeader && (
        <PageHeader
          title="Calendar"
          subtitle={filteredBookings.length > 0 ? `${filteredBookings.length} booking${filteredBookings.length !== 1 ? 's' : ''} in view` : "Your team\u2019s schedule"}
          actions={
            <Flex align="center" gap={1.5}>
              {isMobile && (
                <IconButton
                  icon={<Filter size={16} />}
                  onClick={() => setShowFiltersDrawer(true)}
                  aria-label="Open filters"
                />
              )}
              <IconButton
                icon={<Search size={16} />}
                onClick={openCommandPalette}
                aria-label="Open command palette"
              />
              <Button size="sm" onClick={() => router.push('/bookings/new')}>
                New booking
              </Button>
            </Flex>
          }
        />
      )}

      {isLoading && bookings.length === 0 ? (
        <Section>
          <div className="py-4">
            <Skeleton height="600px" />
          </div>
        </Section>
      ) : queryError && bookings.length === 0 ? (
        <Section>
          <AppErrorState title="Couldn't load calendar" onRetry={refetch} />
        </Section>
      ) : (
        <Section>
        <Grid>
          <GridCol span={12}>
            <Panel>
              {/* Top bar: period nav + view tabs + Today */}
              <div className="p-3 border-b border-border-default">
                <Flex align="center" justify="space-between" wrap gap={3}>
                  <Flex align="center" gap={2}>
                    <IconButton
                      icon={<ChevronLeft size={16} />}
                      onClick={() => {
                        const prev = new Date(currentDate);
                        if (viewMode === 'month') prev.setMonth(prev.getMonth() - 1);
                        else if (viewMode === 'week') prev.setDate(prev.getDate() - 7);
                        else prev.setDate(prev.getDate() - 1);
                        setCurrentDate(prev);
                      }}
                      aria-label="Previous period"
                    />
                    <span
                      className="text-lg font-bold text-center"
                      style={{ minWidth: '180px' }}
                    >
                      {periodLabel}
                    </span>
                    <IconButton
                      icon={<ChevronRight size={16} />}
                      onClick={() => {
                        const next = new Date(currentDate);
                        if (viewMode === 'month') next.setMonth(next.getMonth() + 1);
                        else if (viewMode === 'week') next.setDate(next.getDate() + 7);
                        else next.setDate(next.getDate() + 1);
                        setCurrentDate(next);
                      }}
                      aria-label="Next period"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setCurrentDate(new Date());
                        setSelectedDate(new Date());
                      }}
                      className="ml-2"
                    >
                      Today
                    </Button>
                  </Flex>
                  <Flex align="center" gap={2}>
                    <Tabs
                      tabs={[
                        { id: 'day', label: 'Day' },
                        { id: 'week', label: 'Week' },
                        { id: 'month', label: 'Month' },
                      ]}
                      activeTab={viewMode}
                      onTabChange={(tabId: string) => setViewMode(tabId as CalendarView)}
                    >
                      <div />
                    </Tabs>
                  </Flex>
                </Flex>
              </div>

              {/* Filters in top bar (compact row) */}
              <div className="p-2 border-b border-border-default bg-surface-secondary">
                {isMobile ? (
                  <Flex align="center" gap={2}>
                    <Button variant="tertiary" size="sm" onClick={() => setShowFiltersDrawer(true)}>
                      <Filter size={14} className="mr-1 inline" />
                      Filters
                    </Button>
                  </Flex>
                ) : (
                  calendarFilterBar
                )}
              </div>

              {/* Today / Upcoming strip */}
              <div className="py-2 px-3 border-b border-border-default flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">
                  Today: <strong>{todayBookings.length}</strong> {todayBookings.length === 1 ? 'booking' : 'bookings'}
                </span>
                {upcomingBookings.length > 0 && (
                  <Flex gap={1} wrap>
                    {upcomingBookings.slice(0, 5).map((booking) => (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setShowBookingDrawer(true);
                        }}
                        className="py-0 px-2 text-xs border border-border-default rounded-sm bg-surface-primary cursor-pointer"
                      >
                        {formatTime(booking.startAt)} {booking.firstName}
                      </button>
                    ))}
                  </Flex>
                )}
              </div>

              {/* Calendar Body */}
              {viewMode === 'month' && renderCalendarGrid()}
              {viewMode === 'day' && renderDayView()}
              {viewMode === 'week' && renderWeekView()}
            </Panel>

            {/* Event List */}
            {selectedDate && (
              <div className="mt-4">
              <Panel>
                <div className="p-4">
                  <div className="text-lg font-bold mb-4">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>

                  {isMobile ? (
                    <CardList<Booking>
                      items={selectedBookings}
                      renderCard={(booking: Booking) => (
                        <div
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowBookingDrawer(true);
                          }}
                          className="p-4 border border-border-default rounded-md cursor-pointer"
                        >
                          <div className="font-semibold">
                            {formatTime(booking.startAt)} - {formatTime(booking.endAt)}
                          </div>
                          <div>{booking.firstName} {booking.lastName}</div>
                          <div className="text-sm text-text-secondary">
                            {formatServiceName(booking.service)}
                          </div>
                        </div>
                      )}
                      loading={isLoading}
                      emptyMessage="No bookings for this date"
                    />
                  ) : (
                    <DataTable
                      columns={[
                        { key: 'time', header: 'Time', render: (booking) => `${formatTime(booking.startAt)} - ${formatTime(booking.endAt)}` },
                        { key: 'client', header: 'Client', render: (booking) => `${booking.firstName} ${booking.lastName}` },
                        { key: 'service', header: 'Service', render: (booking) => booking.service },
                        { key: 'status', header: 'Status', render: (booking) => booking.status },
                      ]}
                      data={selectedBookings}
                      onRowClick={(booking) => {
                        setSelectedBooking(booking);
                        setShowBookingDrawer(true);
                      }}
                      loading={isLoading}
                      emptyMessage="No bookings for this date"
                    />
                  )}
                </div>
              </Panel>
              </div>
            )}
          </GridCol>
        </Grid>
        </Section>
      )}

      {isMobile && (
        <AppDrawer
          isOpen={showFiltersDrawer}
          onClose={() => setShowFiltersDrawer(false)}
          title="Filters"
          side="left"
        >
          <div className="p-4 space-y-4">
            <Tabs
              tabs={[
                { id: 'day', label: 'Day' },
                { id: 'week', label: 'Week' },
                { id: 'month', label: 'Month' },
              ]}
              activeTab={viewMode}
              onTabChange={(tabId: string) => setViewMode(tabId as CalendarView)}
            >
              <div />
            </Tabs>
            {calendarFilterBar}
          </div>
        </AppDrawer>
      )}

      <AppDrawer
        isOpen={showBookingDrawer}
        onClose={() => {
          setShowBookingDrawer(false);
          setSelectedBooking(null);
        }}
        title={selectedBooking ? `${selectedBooking.firstName} ${selectedBooking.lastName}` : 'Booking Details'}
      >
        {selectedBooking && (
          <div className="p-4">
            <Flex direction="column" gap={4}>
              <div>
                <div className="text-sm text-text-secondary mb-1">
                  Service
                </div>
                <div className="text-base font-semibold">
                  {formatServiceName(selectedBooking.service)}
                </div>
              </div>

              <div>
                <div className="text-sm text-text-secondary mb-1">
                  Time
                </div>
                <div className="text-base">
                  {formatTime(selectedBooking.startAt)} - {formatTime(selectedBooking.endAt)}
                </div>
              </div>

              <div>
                <div className="text-sm text-text-secondary mb-1">
                  Status
                </div>
                <div className="text-base">
                  {selectedBooking.status}
                </div>
              </div>

              {selectedBooking.sitter && (
                <div>
                  <div className="text-sm text-text-secondary mb-1">
                    Sitter
                  </div>
                  <div className="text-base">
                    {selectedBooking.sitter.firstName} {selectedBooking.sitter.lastName}
                  </div>
                </div>
              )}

              <div className="mt-4">
              <Flex direction="column" gap={2}>
                <CommandLauncher
                  context={calendarCommandContext}
                  maxSuggestions={3}
                  onCommandSelect={(command) => {
                    command.execute(calendarCommandContext).then(result => {
                      if (result.status === 'success') {
                        showToast({ variant: 'success', message: result.message || 'Command executed' });
                        if (result.redirect) {
                          router.push(result.redirect);
                        }
                      } else {
                        showToast({ variant: 'error', message: result.message || 'Command failed' });
                      }
                    });
                  }}
                />
              </Flex>
              </div>
            </Flex>
          </div>
        )}
      </AppDrawer>
    </>
  );
}
