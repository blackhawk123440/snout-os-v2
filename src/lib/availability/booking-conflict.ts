/**
 * Booking conflict validation for create/assign flows.
 * Enforces conflict detection; allows owner/admin override with force=true and audit log.
 */

import type { PrismaClient } from "@prisma/client";
import type { ConflictReason } from "./engine";

export class AvailabilityConflictError extends Error {
  constructor(
    message: string,
    public readonly conflicts: { reason: ConflictReason; detail?: string }[]
  ) {
    super(message);
    this.name = "AvailabilityConflictError";
  }
}
import { checkConflict } from "./engine";
import { logEvent } from "@/lib/log-event";

export interface ValidateSitterAssignmentParams {
  db: PrismaClient;
  orgId: string;
  sitterId: string;
  start: Date;
  end: Date;
  excludeBookingId?: string;
  respectGoogleBusy?: boolean;
}

export interface ValidateResult {
  ok: boolean;
  conflicts: { reason: ConflictReason; detail?: string }[];
}

/**
 * Validate sitter assignment for conflict. Does NOT apply override.
 */
export async function validateSitterAssignment(
  params: ValidateSitterAssignmentParams
): Promise<ValidateResult> {
  return checkConflict({
    db: params.db,
    orgId: params.orgId,
    sitterId: params.sitterId,
    start: params.start,
    end: params.end,
    excludeBookingId: params.excludeBookingId,
    respectGoogleBusy: params.respectGoogleBusy ?? true,
  });
}

/**
 * Check if assignment is allowed: either no conflicts, or force override by owner/admin.
 * Returns { allowed, conflicts }.
 * When force=true and there are conflicts, logs EventLog and allows.
 */
export async function checkAssignmentAllowed(params: {
  db: PrismaClient;
  orgId: string;
  sitterId: string;
  start: Date;
  end: Date;
  excludeBookingId?: string;
  respectGoogleBusy?: boolean;
  force?: boolean;
  actorUserId?: string;
  bookingId?: string;
}): Promise<{ allowed: boolean; conflicts: { reason: ConflictReason; detail?: string }[] }> {
  const result = await validateSitterAssignment({
    db: params.db,
    orgId: params.orgId,
    sitterId: params.sitterId,
    start: params.start,
    end: params.end,
    excludeBookingId: params.excludeBookingId,
    respectGoogleBusy: params.respectGoogleBusy,
  });

  if (result.ok) {
    return { allowed: true, conflicts: [] };
  }

  if (params.force) {
    await logEvent({
      action: "booking.availability_override",
      orgId: params.orgId,
      bookingId: params.bookingId ?? undefined,
      actorUserId: params.actorUserId,
      metadata: {
        sitterId: params.sitterId,
        start: params.start.toISOString(),
        end: params.end.toISOString(),
        conflicts: result.conflicts,
      },
    }).catch((e) => console.error("[Availability] Failed to log override:", e));
    return { allowed: true, conflicts: result.conflicts };
  }

  return { allowed: false, conflicts: result.conflicts };
}
