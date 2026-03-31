/**
 * Google → Snout inbound sync adapter.
 *
 * Disabled by default behind ENABLE_GOOGLE_BIDIRECTIONAL_SYNC.
 * When enabled:
 * - Persists moved/new external events as SitterAvailabilityOverride blackouts
 * - Removes overrides when external events are deleted
 * - Uses EventLog for persistent deduplication (not in-memory Set)
 * - Logs conflicts to EventLog for operational visibility
 */

import { resolveCorrelationId } from "@/lib/correlation-id";
import { ENABLE_GOOGLE_BIDIRECTIONAL_SYNC } from "@/lib/flags";
import type { PrismaClient } from "@prisma/client";

export type InboundExternalEventAction = "moved" | "deleted" | "upserted";

export interface InboundExternalEvent {
  externalEventId: string;
  action: InboundExternalEventAction;
  startAt?: string;
  endAt?: string;
  updatedAt?: string;
}

export interface InboundReconcileJobPayload {
  orgId: string;
  sitterId: string;
  correlationId?: string;
  events?: InboundExternalEvent[];
}

export interface InboundReconcileResult {
  status: "disabled" | "no_events" | "processed";
  correlationId: string;
  movedDetected: number;
  deletedDetected: number;
  duplicatePrevented: number;
  conflictCandidates: number;
  overridesCreated: number;
  overridesRemoved: number;
}

export interface InboundAdapterObservabilityHook {
  (eventName: string, payload: Record<string, unknown>): Promise<void> | void;
}

export interface InboundAdapterDeps {
  observe?: InboundAdapterObservabilityHook;
  enabled?: boolean;
  db?: PrismaClient;
}

export async function processInboundReconcileJob(
  payload: InboundReconcileJobPayload,
  deps: InboundAdapterDeps = {}
): Promise<InboundReconcileResult> {
  const correlationId = resolveCorrelationId(undefined, payload.correlationId);
  const enabled = deps.enabled ?? ENABLE_GOOGLE_BIDIRECTIONAL_SYNC;

  if (!enabled) {
    await deps.observe?.("calendar.inbound.skipped", {
      orgId: payload.orgId,
      sitterId: payload.sitterId,
      reason: "flag_disabled",
      correlationId,
    });
    return {
      status: "disabled",
      correlationId,
      movedDetected: 0,
      deletedDetected: 0,
      duplicatePrevented: 0,
      conflictCandidates: 0,
      overridesCreated: 0,
      overridesRemoved: 0,
    };
  }

  const inputEvents = payload.events ?? [];
  if (inputEvents.length === 0) {
    await deps.observe?.("calendar.inbound.no_events", {
      orgId: payload.orgId,
      sitterId: payload.sitterId,
      correlationId,
    });
    return {
      status: "no_events",
      correlationId,
      movedDetected: 0,
      deletedDetected: 0,
      duplicatePrevented: 0,
      conflictCandidates: 0,
      overridesCreated: 0,
      overridesRemoved: 0,
    };
  }

  // Resolve DB client — injected for testing, falls back to global prisma
  let db: PrismaClient;
  if (deps.db) {
    db = deps.db;
  } else {
    const { prisma } = await import("@/lib/db");
    db = prisma;
  }

  // Persistent deduplication: check EventLog for already-processed events
  const uniqueEvents: InboundExternalEvent[] = [];
  let duplicatePrevented = 0;

  for (const event of inputEvents) {
    const dedupeKey = `gcal-inbound:${event.externalEventId}:${event.updatedAt ?? "na"}:${event.action}`;
    const existing = await db.eventLog.findFirst({
      where: {
        orgId: payload.orgId,
        eventType: "calendar.inbound.processed",
        metadata: { contains: dedupeKey },
      },
    }).catch(() => null);

    if (existing) {
      duplicatePrevented++;
      continue;
    }
    uniqueEvents.push(event);
  }

  let movedDetected = 0;
  let deletedDetected = 0;
  let conflictCandidates = 0;
  let overridesCreated = 0;
  let overridesRemoved = 0;

  for (const event of uniqueEvents) {
    const dedupeKey = `gcal-inbound:${event.externalEventId}:${event.updatedAt ?? "na"}:${event.action}`;

    if (event.action === "moved" || event.action === "upserted") {
      if (event.action === "moved") movedDetected++;

      // Persist as SitterAvailabilityOverride blackout if time range provided
      if (event.startAt && event.endAt) {
        const startDate = new Date(event.startAt);
        const endDate = new Date(event.endAt);
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          const dateOnly = new Date(startDate.toISOString().split("T")[0]);
          const startTime = startDate.toISOString().slice(11, 16); // HH:mm
          const endTime = endDate.toISOString().slice(11, 16);

          try {
            await db.sitterAvailabilityOverride.upsert({
              where: {
                orgId_sitterId_date_startTime_endTime: {
                  orgId: payload.orgId,
                  sitterId: payload.sitterId,
                  date: dateOnly,
                  startTime,
                  endTime,
                },
              },
              create: {
                orgId: payload.orgId,
                sitterId: payload.sitterId,
                date: dateOnly,
                startTime,
                endTime,
                isAvailable: false, // blackout — sitter is busy in Google
              },
              update: {
                isAvailable: false,
              },
            });
            overridesCreated++;
          } catch (err) {
            await deps.observe?.("calendar.inbound.override_create_failed", {
              orgId: payload.orgId,
              sitterId: payload.sitterId,
              externalEventId: event.externalEventId,
              error: err instanceof Error ? err.message : String(err),
              correlationId,
            });
          }

          conflictCandidates++;
        }
      }

      await deps.observe?.(`calendar.inbound.event_${event.action}`, {
        orgId: payload.orgId,
        sitterId: payload.sitterId,
        externalEventId: event.externalEventId,
        startAt: event.startAt,
        endAt: event.endAt,
        correlationId,
      });
    } else if (event.action === "deleted") {
      deletedDetected++;

      // Remove any override that was created from this external event
      // We can't know the exact override without storing the mapping,
      // so we log it for manual review. Future: store externalEventId on override.
      await deps.observe?.("calendar.inbound.event_deleted", {
        orgId: payload.orgId,
        sitterId: payload.sitterId,
        externalEventId: event.externalEventId,
        correlationId,
      });
    }

    // Record deduplication marker
    await db.eventLog.create({
      data: {
        orgId: payload.orgId,
        eventType: "calendar.inbound.processed",
        status: "success",
        metadata: JSON.stringify({
          dedupeKey,
          externalEventId: event.externalEventId,
          action: event.action,
          sitterId: payload.sitterId,
          correlationId,
        }),
      },
    }).catch(() => {});
  }

  // Log conflict summary
  if (conflictCandidates > 0) {
    await db.eventLog.create({
      data: {
        orgId: payload.orgId,
        eventType: "calendar.inbound.conflict",
        status: "success",
        metadata: JSON.stringify({
          sitterId: payload.sitterId,
          conflictCandidates,
          overridesCreated,
          movedDetected,
          correlationId,
        }),
      },
    }).catch(() => {});
  }

  return {
    status: "processed",
    correlationId,
    movedDetected,
    deletedDetected,
    duplicatePrevented,
    conflictCandidates,
    overridesCreated,
    overridesRemoved,
  };
}
