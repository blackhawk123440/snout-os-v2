/**
 * CalendarSurface Component
 *
 * Shared primitive for calendar month grid rendering.
 * Universal Law: ONE CALENDAR RENDERING SYSTEM
 */

'use client';

import React from 'react';
import { tokens } from '@/lib/design-tokens';
import { Card } from '@/components/ui';
import { useMobile } from '@/lib/use-mobile';
import { formatServiceName } from '@/lib/format-utils';

export interface CalendarEvent {
  id: string;
  firstName?: string;
  lastName?: string;
  clientName?: string;
  service: string;
  startAt: Date | string;
  endAt?: Date | string;
  timeSlots?: Array<{
    id: string;
    startAt: Date | string;
    endAt: Date | string;
    duration?: number;
  }>;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  events: CalendarEvent[];
}

export interface CalendarSurfaceProps {
  days: CalendarDay[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onEventClick?: (event: CalendarEvent, date: Date) => void;
  monthName: string;
  year: number;
  formatTime?: (date: Date | string) => string;
  renderEventLabel?: (event: CalendarEvent) => string;
}

const defaultFormatTime = (date: Date | string) => {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const defaultRenderEventLabel = (event: CalendarEvent) => {
  if (event.clientName) {
    return event.clientName;
  }
  if (event.firstName && event.lastName) {
    return `${event.firstName} ${event.lastName.charAt(0)}.`;
  }
  return formatServiceName(event.service);
};

export const CalendarSurface: React.FC<CalendarSurfaceProps> = ({
  days,
  selectedDate,
  onDateSelect,
  onEventClick,
  monthName,
  year,
  formatTime = defaultFormatTime,
  renderEventLabel = defaultRenderEventLabel,
}) => {
  const isMobile = useMobile();

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calculate minimum width for calendar grid to preserve column widths
  const minGridWidth = isMobile ? 490 : '100%'; // ~70px per column * 7 columns on mobile

  return (
    <div
      className="w-full max-w-full m-0 overflow-x-auto overflow-y-visible"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <Card
        padding={false}
        className="w-full m-0"
        style={{ minWidth: minGridWidth }}
      >
        {/* Day Names Header */}
        <div
          className="grid grid-cols-7 border-b border-border-default w-full"
          style={{ minWidth: minGridWidth }}
        >
        {dayNames.map((day) => (
          <div
            key={day}
            className={`text-center font-semibold text-text-primary bg-surface-secondary ${
              isMobile ? 'py-2 px-1 text-xs' : 'p-3 text-sm'
            } ${day !== 'Sat' ? 'border-r border-border-default' : ''}`}
          >
            {day}
          </div>
        ))}
      </div>

        {/* Calendar Grid */}
        <div
          className="grid grid-cols-7 w-full"
          style={{ minWidth: minGridWidth }}
        >
        {days.map((day, index) => {
          const maxVisibleEvents = 2;
          const remainingCount = Math.max(0, day.events.length - maxVisibleEvents);
          const isSelected = selectedDate && selectedDate.getTime() === day.date.getTime();

          return (
            <div
              key={index}
              onClick={() => day.isCurrentMonth && onDateSelect(day.date)}
              className={`overflow-hidden break-words relative min-w-0 transition-colors duration-normal ${
                isMobile ? 'min-h-[60px] p-1' : 'min-h-[120px] p-2'
              } ${index % 7 !== 6 ? 'border-r border-border-default' : ''} border-b border-border-default ${
                day.isCurrentMonth ? 'cursor-pointer opacity-100' : 'cursor-default opacity-50'
              }`}
              style={{
                backgroundColor: day.isCurrentMonth
                  ? isSelected
                    ? tokens.colors.primary[50]
                    : day.isPast
                    ? tokens.colors.background.tertiary
                    : tokens.colors.background.primary
                  : tokens.colors.background.secondary,
              }}
              onMouseEnter={(e) => {
                if (day.isCurrentMonth && !day.isPast && !isSelected) {
                  e.currentTarget.style.backgroundColor = tokens.colors.background.secondary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = day.isCurrentMonth
                    ? day.isPast
                      ? tokens.colors.background.tertiary
                      : tokens.colors.background.primary
                    : tokens.colors.background.secondary;
                }
              }}
            >
              {/* Date Number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-sm ${
                    day.isToday ? 'font-bold text-primary' : 'font-normal text-text-primary'
                  }`}
                >
                  {day.date.getDate()}
                </span>
                {day.isToday && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </div>

              {/* Events */}
              <div className="flex flex-col gap-1">
                {day.events.slice(0, maxVisibleEvents).map((event) => {
                  const dateStr = day.date.toISOString().split('T')[0];
                  let displayTime = '';

                  if (event.timeSlots && event.timeSlots.length > 0) {
                    const daySlots = event.timeSlots.filter((slot) => {
                      const slotDate = new Date(slot.startAt);
                      return slotDate.toISOString().split('T')[0] === dateStr;
                    });
                    if (daySlots.length > 0) {
                      const start = formatTime(daySlots[0].startAt);
                      displayTime = daySlots.length > 1 ? `${daySlots.length} slots` : start;
                    }
                  } else if (
                    event.service === 'Housesitting' ||
                    event.service === '24/7 Care'
                  ) {
                    const startAt = new Date(event.startAt);
                    const startDateStr = startAt.toISOString().split('T')[0];
                    if (dateStr === startDateStr) {
                      displayTime = formatTime(startAt);
                    } else {
                      displayTime = 'All day';
                    }
                  } else {
                    displayTime = formatTime(event.startAt);
                  }

                  return (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEventClick) {
                          onEventClick(event, day.date);
                        } else {
                          onDateSelect(day.date);
                        }
                      }}
                      className="py-1 px-2 rounded-sm text-xs bg-[#fef2f8] text-text-primary cursor-pointer border-l-[3px] border-l-primary"
                      title={`${renderEventLabel(event)} - ${formatServiceName(event.service)}`}
                    >
                      <div className="font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                        {renderEventLabel(event)}
                      </div>
                      {displayTime && (
                        <div className="text-xs opacity-80 overflow-hidden text-ellipsis whitespace-nowrap">
                          {displayTime}
                        </div>
                      )}
                    </div>
                  );
                })}

                {remainingCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDateSelect(day.date);
                    }}
                    className="py-1 px-2 rounded-sm text-xs bg-[#fef7fb] text-primary border-none cursor-pointer font-medium text-left"
                  >
                    {remainingCount} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </Card>
    </div>
  );
};
