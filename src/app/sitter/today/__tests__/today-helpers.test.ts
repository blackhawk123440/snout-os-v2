import { describe, expect, it } from 'vitest';
import {
  getShowCancelledFromQuery,
  groupTodayVisits,
  normalizeTodayBooking,
  pickNextUpVisit,
  type TodayVisitLike,
} from '@/app/sitter/today/today-helpers';

const mk = (id: string, status: TodayVisitLike['status'], startAt: string): TodayVisitLike => ({
  id,
  status,
  startAt,
});

describe('today helpers', () => {
  it('groups visits with in-progress pinned and completed at bottom', () => {
    const visits = [
      mk('c1', 'completed', '2026-03-04T09:00:00.000Z'),
      mk('u1', 'confirmed', '2026-03-04T10:00:00.000Z'),
      mk('p1', 'in_progress', '2026-03-04T08:00:00.000Z'),
      mk('u2', 'pending', '2026-03-04T11:00:00.000Z'),
      mk('u3', 'pending', '2026-03-04T12:00:00.000Z'),
      mk('u4', 'pending', '2026-03-04T13:00:00.000Z'),
    ];

    const grouped = groupTodayVisits(visits, false);
    expect(grouped.inProgress.map((v) => v.id)).toEqual(['p1']);
    expect(grouped.upNext.map((v) => v.id)).toEqual(['u1', 'u2', 'u3']);
    expect(grouped.laterToday.map((v) => v.id)).toEqual(['u4']);
    expect(grouped.completed.map((v) => v.id)).toEqual(['c1']);
  });

  it('toggle behavior hides cancelled unless query flag enabled', () => {
    const visits = [
      mk('x1', 'cancelled', '2026-03-04T09:00:00.000Z'),
      mk('x2', 'pending', '2026-03-04T10:00:00.000Z'),
    ];

    const hidden = groupTodayVisits(visits, false);
    expect(hidden.upNext.map((v) => v.id)).toEqual(['x2']);

    const shown = groupTodayVisits(visits, true);
    expect(shown.upNext.map((v) => v.id)).toEqual(['x2']);
    expect(shown.completed.map((v) => v.id)).toEqual(['x1']);
    expect(shown.inProgress).toHaveLength(0);

    expect(getShowCancelledFromQuery(null)).toBe(false);
    expect(getShowCancelledFromQuery('0')).toBe(false);
    expect(getShowCancelledFromQuery('1')).toBe(true);
  });

  it('picks next-up as in-progress first then upcoming', () => {
    const withProgress = [mk('a', 'in_progress', '2026-03-04T09:00:00.000Z'), mk('b', 'pending', '2026-03-04T10:00:00.000Z')];
    expect(pickNextUpVisit(withProgress, false)?.id).toBe('a');

    const noProgress = [mk('b', 'pending', '2026-03-04T10:00:00.000Z')];
    expect(pickNextUpVisit(noProgress, false)?.id).toBe('b');
  });

  it('normalizes optional fields safely', () => {
    const normalized = normalizeTodayBooking({
      id: 'n1',
      status: 'pending',
      startAt: '2026-03-04T10:00:00.000Z',
      endAt: '2026-03-04T11:00:00.000Z',
    });

    expect(normalized.clientName).toBe('Client');
    expect(normalized.pets).toEqual([]);
    expect(normalized.mapLink).toBeNull();
    expect(normalized.clientPhone).toBeNull();
  });
});
