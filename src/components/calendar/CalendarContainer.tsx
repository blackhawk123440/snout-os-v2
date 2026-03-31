'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { DispatchBoard } from './DispatchBoard';
import { CoveragePlanner } from './CoveragePlanner';
import { MonthGrid } from './MonthGrid';
import {
  todayString,
  formatDateLabel,
  formatDateShort,
  getWeekStart,
  shiftDate,
} from './calendar-utils';

type ViewMode = 'day' | 'week' | 'month';

export function CalendarContainer() {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(todayString);

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);

  const periodLabel = useMemo(() => {
    if (viewMode === 'day') return formatDateLabel(currentDate);
    if (viewMode === 'week') {
      const ws = weekStart;
      const we = shiftDate(ws, 6);
      return `${formatDateShort(ws)} \u2013 ${formatDateShort(we)}`;
    }
    const d = new Date(currentDate + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [viewMode, currentDate, weekStart]);

  const navigatePrev = () => {
    if (viewMode === 'day') setCurrentDate(shiftDate(currentDate, -1));
    else if (viewMode === 'week') setCurrentDate(shiftDate(currentDate, -7));
    else {
      const d = new Date(currentDate + 'T12:00:00');
      d.setMonth(d.getMonth() - 1);
      setCurrentDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  };

  const navigateNext = () => {
    if (viewMode === 'day') setCurrentDate(shiftDate(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(shiftDate(currentDate, 7));
    else {
      const d = new Date(currentDate + 'T12:00:00');
      d.setMonth(d.getMonth() + 1);
      setCurrentDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  };

  const goToday = () => setCurrentDate(todayString());

  const isToday = currentDate === todayString();

  return (
    <div>
      {/* Sub-navigation: date nav + Day/Week/Month toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default bg-surface-primary rounded-t-2xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={navigatePrev}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-default text-text-secondary hover:bg-surface-secondary transition-all duration-fast"
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-text-primary min-w-[180px] text-center">
            {periodLabel}
          </span>
          <button
            type="button"
            onClick={navigateNext}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-default text-text-secondary hover:bg-surface-secondary transition-all duration-fast"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isToday && (
            <Button size="sm" variant="secondary" onClick={goToday}>
              Today
            </Button>
          )}
        </div>
        <div className="flex gap-1 rounded-lg border border-border-default bg-surface-primary p-0.5">
          {([
            { id: 'day', label: 'Day' },
            { id: 'week', label: 'Week' },
            { id: 'month', label: 'Month' },
          ] as const).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setViewMode(v.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                viewMode === v.id
                  ? 'bg-surface-inverse text-text-inverse'
                  : 'text-text-secondary hover:bg-surface-tertiary'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active view */}
      {viewMode === 'day' && (
        <DispatchBoard date={currentDate} onDateChange={setCurrentDate} />
      )}
      {viewMode === 'week' && (
        <CoveragePlanner weekStart={weekStart} onWeekChange={(ws) => setCurrentDate(ws)} />
      )}
      {viewMode === 'month' && (
        <MonthGrid
          currentMonth={new Date(currentDate + 'T12:00:00')}
          onMonthChange={(d) => {
            setCurrentDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
          }}
          onDayClick={(d) => {
            setCurrentDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
            setViewMode('day');
          }}
        />
      )}
    </div>
  );
}
