'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui';
import { AppErrorState } from '@/components/app';
import { getServiceColor } from './ServiceColors';
import {
  toDateString,
  todayString,
  formatTime,
  formatServiceName,
  formatDateLabel,
} from './calendar-utils';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface Booking {
  id: string;
  firstName: string;
  lastName: string;
  service: string;
  startAt: string;
  endAt: string;
  status: string;
  totalPrice: number;
  paymentStatus: string;
  sitter?: { id: string; firstName: string; lastName: string } | null;
}

interface BookingsResponse {
  items: Booking[];
  total: number;
}

interface ConflictsResponse {
  conflictBookingIds: string[];
}

interface DayCell {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  bookings: Booking[];
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function MonthGrid({
  currentMonth,
  onMonthChange,
  onDayClick,
}: {
  currentMonth: Date;
  onMonthChange: (month: Date) => void;
  onDayClick: (date: Date) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const today = todayString();

  /* ── Data fetching ─────────────────────────────────────────────────── */

  const {
    data: bookingsData,
    isLoading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings,
  } = useQuery<BookingsResponse>({
    queryKey: ['bookings', 'month-grid'],
    queryFn: async () => {
      const res = await fetch('/api/bookings?page=1&pageSize=500');
      if (!res.ok) throw new Error('Failed to load bookings');
      return res.json();
    },
  });

  const {
    data: conflictsData,
    isLoading: conflictsLoading,
    error: conflictsError,
    refetch: refetchConflicts,
  } = useQuery<ConflictsResponse>({
    queryKey: ['bookings', 'conflicts'],
    queryFn: async () => {
      const res = await fetch('/api/bookings/conflicts');
      if (!res.ok) throw new Error('Failed to load conflicts');
      return res.json();
    },
  });

  const isLoading = bookingsLoading || conflictsLoading;
  const error = bookingsError || conflictsError;

  const conflictIds = useMemo(
    () => new Set(conflictsData?.conflictBookingIds ?? []),
    [conflictsData],
  );

  /* ── Build month grid ──────────────────────────────────────────────── */

  const days: DayCell[] = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Pad start to Sunday
    const startPad = firstDay.getDay(); // 0 = Sun
    const gridStart = new Date(year, month, 1 - startPad);

    // Build 42 cells (6 weeks)
    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const dateStr = toDateString(d);

      cells.push({
        date: d,
        dateStr,
        isCurrentMonth: d.getMonth() === month && d.getFullYear() === year,
        isToday: dateStr === today,
        bookings: [],
      });
    }

    // Bucket bookings into cells
    if (bookingsData?.items) {
      const cellMap = new Map<string, DayCell>();
      for (const cell of cells) {
        cellMap.set(cell.dateStr, cell);
      }

      for (const booking of bookingsData.items) {
        const bookingDate = toDateString(new Date(booking.startAt));
        const cell = cellMap.get(bookingDate);
        if (cell) {
          cell.bookings.push(booking);
        }
      }
    }

    return cells;
  }, [currentMonth, bookingsData, today]);

  /* ── Derived data for selected day panel ───────────────────────────── */

  const selectedDayCell = useMemo(() => {
    if (!selectedDate) return null;
    return days.find((d) => d.dateStr === selectedDate) ?? null;
  }, [selectedDate, days]);

  /* ── Handlers ──────────────────────────────────────────────────────── */

  function handleDayClick(cell: DayCell) {
    if (selectedDate === cell.dateStr) {
      // Second click on same day: switch to Day view
      onDayClick(cell.date);
    } else {
      setSelectedDate(cell.dateStr);
    }
  }

  /* ── Loading / Error states ────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton height="500px" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <AppErrorState
          title="Couldn't load calendar"
          message={(error as Error).message}
          onRetry={() => {
            refetchBookings();
            refetchConflicts();
          }}
        />
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────────────────────── */

  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7">
        {dayHeaders.map((d) => (
          <div
            key={d}
            className="text-xs font-semibold text-text-tertiary text-center py-2"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7">
        {days.map((cell, idx) => {
          const count = cell.bookings.length;
          const isSelected = selectedDate === cell.dateStr;
          const revenue = cell.bookings.reduce(
            (sum, b) => sum + (b.totalPrice ?? 0),
            0,
          );
          const hasConflict = cell.bookings.some((b) => conflictIds.has(b.id));
          const hasUnassigned = cell.bookings.some(
            (b) => !b.sitter,
          );

          return (
            <div
              key={idx}
              onClick={() => handleDayClick(cell)}
              className={`
                relative min-h-[100px] border-b border-r border-border-muted p-1.5
                cursor-pointer transition hover:bg-surface-secondary
                ${!cell.isCurrentMonth ? 'opacity-40' : ''}
                ${cell.isToday ? 'ring-2 ring-accent-primary ring-inset' : ''}
                ${isSelected ? 'bg-accent-secondary' : ''}
              `}
            >
              {/* Top row: day number + count badge */}
              <div className="flex items-start justify-between">
                <span
                  className={`text-sm ${
                    cell.isToday
                      ? 'font-bold text-text-primary'
                      : 'font-medium text-text-primary'
                  }`}
                >
                  {cell.date.getDate()}
                </span>

                <div className="flex items-center gap-1">
                  {/* Conflict dot */}
                  {hasConflict && (
                    <span className="block w-1.5 h-1.5 rounded-full bg-status-danger-fill" />
                  )}

                  {/* Unassigned dot */}
                  {hasUnassigned && (
                    <span className="block w-1.5 h-1.5 rounded-full bg-status-warning-fill" />
                  )}

                  {/* Count badge */}
                  {count > 0 && (
                    <span
                      className={`text-[10px] leading-none font-medium px-1.5 py-0.5 rounded-full ${
                        count > 8
                          ? 'bg-status-danger-bg text-status-danger-text'
                          : count >= 5
                            ? 'bg-status-warning-bg text-status-warning-text'
                            : 'bg-surface-tertiary text-text-secondary'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </div>
              </div>

              {/* Booking pills (up to 2) */}
              <div className="mt-1 flex flex-col gap-0.5">
                {cell.bookings.slice(0, 2).map((booking) => {
                  const color = getServiceColor(booking.service);
                  return (
                    <div
                      key={booking.id}
                      className="text-[10px] px-1.5 py-0.5 rounded-sm bg-surface-secondary overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ borderLeft: `2px solid ${color.border}` }}
                    >
                      {formatServiceName(booking.service)}
                    </div>
                  );
                })}

                {count > 2 && (
                  <span className="text-[10px] text-text-tertiary">
                    +{count - 2} more
                  </span>
                )}
              </div>

              {/* Revenue */}
              {revenue > 0 && (
                <div className="mt-auto pt-1 text-[10px] text-text-tertiary tabular-nums">
                  ${revenue}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Day detail panel ───────────────────────────────────────────── */}
      {selectedDayCell && (
        <div className="rounded-2xl border border-border-default bg-surface-primary p-4 mt-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            {formatDateLabel(selectedDayCell.dateStr)}
          </h3>

          {selectedDayCell.bookings.length === 0 ? (
            <p className="text-sm text-text-tertiary">
              No bookings on this day.
            </p>
          ) : (
            <div className="divide-y divide-border-muted">
              {selectedDayCell.bookings.map((booking) => {
                const color = getServiceColor(booking.service);
                const isConflict = conflictIds.has(booking.id);
                const isUnassigned = !booking.sitter;

                return (
                  <div
                    key={booking.id}
                    className="flex items-center gap-3 py-2 text-sm"
                  >
                    {/* Time */}
                    <span className="w-20 shrink-0 text-text-secondary tabular-nums">
                      {formatTime(booking.startAt)}
                    </span>

                    {/* Client */}
                    <span className="min-w-0 flex-1 truncate font-medium text-text-primary">
                      {booking.firstName} {booking.lastName}
                    </span>

                    {/* Service */}
                    <span
                      className="shrink-0 text-xs px-2 py-0.5 rounded-sm"
                      style={{
                        backgroundColor: color.bg,
                        color: color.text,
                        borderLeft: `2px solid ${color.border}`,
                      }}
                    >
                      {formatServiceName(booking.service)}
                    </span>

                    {/* Sitter */}
                    <span
                      className={`w-28 shrink-0 truncate text-xs ${
                        isUnassigned
                          ? 'text-status-warning-text font-medium'
                          : 'text-text-secondary'
                      }`}
                    >
                      {booking.sitter
                        ? `${booking.sitter.firstName} ${booking.sitter.lastName}`
                        : 'Unassigned'}
                    </span>

                    {/* Status */}
                    <span className="w-20 shrink-0 text-xs text-text-tertiary capitalize">
                      {booking.status}
                    </span>

                    {/* Conflict indicator */}
                    {isConflict && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-status-danger-fill" title="Scheduling conflict" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
