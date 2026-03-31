/**
 * CalendarGrid Component with Drag-Drop Rescheduling
 *
 * Booking pills are draggable. Day cells are droppable.
 * Dropping a booking on a different day calls onReschedule.
 */

'use client';

import { useState } from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';
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
import { tokens } from '@/lib/design-tokens';
import { Flex } from '@/components/ui/Flex';
import { formatServiceName } from '@/lib/format-utils';

function getServicePillColor(service: string): string {
  const s = service.toLowerCase();
  if (s.includes('walk')) return 'var(--color-status-info-fill)';
  if (s.includes('drop') || s.includes('visit')) return 'var(--color-status-success-fill)';
  if (s.includes('house') || s.includes('sitting') || s.includes('24/7')) return 'var(--color-status-purple-fill)';
  if (s.includes('taxi')) return 'var(--color-status-warning-fill)';
  return 'var(--color-status-info-fill)';
}

export interface CalendarEventBooking {
  id: string;
  firstName: string;
  lastName: string;
  service: string;
  startAt: Date | string;
  endAt: Date | string;
  sitter?: { id: string; firstName: string; lastName: string };
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  bookings: Array<CalendarEventBooking>;
}

interface CalendarGridProps {
  days: CalendarDay[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onEventClick: (booking: CalendarEventBooking, date: Date) => void;
  onReschedule?: (bookingId: string, newDate: Date) => void;
  formatTime: (date: Date | string) => string;
  getEventSignals?: (eventId: string) => Array<{ id: string; severity: 'info' | 'warning' | 'critical'; label: string }>;
}

/** Draggable booking pill */
function DraggableBookingPill({
  booking,
  onEventClick,
  date,
  formatTime,
  criticalSignal,
  hoverPreview,
}: {
  booking: CalendarEventBooking;
  onEventClick: (booking: CalendarEventBooking, date: Date) => void;
  date: Date;
  formatTime: (d: Date | string) => string;
  criticalSignal?: { label: string } | undefined;
  hoverPreview: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: booking.id,
    data: { booking },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onEventClick(booking, date);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEventClick(booking, date);
        }
      }}
      style={{
        fontSize: tokens.typography.fontSize.xs[0],
        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
        backgroundColor: criticalSignal ? tokens.colors.error.DEFAULT : getServicePillColor(booking.service),
        color: tokens.colors.surface.primary,
        borderRadius: tokens.radius.sm,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: tokens.spacing[1],
        minWidth: 0,
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
      }}
      title={hoverPreview}
    >
      <Flex align="center" gap={1}>
        {criticalSignal && (
          <AlertCircle className="shrink-0" size={12} aria-hidden />
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {formatTime(booking.startAt)} {booking.firstName}
        </span>
      </Flex>
      <ChevronRight className="shrink-0 opacity-90" size={10} aria-hidden />
    </div>
  );
}

/** Droppable day cell */
function DroppableDayCell({
  day,
  idx,
  isSelected,
  onDateSelect,
  onEventClick,
  formatTime,
  getEventSignals,
}: {
  day: CalendarDay;
  idx: number;
  isSelected: boolean;
  onDateSelect: (date: Date) => void;
  onEventClick: (booking: CalendarEventBooking, date: Date) => void;
  formatTime: (d: Date | string) => string;
  getEventSignals?: CalendarGridProps['getEventSignals'];
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${day.date.toISOString()}`,
    data: { date: day.date },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={() => onDateSelect(day.date)}
      style={{
        minHeight: '80px',
        padding: tokens.spacing[2],
        border: isOver
          ? `2px solid #10b981`
          : isSelected
          ? `2px solid ${tokens.colors.primary.DEFAULT}`
          : day.isToday
          ? `2px solid ${tokens.colors.border.strong}`
          : `1px solid ${tokens.colors.border.default}`,
        borderRadius: tokens.radius.sm,
        backgroundColor: isOver
          ? '#ecfdf5'
          : isSelected
          ? tokens.colors.accent.primary
          : day.isToday
          ? tokens.colors.surface.primary
          : day.isCurrentMonth
          ? tokens.colors.surface.primary
          : tokens.colors.surface.secondary,
        color: day.isCurrentMonth
          ? tokens.colors.text.primary
          : tokens.colors.text.tertiary,
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: 'none',
        transition: 'border-color 150ms, background-color 150ms',
      }}
    >
      <Flex direction="column" gap={1}>
        <span
          style={{
            fontSize: day.isToday ? '0.9375rem' : tokens.typography.fontSize.sm[0],
            fontWeight: day.isToday
              ? tokens.typography.fontWeight.bold
              : tokens.typography.fontWeight.semibold,
            color: day.isToday
              ? tokens.colors.primary.DEFAULT
              : day.isCurrentMonth
              ? tokens.colors.text.primary
              : tokens.colors.text.tertiary,
          }}
        >
          {day.date.getDate()}
        </span>
        {day.bookings.slice(0, 3).map((booking) => {
          const signals = getEventSignals ? getEventSignals(booking.id) : [];
          const criticalSignal = signals.find(s => s.severity === 'critical');
          const sitterLabel = booking.sitter
            ? `${booking.sitter.firstName} ${booking.sitter.lastName}`
            : 'Unassigned';
          const hoverPreview = `${booking.firstName} ${booking.lastName} · ${formatTime(booking.startAt)}–${formatTime(booking.endAt)} · ${formatServiceName(booking.service)} · ${sitterLabel}${criticalSignal ? ` · ${criticalSignal.label}` : ''}`;
          return (
            <DraggableBookingPill
              key={booking.id}
              booking={booking}
              onEventClick={onEventClick}
              date={day.date}
              formatTime={formatTime}
              criticalSignal={criticalSignal}
              hoverPreview={hoverPreview}
            />
          );
        })}
        {day.bookings.length > 3 && (
          <span style={{ fontSize: tokens.typography.fontSize.xs[0], color: tokens.colors.text.tertiary }}>
            +{day.bookings.length - 3} more
          </span>
        )}
      </Flex>
    </div>
  );
}

export function CalendarGrid({
  days,
  selectedDate,
  onDateSelect,
  onEventClick,
  onReschedule,
  formatTime,
  getEventSignals,
}: CalendarGridProps) {
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const [activeBooking, setActiveBooking] = useState<CalendarEventBooking | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const booking = event.active.data.current?.booking as CalendarEventBooking;
    if (booking) setActiveBooking(booking);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveBooking(null);
    const { active, over } = event;
    if (!over || !onReschedule) return;

    const targetDate = over.data.current?.date as Date | undefined;
    if (!targetDate) return;

    const bookingId = active.id as string;
    const booking = active.data.current?.booking as CalendarEventBooking;
    if (!booking) return;

    // Only reschedule if dropped on a different date
    const originalDate = new Date(booking.startAt);
    originalDate.setHours(0, 0, 0, 0);
    const dropDate = new Date(targetDate);
    dropDate.setHours(0, 0, 0, 0);

    if (originalDate.getTime() !== dropDate.getTime()) {
      onReschedule(bookingId, targetDate);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: tokens.spacing[1],
          padding: tokens.spacing[2],
        }}
      >
        {/* Day headers */}
        {dayHeaders.map((day) => (
          <div
            key={day}
            style={{
              padding: tokens.spacing[2],
              textAlign: 'center',
              fontSize: tokens.typography.fontSize.sm[0],
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.text.secondary,
            }}
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map((day, idx) => {
          const isSelected = selectedDate ? day.date.getTime() === selectedDate.getTime() : false;
          return (
            <DroppableDayCell
              key={idx}
              day={day}
              idx={idx}
              isSelected={isSelected}
              onDateSelect={onDateSelect}
              onEventClick={onEventClick}
              formatTime={formatTime}
              getEventSignals={getEventSignals}
            />
          );
        })}
      </div>

      {/* Drag overlay — floating pill that follows cursor */}
      <DragOverlay>
        {activeBooking ? (
          <div
            style={{
              fontSize: tokens.typography.fontSize.xs[0],
              padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
              backgroundColor: getServicePillColor(activeBooking.service),
              color: tokens.colors.surface.primary,
              borderRadius: tokens.radius.sm,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              cursor: 'grabbing',
            }}
          >
            {formatTime(activeBooking.startAt)} {activeBooking.firstName} {activeBooking.lastName}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
