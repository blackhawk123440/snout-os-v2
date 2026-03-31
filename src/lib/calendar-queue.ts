/**
 * Calendar sync queue - one-way Snout OS → Google
 */

import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { getScopedDb } from '@/lib/tenancy';
import { upsertEventForBooking, deleteEventForBooking, syncRangeForSitter } from '@/lib/calendar/sync';
import { logEvent } from '@/lib/log-event';
import { publish, channels } from '@/lib/realtime/bus';
import { attachQueueWorkerInstrumentation, recordQueueJobQueued } from '@/lib/queue-observability';
import { resolveCorrelationId } from '@/lib/correlation-id';
import { processInboundReconcileJob, type InboundExternalEvent } from '@/lib/calendar/bidirectional-adapter';

const DEAD_LETTER_AFTER_ATTEMPTS = 5;

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

export const calendarQueue = new Queue('calendar-sync', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export type CalendarJobType =
  | { type: 'upsert'; bookingId: string; orgId: string; correlationId?: string }
  | { type: 'delete'; bookingId: string; sitterId: string; orgId: string; correlationId?: string }
  | { type: 'syncRange'; sitterId: string; start: string; end: string; orgId: string; correlationId?: string }
  | { type: 'inboundReconcile'; sitterId: string; orgId: string; events?: InboundExternalEvent[]; correlationId?: string }
  | { type: 'inboundPoll'; orgId?: string; correlationId?: string };

export async function enqueueCalendarSync(job: CalendarJobType): Promise<string | null> {
  const jobCorrelationId = job.correlationId ?? resolveCorrelationId();
  const payload = { ...job, correlationId: jobCorrelationId };

  // Determine job ID (idempotent for upsert/delete, undefined for others)
  let jobId: string | undefined;
  if (job.type === 'upsert') jobId = `upsert:${job.bookingId}`;
  else if (job.type === 'delete') jobId = `delete:${job.bookingId}:${job.sitterId}`;

  const j = await calendarQueue.add(`calendar:${job.type}`, payload, { jobId });

  // Determine resource metadata based on job type
  const orgId = ('orgId' in job ? job.orgId : undefined) ?? 'default';
  const resourceType = (job.type === 'syncRange' || job.type === 'inboundReconcile') ? 'sitter'
    : job.type === 'inboundPoll' ? 'system'
    : 'booking';
  const resourceId = job.type === 'upsert' ? job.bookingId
    : job.type === 'delete' ? job.bookingId
    : job.type === 'syncRange' ? job.sitterId
    : job.type === 'inboundReconcile' ? job.sitterId
    : 'inbound-poll';

  await recordQueueJobQueued({
    queueName: calendarQueue.name,
    jobName: `calendar:${job.type}`,
    jobId: String(j.id),
    orgId,
    subsystem: "calendar",
    resourceType,
    resourceId,
    correlationId: jobCorrelationId,
    payload: payload as Record<string, unknown>,
  });
  return j?.id ?? null;
}

function createCalendarWorker(): Worker {
  const workerInstance = new Worker(
    'calendar-sync',
    async (job) => {
      const data = job.data as CalendarJobType;

      // inboundPoll is handled at the end (no org-scoped DB needed)

      if (data.type === 'upsert') {
        const db = getScopedDb({ orgId: data.orgId });
        const result = await upsertEventForBooking(db, data.bookingId, data.orgId);
        await logEvent({
          orgId: data.orgId,
          actorUserId: 'system',
          action: 'calendar.sync.succeeded',
          entityType: 'calendar',
          entityId: data.bookingId,
          correlationId: data.correlationId,
          metadata: { bookingId: data.bookingId, action: result.action, ...(result.error && { error: result.error }) },
        });
        return result;
      }

      if (data.type === 'delete') {
        const db = getScopedDb({ orgId: data.orgId });
        const result = await deleteEventForBooking(db, data.bookingId, data.sitterId, data.orgId);
        await logEvent({
          orgId: data.orgId,
          actorUserId: 'system',
          action: result.deleted ? 'calendar.sync.succeeded' : 'calendar.sync.failed',
          entityType: 'calendar',
          entityId: data.bookingId,
          correlationId: data.correlationId,
          metadata: { bookingId: data.bookingId, sitterId: data.sitterId, deleted: result.deleted, error: result.error },
        });
        return result;
      }

      if (data.type === 'syncRange') {
        const db = getScopedDb({ orgId: data.orgId });
        const result = await syncRangeForSitter(
          db,
          data.sitterId,
          new Date(data.start),
          new Date(data.end),
          data.orgId
        );
        await logEvent({
          orgId: data.orgId,
          actorUserId: 'system',
          action: 'calendar.repair.succeeded',
          entityType: 'calendar',
          entityId: data.sitterId,
          correlationId: data.correlationId,
          metadata: { sitterId: data.sitterId, ...result },
        });
        return result;
      }

      if (data.type === 'inboundReconcile') {
        const result = await processInboundReconcileJob(
          {
            orgId: data.orgId,
            sitterId: data.sitterId,
            events: data.events,
            correlationId: data.correlationId,
          },
          {
            observe: async (eventName, payload) => {
              await logEvent({
                orgId: data.orgId,
                actorUserId: 'system',
                action: eventName,
                entityType: 'calendar',
                entityId: data.sitterId,
                correlationId: data.correlationId,
                metadata: payload,
              });
            },
          }
        );
        await logEvent({
          orgId: data.orgId,
          actorUserId: 'system',
          action: 'calendar.inbound.processed',
          entityType: 'calendar',
          entityId: data.sitterId,
          correlationId: data.correlationId,
          metadata: result as unknown as Record<string, unknown>,
        });
        return result;
      }

      if (data.type === 'inboundPoll') {
        // Dispatcher: find all sitters with calendar sync enabled, poll their calendars,
        // and enqueue individual inboundReconcile jobs per sitter.
        const { prisma } = await import('@/lib/db');
        const { fetchGoogleCalendarChanges } = await import('@/lib/calendar/sync');
        const { ENABLE_GOOGLE_BIDIRECTIONAL_SYNC } = await import('@/lib/flags');

        if (!ENABLE_GOOGLE_BIDIRECTIONAL_SYNC) {
          return { status: 'disabled', reason: 'flag_off' };
        }

        // Find all sitters with calendar sync enabled and a refresh token
        const sitters = await prisma.sitter.findMany({
          where: {
            calendarSyncEnabled: true,
            googleRefreshToken: { not: null },
            deletedAt: null,
          },
          select: { id: true, orgId: true },
        });

        const since = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago (overlaps with 15-min schedule for safety)
        let polled = 0;
        let enqueued = 0;
        let errors = 0;

        for (const sitter of sitters) {
          try {
            const orgId = sitter.orgId ?? 'default';
            const sitterDb = getScopedDb({ orgId });
            const { events, error } = await fetchGoogleCalendarChanges(sitterDb, sitter.id, since, orgId);

            polled++;
            if (error) {
              errors++;
              await logEvent({
                orgId,
                actorUserId: 'system',
                action: 'calendar.inbound.poll_error',
                entityType: 'sitter',
                entityId: sitter.id,
                status: 'failed',
                correlationId: data.correlationId,
                metadata: { error },
              }).catch(() => {});
              continue;
            }

            if (events.length > 0) {
              await enqueueCalendarSync({
                type: 'inboundReconcile',
                sitterId: sitter.id,
                orgId,
                events,
                correlationId: data.correlationId,
              });
              enqueued++;
            }
          } catch (err) {
            errors++;
          }
        }

        const result = { status: 'polled', sittersPolled: polled, jobsEnqueued: enqueued, errors };
        await logEvent({
          orgId: 'default',
          actorUserId: 'system',
          action: 'calendar.inbound.poll_completed',
          entityType: 'system',
          correlationId: data.correlationId,
          metadata: result,
        }).catch(() => {});
        return result;
      }

      throw new Error(`Unknown calendar job type: ${(data as any).type}`);
    },
    {
      connection,
      concurrency: 2,
    }
  );
  attachQueueWorkerInstrumentation(workerInstance, (job) => {
    const data = job.data as CalendarJobType;
    const orgId = ('orgId' in data ? data.orgId : undefined) ?? 'default';
    const resourceType = (data.type === 'syncRange' || data.type === 'inboundReconcile') ? 'sitter'
      : data.type === 'inboundPoll' ? 'system'
      : 'booking';
    const resourceId = data.type === 'upsert' ? data.bookingId
      : data.type === 'delete' ? data.bookingId
      : data.type === 'syncRange' ? data.sitterId
      : data.type === 'inboundReconcile' ? data.sitterId
      : 'inbound-poll';
    return {
      orgId,
      subsystem: "calendar",
      resourceType,
      resourceId,
      correlationId: data.correlationId,
      payload: data as Record<string, unknown>,
    };
  });
  return workerInstance;
}

/**
 * Schedule repeatable inbound calendar sync.
 * Runs every 15 minutes when ENABLE_GOOGLE_BIDIRECTIONAL_SYNC is enabled.
 * Finds sitters with calendar sync enabled and enqueues inboundReconcile jobs.
 */
export async function scheduleInboundCalendarSync(): Promise<void> {
  const { ENABLE_GOOGLE_BIDIRECTIONAL_SYNC } = await import('@/lib/flags');
  if (!ENABLE_GOOGLE_BIDIRECTIONAL_SYNC) {
    console.log('[Calendar Queue] Inbound sync disabled (ENABLE_GOOGLE_BIDIRECTIONAL_SYNC=false)');
    return;
  }

  // Remove existing repeatable jobs for inbound sync
  const repeatableJobs = await calendarQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === 'calendar:inboundPoll') {
      await calendarQueue.removeRepeatableByKey(job.key);
    }
  }

  const correlationId = resolveCorrelationId();
  await calendarQueue.add(
    'calendar:inboundPoll',
    { type: 'inboundPoll', correlationId },
    {
      repeat: {
        pattern: '*/15 * * * *', // Every 15 minutes
      },
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  );
  console.log('[Calendar Queue] Inbound poll scheduled (every 15 minutes)');
}

let worker: Worker | null = null;

export function initializeCalendarWorker(): Worker {
  if (worker) return worker;
  worker = createCalendarWorker();

  worker.on('failed', async (job, err) => {
    const data = job?.data as CalendarJobType | undefined;
    try {
      const { captureWorkerError } = await import('@/lib/worker-sentry');
      captureWorkerError(err instanceof Error ? err : new Error(String(err)), {
        jobName: `calendar:${data?.type}`,
        orgId: data?.orgId,
        bookingId: (data as any)?.bookingId,
        correlationId: data?.correlationId,
      });
    } catch (_) {}
    const attempts = (job?.attemptsMade ?? 0) + 1;
    const isRepair = data?.type === 'syncRange';
    const action = isRepair ? 'calendar.repair.failed' : 'calendar.sync.failed';
    if (data?.orgId) {
      await logEvent({
        orgId: data.orgId,
        actorUserId: 'system',
        action,
        entityType: 'calendar',
        entityId: (data as any).bookingId || (data as any).sitterId || 'unknown',
        status: 'failed',
        correlationId: data.correlationId,
        metadata: { error: (err as Error).message, jobData: data, attempts },
      });
      publish(channels.opsFailures(data.orgId), {
        type: action,
        ts: Date.now(),
      }).catch(() => {});
    }
    if (job && attempts >= DEAD_LETTER_AFTER_ATTEMPTS) {
      try {
        await logEvent({
          orgId: data?.orgId ?? 'default',
          actorUserId: 'system',
          action: 'calendar.dead',
          entityType: 'calendar',
          entityId: (data as any)?.bookingId || (data as any)?.sitterId || 'unknown',
          status: 'failed',
          correlationId: data?.correlationId,
          metadata: {
            error: (err as Error).message,
            jobData: data,
            jobId: job.id,
            attempts,
          },
        });
        publish(channels.opsFailures(data?.orgId ?? 'default'), {
          type: 'calendar.dead',
          ts: Date.now(),
        }).catch(() => {});
      } catch (e) {
        console.error('[Calendar Queue] Failed to log dead letter:', e);
      }
    }
  });

  return worker;
}
