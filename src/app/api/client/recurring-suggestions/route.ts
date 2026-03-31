/**
 * GET /api/client/recurring-suggestions
 * Analyzes booking history and suggests recurring schedules.
 * "You book every Tuesday and Thursday — make it recurring?"
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

export async function GET() {
  let ctx;
  try { ctx = await getRequestContext(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  if (!ctx.clientId) return NextResponse.json({ suggestions: [] });

  try {
    const db = getScopedDb(ctx);
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Get completed bookings from last 3 months
    const bookings = await db.booking.findMany({
      where: {
        orgId: ctx.orgId,
        clientId: ctx.clientId,
        status: { in: ['completed', 'confirmed'] },
        startAt: { gte: threeMonthsAgo },
        recurringScheduleId: null, // Exclude already-recurring bookings
      },
      select: { service: true, startAt: true },
      orderBy: { startAt: 'asc' },
    });

    if (bookings.length < 4) return NextResponse.json({ suggestions: [] });

    // Group by service + day of week
    const patterns: Record<string, { service: string; dayOfWeek: number; count: number; times: string[] }> = {};

    for (const b of bookings) {
      const date = new Date(b.startAt);
      const dow = date.getDay();
      const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const key = `${b.service}:${dow}`;

      if (!patterns[key]) {
        patterns[key] = { service: b.service, dayOfWeek: dow, count: 0, times: [] };
      }
      patterns[key].count++;
      if (!patterns[key].times.includes(time)) patterns[key].times.push(time);
    }

    // Find patterns with 3+ occurrences (suggests weekly habit)
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const suggestions = Object.values(patterns)
      .filter(p => p.count >= 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(p => ({
        service: p.service,
        dayOfWeek: p.dayOfWeek,
        dayName: dayNames[p.dayOfWeek],
        frequency: 'weekly' as const,
        suggestedTime: p.times[0] || '9:00 AM',
        bookingCount: p.count,
        message: `You've booked ${p.service} on ${dayNames[p.dayOfWeek]}s ${p.count} times — make it recurring?`,
      }));

    // Check for multi-day patterns (e.g., Tue + Thu)
    const serviceGroups: Record<string, number[]> = {};
    for (const p of Object.values(patterns)) {
      if (p.count >= 2) {
        if (!serviceGroups[p.service]) serviceGroups[p.service] = [];
        serviceGroups[p.service].push(p.dayOfWeek);
      }
    }

    for (const [service, days] of Object.entries(serviceGroups)) {
      if (days.length >= 2 && days.length <= 5) {
        const dayLabels = days.sort().map(d => dayNames[d]);
        const existing = suggestions.find(s => s.service === service && s.frequency === 'weekly');
        if (!existing) {
          suggestions.unshift({
            service,
            dayOfWeek: days[0],
            dayName: dayLabels.join(' & '),
            frequency: 'weekly',
            suggestedTime: patterns[`${service}:${days[0]}`]?.times[0] || '9:00 AM',
            bookingCount: days.reduce((sum, d) => sum + (patterns[`${service}:${d}`]?.count || 0), 0),
            message: `You book ${service} on ${dayLabels.join(' and ')} regularly — set up a recurring schedule?`,
          });
        }
      }
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 3) });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
