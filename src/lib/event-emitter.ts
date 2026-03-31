/**
 * Event Emitter Layer
 *
 * This is the foundation for all automations. Every major action in the system
 * emits an event that the Automation Center can subscribe to.
 */

import { logEvent } from '@/lib/log-event';
import { redactPhoneLikeString } from '@/lib/privacy/redact-metadata';

type EventType =
  | "booking.created"
  | "booking.updated"
  | "booking.status.changed"
  | "booking.assigned"
  | "booking.completed"
  | "sitter.assigned"
  | "sitter.unassigned"
  | "sitter.changed"
  | "sitter.checked_in"
  | "sitter.checked_out"
  | "payment.success"
  | "payment.failed"
  | "visit.overdue"
  | "visit.completed"
  | "client.created"
  | "sitter.tier.changed"
  | "custom";

type EventContext = Record<string, any>;

type EventHandler = (context: EventContext) => Promise<void> | void;

class EventEmitter {
  private handlers: Map<EventType, EventHandler[]> = new Map();
  private globalHandlers: EventHandler[] = [];

  /**
   * Subscribe to a specific event type
   */
  on(eventType: EventType, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Subscribe to all events
   */
  onAll(handler: EventHandler): () => void {
    this.globalHandlers.push(handler);
    return () => {
      const index = this.globalHandlers.indexOf(handler);
      if (index > -1) {
        this.globalHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Emit an event
   */
  async emit(eventType: EventType, context: EventContext): Promise<void> {
    // Call specific handlers
    const handlers = this.handlers.get(eventType) || [];
    for (const handler of handlers) {
      try {
        await handler(context);
      } catch (error) {
        console.error(`Error in event handler for ${eventType}:`, error);
      }
    }

    // Call global handlers
    for (const handler of this.globalHandlers) {
      try {
        await handler({ ...context, eventType });
      } catch (error) {
        console.error(`Error in global event handler for ${eventType}:`, error);
      }
    }
  }

  /**
   * Remove all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.globalHandlers = [];
  }
}

// Singleton instance
export const eventEmitter = new EventEmitter();

/**
 * Helper functions to emit common events
 */
export async function emitBookingCreated(booking: any, correlationId?: string): Promise<void> {
  await eventEmitter.emit("booking.created", {
    bookingId: booking.id,
    booking,
    service: booking.service,
    clientName: `${booking.firstName} ${booking.lastName}`,
    clientPhone: redactPhoneLikeString(booking.phone),
    clientEmail: booking.email,
    totalPrice: booking.totalPrice,
    status: booking.status,
    correlationId,
  });
}

export async function emitBookingUpdated(
  booking: any,
  previousStatus?: string,
  correlationId?: string
): Promise<void> {
  await eventEmitter.emit("booking.updated", {
    bookingId: booking.id,
    booking,
    previousStatus,
    service: booking.service,
    clientName: `${booking.firstName} ${booking.lastName}`,
    totalPrice: booking.totalPrice,
    status: booking.status,
    correlationId,
  });

  // Also emit status change if status changed
  if (previousStatus && previousStatus !== booking.status) {
    await eventEmitter.emit("booking.status.changed", {
      bookingId: booking.id,
      booking,
      previousStatus,
      newStatus: booking.status,
      service: booking.service,
      correlationId,
    });
  }

  // Audit log for booking updates (including cancel)
  logEvent({
    orgId: booking.orgId || 'default',
    action: 'booking.updated',
    entityType: 'booking',
    entityId: booking.id,
    bookingId: booking.id,
    correlationId,
    metadata: {
      previousStatus,
      newStatus: booking.status,
      service: booking.service,
    },
  }).catch(() => {});
}

export async function emitSitterAssigned(
  booking: any,
  sitter: any,
  correlationId?: string
): Promise<void> {
  await eventEmitter.emit("sitter.assigned", {
    bookingId: booking.id,
    booking,
    sitterId: sitter.id,
    sitter,
    service: booking.service,
    clientName: `${booking.firstName} ${booking.lastName}`,
    correlationId,
  });

  await eventEmitter.emit("booking.assigned", {
    bookingId: booking.id,
    booking,
    sitterId: sitter.id,
    sitter,
    correlationId,
  });
}

export async function emitSitterUnassigned(
  booking: any,
  sitterId: string,
  correlationId?: string
): Promise<void> {
  await eventEmitter.emit("sitter.unassigned", {
    bookingId: booking.id,
    booking,
    sitterId,
    service: booking.service,
    correlationId,
  });
}

export async function emitPaymentSuccess(
  booking: any,
  amount: number,
  correlationId?: string
): Promise<void> {
  await eventEmitter.emit("payment.success", {
    bookingId: booking.id,
    booking,
    amount,
    service: booking.service,
    clientName: `${booking.firstName} ${booking.lastName}`,
    correlationId,
  });
}

export async function emitPaymentFailed(
  booking: any,
  error: string,
  correlationId?: string
): Promise<void> {
  await eventEmitter.emit("payment.failed", {
    bookingId: booking.id,
    booking,
    error,
    service: booking.service,
    correlationId,
  });
}

export async function emitSitterCheckedIn(
  booking: any,
  sitter: any,
  timeSlot?: any,
  correlationId?: string
): Promise<void> {
  await eventEmitter.emit("sitter.checked_in", {
    bookingId: booking.id,
    booking,
    sitterId: sitter.id,
    sitter,
    timeSlot,
    service: booking.service,
    correlationId,
  });
}

export async function emitSitterCheckedOut(
  booking: any,
  sitter: any,
  timeSlot?: any,
  correlationId?: string
): Promise<void> {
  await eventEmitter.emit("sitter.checked_out", {
    bookingId: booking.id,
    booking,
    sitterId: sitter.id,
    sitter,
    timeSlot,
    service: booking.service,
    correlationId,
  });
}

export async function emitVisitCompleted(
  booking: any,
  report: any,
  correlationId?: string
): Promise<void> {
  await eventEmitter.emit("visit.completed", {
    bookingId: booking.id,
    booking,
    report,
    service: booking.service,
    correlationId,
  });
}

export async function emitSitterTierChanged(
  sitter: any,
  previousTierId: string | null,
  newTierId: string,
  correlationId?: string
): Promise<void> {
  await eventEmitter.emit("sitter.tier.changed", {
    sitterId: sitter.id,
    sitter,
    previousTierId,
    newTierId,
    correlationId,
  });
}

export async function emitClientCreated(client: any, correlationId?: string): Promise<void> {
  await eventEmitter.emit("client.created", {
    clientId: client.id,
    client,
    clientName: `${client.firstName} ${client.lastName}`,
    phone: redactPhoneLikeString(client.phone),
    email: client.email,
    correlationId,
  });
}

export async function emitCustomEvent(
  eventName: string,
  context: EventContext,
  correlationId?: string
): Promise<void> {
  await eventEmitter.emit("custom", {
    ...context,
    customEventName: eventName,
    correlationId,
  });
}



