'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useSitterAvailabilityFull, useBulkReplaceAvailability } from '@/lib/api/sitter-portal-hooks';
import { AppErrorState } from '@/components/app/AppErrorState';
import { toastSuccess, toastError } from '@/lib/toast';

// ─── Constants ──────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const BLOCKS = [
  { label: 'Morning', startTime: '06:00', endTime: '12:00' },
  { label: 'Afternoon', startTime: '12:00', endTime: '17:00' },
  { label: 'Evening', startTime: '17:00', endTime: '22:00' },
  { label: 'Overnight', startTime: '22:00', endTime: '06:00' },
] as const;

type CellKey = `${number}-${number}`; // dayIndex-blockIndex

// ─── Helpers ────────────────────────────────────────────────────────

function rulesToGrid(rules: Array<{ daysOfWeek: string; startTime: string; endTime: string }>): Set<CellKey> {
  const active = new Set<CellKey>();
  for (const rule of rules) {
    let days: number[];
    try {
      const parsed = JSON.parse(rule.daysOfWeek);
      days = Array.isArray(parsed) ? parsed : [];
    } catch {
      days = [];
    }
    for (const day of days) {
      for (let bi = 0; bi < BLOCKS.length; bi++) {
        const block = BLOCKS[bi];
        if (rule.startTime === block.startTime && rule.endTime === block.endTime) {
          active.add(`${day}-${bi}`);
        }
        // Handle rules that span multiple blocks
        if (timeToMinutes(rule.startTime) <= timeToMinutes(block.startTime) &&
            timeToMinutes(rule.endTime) >= timeToMinutes(block.endTime !== '06:00' ? block.endTime : '30:00')) {
          active.add(`${day}-${bi}`);
        }
      }
    }
  }
  return active;
}

function gridToRules(active: Set<CellKey>): Array<{ daysOfWeek: number[]; startTime: string; endTime: string }> {
  // Group by block → collect days that have that block active
  const rules: Array<{ daysOfWeek: number[]; startTime: string; endTime: string }> = [];
  for (let bi = 0; bi < BLOCKS.length; bi++) {
    const days: number[] = [];
    for (let di = 0; di < 7; di++) {
      if (active.has(`${di}-${bi}`)) days.push(di);
    }
    if (days.length > 0) {
      rules.push({
        daysOfWeek: days,
        startTime: BLOCKS[bi].startTime,
        endTime: BLOCKS[bi].endTime,
      });
    }
  }
  return rules;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// ─── Skeleton ───────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid grid-cols-[auto_repeat(7,1fr)] gap-1 min-w-[340px] w-full">
        {/* Header row */}
        <div className="h-8" />
        {DAYS.map((d) => (
          <div key={d} className="h-8 flex items-center justify-center">
            <div className="h-3 w-8 animate-pulse rounded bg-surface-tertiary" />
          </div>
        ))}
        {/* Block rows */}
        {BLOCKS.map((b) => (
          <>
            <div key={`label-${b.label}`} className="flex items-center pr-2">
              <div className="h-3 w-16 animate-pulse rounded bg-surface-tertiary" />
            </div>
            {DAYS.map((d) => (
              <div
                key={`skel-${d}-${b.label}`}
                className="h-11 min-w-[44px] animate-pulse rounded-lg bg-surface-secondary"
              />
            ))}
          </>
        ))}
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────

export interface AvailabilityGridProps {
  /** When true, shows compact mode for onboarding flow */
  compact?: boolean;
}

export function AvailabilityGrid({ compact = false }: AvailabilityGridProps) {
  const { data, isLoading, error, refetch } = useSitterAvailabilityFull();
  const bulkMutation = useBulkReplaceAvailability();

  const rules: Array<{ daysOfWeek: string; startTime: string; endTime: string }> =
    Array.isArray(data?.rules) ? data.rules : [];

  // Grid state: set of active cell keys
  const [activeCells, setActiveCells] = useState<Set<CellKey>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync server state → local state when data loads
  useEffect(() => {
    if (rules.length >= 0 && !initialized && !isLoading) {
      setActiveCells(rulesToGrid(rules));
      setInitialized(true);
    }
  }, [rules, initialized, isLoading]);

  // Debounced save
  const saveGrid = useCallback(
    (cells: Set<CellKey>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const newRules = gridToRules(cells);
        if (newRules.length === 0) {
          // If grid is completely empty, don't save (bulk API requires min 1 rule)
          return;
        }
        bulkMutation.mutate(
          { rules: newRules },
          {
            onSuccess: () => toastSuccess('Availability updated'),
            onError: () => {
              toastError('Failed to save. Reverting...');
              // Revert to server state
              setActiveCells(rulesToGrid(rules));
            },
          },
        );
      }, 500);
    },
    [bulkMutation, rules],
  );

  const toggleCell = useCallback(
    (dayIndex: number, blockIndex: number) => {
      setActiveCells((prev) => {
        const next = new Set(prev);
        const key: CellKey = `${dayIndex}-${blockIndex}`;
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        saveGrid(next);
        return next;
      });
    },
    [saveGrid],
  );

  // ─── Render states ───────────────────────────────────────────────

  if (isLoading) return <GridSkeleton />;

  if (error) {
    return (
      <AppErrorState
        message="Couldn't load availability"
        subtitle="Check your connection and try again."
        onRetry={() => void refetch()}
      />
    );
  }

  const isEmpty = activeCells.size === 0;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="inline-grid grid-cols-[auto_repeat(7,1fr)] gap-1 min-w-[340px] w-full">
          {/* Header row — day labels */}
          <div className="h-8" />
          {DAYS.map((d) => (
            <div
              key={d}
              className="flex h-8 items-center justify-center text-xs font-medium text-text-secondary"
            >
              {d}
            </div>
          ))}

          {/* Grid rows — one per time block */}
          {BLOCKS.map((block, bi) => (
            <>
              <div
                key={`label-${block.label}`}
                className="flex items-center pr-2 text-xs font-medium text-text-tertiary whitespace-nowrap"
              >
                {block.label}
              </div>
              {DAYS.map((_, di) => {
                const key: CellKey = `${di}-${bi}`;
                const isActive = activeCells.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleCell(di, bi)}
                    aria-label={`${DAYS[di]} ${block.label}: ${isActive ? 'available' : 'unavailable'}`}
                    aria-pressed={isActive}
                    className={`flex h-11 min-w-[44px] items-center justify-center rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-1 ${
                      isActive
                        ? 'border-accent-primary bg-accent-primary/15 text-accent-primary'
                        : 'border-border-default bg-surface-primary text-transparent hover:border-border-strong hover:bg-surface-secondary'
                    }`}
                  >
                    {isActive && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </>
          ))}
        </div>
      </div>

      {/* Empty state helper */}
      {isEmpty && initialized && (
        <p className="text-center text-sm text-text-tertiary">
          Tap cells to mark when you&apos;re available
        </p>
      )}

      {/* Saving indicator */}
      {bulkMutation.isPending && (
        <p className="text-center text-xs text-text-tertiary">Saving...</p>
      )}
    </div>
  );
}
