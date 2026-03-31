/**
 * Resonance Scoring
 * UI Constitution V1 - Phase 6
 * 
 * Priority scoring algorithm for suggestions.
 */

import { BookingData, CalendarEventData, ScoringConfig } from './types';

/**
 * Default scoring configuration
 */
export const defaultScoringConfig: ScoringConfig = {
  weights: {
    timeProximity24h: 50,
    timeProximity48h: 30,
    timeProximity7d: 10,
    unpaid: 40,
    unassigned: 35,
    conflict: 60,
    missingEntryInstructions: 25,
    missingAddress: 30,
  },
};

/**
 * Calculate time proximity score
 */
function getTimeProximityScore(startAt: Date | string, config: ScoringConfig): number {
  const start = typeof startAt === 'string' ? new Date(startAt) : startAt;
  const now = new Date();
  const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil <= 0) {
    return 0; // Past events get no proximity score
  }

  if (hoursUntil <= 24) {
    return config.weights.timeProximity24h;
  }
  if (hoursUntil <= 48) {
    return config.weights.timeProximity48h;
  }
  if (hoursUntil <= 7 * 24) {
    return config.weights.timeProximity7d;
  }

  return 0;
}

/**
 * Calculate booking priority score
 */
export function calculateBookingPriorityScore(
  booking: BookingData,
  config: ScoringConfig = defaultScoringConfig
): number {
  let score = 0;

  // Time proximity
  score += getTimeProximityScore(booking.startAt, config);

  // Unpaid status
  if (booking.paymentStatus === 'unpaid') {
    score += config.weights.unpaid;
  }

  // Unassigned sitter
  if (!booking.sitter?.id) {
    score += config.weights.unassigned;
  }

  // Missing entry instructions
  if (!booking.entryInstructions || booking.entryInstructions.trim() === '') {
    score += config.weights.missingEntryInstructions;
  }

  // Missing address
  if (!booking.address || booking.address.trim() === '') {
    score += config.weights.missingAddress;
  }

  return score;
}

/**
 * Calculate calendar event priority score
 */
export function calculateCalendarEventPriorityScore(
  event: CalendarEventData,
  config: ScoringConfig = defaultScoringConfig
): number {
  let score = 0;

  // Time proximity
  score += getTimeProximityScore(event.startAt, config);

  // Unassigned
  if (!event.sitter?.id) {
    score += config.weights.unassigned;
  }

  return score;
}

/**
 * Check if events overlap
 */
export function checkEventOverlap(
  event1: CalendarEventData,
  event2: CalendarEventData
): boolean {
  if (event1.sitter?.id && event2.sitter?.id && event1.sitter.id !== event2.sitter.id) {
    return false; // Different sitters, no conflict
  }

  const start1 = typeof event1.startAt === 'string' ? new Date(event1.startAt) : event1.startAt;
  const end1 = typeof event1.endAt === 'string' ? new Date(event1.endAt) : event1.endAt;
  const start2 = typeof event2.startAt === 'string' ? new Date(event2.startAt) : event2.startAt;
  const end2 = typeof event2.endAt === 'string' ? new Date(event2.endAt) : event2.endAt;

  return start1 < end2 && start2 < end1;
}

/**
 * Detect conflicts in event list
 */
export function detectConflicts(events: CalendarEventData[]): Map<string, CalendarEventData[]> {
  const conflicts = new Map<string, CalendarEventData[]>();

  for (let i = 0; i < events.length; i++) {
    const event1 = events[i];
    const conflictsForEvent: CalendarEventData[] = [];

    for (let j = i + 1; j < events.length; j++) {
      const event2 = events[j];
      if (checkEventOverlap(event1, event2)) {
        conflictsForEvent.push(event2);
        if (!conflicts.has(event2.id)) {
          conflicts.set(event2.id, [event1]);
        } else {
          conflicts.get(event2.id)!.push(event1);
        }
      }
    }

    if (conflictsForEvent.length > 0) {
      conflicts.set(event1.id, conflictsForEvent);
    }
  }

  return conflicts;
}
