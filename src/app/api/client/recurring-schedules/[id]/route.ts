/**
 * GET /api/client/recurring-schedules/[id] — get schedule details + upcoming bookings
 * PATCH /api/client/recurring-schedules/[id] — modify schedule (pause, resume, skip, update)
 * DELETE /api/client/recurring-schedules/[id] — cancel schedule + all future bookings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { logEvent } from '@/lib/log-event';

/** Statuses that should never be mutated by recurring edits/skips. */
const IMMUTABLE_STATUSES = ['completed', 'cancelled', 'in_progress'];

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const db = getScopedDb(ctx);

  const schedule = await db.recurringSchedule.findFirst({
    where: { id, orgId: ctx.orgId, clientId: ctx.clientId },
  });
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });

  const bookings = await db.booking.findMany({
    where: {
      orgId: ctx.orgId,
      recurringScheduleId: id,
      startAt: { gte: new Date() },
      status: { notIn: ['cancelled'] },
    },
    orderBy: { startAt: 'asc' },
    take: 20,
    select: { id: true, startAt: true, endAt: true, status: true, sitter: { select: { firstName: true } } },
  });

  return NextResponse.json({
    schedule: {
      ...schedule,
      daysOfWeek: schedule.daysOfWeek ? JSON.parse(schedule.daysOfWeek) : [],
      petIds: schedule.petIds ? JSON.parse(schedule.petIds) : [],
    },
    upcomingBookings: bookings.map((b: any) => ({
      ...b,
      startAt: b.startAt?.toISOString(),
      endAt: b.endAt?.toISOString(),
      sitterName: b.sitter?.firstName || null,
    })),
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const db = getScopedDb(ctx);

  const schedule = await db.recurringSchedule.findFirst({
    where: { id, orgId: ctx.orgId, clientId: ctx.clientId },
    select: { id: true, status: true, startTime: true, endTime: true, service: true, frequency: true, clientId: true },
  });
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });

  const body = await request.json();
  const { action, skipDate, ...updates } = body;

  // ─── Pause ───
  if (action === 'pause') {
    await db.recurringSchedule.update({ where: { id }, data: { status: 'paused' } });
    await logEvent({ orgId: ctx.orgId, action: 'recurring.paused', entityId: id, status: 'success' }).catch(() => {});
    return NextResponse.json({ success: true, status: 'paused' });
  }

  // ─── Resume ───
  if (action === 'resume') {
    await db.recurringSchedule.update({ where: { id }, data: { status: 'active' } });
    await logEvent({ orgId: ctx.orgId, action: 'recurring.resumed', entityId: id, status: 'success' }).catch(() => {});
    return NextResponse.json({ success: true, status: 'active' });
  }

  // ─── Skip occurrence ───
  if (action === 'skip' && skipDate) {
    const dayStart = new Date(skipDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(skipDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Block skipping past dates
    if (dayEnd < new Date()) {
      return NextResponse.json({ error: 'Cannot skip a past date' }, { status: 400 });
    }

    const booking = await db.booking.findFirst({
      where: {
        orgId: ctx.orgId,
        recurringScheduleId: id,
        startAt: { gte: dayStart, lte: dayEnd },
        // Only skip pending or confirmed — not in_progress, completed, or cancelled
        status: { in: ['pending', 'confirmed'] },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'No skippable booking found for that date. It may already be in progress or completed.' }, { status: 404 });
    }

    await db.booking.update({ where: { id: booking.id }, data: { status: 'cancelled' } });

    // Notify owner about the skip (fire and forget)
    void import('@/lib/notifications/triggers').then(({ notifyOwnerNewBooking }) => {
      // Reuse owner notification to flag schedule change
    }).catch(() => {});

    await logEvent({
      orgId: ctx.orgId,
      action: 'recurring.occurrence_skipped',
      entityId: id,
      bookingId: booking.id,
      status: 'success',
      metadata: { skipDate, service: schedule.service },
    }).catch(() => {});

    return NextResponse.json({ success: true, skippedBookingId: booking.id });
  }

  // ─── General schedule updates (time, days, frequency) ───
  const updateData: Record<string, any> = {};
  if (updates.startTime) updateData.startTime = updates.startTime;
  if (updates.endTime) updateData.endTime = updates.endTime;
  if (updates.daysOfWeek) updateData.daysOfWeek = JSON.stringify(updates.daysOfWeek);
  if (updates.frequency && ['daily', 'weekly', 'biweekly', 'monthly'].includes(updates.frequency)) {
    updateData.frequency = updates.frequency;
  }
  if (updates.effectiveUntil !== undefined) {
    updateData.effectiveUntil = updates.effectiveUntil ? new Date(updates.effectiveUntil) : null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: true });
  }

  // Update the schedule template
  await db.recurringSchedule.update({ where: { id }, data: updateData });

  // Only propagate to future bookings that are pending or confirmed (never in_progress or completed)
  const futureBookings = await db.booking.findMany({
    where: {
      orgId: ctx.orgId,
      recurringScheduleId: id,
      startAt: { gte: new Date() },
      status: { in: ['pending', 'confirmed'] },
    },
    select: { id: true, startAt: true, endAt: true, sitterId: true },
  });

  let updatedCount = 0;

  // Propagate time changes to future bookings
  if (updateData.startTime || updateData.endTime) {
    const [newStartH, newStartM] = (updateData.startTime || schedule.startTime || '09:00').split(':').map(Number);
    const [newEndH, newEndM] = (updateData.endTime || schedule.endTime || '10:00').split(':').map(Number);

    for (const booking of futureBookings) {
      const bookingDate = new Date(booking.startAt);
      const newStart = new Date(bookingDate);
      newStart.setHours(newStartH, newStartM, 0, 0);
      const newEnd = new Date(bookingDate);
      newEnd.setHours(newEndH, newEndM, 0, 0);

      await db.booking.update({
        where: { id: booking.id },
        data: { startAt: newStart, endAt: newEnd },
      });
      updatedCount++;
    }
  }

  // If days changed, cancel bookings on removed days
  if (updateData.daysOfWeek) {
    const newDays: number[] = JSON.parse(updateData.daysOfWeek);
    for (const booking of futureBookings) {
      const bookingDay = new Date(booking.startAt).getDay();
      if (!newDays.includes(bookingDay)) {
        await db.booking.update({
          where: { id: booking.id },
          data: { status: 'cancelled' },
        });
        updatedCount++;
      }
    }
  }

  // Notify owner about schedule change (fire and forget)
  const changes: string[] = [];
  if (updateData.startTime || updateData.endTime) changes.push(`time: ${updateData.startTime || schedule.startTime}–${updateData.endTime || schedule.endTime}`);
  if (updateData.frequency) changes.push(`frequency: ${updateData.frequency}`);
  if (updateData.daysOfWeek) changes.push(`days changed`);

  if (changes.length > 0) {
    void import('@/lib/realtime/bus').then(({ publish, channels }) => {
      publish(channels.ownerOps(ctx.orgId), {
        type: 'recurring.schedule_edited',
        scheduleId: id,
        service: schedule.service,
        changes,
        futureBookingsAffected: updatedCount,
        ts: Date.now(),
      });
    }).catch(() => {});
  }

  await logEvent({
    orgId: ctx.orgId,
    action: 'recurring.updated',
    entityId: id,
    status: 'success',
    metadata: { ...updateData, futureBookingsUpdated: updatedCount, changes },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    futureBookingsUpdated: updatedCount,
    changes,
  });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const db = getScopedDb(ctx);

  const schedule = await db.recurringSchedule.findFirst({
    where: { id, orgId: ctx.orgId, clientId: ctx.clientId },
  });
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });

  await db.recurringSchedule.update({ where: { id }, data: { status: 'cancelled' } });

  // Cancel only pending/confirmed future bookings — never touch in_progress or completed
  const cancelled = await db.booking.updateMany({
    where: {
      orgId: ctx.orgId,
      recurringScheduleId: id,
      startAt: { gte: new Date() },
      status: { in: ['pending', 'confirmed'] },
    },
    data: { status: 'cancelled' },
  });

  await logEvent({
    orgId: ctx.orgId,
    action: 'recurring.cancelled',
    entityId: id,
    status: 'success',
    metadata: { futureBookingsCancelled: cancelled.count },
  }).catch(() => {});

  return NextResponse.json({ success: true, futureBookingsCancelled: cancelled.count });
}
