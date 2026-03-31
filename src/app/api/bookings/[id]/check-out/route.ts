import { NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';
import { emitVisitCompleted } from '@/lib/event-emitter';
import { ensureEventQueueBridge } from '@/lib/event-queue-bridge-init';
import { publish, channels } from '@/lib/realtime/bus';
import { calculatePayoutForBooking, executePayout } from '@/lib/payout/payout-engine';
import { persistPayrollRunFromTransfer } from '@/lib/payroll/payroll-service';
import { syncConversationLifecycleWithBookingWorkflow } from '@/lib/messaging/conversation-service';
import { emitClientLifecycleNoticeIfNeeded } from '@/lib/messaging/lifecycle-client-copy';

/**
 * POST /api/bookings/[id]/check-out
 * Updates booking status to completed for sitter check-out. Requires SITTER role.
 * Accepts optional body: { lat?: number; lng?: number } for GPS capture.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter profile missing on session' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const db = getScopedDb(ctx);
    const booking = await db.booking.findFirst({
      where: { id, sitterId: ctx.sitterId },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status !== 'in_progress') {
      return NextResponse.json(
        { error: `Cannot check out: booking is ${booking.status}` },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const lat = typeof body.lat === 'number' ? body.lat : null;
    const lng = typeof body.lng === 'number' ? body.lng : null;

    await db.booking.update({
      where: { id },
      data: { status: 'completed' },
    });
    await (db as any).bookingStatusHistory.create({
      data: {
        orgId: ctx.orgId,
        bookingId: id,
        fromStatus: 'in_progress',
        toStatus: 'completed',
        changedBy: ctx.userId || 'sitter',
        reason: 'sitter_check_out',
      },
    }).catch((e: any) => console.error('[check-out] BookingStatusHistory failed:', e?.message));

    const lifecycleSync = await syncConversationLifecycleWithBookingWorkflow({
      orgId: ctx.orgId,
      bookingId: booking.id,
      clientId: booking.clientId,
      phone: booking.phone,
      firstName: booking.firstName,
      lastName: booking.lastName,
      sitterId: booking.sitterId,
      bookingStatus: 'completed',
      serviceWindowStart: booking.startAt,
      serviceWindowEnd: booking.endAt,
    }).catch((error) => {
      console.error('[check-out] lifecycle sync failed:', error);
      return null;
    });
    if (lifecycleSync?.threadId) {
      void emitClientLifecycleNoticeIfNeeded({
        orgId: ctx.orgId,
        threadId: lifecycleSync.threadId,
        notice: 'post_service_grace',
        dedupeKey: `${booking.id}:checkout`,
      }).catch(() => {});
    }

    const existingVisitEvent = await db.visitEvent.findFirst({
      where: { bookingId: id, sitterId: ctx.sitterId, orgId: ctx.orgId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (existingVisitEvent) {
      await db.visitEvent.update({
        where: { id: existingVisitEvent.id },
        data: {
          checkOutAt: new Date(),
          status: 'completed',
        },
      });
    }

    if (lat != null && lng != null) {
      await db.eventLog.create({
        data: {
          orgId: ctx.orgId,
          eventType: 'sitter.check_out',
          status: 'success',
          bookingId: id,
          metadata: JSON.stringify({ lat, lng, sitterId: ctx.sitterId, correlationId: ctx.correlationId }),
        },
      });
    }

    const updated = await db.booking.findUnique({
      where: { id },
      include: { sitter: true, pets: true },
    });
    if (updated) {
      await ensureEventQueueBridge();
      await emitVisitCompleted(updated, {}, ctx.correlationId);
      if (updated.sitterId) {
        publish(channels.sitterToday(updated.orgId ?? ctx.orgId, updated.sitterId), {
          type: 'visit.checkout',
          bookingId: id,
          ts: Date.now(),
        }).catch(() => {});
      }

      // SSE: notify client visit completed
      if (updated.clientId) {
        publish(channels.clientBooking(updated.orgId ?? ctx.orgId, updated.clientId), {
          type: 'visit.completed',
          bookingId: id,
          ts: Date.now(),
        }).catch(() => {});
      }

      // SSE: notify owner visit completed
      publish(channels.ownerOps(updated.orgId ?? ctx.orgId), {
        type: 'visit.completed',
        bookingId: id,
        sitterName: updated.sitter ? `${updated.sitter.firstName} ${updated.sitter.lastName}`.trim() : null,
        ts: Date.now(),
      }).catch(() => {});

      // SMS/push: notify client visit completed
      if (updated.clientId) {
        const petNames = (updated.pets || []).map((p: any) => p.name).filter(Boolean).join(', ');
        const sitterName = updated.sitter ? `${updated.sitter.firstName} ${updated.sitter.lastName}`.trim() : 'Your sitter';
        void import('@/lib/notifications/triggers').then(({ notifyClientVisitCompleted }) => {
          notifyClientVisitCompleted({
            orgId: ctx.orgId,
            bookingId: id,
            clientId: updated.clientId!,
            sitterName,
            petNames,
            service: updated.service,
          });
        }).catch(() => {});
      }

      // Assemble Visit Card (fire-and-forget — assembles GPS + photos + checklist)
      void import('@/lib/visit-card/assemble').then(({ assembleVisitCard }) => {
        assembleVisitCard(id, ctx.orgId).catch((e) =>
          console.error('[check-out] Visit card assembly failed:', e)
        );
      }).catch(() => {});

      // Log mileage (fire-and-forget — estimated from address)
      if (updated.sitterId && updated.address) {
        void (async () => {
          try {
            const month = new Date().toISOString().slice(0, 7);
            await (db as any).sitterMileageLog.upsert({
              where: { bookingId: id },
              create: {
                orgId: ctx.orgId,
                sitterId: updated.sitterId!,
                bookingId: id,
                month,
                estimatedMi: updated.estimatedMileage ?? 5, // Default 5 mi if no calculation
                toAddress: updated.address,
              },
              update: {},
            });
          } catch (e) {
            console.error('[check-out] Mileage log failed:', e);
          }
        })();
      }

      // Launch reliability: process payout synchronously as a fallback in web path.
      // Worker path remains active and idempotent; executePayout skips duplicates.
      if (updated.sitterId) {
        const totalPrice = Number(updated.totalPrice) || 0;
        if (totalPrice > 0) {
          const commissionPct = updated.sitter?.commissionPercentage ?? 80;
          const calc = calculatePayoutForBooking(totalPrice, commissionPct);
          if (calc.amountCents > 0) {
            try {
              const payoutResult = await executePayout({
                db: db as any,
                orgId: ctx.orgId,
                sitterId: updated.sitterId,
                bookingId: updated.id,
                amountCents: calc.amountCents,
                currency: 'usd',
                correlationId: ctx.correlationId,
              });
              if (payoutResult.success && payoutResult.payoutTransferId) {
                const commissionAmount = totalPrice - calc.netAmount;
                await persistPayrollRunFromTransfer(
                  db as any,
                  ctx.orgId,
                  payoutResult.payoutTransferId,
                  updated.sitterId,
                  totalPrice,
                  commissionAmount,
                  calc.netAmount
                ).catch((e) => console.error('[check-out] persistPayrollRunFromTransfer failed:', e));
              }
            } catch (payoutError) {
              console.error('[check-out] synchronous payout fallback failed:', payoutError);
            }
          }
        }
      }
    }

    // Pay-first flow: auto-payout for bookings where payment was collected pre-visit
    if (updated?.sitterId && ['paid', 'deposit_paid'].includes(updated.paymentStatus)) {
      void import('@/lib/payout/sitter-payout').then(({ processSitterPayout }) =>
        processSitterPayout({
          orgId: ctx.orgId,
          bookingId: id,
          sitterId: updated.sitterId!,
          correlationId: ctx.correlationId,
        })
      ).catch(err => console.error('[check-out] Pay-first auto-payout failed:', err));
    }

    // Award loyalty points for completed booking
    if (updated?.clientId) {
      void import('@/lib/loyalty/loyalty-engine').then(({ awardPoints, calculatePointsForAmount }) => {
        const totalPrice = Number(updated.totalPrice) || 0;
        const points = calculatePointsForAmount(totalPrice);
        if (points > 0) {
          return awardPoints(
            db as any,
            ctx.orgId,
            updated.clientId!,
            points,
            `Completed booking ${updated.id} ($${totalPrice.toFixed(2)})`
          );
        }
      }).catch(err => console.error('[check-out] Loyalty points award failed (non-blocking):', err));
    }

    // Deduct bundle visit if client has active matching bundle
    if (updated?.clientId && updated?.service) {
      void import('@/lib/bundles/bundle-usage').then(({ tryUseBundleVisit }) =>
        tryUseBundleVisit(db as any, ctx.orgId, updated.clientId!, updated.service!, updated.id)
      ).catch(err => console.error('[check-out] Bundle visit deduction failed (non-blocking):', err));
    }

    return NextResponse.json({ ok: true, status: 'completed' });
  } catch (error: unknown) {
    console.error('[Check-out API] Check-out failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Check-out failed', message },
      { status: 500 }
    );
  }
}
