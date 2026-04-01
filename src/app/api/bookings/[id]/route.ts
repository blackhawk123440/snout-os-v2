import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireAnyRole } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { logEvent } from '@/lib/log-event';
import { enqueueCalendarSync } from '@/lib/calendar-queue';
import { ensureEventQueueBridge } from '@/lib/event-queue-bridge-init';
import { emitBookingUpdated } from '@/lib/event-emitter';
import { syncConversationLifecycleWithBookingWorkflow } from '@/lib/messaging/conversation-service';
import { emitClientLifecycleNoticeIfNeeded } from '@/lib/messaging/lifecycle-client-copy';

function truncateExternalEventId(id: string | null | undefined): string | null {
  if (!id) return null;
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function extractSyncError(eventLog: { error?: string | null; metadata?: string | null } | null): string | null {
  if (!eventLog) return null;
  if (eventLog.error) return eventLog.error;
  if (!eventLog.metadata) return null;
  try {
    const parsed = JSON.parse(eventLog.metadata) as Record<string, unknown>;
    const direct =
      (typeof parsed.error === 'string' && parsed.error) ||
      (typeof parsed.message === 'string' && parsed.message);
    if (direct) return direct;
    const metaError =
      typeof parsed.metadata === 'object' && parsed.metadata
        ? (parsed.metadata as Record<string, unknown>).error
        : null;
    return typeof metaError === 'string' ? metaError : null;
  } catch {
    return null;
  }
}

const ALLOWED_BOOKING_STATUSES = new Set([
  'pending',
  'pending_payment',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
]);

const VALID_STATUS_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  pending: new Set(['confirmed', 'cancelled']),
  pending_payment: new Set(['confirmed', 'cancelled']),
  confirmed: new Set(['pending', 'in_progress', 'cancelled']),
  in_progress: new Set(['completed', 'cancelled']),
  completed: new Set([]),
  cancelled: new Set([]),
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext(_request);
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const db = getScopedDb(ctx);
    const booking = await db.booking.findFirst({
      where: { id },
      include: {
        sitter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            calendarSyncEnabled: true,
            googleCalendarId: true,
          },
        },
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        pets: { select: { id: true, name: true, species: true, notes: true } },
        timeSlots: { select: { id: true, startAt: true, endAt: true, duration: true }, orderBy: { startAt: 'asc' } },
        reports: { take: 1, orderBy: { createdAt: 'desc' }, select: { id: true, createdAt: true } },
        calendarEvents: {
          select: {
            googleCalendarEventId: true,
            lastSyncedAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const [latestSucceededCharge, latestCalendarFailure, thread] = await Promise.all([
      db.stripeCharge.findFirst({
        where: { bookingId: booking.id, status: 'succeeded' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          currency: true,
          paymentIntentId: true,
        },
      }),
      db.eventLog.findFirst({
        where: {
          bookingId: booking.id,
          status: 'failed',
          eventType: { in: ['calendar.sync.failed', 'calendar.dead', 'calendar.repair.failed'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, error: true, metadata: true },
      }),
      db.messageThread.findFirst({
        where: { bookingId: booking.id },
        select: { id: true },
      }),
    ]);
    const [latestPaymentLinkMessage, latestTipLinkMessage] = await Promise.all([
      thread
        ? db.messageEvent.findFirst({
            where: {
              threadId: thread.id,
              direction: 'outbound',
              metadataJson: { contains: '"templateType":"payment_link"' },
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              createdAt: true,
              deliveryStatus: true,
              providerMessageSid: true,
              failureDetail: true,
            },
          })
        : Promise.resolve(null),
      thread
        ? db.messageEvent.findFirst({
            where: {
              threadId: thread.id,
              direction: 'outbound',
              metadataJson: { contains: '"templateType":"tip_link"' },
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              createdAt: true,
              deliveryStatus: true,
              providerMessageSid: true,
              failureDetail: true,
            },
          })
        : Promise.resolve(null),
    ]);

    const calendarMapping = booking.calendarEvents?.[0] ?? null;
    const syncError = extractSyncError(latestCalendarFailure);
    const hasCalendarSync = Boolean(calendarMapping?.googleCalendarEventId);
    const calendarStatus = !booking.sitter
      ? 'not_assigned'
      : !booking.sitter.calendarSyncEnabled
        ? 'disabled'
        : hasCalendarSync
          ? 'synced'
          : syncError
            ? 'failed'
            : 'pending';

    return NextResponse.json({
      booking: {
        id: booking.id,
        firstName: booking.firstName,
        lastName: booking.lastName,
        phone: booking.phone,
        email: booking.email,
        address: booking.address,
        pickupAddress: booking.pickupAddress,
        dropoffAddress: booking.dropoffAddress,
        service: booking.service,
        startAt: booking.startAt,
        endAt: booking.endAt,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        totalPrice: Number(booking.totalPrice),
        notes: booking.notes,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        threadId: thread?.id ?? null,
        sitter: booking.sitter,
        client: booking.client,
        pets: booking.pets,
        timeSlots: booking.timeSlots,
        hasReport: booking.reports.length > 0,
        paymentProof: latestSucceededCharge
          ? {
              status: 'paid',
              amount: Number(latestSucceededCharge.amount) / 100,
              paidAt: latestSucceededCharge.createdAt,
              bookingReference: booking.id,
              paymentReference: latestSucceededCharge.id,
              paymentIntentId: latestSucceededCharge.paymentIntentId ?? null,
              currency: latestSucceededCharge.currency || 'usd',
              receiptLink: null,
              inferred: false,
            }
          : booking.paymentStatus === 'paid'
            ? {
                status: 'paid',
                amount: Number(booking.totalPrice),
                paidAt: booking.updatedAt,
                bookingReference: booking.id,
                paymentReference: 'legacy-import',
                paymentIntentId: null,
                currency: 'usd',
                receiptLink: null,
                inferred: true,
              }
            : null,
        calendarSyncProof: {
          status: calendarStatus,
          externalEventId: truncateExternalEventId(calendarMapping?.googleCalendarEventId),
          connectedCalendar: booking.sitter?.googleCalendarId || null,
          connectedAccount: booking.sitter
            ? `${booking.sitter.firstName} ${booking.sitter.lastName}`.trim()
            : null,
          lastSyncedAt: calendarMapping?.lastSyncedAt ?? null,
          syncError,
          openInGoogleCalendarUrl: calendarMapping?.googleCalendarEventId
            ? `https://calendar.google.com/calendar/u/0/r/search?q=${encodeURIComponent(
                calendarMapping.googleCalendarEventId
              )}`
            : null,
        },
        paymentMessageState: latestPaymentLinkMessage
          ? {
              status: latestPaymentLinkMessage.deliveryStatus,
              sentAt: latestPaymentLinkMessage.createdAt,
              providerMessageId: latestPaymentLinkMessage.providerMessageSid,
              error: latestPaymentLinkMessage.failureDetail,
            }
          : null,
        tipMessageState: latestTipLinkMessage
          ? {
              status: latestTipLinkMessage.deliveryStatus,
              sentAt: latestTipLinkMessage.createdAt,
              providerMessageId: latestTipLinkMessage.providerMessageSid,
              error: latestTipLinkMessage.failureDetail,
            }
          : null,
      },
    });
  } catch (error: unknown) {
    console.error('[Booking API] Failed to load booking:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load booking', message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const db = getScopedDb(ctx);
    const body = (await request.json()) as {
      status?: string;
      sitterId?: string | null;
      startAt?: string;
      endAt?: string;
      forceConflict?: boolean;
      overrideReason?: string;
      meetAndGreetScheduledAt?: string | null;
      meetAndGreetConfirmed?: boolean;
      clientApprovedSitter?: boolean;
      sitterApprovedClient?: boolean;
    };
    const existing = await db.booking.findFirst({
      where: { id },
      select: {
        id: true,
        orgId: true,
        clientId: true,
        status: true,
        sitterId: true,
        service: true,
        startAt: true,
        endAt: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });
    if (!existing) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const data: Record<string, unknown> = {};
    const requestedStatus = typeof body.status === 'string' ? body.status.trim() : '';
    if (requestedStatus) {
      if (!ALLOWED_BOOKING_STATUSES.has(requestedStatus)) {
        return NextResponse.json(
          {
            error: 'Invalid booking status',
            allowedStatuses: Array.from(ALLOWED_BOOKING_STATUSES),
          },
          { status: 400 }
        );
      }

      if (requestedStatus !== existing.status) {
        const validNextStatuses = VALID_STATUS_TRANSITIONS[existing.status] ?? new Set<string>();
        if (!validNextStatuses.has(requestedStatus)) {
          return NextResponse.json(
            {
              error: 'Invalid booking status transition',
              from: existing.status,
              to: requestedStatus,
              allowedTransitions: Array.from(validNextStatuses),
            },
            { status: 409 }
          );
        }
      }

      data.status = requestedStatus;
    }
    // Handle sitterId change
    if (body.sitterId === null) {
      data.sitterId = null;
    } else if (typeof body.sitterId === 'string') {
      data.sitterId = body.sitterId;
    }

    // Handle time changes
    if (body.startAt) {
      const parsed = new Date(body.startAt);
      if (!Number.isNaN(parsed.getTime())) data.startAt = parsed;
    }
    if (body.endAt) {
      const parsed = new Date(body.endAt);
      if (!Number.isNaN(parsed.getTime())) data.endAt = parsed;
    }

    // Conflict check: when sitter, startAt, or endAt changes and booking has an assigned sitter
    const effectiveSitterId = (data.sitterId !== undefined ? data.sitterId : existing.sitterId) as string | null;
    const effectiveStart = (data.startAt as Date | undefined) ?? existing.startAt;
    const effectiveEnd = (data.endAt as Date | undefined) ?? existing.endAt;
    const sitterIsChanging = data.sitterId !== undefined && data.sitterId !== existing.sitterId;
    const timeIsChanging = data.startAt !== undefined || data.endAt !== undefined;

    if (effectiveSitterId && (sitterIsChanging || timeIsChanging)) {
      const { checkAssignmentAllowed } = await import('@/lib/availability/booking-conflict');
      const conflictCheck = await checkAssignmentAllowed({
        db,
        orgId: ctx.orgId,
        sitterId: effectiveSitterId,
        start: effectiveStart,
        end: effectiveEnd,
        excludeBookingId: id,
        force: body.forceConflict === true,
        actorUserId: ctx.userId ?? undefined,
        bookingId: id,
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

      // Mark booking as conflict-overridden (visible in UI)
      if (conflictCheck.conflicts.length > 0 && body.forceConflict) {
        data.conflictOverrideAt = new Date();
        data.conflictOverrideBy = ctx.userId ?? 'unknown';
        data.conflictOverrideReason = body.overrideReason ?? null;
        // Log override with full payload
        const { logEvent: logEvt } = await import('@/lib/log-event');
        await logEvt({
          orgId: ctx.orgId,
          action: 'booking.conflict_override',
          bookingId: id,
          actorUserId: ctx.userId ?? undefined,
          status: 'success',
          metadata: {
            sitterId: effectiveSitterId,
            conflicts: conflictCheck.conflicts,
            overrideReason: body.overrideReason ?? 'not provided',
            sitterChanged: sitterIsChanging,
            timeChanged: timeIsChanging,
          },
        }).catch(() => {});
      }
    }

    const parseOptionalDate = (value: string | null | undefined): Date | null | undefined => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    };
    const meetAndGreetScheduledAt = parseOptionalDate(body.meetAndGreetScheduledAt);
    const meetAndGreetConfirmedAt =
      body.meetAndGreetConfirmed === true ? new Date() : body.meetAndGreetConfirmed === false ? null : undefined;
    const clientApprovedAt =
      body.clientApprovedSitter === true ? new Date() : body.clientApprovedSitter === false ? null : undefined;
    const sitterApprovedAt =
      body.sitterApprovedClient === true ? new Date() : body.sitterApprovedClient === false ? null : undefined;
    const hasWorkflowUpdate =
      meetAndGreetScheduledAt !== undefined ||
      meetAndGreetConfirmedAt !== undefined ||
      clientApprovedAt !== undefined ||
      sitterApprovedAt !== undefined;

    if (Object.keys(data).length === 0 && !hasWorkflowUpdate) {
      return NextResponse.json({ error: 'No supported fields to update' }, { status: 400 });
    }

    const updated =
      Object.keys(data).length > 0
        ? await db.booking.update({
            where: { id: existing.id },
            data,
            select: { id: true, status: true, sitterId: true, updatedAt: true },
          })
        : {
            id: existing.id,
            status: existing.status,
            sitterId: existing.sitterId,
            updatedAt: new Date(),
          };

    if (requestedStatus && requestedStatus !== existing.status) {
      await db.bookingStatusHistory.create({
        data: {
          orgId: ctx.orgId,
          bookingId: existing.id,
          fromStatus: existing.status,
          toStatus: requestedStatus,
          changedBy: ctx.userId ?? null,
          reason: 'owner_operator_update',
        },
      });
    }

    // Auto-charge on confirmation: when owner confirms a booking, attempt payment
    if (requestedStatus === 'confirmed' && existing.status !== 'confirmed') {
      void import('@/lib/payments/auto-charge').then(async ({ chargeOnConfirmation, getPaymentTiming }) => {
        try {
          const timing = await getPaymentTiming(ctx.orgId);
          if (timing === 'at_booking') {
            const fullBooking = await db.booking.findUnique({
              where: { id: existing.id },
              select: { totalPrice: true, service: true, firstName: true, lastName: true, email: true, phone: true, clientId: true },
            });
            if (fullBooking && Number(fullBooking.totalPrice) > 0 && fullBooking.clientId) {
              await chargeOnConfirmation({
                bookingId: existing.id,
                orgId: ctx.orgId,
                clientId: fullBooking.clientId,
                amount: Number(fullBooking.totalPrice),
                service: fullBooking.service || 'Pet Care',
                clientName: `${fullBooking.firstName || ''} ${fullBooking.lastName || ''}`.trim(),
                clientEmail: fullBooking.email,
                clientPhone: fullBooking.phone,
              });
            }
          }
        } catch (err) {
          console.error('[Booking PATCH] Auto-charge on confirmation failed:', err);
        }
      }).catch(() => {});

      // Set up messaging thread on confirmation (same as Stripe webhook does)
      void import('@/lib/bookings/booking-confirmed-handler').then(async ({ onBookingConfirmed }) => {
        try {
          await onBookingConfirmed({
            bookingId: existing.id,
            orgId: ctx.orgId,
            clientId: existing.clientId || '',
            sitterId: (data.sitterId as string) || existing.sitterId,
            startAt: new Date(existing.startAt),
            endAt: new Date(existing.endAt),
            actorUserId: ctx.userId || 'system',
          });
        } catch (err) {
          console.error('[Booking PATCH] onBookingConfirmed failed:', err);
        }
      }).catch(() => {});
    }

    // Fire-and-forget notifications for status/sitter changes
    const statusActuallyChanged = requestedStatus && requestedStatus !== existing.status;
    void import('@/lib/notifications/triggers').then(async (triggers) => {
      const clientName = `${existing.firstName} ${existing.lastName}`.trim();

      // Booking confirmed → client + sitter
      if (statusActuallyChanged && updated.status === 'confirmed' && existing.clientId) {
        triggers.notifyClientBookingConfirmed({
          orgId: ctx.orgId,
          bookingId: existing.id,
          clientId: existing.clientId,
          clientFirstName: existing.firstName,
          service: existing.service,
          startAt: existing.startAt,
        });
        // Notify sitter if assigned
        const effectiveSitter = (data.sitterId as string) || existing.sitterId;
        if (effectiveSitter) {
          triggers.notifySitterAssigned({
            orgId: ctx.orgId,
            bookingId: existing.id,
            sitterId: effectiveSitter,
            sitterFirstName: '',
            clientName,
            service: existing.service,
            startAt: existing.startAt,
          });
        }
      }

      // N5: Booking cancelled → sitter
      if (updated.status === 'cancelled' && existing.sitterId) {
        triggers.notifySitterBookingCancelled({
          orgId: ctx.orgId,
          bookingId: existing.id,
          sitterId: existing.sitterId,
          clientName,
          service: existing.service,
          startAt: existing.startAt,
        });
      }
      // Sitter reassigned on already-confirmed booking → notify the new sitter
      if (body.sitterId && body.sitterId !== existing.sitterId && !statusActuallyChanged && ['confirmed', 'in_progress'].includes(updated.status)) {
        triggers.notifySitterAssigned({
          orgId: ctx.orgId,
          bookingId: existing.id,
          sitterId: body.sitterId,
          sitterFirstName: '',
          clientName,
          service: existing.service,
          startAt: existing.startAt,
        });
      }

      // N6: Sitter changed → client (only if not a status change that already sent notifications)
      if (body.sitterId && body.sitterId !== existing.sitterId && existing.clientId && updated.status !== 'confirmed') {
        const newSitter = await db.sitter.findUnique({
          where: { id: body.sitterId },
          select: { firstName: true, lastName: true },
        });
        const pets = await db.pet.findMany({
          where: { bookingId: existing.id },
          select: { name: true },
        });
        triggers.notifyClientSitterChanged({
          orgId: ctx.orgId,
          bookingId: existing.id,
          clientId: existing.clientId,
          newSitterName: newSitter ? `${newSitter.firstName} ${newSitter.lastName}`.trim() : 'your new sitter',
          service: existing.service,
          startAt: existing.startAt,
          petNames: pets.map((p: any) => p.name).filter(Boolean).join(', '),
        });
      }
    }).catch(() => {});

    const lifecycleSync = await syncConversationLifecycleWithBookingWorkflow({
      orgId: ctx.orgId,
      bookingId: existing.id,
      clientId: existing.clientId,
      phone: existing.phone,
      firstName: existing.firstName,
      lastName: existing.lastName,
      sitterId: updated.sitterId,
      bookingStatus: updated.status,
      serviceWindowStart: existing.startAt,
      serviceWindowEnd: existing.endAt,
      meetAndGreetScheduledAt,
      meetAndGreetConfirmedAt,
      clientApprovedAt,
      sitterApprovedAt,
    }).catch((error) => {
      console.error('[Booking PATCH] Failed to sync messaging lifecycle:', error);
      return null;
    });
    if (lifecycleSync?.threadId && meetAndGreetScheduledAt) {
      void emitClientLifecycleNoticeIfNeeded({
        orgId: ctx.orgId,
        threadId: lifecycleSync.threadId,
        notice: 'meet_greet_scheduled',
        dedupeKey: `${existing.id}:${updated.updatedAt.toISOString()}`,
      }).catch(() => {});
    }
    if (lifecycleSync?.threadId && meetAndGreetConfirmedAt) {
      void emitClientLifecycleNoticeIfNeeded({
        orgId: ctx.orgId,
        threadId: lifecycleSync.threadId,
        notice: 'meet_greet_confirmed',
        dedupeKey: `${existing.id}:${updated.updatedAt.toISOString()}`,
      }).catch(() => {});
    }
    if (lifecycleSync?.threadId && clientApprovedAt && sitterApprovedAt) {
      void emitClientLifecycleNoticeIfNeeded({
        orgId: ctx.orgId,
        threadId: lifecycleSync.threadId,
        notice: 'service_activated',
        dedupeKey: `${existing.id}:${updated.updatedAt.toISOString()}`,
      }).catch(() => {});
    }

    // Calendar consistency: enqueue sync/delete so booking and calendar stay in sync
    const newStatus = (updated.status as string) ?? existing.status;
    const newSitterId = updated.sitterId ?? existing.sitterId;
    const cancelled = newStatus === 'cancelled';
    const sitterChanged = body.sitterId !== undefined && existing.sitterId !== newSitterId;

    if (existing.sitterId && (cancelled || sitterChanged)) {
      enqueueCalendarSync({
        type: 'delete',
        bookingId: existing.id,
        sitterId: existing.sitterId,
        orgId: ctx.orgId,
        correlationId: ctx.correlationId,
      }).catch((e) => console.error('[Booking PATCH] calendar delete enqueue failed:', e));
    }
    if (newSitterId && !cancelled) {
      enqueueCalendarSync({
        type: 'upsert',
        bookingId: existing.id,
        orgId: ctx.orgId,
        correlationId: ctx.correlationId,
      }).catch((e) => console.error('[Booking PATCH] calendar upsert enqueue failed:', e));
    }

    try {
      await ensureEventQueueBridge();
      const full = await db.booking.findFirst({
        where: { id: existing.id },
        include: { pets: true, timeSlots: true, sitter: true, client: true },
      });
      if (full) await emitBookingUpdated(full, existing.status, ctx.correlationId);
    } catch (err) {
      console.error('[Booking PATCH] Failed to emit booking.updated:', err);
    }

    return NextResponse.json({ booking: updated });
  } catch (error: unknown) {
    console.error('[Booking API] Failed to update booking:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to update booking', message }, { status: 500 });
  }
}

// ─── DELETE /api/bookings/[id] ──────────────────────────────────────

const DELETABLE_STATUSES = ['cancelled', 'expired', 'pending'];

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await context.params;
    const id = resolvedParams.id;
    const db = getScopedDb(ctx);

    const booking = await db.booking.findFirst({
      where: { id },
      select: { id: true, status: true, service: true, firstName: true, lastName: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (!DELETABLE_STATUSES.includes(booking.status)) {
      return NextResponse.json({
        error: `Cannot delete a booking with status "${booking.status}". Cancel it first.`,
      }, { status: 400 });
    }

    // Hard delete booking and related records in transaction
    await (db as any).$transaction(async (tx: any) => {
      await tx.bookingStatusHistory.deleteMany({ where: { bookingId: id } });
      await tx.bookingChecklistItem.deleteMany({ where: { bookingId: id } });
      await tx.bookingTagAssignment.deleteMany({ where: { bookingId: id } });
      await tx.customFieldValue.deleteMany({ where: { bookingId: id } });
      await tx.timeSlot.deleteMany({ where: { bookingId: id } });
      await tx.discountUsage.deleteMany({ where: { bookingId: id } });
      await tx.pet.updateMany({ where: { bookingId: id }, data: { bookingId: null } });
      await tx.report.deleteMany({ where: { bookingId: id } });
      await tx.offerEvent.deleteMany({ where: { bookingId: id } });
      await tx.visitEvent.deleteMany({ where: { bookingId: id } });
      await tx.sitterAvailabilityRequest.deleteMany({ where: { bookingId: id } });
      await tx.assignmentWindow.deleteMany({ where: { bookingId: id } });
      await tx.sitterPoolOffer.deleteMany({ where: { bookingId: id } });
      await tx.bookingSitterPool.deleteMany({ where: { bookingId: id } });
      await tx.bookingCalendarEvent.deleteMany({ where: { bookingId: id } });
      await tx.petHealthLog.deleteMany({ where: { bookingId: id } });
      await tx.sitterEarning.deleteMany({ where: { bookingId: id } });
      await tx.payoutTransfer.deleteMany({ where: { bookingId: id } });
      await tx.baselineSnapshot.deleteMany({ where: { bookingId: id } });
      await tx.eventLog.deleteMany({ where: { bookingId: id } });
      await tx.message.deleteMany({ where: { bookingId: id } });
      await tx.booking.delete({ where: { id } });
    });

    await logEvent({
      orgId: ctx.orgId,
      action: 'booking.deleted',
      status: 'success',
      metadata: {
        bookingId: id,
        status: booking.status,
        client: `${booking.firstName} ${booking.lastName}`.trim(),
        service: booking.service,
        deletedBy: ctx.userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[Booking API] Failed to delete booking:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to delete booking', message }, { status: 500 });
  }
}
