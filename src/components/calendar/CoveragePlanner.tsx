'use client';

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AppErrorState } from '@/components/app';
import { Skeleton, EmptyState, Badge } from '@/components/ui';
import { getServiceColor } from './ServiceColors';
import {
  formatTime,
  formatDateShort,
  sitterInitials,
  getDurationHours,
  todayString,
  formatServiceName,
} from './calendar-utils';

/* ---------- API types ---------- */

interface Booking {
  id: string;
  service: string;
  startAt: string;
  endAt: string;
  clientName: string;
  status: string;
}

interface SitterDay {
  date: string;
  bookings: Booking[];
  bookingCount: number;
  totalHours: number;
  available: boolean;
}

interface Sitter {
  id: string;
  firstName: string;
  lastName: string;
  days: SitterDay[];
}

interface DayTotal {
  date: string;
  totalBookings: number;
  activeSitters: number;
}

interface ScheduleGridResponse {
  weekStart: string;
  sitters: Sitter[];
  totals: { days: DayTotal[] };
}

/* ---------- Helpers ---------- */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayName(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return DAY_NAMES[d.getDay()];
}

function capacityPercent(totalHours: number): number {
  return Math.min(100, (totalHours / 8) * 100);
}

function capacityColor(totalHours: number): string {
  const pct = capacityPercent(totalHours);
  if (pct > 90) return 'bg-status-danger-fill';
  if (pct >= 70) return 'bg-status-warning-fill';
  return 'bg-status-success-fill';
}

/* ---------- Component ---------- */

export function CoveragePlanner({
  weekStart,
  onWeekChange,
}: {
  weekStart: string; // YYYY-MM-DD
  onWeekChange: (weekStart: string) => void;
}) {
  const router = useRouter();
  const [expandedCell, setExpandedCell] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ScheduleGridResponse>({
    queryKey: ['schedule-grid', weekStart],
    queryFn: async () => {
      const res = await fetch(`/api/ops/schedule-grid?date=${weekStart}`);
      if (!res.ok) throw new Error('Failed to load schedule grid');
      return res.json();
    },
  });

  const toggleExpand = useCallback(
    (sitterId: string, date: string) => {
      const key = `${sitterId}:${date}`;
      setExpandedCell((prev) => (prev === key ? null : key));
    },
    [],
  );

  const today = todayString();

  /* ----- Loading ----- */
  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton height="400px" />
      </div>
    );
  }

  /* ----- Error ----- */
  if (isError) {
    return (
      <div className="p-4">
        <AppErrorState
          message={(error as Error)?.message ?? 'Something went wrong'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  /* ----- Empty ----- */
  if (!data || data.sitters.length === 0) {
    return (
      <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
        <EmptyState
          title="No sitters found"
          description="There are no sitters with schedules for this week."
        />
      </div>
    );
  }

  /* ----- Derive dates from first sitter (always 7 days) ----- */
  const dates = data.sitters[0].days.map((d) => d.date);
  const totalsMap = new Map(data.totals.days.map((t) => [t.date, t]));

  return (
    <div className="rounded-2xl border border-border-default bg-surface-primary overflow-x-auto">
      <table
        className="w-full border-collapse text-sm"
        style={{ tableLayout: 'fixed' }}
      >
        {/* ----- Column sizing ----- */}
        <colgroup>
          <col style={{ minWidth: 130, width: 130 }} />
          {dates.map((d) => (
            <col key={d} />
          ))}
        </colgroup>

        {/* ----- Header ----- */}
        <thead>
          <tr className="border-b border-border-default">
            <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">
              Sitter
            </th>
            {dates.map((d) => {
              const isToday = d === today;
              return (
                <th
                  key={d}
                  className={`px-2 py-2 text-center text-xs font-medium ${
                    isToday
                      ? 'bg-accent-tertiary text-text-primary'
                      : 'text-text-secondary'
                  }`}
                >
                  <div>{dayName(d)}</div>
                  <div>{formatDateShort(d)}</div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* ----- Body ----- */}
        <tbody>
          {data.sitters.map((sitter) => {
            /* Week totals for this sitter */
            const weekBookings = sitter.days.reduce(
              (sum, d) => sum + d.bookingCount,
              0,
            );
            const weekHours = sitter.days.reduce(
              (sum, d) => sum + d.totalHours,
              0,
            );

            return (
              <tr
                key={sitter.id}
                className="border-b border-border-default last:border-b-0"
              >
                {/* Sitter name cell */}
                <td
                  className="px-3 py-2 min-h-[44px] cursor-pointer transition hover:bg-surface-secondary"
                  onClick={() => router.push(`/sitters/${sitter.id}`)}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-secondary text-xs font-semibold text-accent-primary">
                      {sitterInitials(sitter.firstName, sitter.lastName)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-text-primary font-medium">
                        {sitter.firstName} {sitter.lastName}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {weekBookings} visit{weekBookings !== 1 ? 's' : ''} &middot;{' '}
                        {weekHours.toFixed(1)}h
                      </div>
                    </div>
                  </div>
                </td>

                {/* Day cells */}
                {sitter.days.map((day) => {
                  const cellKey = `${sitter.id}:${day.date}`;
                  const isExpanded = expandedCell === cellKey;
                  const isToday = day.date === today;

                  /* Unavailable */
                  if (!day.available) {
                    return (
                      <td
                        key={day.date}
                        className={`px-2 py-2 align-top min-h-[44px] bg-status-danger-bg ${
                          isToday ? 'ring-1 ring-inset ring-accent-tertiary' : ''
                        }`}
                      >
                        <Badge variant="error">Off</Badge>
                      </td>
                    );
                  }

                  /* No bookings */
                  if (day.bookingCount === 0) {
                    return (
                      <td
                        key={day.date}
                        className={`px-2 py-2 align-top text-center text-text-tertiary min-h-[44px] ${
                          isToday ? 'bg-accent-tertiary/10' : ''
                        }`}
                      >
                        &mdash;
                      </td>
                    );
                  }

                  /* Has bookings */
                  const visibleBookings = isExpanded
                    ? day.bookings
                    : day.bookings.slice(0, 3);
                  const overflow = day.bookings.length - 3;
                  const pct = capacityPercent(day.totalHours);

                  return (
                    <td
                      key={day.date}
                      className={`px-2 py-2 align-top min-h-[44px] cursor-pointer transition hover:bg-surface-secondary ${
                        isToday ? 'bg-accent-tertiary/10' : ''
                      }`}
                      onClick={() => toggleExpand(sitter.id, day.date)}
                    >
                      {/* Booking pills */}
                      <div className="flex flex-col gap-1">
                        {visibleBookings.map((b) => {
                          const color = getServiceColor(b.service);
                          return (
                            <div
                              key={b.id}
                              className={`text-xs px-2 py-1 rounded-sm bg-surface-secondary truncate ${
                                isExpanded ? 'cursor-pointer hover:bg-surface-tertiary' : ''
                              }`}
                              style={{
                                borderLeft: `3px solid ${color.border}`,
                              }}
                              onClick={
                                isExpanded
                                  ? (e) => {
                                      e.stopPropagation();
                                      router.push(`/bookings/${b.id}`);
                                    }
                                  : undefined
                              }
                            >
                              <span className="text-text-tertiary">
                                {formatTime(b.startAt)}
                              </span>{' '}
                              <span className="text-text-primary">
                                {formatServiceName(b.service)}
                              </span>
                              {isExpanded && (
                                <div className="text-text-secondary mt-0.5 truncate">
                                  {b.clientName}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Overflow indicator */}
                        {!isExpanded && overflow > 0 && (
                          <span className="text-xs text-text-tertiary">
                            +{overflow} more
                          </span>
                        )}
                      </div>

                      {/* Capacity bar */}
                      <div className="mt-1.5 h-[3px] w-full rounded-full bg-surface-secondary">
                        <div
                          className={`h-full rounded-full ${capacityColor(day.totalHours)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>

        {/* ----- Footer totals ----- */}
        <tfoot>
          <tr className="bg-surface-secondary">
            <td className="px-3 py-2 text-sm font-bold text-text-primary">
              Team Total
            </td>
            {dates.map((d) => {
              const t = totalsMap.get(d);
              return (
                <td
                  key={d}
                  className="px-2 py-2 text-center text-xs text-text-secondary"
                >
                  {t ? (
                    <>
                      <div className="font-medium text-text-primary">
                        {t.totalBookings} booking{t.totalBookings !== 1 ? 's' : ''}
                      </div>
                      <div>
                        {t.activeSitters} sitter{t.activeSitters !== 1 ? 's' : ''}
                      </div>
                    </>
                  ) : (
                    <span className="text-text-tertiary">&mdash;</span>
                  )}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
