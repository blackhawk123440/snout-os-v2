/**
 * Analytics date range helpers.
 * Computes current period and previous period for range=7d|30d|90d|mtd.
 */

export type AnalyticsRange = '7d' | '30d' | '90d' | 'mtd';

export interface Period {
  start: Date;
  end: Date;
}

export function parseRange(range: string | null): AnalyticsRange {
  const r = (range || '30d').toLowerCase();
  if (r === '7d' || r === '30d' || r === '90d' || r === 'mtd') return r as AnalyticsRange;
  return '30d';
}

/**
 * Current period end = now. Start = range ago (or start of month for mtd).
 */
export function getCurrentPeriod(range: AnalyticsRange): Period {
  const end = new Date();
  const start = new Date();
  if (range === 'mtd') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    start.setDate(start.getDate() - days);
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

/**
 * Previous period: same length, ending at current period start.
 */
export function getPreviousPeriod(range: AnalyticsRange, currentStart: Date): Period {
  const end = new Date(currentStart);
  end.setMilliseconds(-1);
  const start = new Date(end);
  if (range === 'mtd') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    start.setDate(start.getDate() - days);
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

/** Start of today (UTC date, 00:00:00 local). */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Last N days from now (start at 00:00:00). */
export function lastDays(n: number): Period {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - n);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

export function trendPercent(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function trendDirection(current: number, previous: number): 'up' | 'down' | 'neutral' {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'neutral';
}

/** Range for trend APIs: 7d, 30d, 90d only (daily buckets). */
export type TrendRange = '7d' | '30d' | '90d';

export function parseTrendRange(range: string | null): TrendRange {
  const r = (range || '30d').toLowerCase();
  if (r === '7d' || r === '30d' || r === '90d') return r as TrendRange;
  return '30d';
}

export function getTrendDays(range: TrendRange): number {
  return range === '7d' ? 7 : range === '90d' ? 90 : 30;
}
