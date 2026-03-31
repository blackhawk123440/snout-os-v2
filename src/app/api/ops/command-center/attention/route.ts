import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireOwnerOrAdmin } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import {
  dedupeAttentionItems,
  detectSitterOverlaps,
  sortAttentionItems,
  type AttentionItem,
} from './helpers';

export async function GET(request: Request) {
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

  try {
    const db = getScopedDb(ctx);
    const now = new Date();
    const in24h = new Date(now);
    in24h.setHours(in24h.getHours() + 24);
    const in7d = new Date(now);
    in7d.setDate(in7d.getDate() + 7);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const [failedEvents, payoutFailures, unassignedBookings, assignedBookings] = await Promise.all([
      db.eventLog.findMany({
        where: {
          createdAt: { gte: weekAgo },
          OR: [
            { eventType: 'automation.failed' },
            { eventType: 'automation.dead' },
            { status: 'failed' },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      db.payoutTransfer.findMany({
        where: { status: 'failed' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          sitterId: true,
          bookingId: true,
          status: true,
          stripeTransferId: true,
          lastError: true,
          createdAt: true,
        },
      }),
      db.booking.findMany({
        where: {
          sitterId: null,
          status: { in: ['pending', 'confirmed'] },
          startAt: { gte: now, lte: in7d },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          service: true,
          startAt: true,
        },
        orderBy: { startAt: 'asc' },
        take: 30,
      }),
      db.booking.findMany({
        where: {
          sitterId: { not: null },
          status: { in: ['pending', 'confirmed', 'in_progress'] },
          startAt: { gte: now, lte: in7d },
        },
        select: {
          id: true,
          sitterId: true,
          service: true,
          startAt: true,
          endAt: true,
        },
        orderBy: { startAt: 'asc' },
        take: 300,
      }),
    ]);

    const calendarFailureCount = failedEvents.filter((event) => {
      const eventType = event.eventType?.toLowerCase() ?? '';
      const automationType = event.automationType?.toLowerCase() ?? '';
      const error = event.error?.toLowerCase() ?? '';
      return (
        eventType.includes('calendar') ||
        automationType.includes('calendar') ||
        error.includes('calendar')
      );
    }).length;
    const automationFailureCount = Math.max(0, failedEvents.length - calendarFailureCount);
    const coverageGapBookings = unassignedBookings.filter(
      (booking) => new Date(booking.startAt).getTime() <= in24h.getTime()
    );

    const overlaps = detectSitterOverlaps(
      assignedBookings.map((booking) => ({
        id: booking.id,
        sitterId: booking.sitterId,
        startAt: booking.startAt,
        endAt: booking.endAt,
      }))
    );

    const rawItems: AttentionItem[] = [];

    for (const event of failedEvents) {
      const eventType = event.eventType?.toLowerCase() ?? '';
      const automationType = event.automationType?.toLowerCase() ?? '';
      const errorText = event.error?.toLowerCase() ?? '';
      const isCalendarEvent =
        eventType.includes('calendar') ||
        automationType.includes('calendar') ||
        errorText.includes('calendar');
      const type = isCalendarEvent ? 'calendar_repair' : 'automation_failure';
      const entityId = event.bookingId ?? event.id;
      const itemKey = `${type}:${entityId}`;
      const actionEntityId = event.id;
      const calendarStart = new Date(event.createdAt);
      calendarStart.setDate(calendarStart.getDate() - 1);
      const calendarEnd = new Date(event.createdAt);
      calendarEnd.setDate(calendarEnd.getDate() + 14);
      const actionMeta =
        type === 'calendar_repair'
          ? {
              sitterId:
                (() => {
                  try {
                    const parsed = event.metadata ? JSON.parse(event.metadata) : null;
                    return typeof parsed?.sitterId === 'string' ? parsed.sitterId : null;
                  } catch {
                    return null;
                  }
                })(),
              start: calendarStart.toISOString(),
              end: calendarEnd.toISOString(),
            }
          : null;
      const calendarHref =
        actionMeta && typeof actionMeta.sitterId === 'string' && actionMeta.sitterId
          ? `/ops/calendar-repair?sitterId=${encodeURIComponent(String(actionMeta.sitterId))}&start=${encodeURIComponent(String(actionMeta.start))}&end=${encodeURIComponent(String(actionMeta.end))}`
          : '/ops/calendar-repair';

      rawItems.push({
        id: itemKey,
        itemKey,
        type,
        category: 'alerts',
        entityId,
        actionEntityId,
        actionMeta,
        title: isCalendarEvent ? 'Calendar repair needed' : 'Automation failure',
        subtitle: event.error || 'Automation run failed and requires owner retry.',
        severity: isCalendarEvent ? 'medium' : 'high',
        dueAt: null,
        createdAt: event.createdAt.toISOString(),
        primaryActionHref: isCalendarEvent
          ? calendarHref
          : `/ops/automation-failures?eventId=${encodeURIComponent(actionEntityId)}`,
        primaryActionLabel: isCalendarEvent ? 'Fix' : 'Retry',
      });
    }

    for (const payout of payoutFailures) {
      const itemKey = `payout_failure:${payout.id}`;
      const safeToRetry = !!payout.bookingId && !!payout.sitterId && !payout.stripeTransferId;
      rawItems.push({
        id: itemKey,
        itemKey,
        type: 'payout_failure',
        category: 'alerts',
        entityId: payout.id,
        actionEntityId: payout.id,
        actionMeta: {
          payoutId: payout.id,
          sitterId: payout.sitterId,
          bookingId: payout.bookingId,
          status: payout.status,
          safeToRetry,
          retryReason: safeToRetry
            ? null
            : !payout.bookingId
              ? 'No booking associated with this failed payout.'
              : 'Payout has transfer metadata and must be reviewed manually.',
          lastError: payout.lastError,
        },
        title: 'Payout failure',
        subtitle: payout.lastError || 'Failed transfer is blocking sitter payout.',
        severity: 'high',
        dueAt: payout.createdAt.toISOString(),
        createdAt: payout.createdAt.toISOString(),
        primaryActionHref: `/ops/payouts?status=failed&payoutId=${encodeURIComponent(payout.id)}&sitterId=${encodeURIComponent(payout.sitterId)}`,
        primaryActionLabel: 'Open',
      });
    }

    for (const booking of coverageGapBookings) {
      const key = `coverage_gap:${booking.id}`;
      rawItems.push({
        id: key,
        itemKey: key,
        type: 'coverage_gap',
        category: 'staffing',
        entityId: booking.id,
        title: 'Coverage gap',
        subtitle: `${booking.service} for ${booking.firstName || ''} ${booking.lastName || ''}`.trim(),
        severity: 'high',
        dueAt: booking.startAt.toISOString(),
        createdAt: booking.startAt.toISOString(),
        primaryActionHref: `/bookings/${booking.id}`,
        primaryActionLabel: 'Assign',
      });
    }

    for (const booking of unassignedBookings) {
      const key = `unassigned:${booking.id}`;
      rawItems.push({
        id: key,
        itemKey: key,
        type: 'unassigned',
        category: 'staffing',
        entityId: booking.id,
        title: 'Unassigned visit',
        subtitle: `${booking.service} for ${booking.firstName || ''} ${booking.lastName || ''}`.trim(),
        severity: 'medium',
        dueAt: booking.startAt.toISOString(),
        createdAt: booking.startAt.toISOString(),
        primaryActionHref: `/bookings/${booking.id}`,
        primaryActionLabel: 'Assign',
      });
    }

    for (const overlap of overlaps) {
      const entityId = `${overlap.bookingAId}_${overlap.bookingBId}`;
      const key = `overlap:${entityId}`;
      rawItems.push({
        id: key,
        itemKey: key,
        type: 'overlap',
        category: 'staffing',
        entityId,
        actionEntityId: overlap.bookingAId,
        actionMeta: {
          bookingAId: overlap.bookingAId,
          bookingBId: overlap.bookingBId,
          sitterId: overlap.sitterId,
        },
        title: 'Overlapping assignment',
        subtitle: `Sitter ${overlap.sitterId} has overlapping booking windows.`,
        severity: 'medium',
        dueAt: overlap.overlapStart,
        createdAt: overlap.overlapStart,
        primaryActionHref: `/bookings/${overlap.bookingAId}?overlapWith=${encodeURIComponent(overlap.bookingBId)}`,
        primaryActionLabel: 'Assign',
      });
    }

    const deduped = dedupeAttentionItems(rawItems);
    const itemKeys = deduped.map((item) => item.itemKey);
    const states = itemKeys.length
      ? await db.commandCenterAttentionState.findMany({
          where: {
            itemKey: { in: itemKeys },
          },
          select: {
            itemKey: true,
            handledAt: true,
            snoozedUntil: true,
          },
        })
      : [];
    const stateByKey = new Map(states.map((state) => [state.itemKey, state]));

    const { searchParams } = new URL(request.url);
    const view = (searchParams.get('view') || 'active').toLowerCase();

    const visible = sortAttentionItems(
      deduped.filter((item) => {
        const state = stateByKey.get(item.itemKey);
        if (view === 'snoozed') {
          return !!state?.snoozedUntil && state.snoozedUntil.getTime() > now.getTime();
        }
        if (view === 'handled') {
          if (!state?.handledAt) return false;
          const handledAt = state.handledAt.getTime();
          return handledAt >= now.getTime() - 24 * 60 * 60 * 1000;
        }
        if (!state) return true;
        if (state.handledAt) return false;
        if (state.snoozedUntil && state.snoozedUntil.getTime() > now.getTime()) return false;
        return true;
      })
    );

    return NextResponse.json({
      alerts: visible.filter((item) => item.category === 'alerts'),
      staffing: visible.filter((item) => item.category === 'staffing'),
      lastUpdatedAt: new Date().toISOString(),
      view,
      meta: {
        totalFailures: automationFailureCount + calendarFailureCount,
      },
    }, {
      headers: { 'Cache-Control': 'private, s-maxage=10, stale-while-revalidate=5' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load command center queues', message },
      { status: 500 }
    );
  }
}
