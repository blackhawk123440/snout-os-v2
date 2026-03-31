/**
 * Generic event logging helper for critical actions.
 * Uses existing EventLog model. Does not throw; logs errors to console.
 */

import { prisma } from '@/lib/db';
import { publish, channels } from '@/lib/realtime/bus';
import { redactSensitiveMetadata } from '@/lib/privacy/redact-metadata';

export interface LogEventParams {
  orgId: string;
  actorUserId?: string;
  action: string; // e.g. "booking.created", "message.sent", "payment.completed"
  entityType?: string; // e.g. "booking", "message", "payment"
  entityId?: string;
  bookingId?: string;
  status?: 'success' | 'failed' | 'pending';
  metadata?: Record<string, unknown>;
  correlationId?: string; // preserved for call-site compatibility
}

const OPS_FAILURE_ACTIONS = ['message.failed', 'automation.failed', 'automation.dead', 'calendar.sync.failed', 'calendar.dead'];

/**
 * Log a critical action to EventLog. Fire-and-forget; never throws.
 */
export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    const metadata = redactSensitiveMetadata({
      actorUserId: params.actorUserId,
      entityType: params.entityType,
      entityId: params.entityId,
      ...params.metadata,
    });

    await (prisma as any).eventLog.create({
      data: {
        orgId: params.orgId,
        eventType: params.action,
        status: params.status ?? 'success',
        bookingId: params.bookingId ?? null,
        metadata: JSON.stringify(metadata),
      },
    });
    if (OPS_FAILURE_ACTIONS.includes(params.action)) {
      publish(channels.opsFailures(params.orgId), { type: params.action, ts: Date.now() }).catch(() => {});
    }
  } catch (err: unknown) {
    console.error('[logEvent] Failed to record:', {
      action: params.action,
      orgId: params.orgId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
