'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Button, EmptyState } from '@/components/ui';
import { AppErrorState } from '@/components/app';
import { useQuickAssign } from '@/lib/api/owner-hooks';
import { toastSuccess, toastError } from '@/lib/toast';
import { getServiceColor, SERVICE_LEGEND } from './ServiceColors';
import {
  todayString,
  formatTime,
  formatDateLabel,
  formatServiceName,
  getHourFromIso,
  getDurationHours,
  sitterInitials,
} from './calendar-utils';

/* ─── Types ─────────────────────────────────────────────────────────── */

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

interface BoardData {
  date: string;
  stats: {
    totalVisits: number;
    completedVisits: number;
    inProgressVisits: number;
    upcomingVisits: number;
    unassignedCount: number;
    activeSittersCount: number;
    todayRevenue: number;
    onTimeRate: number;
  };
  sitterSchedules: SitterSchedule[];
  unassigned: UnassignedVisit[];
  sitters: Array<{ id: string; firstName: string; lastName: string }>;
}

interface SitterOption {
  id: string;
  firstName: string;
  lastName: string;
}

/* ─── Constants ─────────────────────────────────────────────────────── */

const HOUR_HEIGHT = 64;
const MIN_HOUR = 7;
const MAX_HOUR = 18; // 6 PM
const MIN_BLOCK_HEIGHT = 40;

/* ─── Component ─────────────────────────────────────────────────────── */

export function DispatchBoard({
  date,
  onDateChange,
}: {
  date: string;
  onDateChange: (date: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch board + sitters
  const { data: board, isLoading, error, refetch } = useQuery<BoardData>({
    queryKey: ['owner', 'daily-board', date],
    queryFn: async () => {
      const [boardRes, sittersRes] = await Promise.all([
        fetch(`/api/ops/daily-board?date=${date}`),
        fetch('/api/sitters?page=1&pageSize=200'),
      ]);
      const boardJson = await boardRes.json().catch(() => ({}));
      const sittersJson = await sittersRes.json().catch(() => ({}));
      if (!boardRes.ok) throw new Error(boardJson.error || 'Failed to load');
      return {
        ...boardJson,
        sitters: Array.isArray(sittersJson.items) ? sittersJson.items : [],
      };
    },
    refetchInterval: 30000,
  });

  // Quick-assign mutation
  const quickAssignMutation = useQuickAssign();
  const handleAssign = (bookingId: string, sitterId: string) => {
    quickAssignMutation.mutate(
      { bookingId, sitterId },
      {
        onSuccess: () => {
          toastSuccess('Sitter assigned');
          void refetch();
        },
        onError: (err: Error) => toastError(err.message || 'Failed to assign'),
      },
    );
  };

  // ── Drag-and-drop ──
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);

  const findBookingInfo = useCallback((bookingId: string): { visit: Visit | UnassignedVisit; sitterId: string | null } | null => {
    if (!board) return null;
    for (const s of board.sitterSchedules) {
      const v = s.visits.find((v) => v.bookingId === bookingId);
      if (v) return { visit: v, sitterId: s.sitter.id };
    }
    const u = board.unassigned.find((v) => v.bookingId === bookingId);
    if (u) return { visit: u, sitterId: null };
    return null;
  }, [board]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id).replace('booking-', '');
    setActiveBookingId(id);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveBookingId(null);
    const { active, over } = event;
    if (!over) return;
    const bookingId = String(active.id).replace('booking-', '');
    const targetSitterId = String(over.id).replace('sitter-', '');
    const info = findBookingInfo(bookingId);
    if (!info) return;
    if (info.sitterId === targetSitterId) return;

    // Unassigned → quick assign
    if (!info.sitterId) {
      handleAssign(bookingId, targetSitterId);
      return;
    }

    // Reassign via reschedule endpoint
    try {
      const res = await fetch(`/api/bookings/${bookingId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sitterId: targetSitterId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toastError(json.error || 'Reassign failed');
        return;
      }
      const sitter = board?.sitters.find((s) => s.id === targetSitterId);
      toastSuccess(`Reassigned to ${sitter ? sitter.firstName + ' ' + sitter.lastName : 'sitter'}`);
      void queryClient.invalidateQueries({ queryKey: ['owner', 'daily-board'] });
    } catch {
      toastError('Network error');
    }
  }, [findBookingInfo, handleAssign, board, queryClient]);

  const handleDragCancel = useCallback(() => setActiveBookingId(null), []);

  // Active drag overlay info
  const activeDragInfo = useMemo(() => {
    if (!activeBookingId) return null;
    return findBookingInfo(activeBookingId);
  }, [activeBookingId, findBookingInfo]);

  // Now line position (today only)
  const [nowMs, setNowMs] = useState(Date.now());
  const isToday = date === todayString();
  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  // Compute time axis range
  const { gridStart, gridEnd } = useMemo(() => {
    if (!board) return { gridStart: MIN_HOUR, gridEnd: MAX_HOUR };
    const allVisits = [
      ...board.sitterSchedules.flatMap((s) => s.visits),
      ...board.unassigned,
    ];
    if (allVisits.length === 0) return { gridStart: MIN_HOUR, gridEnd: MAX_HOUR };
    let earliest = MIN_HOUR;
    let latest = MAX_HOUR;
    for (const v of allVisits) {
      const start = getHourFromIso(v.startAt);
      const end = getHourFromIso(v.endAt);
      if (start < earliest) earliest = Math.floor(start);
      if (end > latest) latest = Math.ceil(end);
    }
    return { gridStart: Math.min(earliest, MIN_HOUR), gridEnd: Math.max(latest, MAX_HOUR) };
  }, [board]);

  const totalHours = gridEnd - gridStart;
  const gridHeight = totalHours * HOUR_HEIGHT;

  // Now line offset
  const nowHour = useMemo(() => {
    const d = new Date(nowMs);
    return d.getHours() + d.getMinutes() / 60;
  }, [nowMs]);
  const nowOffset = (nowHour - gridStart) * HOUR_HEIGHT;
  const showNowLine = isToday && nowHour >= gridStart && nowHour <= gridEnd;

  // Loading skeleton
  if (isLoading && !board) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-4 w-48 rounded bg-surface-tertiary" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-tertiary h-[400px]" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <AppErrorState title="Couldn't load schedule" onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!board) return null;

  const { sitterSchedules, unassigned, stats, sitters } = board;

  // Empty day
  if (sitterSchedules.length === 0 && unassigned.length === 0) {
    return (
      <div className="p-8">
        <EmptyState
          title="No visits scheduled"
          description={`No visits scheduled for ${formatDateLabel(date)}. Book a visit or check another day.`}
          primaryAction={{ label: 'New booking', onClick: () => router.push('/bookings/new') }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Stats strip */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border-default bg-surface-secondary text-xs text-text-secondary">
        <span>{stats.totalVisits} visits</span>
        <span>{stats.activeSittersCount} sitters</span>
        {stats.inProgressVisits > 0 && <span className="text-status-success-text">{stats.inProgressVisits} in progress</span>}
        {stats.completedVisits > 0 && <span>{stats.completedVisits} done</span>}
        {stats.unassignedCount > 0 && <span className="text-status-danger-text font-medium">{stats.unassignedCount} unassigned</span>}
        <span className="ml-auto tabular-nums">${stats.todayRevenue.toLocaleString()}</span>
      </div>

      {/* Unassigned queue */}
      {unassigned.length > 0 && (
        <UnassignedQueue
          visits={unassigned}
          sitters={sitters}
          onAssign={handleAssign}
        />
      )}

      {/* Dispatch grid with drag-drop */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Sitter column headers */}
            <div className="flex border-b border-border-default">
              <div className="w-16 shrink-0 lg:w-20" />
              {sitterSchedules.map((schedule) => {
                const totalHrs = schedule.visits.reduce(
                  (s, v) => s + getDurationHours(v.startAt, v.endAt), 0
                );
                return (
                  <div
                    key={schedule.sitter.id}
                    className="flex-1 min-w-[140px] px-2 py-3 border-l border-border-default"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-tertiary text-xs font-bold text-accent-primary">
                        {sitterInitials(schedule.sitter.firstName, schedule.sitter.lastName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">
                          {schedule.sitter.firstName} {schedule.sitter.lastName}
                        </p>
                        <p className="text-[11px] text-text-tertiary">
                          {schedule.visits.length} visit{schedule.visits.length !== 1 ? 's' : ''} &middot; {totalHrs.toFixed(1)}h
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="flex relative" style={{ height: gridHeight }}>
              {/* Time axis */}
              <div className="w-16 shrink-0 lg:w-20 relative">
                {Array.from({ length: totalHours }, (_, i) => {
                  const hour = gridStart + i;
                  const label =
                    hour === 0 ? '12 AM' :
                    hour < 12 ? `${hour} AM` :
                    hour === 12 ? '12 PM' :
                    `${hour - 12} PM`;
                  return (
                    <div
                      key={hour}
                      className="absolute right-2 text-[11px] text-text-tertiary tabular-nums"
                      style={{ top: i * HOUR_HEIGHT - 7 }}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>

              {/* Sitter columns (droppable) */}
              {sitterSchedules.map((schedule) => (
                <SitterColumn
                  key={schedule.sitter.id}
                  sitterId={schedule.sitter.id}
                  visits={schedule.visits}
                  gridStart={gridStart}
                  totalHours={totalHours}
                  activeBookingId={activeBookingId}
                />
              ))}

              {/* Now line */}
              {showNowLine && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: nowOffset }}
                >
                  <div className="relative h-0.5 bg-status-danger-fill">
                    <div className="absolute -left-0 -top-[3px] h-2 w-2 rounded-full bg-status-danger-fill" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeDragInfo ? (
            <DragOverlayBlock visit={activeDragInfo.visit} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Service color legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-border-default">
        {SERVICE_LEGEND.map((item) => {
          const sc = getServiceColor(item.label);
          return (
            <div key={item.type} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: sc.border }}
              />
              <span className="text-[11px] text-text-tertiary">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Droppable Sitter Column ───────────────────────────────────────── */

function SitterColumn({
  sitterId,
  visits,
  gridStart,
  totalHours,
  activeBookingId,
}: {
  sitterId: string;
  visits: Visit[];
  gridStart: number;
  totalHours: number;
  activeBookingId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `sitter-${sitterId}` });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[140px] relative border-l transition-colors ${
        isOver ? 'border-l-accent-primary bg-accent-tertiary/20' : 'border-border-default'
      }`}
    >
      {/* Hour gridlines */}
      {Array.from({ length: totalHours }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-border-muted"
          style={{ top: i * HOUR_HEIGHT }}
        />
      ))}
      {/* Half-hour gridlines */}
      {Array.from({ length: totalHours }, (_, i) => (
        <div
          key={`half-${i}`}
          className="absolute left-0 right-0 border-t border-border-muted border-dashed opacity-40"
          style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
        />
      ))}

      {/* Booking blocks (draggable) */}
      {visits.map((visit) => (
        <DraggableBooking
          key={visit.bookingId}
          visit={visit}
          gridStart={gridStart}
          isDragging={activeBookingId === visit.bookingId}
        />
      ))}

      {/* Drop zone indicator */}
      {isOver && (
        <div className="absolute inset-0 border-2 border-dashed border-accent-primary rounded-lg pointer-events-none z-5" />
      )}
    </div>
  );
}

/* ─── Draggable Booking Block ──────────────────────────────────────── */

function DraggableBooking({
  visit,
  gridStart,
  isDragging,
}: {
  visit: Visit;
  gridStart: number;
  isDragging: boolean;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `booking-${visit.bookingId}`,
  });

  const startHour = getHourFromIso(visit.startAt);
  const duration = getDurationHours(visit.startAt, visit.endAt);
  const top = (startHour - gridStart) * HOUR_HEIGHT;
  const height = Math.max(duration * HOUR_HEIGHT, MIN_BLOCK_HEIGHT);
  const sc = getServiceColor(visit.service);
  const isInProgress = visit.status === 'in_progress';
  const isCompleted = visit.status === 'completed';
  const isCheckedIn = !!visit.checkedInAt && !visit.checkedOutAt;
  const petCount = visit.pets?.length ?? 0;

  const style: React.CSSProperties = {
    top,
    height,
    backgroundColor: sc.bg,
    border: `1px solid ${sc.border}`,
    borderLeftWidth: 3,
    borderLeftColor: sc.border,
    opacity: isDragging ? 0.3 : isCompleted ? 0.6 : 1,
    ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => router.push(`/bookings/${visit.bookingId}`)}
      className="absolute left-1 right-1 rounded-lg overflow-hidden text-left transition-shadow hover:shadow-md cursor-grab active:cursor-grabbing z-[2]"
      style={style}
    >
      {isInProgress && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] animate-pulse"
          style={{ backgroundColor: sc.border }}
        />
      )}
      <div className="px-2 py-1.5 h-full flex flex-col justify-between overflow-hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            {isCheckedIn && <span className="h-2 w-2 rounded-full bg-status-success-fill shrink-0" />}
            {isCompleted && <span className="text-[10px]">&#10003;</span>}
            <p className="text-xs font-semibold truncate" style={{ color: sc.text }}>
              {formatServiceName(visit.service)}
            </p>
          </div>
          <p className="text-[11px] font-medium text-text-primary truncate">
            {visit.clientName}
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-text-tertiary">
          <span>{formatTime(visit.startAt)}&ndash;{formatTime(visit.endAt)}</span>
          {petCount > 0 && <span>&middot; {petCount} pet{petCount !== 1 ? 's' : ''}</span>}
        </div>
      </div>
    </div>
  );
}

/* ─── Drag Overlay ──────────────────────────────────────────────────── */

function DragOverlayBlock({ visit }: { visit: Visit | UnassignedVisit }) {
  const sc = getServiceColor(visit.service);
  return (
    <div
      className="rounded-lg px-3 py-2 shadow-lg min-w-[160px] cursor-grabbing"
      style={{ backgroundColor: sc.bg, border: `2px solid ${sc.border}` }}
    >
      <p className="text-xs font-semibold" style={{ color: sc.text }}>
        {formatServiceName(visit.service)}
      </p>
      <p className="text-[11px] text-text-primary">{visit.clientName}</p>
      <p className="text-[10px] text-text-tertiary">{formatTime(visit.startAt)}</p>
    </div>
  );
}

/* ─── Unassigned Queue ──────────────────────────────────────────────── */

function UnassignedQueue({
  visits,
  sitters,
  onAssign,
}: {
  visits: UnassignedVisit[];
  sitters: SitterOption[];
  onAssign: (bookingId: string, sitterId: string) => void;
}) {
  return (
    <div className="border-b-2 border-status-danger-border bg-status-danger-bg px-4 py-3">
      <p className="text-xs font-semibold text-status-danger-text mb-2">
        Unassigned &mdash; {visits.length} visit{visits.length !== 1 ? 's' : ''}
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {visits.map((visit) => (
          <DraggableUnassigned
            key={visit.bookingId}
            visit={visit}
            sitters={sitters}
            onAssign={onAssign}
          />
        ))}
      </div>
    </div>
  );
}

function DraggableUnassigned({
  visit,
  sitters,
  onAssign,
}: {
  visit: UnassignedVisit;
  sitters: SitterOption[];
  onAssign: (bookingId: string, sitterId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `booking-${visit.bookingId}`,
  });
  const sc = getServiceColor(visit.service);
  const hoursUntil = (new Date(visit.startAt).getTime() - Date.now()) / 3_600_000;
  const urgent = hoursUntil > 0 && hoursUntil < 4;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`shrink-0 rounded-xl border bg-surface-primary px-3 py-2 min-w-[200px] cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
      style={{ borderColor: sc.border }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: sc.border }} />
        <span className="text-xs font-medium text-text-primary truncate">
          {formatTime(visit.startAt)} &middot; {formatServiceName(visit.service)}
        </span>
        {urgent && (
          <span className="shrink-0 rounded-full bg-status-danger-fill px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
            Urgent
          </span>
        )}
      </div>
      <p className="text-xs text-text-secondary truncate mb-2">{visit.clientName}</p>
      {sitters.length > 0 && (
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onAssign(visit.bookingId, e.target.value);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full min-h-[36px] rounded-lg border border-border-default bg-surface-primary px-2 text-xs text-text-primary focus:border-border-focus focus:outline-none"
          aria-label={`Assign sitter to ${visit.clientName}`}
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
  );
}
