/**
 * GET /api/ops/daily-board?date=YYYY-MM-DD
 * Single endpoint powering the owner daily operations board.
 * Returns stats, sitter schedules, unassigned visits, and attention items.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import {
  dedupeAttentionItems,
  detectSitterOverlaps,
  sortAttentionItems,
  type AttentionItem,
} from '@/app/api/ops/command-center/attention/helpers';

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');

  // Parse target date (default today in server timezone)
  const now = new Date();
  let targetDate: Date;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    targetDate = new Date(dateParam + 'T00:00:00');
  } else {
    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const dayStart = new Date(targetDate);
  const dayEnd = new Date(targetDate);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const db = getScopedDb(ctx);

  try {
    // 1. Get all bookings for the day with relations
    const bookings = await db.booking.findMany({
      where: {
        startAt: { gte: dayStart, lt: dayEnd },
        status: { not: 'cancelled' },
      },
      select: {
        id: true,
        service: true,
        firstName: true,
        lastName: true,
        address: true,
        startAt: true,
        endAt: true,
        status: true,
        paymentStatus: true,
        totalPrice: true,
        sitterId: true,
        clientId: true,
        notes: true,
        sitter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            active: true,
          },
        },
        pets: {
          select: { name: true, species: true },
        },
      },
      orderBy: { startAt: 'asc' },
      take: 200,
    });

    // 2. Get visit events for check-in/out times
    const bookingIds = bookings.map((b) => b.id);
    const visitEvents = bookingIds.length
      ? await db.visitEvent.findMany({
          where: { bookingId: { in: bookingIds } },
          select: {
            bookingId: true,
            checkInAt: true,
            checkOutAt: true,
          },
        })
      : [];
    const visitEventByBooking = new Map(
      visitEvents.map((ve) => [ve.bookingId, ve])
    );

    // 3. Check for reports
    const reportRows = bookingIds.length
      ? await db.report.findMany({
          where: { bookingId: { in: bookingIds } },
          select: { bookingId: true },
          distinct: ['bookingId'] as any,
        })
      : [];
    const reportByBooking = new Set(reportRows.map((r: any) => r.bookingId));

    // 4. Check for message threads
    const threads = bookingIds.length
      ? await db.messageThread.findMany({
          where: { bookingId: { in: bookingIds } },
          select: { id: true, bookingId: true },
        })
      : [];
    const threadByBooking = new Map<string, string>();
    for (const thread of threads) {
      if (thread.bookingId) {
        threadByBooking.set(thread.bookingId, thread.id);
      }
    }

    // 5. Calculate stats
    const totalVisits = bookings.length;
    const completedVisits = bookings.filter((b) => b.status === 'completed').length;
    const inProgressVisits = bookings.filter((b) => b.status === 'in_progress').length;
    const upcomingVisits = bookings.filter((b) =>
      ['pending', 'confirmed'].includes(b.status)
    ).length;
    const unassignedBookings = bookings.filter((b) => !b.sitterId);
    const assignedBookings = bookings.filter((b) => b.sitterId);

    // Active sitters = unique sitters with bookings today
    const activeSitterIds = new Set(
      assignedBookings.map((b) => b.sitterId).filter(Boolean)
    );

    // Today revenue = sum of totalPrice for completed + paid bookings
    const todayRevenue = bookings
      .filter((b) => b.status === 'completed' || b.paymentStatus === 'paid')
      .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    // On-time rate from visit events
    const eventsWithCheckIn = visitEvents.filter((ve) => ve.checkInAt);
    let onTimeRate = 100;
    if (eventsWithCheckIn.length > 0) {
      const onTime = eventsWithCheckIn.filter((ve) => {
        const booking = bookings.find((b) => b.id === ve.bookingId);
        if (!booking || !ve.checkInAt) return true;
        const diff =
          new Date(ve.checkInAt).getTime() -
          new Date(booking.startAt).getTime();
        return diff <= 15 * 60 * 1000; // within 15 min
      }).length;
      onTimeRate = Math.round((onTime / eventsWithCheckIn.length) * 100);
    }

    // 6. Group by sitter
    const sitterMap = new Map<
      string,
      { sitter: typeof assignedBookings[0]['sitter']; visits: typeof assignedBookings }
    >();
    for (const b of assignedBookings) {
      if (!b.sitterId || !b.sitter) continue;
      const existing = sitterMap.get(b.sitterId);
      if (existing) {
        existing.visits.push(b);
      } else {
        sitterMap.set(b.sitterId, { sitter: b.sitter, visits: [b] });
      }
    }

    const sitterSchedules = Array.from(sitterMap.values()).map(
      ({ sitter, visits }) => ({
        sitter: {
          id: sitter!.id,
          firstName: sitter!.firstName,
          lastName: sitter!.lastName,
          phone: sitter!.phone,
          isAvailable: sitter!.active,
        },
        visits: visits.map((v) => {
          const ve = visitEventByBooking.get(v.id);
          return {
            bookingId: v.id,
            service: v.service,
            clientName: `${v.firstName || ''} ${v.lastName || ''}`.trim(),
            address: v.address,
            startAt: v.startAt.toISOString(),
            endAt: v.endAt.toISOString(),
            status: v.status,
            checkedInAt: ve?.checkInAt?.toISOString() ?? null,
            checkedOutAt: ve?.checkOutAt?.toISOString() ?? null,
            pets: v.pets.map((p) => ({
              name: p.name || '',
              species: p.species || '',
            })),
            paymentStatus: v.paymentStatus,
            hasReport: reportByBooking.has(v.id),
            threadId: threadByBooking.get(v.id) ?? null,
          };
        }),
      })
    );

    // Sort sitters by first visit start time
    sitterSchedules.sort((a, b) => {
      const aFirst = a.visits[0]?.startAt ?? '';
      const bFirst = b.visits[0]?.startAt ?? '';
      return aFirst.localeCompare(bFirst);
    });

    // 7. Unassigned visits
    const unassigned = unassignedBookings.map((b) => ({
      bookingId: b.id,
      service: b.service,
      clientName: `${b.firstName || ''} ${b.lastName || ''}`.trim(),
      address: b.address,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      pets: b.pets.map((p) => ({
        name: p.name || '',
        species: p.species || '',
      })),
    }));

    // 8. Attention items — reuse command center detection
    const in24h = new Date(now);
    in24h.setHours(in24h.getHours() + 24);
    const in7d = new Date(now);
    in7d.setDate(in7d.getDate() + 7);

    const [unassignedUpcoming, assignedUpcoming] = await Promise.all([
      db.booking.findMany({
        where: {
          sitterId: null,
          status: { in: ['pending', 'confirmed'] },
          startAt: { gte: now, lte: in7d },
        },
        select: { id: true, firstName: true, lastName: true, service: true, startAt: true },
        orderBy: { startAt: 'asc' },
        take: 30,
      }),
      db.booking.findMany({
        where: {
          sitterId: { not: null },
          status: { in: ['pending', 'confirmed', 'in_progress'] },
          startAt: { gte: now, lte: in7d },
        },
        select: { id: true, sitterId: true, service: true, startAt: true, endAt: true },
        orderBy: { startAt: 'asc' },
        take: 300,
      }),
    ]);

    const coverageGaps = unassignedUpcoming.filter(
      (b) => new Date(b.startAt).getTime() <= in24h.getTime()
    );

    const overlaps = detectSitterOverlaps(
      assignedUpcoming.map((b) => ({
        id: b.id,
        sitterId: b.sitterId,
        startAt: b.startAt,
        endAt: b.endAt,
      }))
    );

    const rawAttention: AttentionItem[] = [];

    for (const b of coverageGaps) {
      const key = `coverage_gap:${b.id}`;
      rawAttention.push({
        id: key,
        itemKey: key,
        type: 'coverage_gap',
        category: 'staffing',
        entityId: b.id,
        title: 'Coverage gap',
        subtitle: `${b.service} for ${b.firstName || ''} ${b.lastName || ''}`.trim(),
        severity: 'high',
        dueAt: b.startAt.toISOString(),
        createdAt: b.startAt.toISOString(),
        primaryActionHref: `/bookings/${b.id}`,
        primaryActionLabel: 'Assign',
      });
    }

    for (const b of unassignedUpcoming) {
      const key = `unassigned:${b.id}`;
      rawAttention.push({
        id: key,
        itemKey: key,
        type: 'unassigned',
        category: 'staffing',
        entityId: b.id,
        title: 'Unassigned visit',
        subtitle: `${b.service} for ${b.firstName || ''} ${b.lastName || ''}`.trim(),
        severity: 'medium',
        dueAt: b.startAt.toISOString(),
        createdAt: b.startAt.toISOString(),
        primaryActionHref: `/bookings/${b.id}`,
        primaryActionLabel: 'Assign',
      });
    }

    for (const o of overlaps) {
      const entityId = `${o.bookingAId}_${o.bookingBId}`;
      const key = `overlap:${entityId}`;
      rawAttention.push({
        id: key,
        itemKey: key,
        type: 'overlap',
        category: 'staffing',
        entityId,
        title: 'Overlapping assignment',
        subtitle: `Sitter has overlapping booking windows.`,
        severity: 'medium',
        dueAt: o.overlapStart,
        createdAt: o.overlapStart,
        primaryActionHref: `/bookings/${o.bookingAId}`,
        primaryActionLabel: 'Assign',
      });
    }

    const attentionItems = sortAttentionItems(dedupeAttentionItems(rawAttention));

    return NextResponse.json({
      date: targetDate.toISOString().slice(0, 10),
      stats: {
        totalVisits,
        completedVisits,
        inProgressVisits,
        upcomingVisits,
        unassignedCount: unassignedBookings.length,
        activeSittersCount: activeSitterIds.size,
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        onTimeRate,
      },
      sitterSchedules,
      unassigned,
      attention: {
        alerts: attentionItems.filter((i) => i.category === 'alerts'),
        staffing: attentionItems.filter((i) => i.category === 'staffing'),
      },
    }, {
      headers: { 'Cache-Control': 'private, s-maxage=10, stale-while-revalidate=5' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load daily board', message },
      { status: 500 }
    );
  }
}
