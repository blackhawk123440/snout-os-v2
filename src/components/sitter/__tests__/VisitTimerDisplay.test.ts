import { describe, expect, it } from 'vitest';
import { formatDuration, formatElapsedTimer } from '../VisitTimerDisplay';

describe('VisitTimerDisplay helpers', () => {
  describe('formatElapsedTimer', () => {
    it('derives elapsed from checkedInAt and now (source of truth)', () => {
      const checkedInAt = '2026-03-03T10:00:00.000Z';
      const nowMs = new Date('2026-03-03T10:18:42.500Z').getTime();
      expect(formatElapsedTimer(checkedInAt, nowMs)).toBe('00:18:42');
    });

    it('pads hours and minutes with zero', () => {
      const checkedInAt = '2026-03-03T08:00:00.000Z';
      const nowMs = new Date('2026-03-03T09:05:03.000Z').getTime();
      expect(formatElapsedTimer(checkedInAt, nowMs)).toBe('01:05:03');
    });

    it('returns 00:00:00 when now is before or equal to start', () => {
      const checkedInAt = '2026-03-03T10:00:00.000Z';
      const nowMs = new Date('2026-03-03T09:59:59.000Z').getTime();
      expect(formatElapsedTimer(checkedInAt, nowMs)).toBe('00:00:00');
    });
  });

  describe('formatDuration', () => {
    it('returns "X min" for under 60 minutes', () => {
      const start = '2026-03-03T10:00:00.000Z';
      const end = '2026-03-03T10:29:00.000Z';
      expect(formatDuration(start, end)).toBe('29 min');
    });

    it('returns "Xh Ym" for 60 minutes or more', () => {
      const start = '2026-03-03T10:00:00.000Z';
      const end = '2026-03-03T11:30:00.000Z';
      expect(formatDuration(start, end)).toBe('1h 30m');
    });

    it('returns "Xh" when duration is exact hours', () => {
      const start = '2026-03-03T10:00:00.000Z';
      const end = '2026-03-03T12:00:00.000Z';
      expect(formatDuration(start, end)).toBe('2h');
    });

    it('rounds to nearest minute', () => {
      const start = '2026-03-03T10:00:00.000Z';
      const end = '2026-03-03T10:29:30.000Z';
      expect(formatDuration(start, end)).toBe('30 min');
    });
  });
});
