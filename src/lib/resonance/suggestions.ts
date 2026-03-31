/**
 * Resonance Suggestions
 * UI Constitution V1 - Phase 6
 * 
 * Suggestion generation from signals.
 */

import { Suggestion, Signal, BookingData, CalendarEventData } from './types';
import { calculateBookingPriorityScore, calculateCalendarEventPriorityScore } from './scoring';

/**
 * Generate suggestions from booking signals
 */
export function generateBookingSuggestions(
  booking: BookingData,
  signals: Signal[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const now = new Date();
  const startAt = typeof booking.startAt === 'string' ? new Date(booking.startAt) : booking.startAt;
  const hoursUntil = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Unassigned sitter suggestion
  const unassignedSignal = signals.find(s => s.id.includes('unassigned'));
  if (unassignedSignal) {
    const score = calculateBookingPriorityScore(booking);
    suggestions.push({
      id: `suggestion-${booking.id}-assign-sitter`,
      label: 'Assign Sitter Now',
      priorityScore: score,
      reason: 'This booking needs a sitter assigned',
      entityType: 'booking',
      entityId: booking.id,
      actionCommandId: 'booking.assign-sitter',
      constraints: {
        entityExists: true,
      },
    });
  }

  // Unpaid suggestion
  const unpaidSignal = signals.find(s => s.id.includes('unpaid'));
  if (unpaidSignal) {
    const score = calculateBookingPriorityScore(booking);
    suggestions.push({
      id: `suggestion-${booking.id}-collect-payment`,
      label: 'Collect Payment Now',
      priorityScore: score,
      reason: 'Payment has not been collected',
      entityType: 'booking',
      entityId: booking.id,
      actionCommandId: 'booking.collect-payment',
      constraints: {
        entityExists: true,
      },
    });
  }

  // Send confirmation for upcoming bookings
  if (hoursUntil > 0 && hoursUntil <= 24 && booking.status === 'confirmed') {
    const score = calculateBookingPriorityScore(booking);
    suggestions.push({
      id: `suggestion-${booking.id}-send-confirmation`,
      label: 'Send Confirmation Now',
      priorityScore: score + 10, // Boost for time proximity
      reason: 'Booking starts within 24 hours, send confirmation',
      entityType: 'booking',
      entityId: booking.id,
      actionCommandId: 'booking.send-confirmation',
      constraints: {
        entityExists: true,
      },
    });
  }

  // Review missing info
  const missingInfoSignals = signals.filter(s => 
    s.id.includes('missing-entry') || s.id.includes('missing-address')
  );
  if (missingInfoSignals.length > 0) {
    const score = calculateBookingPriorityScore(booking);
    suggestions.push({
      id: `suggestion-${booking.id}-review-missing-info`,
      label: 'Review Missing Info',
      priorityScore: score,
      reason: `Missing ${missingInfoSignals.length} critical detail(s)`,
      entityType: 'booking',
      entityId: booking.id,
      actionCommandId: 'booking.open-drawer',
      constraints: {
        entityExists: true,
      },
      metadata: {
        missingFields: missingInfoSignals.map(s => s.label),
      },
    });
  }

  return suggestions;
}

/**
 * Generate suggestions from calendar signals
 */
export function generateCalendarSuggestions(
  events: CalendarEventData[],
  signals: Signal[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Conflict resolution
  const conflictSignals = signals.filter(s => s.id.includes('conflict'));
  if (conflictSignals.length > 0) {
    // Group conflicts by sitter or unassigned
    const conflictGroups = new Map<string, Signal[]>();
    conflictSignals.forEach(signal => {
      const key = signal.entityId;
      if (!conflictGroups.has(key)) {
        conflictGroups.set(key, []);
      }
      conflictGroups.get(key)!.push(signal);
    });

    conflictGroups.forEach((groupSignals, eventId) => {
      const event = events.find(e => e.id === eventId);
      if (event) {
        const score = calculateCalendarEventPriorityScore(event) + 50; // Boost for conflicts
        suggestions.push({
          id: `suggestion-${eventId}-resolve-conflict`,
          label: 'Resolve Overlap',
          priorityScore: score,
          reason: 'Schedule conflict detected',
          entityType: 'calendarEvent',
          entityId: eventId,
          actionCommandId: 'calendar.event.open-booking',
          constraints: {
            entityExists: true,
          },
          metadata: {
            conflictCount: groupSignals.length,
          },
        });
      }
    });
  }

  // Unassigned events in next 48h
  const unassignedSignals = signals.filter(s => s.id.includes('unassigned-48h'));
  unassignedSignals.forEach(signal => {
    const event = events.find(e => e.id === signal.entityId);
    if (event) {
      const score = calculateCalendarEventPriorityScore(event);
      suggestions.push({
        id: `suggestion-${signal.entityId}-assign-sitter`,
        label: 'Assign Sitter',
        priorityScore: score,
        reason: 'Event in next 48h needs sitter',
        entityType: 'calendarEvent',
        entityId: signal.entityId,
        actionCommandId: 'booking.assign-sitter',
        constraints: {
          entityExists: true,
        },
      });
    }
  });

  return suggestions;
}

/**
 * Sort suggestions by priority score (highest first)
 */
export function sortSuggestionsByPriority(suggestions: Suggestion[]): Suggestion[] {
  return [...suggestions].sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Filter suggestions by constraints
 */
export function filterValidSuggestions(
  suggestions: Suggestion[],
  checkCommandAvailable?: (commandId: string) => boolean
): Suggestion[] {
  return suggestions.filter(suggestion => {
    if (suggestion.constraints?.commandAvailable !== undefined) {
      if (checkCommandAvailable && !checkCommandAvailable(suggestion.actionCommandId)) {
        return false;
      }
    }
    if (suggestion.constraints?.entityExists === false) {
      return false;
    }
    return true;
  });
}
