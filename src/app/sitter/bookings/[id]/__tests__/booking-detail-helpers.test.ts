import { describe, expect, it } from 'vitest';
import {
  formatDurationMinutes,
  formatElapsedTimer,
  getBookingPrimaryAction,
  getOptimisticStatus,
  getVisitTimerLabel,
  shouldRenderCopyAddress,
  shouldRenderMail,
  shouldRenderTel,
} from '@/app/sitter/bookings/[id]/booking-detail-helpers';

describe('booking detail helpers', () => {
  it('selects primary action from booking state', () => {
    expect(getBookingPrimaryAction('pending', false)).toBe('start');
    expect(getBookingPrimaryAction('confirmed', false)).toBe('start');
    expect(getBookingPrimaryAction('in_progress', false)).toBe('end');
    expect(getBookingPrimaryAction('completed', false)).toBe('write_report');
    expect(getBookingPrimaryAction('completed', true)).toBe('view_report');
  });

  it('renders tel/mailto/copy controls only when values exist', () => {
    expect(shouldRenderTel(null)).toBe(false);
    expect(shouldRenderTel('')).toBe(false);
    expect(shouldRenderTel('+15551234567')).toBe(true);

    expect(shouldRenderMail(null)).toBe(false);
    expect(shouldRenderMail('')).toBe(false);
    expect(shouldRenderMail('client@example.com')).toBe(true);

    expect(shouldRenderCopyAddress(null)).toBe(false);
    expect(shouldRenderCopyAddress('')).toBe(false);
    expect(shouldRenderCopyAddress('123 Main St')).toBe(true);
  });

  it('returns optimistic status transitions for start/end visit', () => {
    expect(getOptimisticStatus('confirmed', 'start')).toBe('in_progress');
    expect(getOptimisticStatus('in_progress', 'end')).toBe('completed');
  });

  it('formats duration + elapsed timer labels', () => {
    const start = '2026-03-03T10:00:00.000Z';
    const end = '2026-03-03T10:29:10.000Z';
    expect(formatDurationMinutes(start, end)).toBe('29m');
    expect(formatElapsedTimer(start, new Date('2026-03-03T10:18:42.000Z').getTime())).toBe('00:18:42');
    expect(getVisitTimerLabel('in_progress', start, null, new Date('2026-03-03T10:18:42.000Z').getTime())).toBe(
      'In progress — 00:18:42'
    );
    expect(getVisitTimerLabel('completed', start, end)).toBe('Duration 29m');
  });
});
