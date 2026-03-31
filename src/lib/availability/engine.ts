/**
 * Recurring Availability Engine
 *
 * RRULE-style recurring availability with merge logic and deterministic conflict detection.
 * - Recurring weekly windows (e.g., Mon–Fri 9–5)
 * - Recurring blackout rules (via overrides with isAvailable=false)
 * - One-off overrides (date-specific blocks/availability)
 * - Merge: existing bookings, optional Google busy blocks
 * - Output: availability windows for a sitter over a date range
 * - Conflict check: given (sitterId, start, end), return conflict reasons
 */

import type { PrismaClient } from "@prisma/client";
import {
  addDays,
  startOfDay,
  endOfDay,
  format,
  areIntervalsOverlapping,
} from "date-fns";
import { TZDate } from "@date-fns/tz";
import { getGoogleBusyRanges } from "@/lib/calendar/sync";

export type ConflictReason =
  | "booking_conflict"
  | "travel_buffer"
  | "blackout"
  | "google_busy"
  | "outside_availability";

export interface AvailabilityWindow {
  start: Date;
  end: Date;
}

export interface CheckConflictResult {
  ok: boolean;
  conflicts: { reason: ConflictReason; detail?: string }[];
}

const DEFAULT_TIMEZONE = "America/Chicago";

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function parseDaysOfWeek(json: string): number[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((n: unknown) => typeof n === "number" && n >= 0 && n <= 6) : [];
  } catch {
    return [];
  }
}

/**
 * Build a Date in the given timezone for a specific date and HH:mm time.
 */
function dateAtTimeInTz(
  date: Date,
  timeStr: string,
  tz: string
): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const y = date.getFullYear();
  const mo = date.getMonth();
  const d = date.getDate();
  const tzDate = new TZDate(y, mo, d, h ?? 0, m ?? 0, 0, 0, tz);
  return new Date(tzDate.getTime());
}

/**
 * Expand recurring rules into windows for each day in [start, end].
 */
function expandRecurringRules(
  rules: { daysOfWeek: string; startTime: string; endTime: string; timezone: string }[],
  rangeStart: Date,
  rangeEnd: Date
): AvailabilityWindow[] {
  const windows: AvailabilityWindow[] = [];
  let cursor = startOfDay(rangeStart);

  while (cursor <= rangeEnd) {
    const dayOfWeek = cursor.getDay(); // 0=Sun, 6=Sat
    const dateStr = format(cursor, "yyyy-MM-dd");

    for (const rule of rules) {
      const days = parseDaysOfWeek(rule.daysOfWeek);
      if (!days.includes(dayOfWeek)) continue;

      const tz = rule.timezone || DEFAULT_TIMEZONE;
      const start = dateAtTimeInTz(cursor, rule.startTime, tz);
      const end = dateAtTimeInTz(cursor, rule.endTime, tz);

      if (start < end && end > rangeStart && start < rangeEnd) {
        windows.push({
          start: start < rangeStart ? rangeStart : start,
          end: end > rangeEnd ? rangeEnd : end,
        });
      }
    }
    cursor = addDays(cursor, 1);
  }

  return windows;
}

/**
 * Apply overrides: isAvailable=false subtracts (blackout), isAvailable=true adds.
 */
function applyOverrides(
  baseWindows: AvailabilityWindow[],
  overrides: { date: Date; startTime: string; endTime: string; isAvailable: boolean; timezone?: string }[],
  rangeStart: Date,
  rangeEnd: Date
): AvailabilityWindow[] {
  let result = [...baseWindows];

  for (const ov of overrides) {
    const d = ov.date instanceof Date ? ov.date : new Date(ov.date);
    const tz = ov.timezone || DEFAULT_TIMEZONE;
    const start = dateAtTimeInTz(d, ov.startTime, tz);
    const end = dateAtTimeInTz(d, ov.endTime, tz);

    if (end <= rangeStart || start >= rangeEnd) continue;

    if (ov.isAvailable) {
      result.push({
        start: start < rangeStart ? rangeStart : start,
        end: end > rangeEnd ? rangeEnd : end,
      });
    } else {
      result = subtractBlock(result, { start, end });
    }
  }

  return mergeAndDedupe(result);
}

/**
 * Subtract a block from windows (blackout).
 */
function subtractBlock(
  windows: AvailabilityWindow[],
  block: { start: Date; end: Date }
): AvailabilityWindow[] {
  const out: AvailabilityWindow[] = [];
  for (const w of windows) {
    if (!areIntervalsOverlapping(w, block)) {
      out.push(w);
      continue;
    }
    if (w.start < block.start) {
      out.push({ start: w.start, end: block.start });
    }
    if (w.end > block.end) {
      out.push({ start: block.end, end: w.end });
    }
  }
  return out;
}

/**
 * Subtract blocks (bookings, time-off, google busy) from windows.
 */
function subtractBlocks(
  windows: AvailabilityWindow[],
  blocks: { start: Date; end: Date }[]
): AvailabilityWindow[] {
  let result = windows;
  for (const b of blocks) {
    result = subtractBlock(result, b);
  }
  return mergeAndDedupe(result);
}

/**
 * Merge overlapping/adjacent windows.
 */
function mergeAndDedupe(windows: AvailabilityWindow[]): AvailabilityWindow[] {
  if (windows.length === 0) return [];
  const sorted = [...windows].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: AvailabilityWindow[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr.start <= prev.end) {
      prev.end = curr.end > prev.end ? curr.end : prev.end;
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

/**
 * Get availability windows for a sitter over a date range.
 * Merges: recurring rules, overrides, subtracts bookings, SitterTimeOff, optional Google busy.
 */
export async function getAvailabilityWindows(params: {
  db: PrismaClient;
  orgId: string;
  sitterId: string;
  start: Date;
  end: Date;
  respectGoogleBusy?: boolean;
  excludeBookingId?: string; // when checking conflict for an existing booking update
}): Promise<AvailabilityWindow[]> {
  const { db, orgId, sitterId, start, end, respectGoogleBusy = false, excludeBookingId } = params;

  const sitter = await db.sitter.findFirst({
    where: { orgId, id: sitterId },
    select: { availabilityEnabled: true, timezone: true, respectGoogleBusy: true },
  });

  if (!sitter?.availabilityEnabled) {
    return [];
  }

  const tz = sitter.timezone || DEFAULT_TIMEZONE;
  const rangeStart = startOfDay(start);
  const rangeEnd = endOfDay(end);

  const [rules, overrides, bookings, timeOffs] = await Promise.all([
    db.sitterAvailabilityRule.findMany({
      where: { orgId, sitterId, active: true },
      select: { daysOfWeek: true, startTime: true, endTime: true, timezone: true },
    }),
    db.sitterAvailabilityOverride.findMany({
      where: {
        orgId,
        sitterId,
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: { date: true, startTime: true, endTime: true, isAvailable: true },
    }),
    db.booking.findMany({
      where: {
        orgId,
        sitterId,
        status: { notIn: ["cancelled"] },
        startAt: { lte: rangeEnd },
        endAt: { gte: rangeStart },
      },
      select: { id: true, startAt: true, endAt: true },
    }),
    db.sitterTimeOff.findMany({
      where: {
        orgId,
        sitterId,
        startsAt: { lte: rangeEnd },
        endsAt: { gte: rangeStart },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  let baseWindows = expandRecurringRules(
    rules.map((r) => ({ ...r, timezone: r.timezone || tz })),
    rangeStart,
    rangeEnd
  );

  baseWindows = applyOverrides(
    baseWindows,
    overrides.map((o) => ({
      date: o.date,
      startTime: o.startTime,
      endTime: o.endTime,
      isAvailable: o.isAvailable,
      timezone: tz,
    })),
    rangeStart,
    rangeEnd
  );

  const bookingBlocks = bookings
    .filter((b) => !excludeBookingId || b.id !== excludeBookingId)
    .map((b) => ({ start: b.startAt, end: b.endAt }));

  const timeOffBlocks = timeOffs.map((t) => ({ start: t.startsAt, end: t.endsAt }));

  let blocksToSubtract = [...bookingBlocks, ...timeOffBlocks];

  if (respectGoogleBusy && sitter.respectGoogleBusy) {
    const googleBusy = await getGoogleBusyRanges(db, sitterId, rangeStart, rangeEnd);
    blocksToSubtract = blocksToSubtract.concat(googleBusy);
  }

  return subtractBlocks(baseWindows, blocksToSubtract);
}

/**
 * Check if (sitterId, start, end) conflicts with availability.
 * Returns { ok, conflicts } with deterministic conflict reasons.
 */
/** Minimum minutes between back-to-back bookings for travel time. */
const DEFAULT_TRAVEL_BUFFER_MINUTES = 15;

export async function checkConflict(params: {
  db: PrismaClient;
  orgId: string;
  sitterId: string;
  start: Date;
  end: Date;
  excludeBookingId?: string;
  respectGoogleBusy?: boolean;
  /** Set to false to skip travel buffer check. Default true. */
  checkTravelBuffer?: boolean;
}): Promise<CheckConflictResult> {
  const { db, orgId, sitterId, start, end, excludeBookingId, respectGoogleBusy = false } = params;
  const conflicts: { reason: ConflictReason; detail?: string }[] = [];

  const sitter = await db.sitter.findFirst({
    where: { orgId, id: sitterId },
    select: { availabilityEnabled: true, timezone: true, respectGoogleBusy: true },
  });

  if (!sitter) {
    return { ok: false, conflicts: [{ reason: "outside_availability", detail: "Sitter not found" }] };
  }

  if (!sitter.availabilityEnabled) {
    return { ok: false, conflicts: [{ reason: "outside_availability", detail: "Sitter availability disabled" }] };
  }

  const tz = sitter.timezone || DEFAULT_TIMEZONE;
  const rangeStart = startOfDay(start);
  const rangeEnd = endOfDay(end);

  const [rules, overrides, bookings, timeOffs, googleBusy] = await Promise.all([
    db.sitterAvailabilityRule.findMany({
      where: { orgId, sitterId, active: true },
      select: { daysOfWeek: true, startTime: true, endTime: true, timezone: true },
    }),
    db.sitterAvailabilityOverride.findMany({
      where: {
        orgId,
        sitterId,
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: { date: true, startTime: true, endTime: true, isAvailable: true },
    }),
    db.booking.findMany({
      where: {
        orgId,
        sitterId,
        status: { notIn: ["cancelled"] },
        startAt: { lte: rangeEnd },
        endAt: { gte: rangeStart },
      },
      select: { id: true, startAt: true, endAt: true },
    }),
    db.sitterTimeOff.findMany({
      where: {
        orgId,
        sitterId,
        startsAt: { lte: rangeEnd },
        endsAt: { gte: rangeStart },
      },
      select: { startsAt: true, endsAt: true },
    }),
    respectGoogleBusy && sitter.respectGoogleBusy
      ? getGoogleBusyRanges(db, sitterId, rangeStart, rangeEnd)
      : Promise.resolve([]),
  ]);

  const probe = { start, end };

  for (const b of bookings) {
    if (excludeBookingId && b.id === excludeBookingId) continue;
    if (areIntervalsOverlapping(probe, { start: b.startAt, end: b.endAt })) {
      conflicts.push({ reason: "booking_conflict", detail: `Booking ${b.id}` });
    }
  }

  // Travel buffer check: ensure enough gap between adjacent bookings
  if (params.checkTravelBuffer !== false) {
    let travelBufferMin = DEFAULT_TRAVEL_BUFFER_MINUTES;
    try {
      const settings = await db.businessSettings.findFirst({
        where: { orgId },
        select: { travelBufferMinutes: true },
      });
      if (settings?.travelBufferMinutes != null) travelBufferMin = settings.travelBufferMinutes;
    } catch { /* fallback to default */ }
    const bufferMs = travelBufferMin * 60 * 1000;
    for (const b of bookings) {
      if (excludeBookingId && b.id === excludeBookingId) continue;
      // Already caught direct overlaps above; check tight adjacency
      if (areIntervalsOverlapping(probe, { start: b.startAt, end: b.endAt })) continue;

      // Check if probe ends too close before booking starts
      const gapAfterProbe = b.startAt.getTime() - end.getTime();
      if (gapAfterProbe >= 0 && gapAfterProbe < bufferMs) {
        conflicts.push({
          reason: "travel_buffer",
          detail: `Only ${Math.round(gapAfterProbe / 60000)}min gap before Booking ${b.id} (need ${travelBufferMin}min)`,
        });
      }

      // Check if booking ends too close before probe starts
      const gapBeforeProbe = start.getTime() - b.endAt.getTime();
      if (gapBeforeProbe >= 0 && gapBeforeProbe < bufferMs) {
        conflicts.push({
          reason: "travel_buffer",
          detail: `Only ${Math.round(gapBeforeProbe / 60000)}min gap after Booking ${b.id} (need ${travelBufferMin}min)`,
        });
      }
    }
  }

  for (const t of timeOffs) {
    if (areIntervalsOverlapping(probe, { start: t.startsAt, end: t.endsAt })) {
      conflicts.push({ reason: "blackout", detail: "Sitter time off" });
    }
  }

  for (const ov of overrides.filter((o) => !o.isAvailable)) {
    const d = ov.date instanceof Date ? ov.date : new Date(ov.date);
    const blockStart = dateAtTimeInTz(d, ov.startTime, tz);
    const blockEnd = dateAtTimeInTz(d, ov.endTime, tz);
    if (areIntervalsOverlapping(probe, { start: blockStart, end: blockEnd })) {
      conflicts.push({ reason: "blackout", detail: "Override blackout" });
    }
  }

  for (const g of googleBusy) {
    if (areIntervalsOverlapping(probe, g)) {
      conflicts.push({ reason: "google_busy", detail: "Google Calendar busy" });
    }
  }

  const baseWindows = expandRecurringRules(
    rules.map((r) => ({ ...r, timezone: r.timezone || tz })),
    rangeStart,
    rangeEnd
  );
  const withOverrides = applyOverrides(
    baseWindows,
    overrides.map((o) => ({
      date: o.date,
      startTime: o.startTime,
      endTime: o.endTime,
      isAvailable: o.isAvailable,
      timezone: tz,
    })),
    rangeStart,
    rangeEnd
  );

  const isFullyWithinAvailability = withOverrides.some(
    (w) => probe.start >= w.start && probe.end <= w.end
  );
  if (!isFullyWithinAvailability && conflicts.length === 0) {
    conflicts.push({ reason: "outside_availability", detail: "Outside recurring availability" });
  }

  return {
    ok: conflicts.length === 0,
    conflicts,
  };
}
