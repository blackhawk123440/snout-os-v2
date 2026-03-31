/**
 * Event-to-Queue Bridge
 * Subscribes to domain events and enqueues automation jobs.
 * booking.created → ownerNewBookingAlert (already done in form route)
 * booking.status.changed → confirmed → bookingConfirmation
 * visit.completed → postVisitThankYou + payout ledger (when payouts exist)
 * booking.created/updated/cancelled → calendar.sync (one-way Snout → Google)
 *
 * Must be initialized from Node.js runtime only (not Edge). Call from API routes
 * that emit events, e.g. form route, check-out route.
 */

import { eventEmitter } from "./event-emitter";
import { enqueueAutomation } from "./automation-queue";
import { enqueueCalendarSync } from "./calendar-queue";
import { logEventFromLogger } from "./event-logger";

let initialized = false;

function enqueueCalendarForBooking(booking: any, correlationId?: string): void {
  const orgId = booking?.orgId || 'default';
  const bookingId = booking?.id;
  const sitterId = booking?.sitterId;
  if (!bookingId) return;
  if (sitterId) {
    enqueueCalendarSync({ type: 'upsert', bookingId, orgId, correlationId }).catch((e) =>
      console.error('[EventQueueBridge] calendar upsert enqueue failed:', e)
    );
  }
}

export function initializeEventQueueBridge(): void {
  if (initialized) return;
  initialized = true;

  eventEmitter.on("booking.created", async (context: any) => {
    enqueueCalendarForBooking(context.booking, context.correlationId);
  });

  eventEmitter.on("booking.updated", async (context: any) => {
    const booking = context.booking;
    if (booking?.status === 'cancelled' && booking?.sitterId) {
      enqueueCalendarSync({
        type: 'delete',
        bookingId: booking.id,
        sitterId: booking.sitterId,
        orgId: booking.orgId || 'default',
        correlationId: context.correlationId,
      }).catch((e) => console.error('[EventQueueBridge] calendar delete enqueue failed:', e));
    } else {
      enqueueCalendarForBooking(booking, context.correlationId);
    }
  });

  eventEmitter.on("booking.assigned", async (context: any) => {
    enqueueCalendarForBooking(context.booking, context.correlationId);
  });

  eventEmitter.on("sitter.assigned", async (context: any) => {
    // Calendar sync still needed
    enqueueCalendarForBooking(context.booking, context.correlationId);
    // sitterAssignment automation DISABLED — replaced by notifySitterAssigned (N13)
    // called directly in PATCH /api/bookings/[id], accept/route.ts, callout-dispatch,
    // and bulk-reassign. Old automation sent duplicate SMS.
  });

  // checkinNotification DISABLED — replaced by notifyClientSitterCheckedIn (N12)
  // in check-in/route.ts. Old automation sent duplicate SMS.
  eventEmitter.on("sitter.checked_in", async () => { /* no-op: handled by centralized triggers */ });

  // checkoutNotification DISABLED — replaced by notifyClientVisitCompleted (N15)
  // in check-out/route.ts. Old automation sent duplicate SMS.
  eventEmitter.on("sitter.checked_out", async () => { /* no-op: handled by centralized triggers */ });

  eventEmitter.on("booking.status.changed", async (context: any) => {
    // bookingCancellation DISABLED — replaced by notifyClientBookingCancelled (N16),
    // notifySitterBookingCancelled (N5), and notifyOwnerClientCancelled (N17) in
    // cancel/route.ts and client/cancel/route.ts. Old automation sent duplicates.

    // bookingConfirmation DISABLED — replaced by notifyClientBookingConfirmed (N21)
    // in PATCH /api/bookings/[id]. Old automation sent duplicates.

    // Calendar sync still fires via other listeners. No action needed here.
    void context; // suppress unused warning
  });

  eventEmitter.on("visit.completed", async (context: any) => {
    const bookingId = context.bookingId;
    const orgId = context.booking?.orgId || "default";
    if (!bookingId) return;
    try {
      await enqueueAutomation(
        "postVisitThankYou",
        "client",
        { bookingId, orgId },
        `postVisitThankYou:client:${bookingId}`,
        context.correlationId
      );
      await logEventFromLogger("review.scheduled", "success", {
        orgId,
        bookingId,
        correlationId: context.correlationId,
        metadata: { recipient: "client" },
      });
      if (context.booking?.sitterId) {
        await enqueueAutomation(
          "postVisitThankYou",
          "sitter",
          { bookingId, sitterId: context.booking.sitterId, orgId },
          `postVisitThankYou:sitter:${bookingId}`,
          context.correlationId
        );
        await logEventFromLogger("review.scheduled", "success", {
          orgId,
          bookingId,
          correlationId: context.correlationId,
          metadata: { recipient: "sitter" },
        });
        const { enqueuePayoutForBooking } = await import("@/lib/payout/payout-queue");
        enqueuePayoutForBooking({
          orgId,
          bookingId,
          sitterId: context.booking.sitterId,
          correlationId: context.correlationId,
        }).catch((e) => console.error("[EventQueueBridge] Failed to enqueue payout:", e));
      }
    } catch (err) {
      console.error("[EventQueueBridge] Failed to enqueue postVisitThankYou:", err);
      await logEventFromLogger("review.scheduled", "failed", {
        orgId,
        bookingId,
        correlationId: context.correlationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
