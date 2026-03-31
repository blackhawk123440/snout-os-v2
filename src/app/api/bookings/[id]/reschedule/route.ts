/**
 * POST /api/bookings/[id]/reschedule
 * Reschedules a booking to a new time and/or sitter.
 * Used by calendar drag-drop. Uses full availability engine for conflict detection.
 * Supports force override with reason.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { logEvent } from '@/lib/log-event';
import { checkAssignmentAllowed } from '@/lib/availability/booking-conflict';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bookingId } = await context.params;

  try {
    const body = await request.json();
    const { startAt, endAt, sitterId, forceConflict, overrideReason } = body;

    if (!startAt && !endAt && !sitterId) {
      return NextResponse.json({ error: 'At least one of startAt, endAt, or sitterId is required' }, { status: 400 });
    }

    const db = getScopedDb(ctx);

    // Get current booking
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        orgId: true,
        status: true,
        startAt: true,
        endAt: true,
        sitterId: true,
        clientId: true,
        firstName: true,
        lastName: true,
        service: true,
        phone: true,
      },
    });

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return NextResponse.json({ error: `Cannot reschedule a ${booking.status} booking` }, { status: 422 });
    }

    // Resolve effective values
    const targetSitterId = sitterId || booking.sitterId;
    const targetStart = startAt ? new Date(startAt) : booking.startAt;
    const targetEnd = endAt ? new Date(endAt) : booking.endAt;

    // Full conflict check via availability engine (includes travel buffer, blackouts, Google Calendar)
    if (targetSitterId) {
      const conflictCheck = await checkAssignmentAllowed({
        db,
        orgId: ctx.orgId,
        sitterId: targetSitterId,
        start: targetStart,
        end: targetEnd,
        excludeBookingId: bookingId,
        force: forceConflict === true,
        actorUserId: ctx.userId ?? undefined,
        bookingId,
      });

      if (!conflictCheck.allowed) {
        return NextResponse.json(
          {
            error: 'Scheduling conflict detected',
            conflictBlocked: true,
            conflicts: conflictCheck.conflicts,
          },
          { status: 409 }
        );
      }

      // Log override if conflicts were present but forced
      if (conflictCheck.conflicts.length > 0 && forceConflict) {
        await logEvent({
          orgId: ctx.orgId,
          actorUserId: ctx.userId || undefined,
          action: 'booking.reschedule_conflict_override',
          bookingId,
          status: 'success',
          metadata: {
            conflicts: conflictCheck.conflicts,
            overrideReason: overrideReason ?? 'not provided',
            targetSitterId,
            targetStart: targetStart.toISOString(),
            targetEnd: targetEnd.toISOString(),
          },
        }).catch(() => {});
      }
    }

    // Build update data
    const updateData: Record<string, any> = {};
    const changes: string[] = [];

    if (startAt) {
      updateData.startAt = new Date(startAt);
      changes.push(`time: ${new Date(startAt).toLocaleString()}`);
    }
    if (endAt) {
      updateData.endAt = new Date(endAt);
    }
    if (sitterId && sitterId !== booking.sitterId) {
      updateData.sitterId = sitterId;
      const newSitter = await db.sitter.findUnique({
        where: { id: sitterId },
        select: { firstName: true, lastName: true },
      });
      changes.push(`sitter: ${newSitter?.firstName} ${newSitter?.lastName}`);
    }

    // Update booking
    const updated = await db.booking.update({
      where: { id: bookingId },
      data: updateData,
      select: {
        id: true,
        startAt: true,
        endAt: true,
        sitterId: true,
        status: true,
        service: true,
        firstName: true,
        lastName: true,
      },
    });

    // Log the reschedule
    await logEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId || undefined,
      action: 'booking.rescheduled',
      entityType: 'booking',
      entityId: bookingId,
      bookingId,
      status: 'success',
      metadata: {
        changes,
        previousStartAt: booking.startAt,
        previousSitterId: booking.sitterId,
        newStartAt: updated.startAt,
        newSitterId: updated.sitterId,
      },
    }).catch(() => {});

    // Lifecycle sync with updated times
    try {
      const { syncConversationLifecycleWithBookingWorkflow } = await import('@/lib/messaging/conversation-service');
      await syncConversationLifecycleWithBookingWorkflow({
        orgId: ctx.orgId,
        bookingId,
        clientId: booking.clientId,
        phone: booking.phone,
        firstName: booking.firstName,
        lastName: booking.lastName,
        bookingStatus: updated.status,
        sitterId: updated.sitterId,
        serviceWindowStart: updated.startAt,
        serviceWindowEnd: updated.endAt,
      });
    } catch (syncErr) {
      console.error('[Reschedule] lifecycle sync failed (non-blocking):', syncErr);
    }

    // Centralized notifications (replaces legacy sendMessage)
    const notifClientId = booking.clientId;
    if (notifClientId) {
      void import('@/lib/notifications/triggers').then(({ notifyClientBookingRescheduled, notifySitterAssigned, notifyClientSitterChanged }) => {
        notifyClientBookingRescheduled({
          orgId: ctx.orgId,
          bookingId,
          clientId: notifClientId,
          clientFirstName: booking.firstName,
          service: booking.service,
          newStartAt: updated.startAt,
        });

        // If sitter changed, notify new sitter and inform client
        if (sitterId && sitterId !== booking.sitterId) {
          const newSitterName = changes.find((c: string) => c.startsWith('sitter:'))?.replace('sitter: ', '') || 'your sitter';
          notifySitterAssigned({
            orgId: ctx.orgId,
            bookingId,
            sitterId,
            sitterFirstName: newSitterName.split(' ')[0],
            clientName: `${booking.firstName} ${booking.lastName}`.trim(),
            service: booking.service,
            startAt: updated.startAt,
          });
          notifyClientSitterChanged({
            orgId: ctx.orgId,
            bookingId,
            clientId: notifClientId,
            newSitterName,
            service: booking.service,
            startAt: updated.startAt,
            petNames: '',
          });
        }
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      booking: updated,
      changes,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
