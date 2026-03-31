/**
 * Resonance Signals
 * UI Constitution V1 - Phase 6
 * 
 * Signal detection logic for bookings and calendar events.
 */

import { Signal, BookingData, CalendarEventData } from './types';
import { detectConflicts, checkEventOverlap } from './scoring';

/**
 * Detect signals for a booking
 */
export function detectBookingSignals(booking: BookingData): Signal[] {
  const signals: Signal[] = [];
  const now = new Date();
  const startAt = typeof booking.startAt === 'string' ? new Date(booking.startAt) : booking.startAt;
  const hoursUntil = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Unassigned sitter
  if (!booking.sitter?.id && booking.status !== 'cancelled' && booking.status !== 'completed') {
    signals.push({
      id: `signal-${booking.id}-unassigned`,
      label: 'Unassigned Sitter',
      severity: hoursUntil <= 24 ? 'critical' : hoursUntil <= 48 ? 'warning' : 'info',
      reason: 'This booking has no sitter assigned',
      entityType: 'booking',
      entityId: booking.id,
      createdAt: new Date(),
    });
  }

  // Unpaid booking
  if (booking.paymentStatus === 'unpaid' && booking.status !== 'cancelled') {
    signals.push({
      id: `signal-${booking.id}-unpaid`,
      label: 'Unpaid',
      severity: 'warning',
      reason: 'Payment has not been collected',
      entityType: 'booking',
      entityId: booking.id,
      createdAt: new Date(),
    });
  }

  // Booking within 24 hours
  if (hoursUntil > 0 && hoursUntil <= 24 && booking.status !== 'cancelled') {
    signals.push({
      id: `signal-${booking.id}-upcoming-24h`,
      label: 'Upcoming in 24h',
      severity: 'warning',
      reason: 'Booking starts within 24 hours',
      entityType: 'booking',
      entityId: booking.id,
      createdAt: new Date(),
    });
  }

  // Missing entry instructions
  if (!booking.entryInstructions || booking.entryInstructions.trim() === '') {
    signals.push({
      id: `signal-${booking.id}-missing-entry`,
      label: 'Missing Entry Instructions',
      severity: 'warning',
      reason: 'Entry instructions are missing',
      entityType: 'booking',
      entityId: booking.id,
      createdAt: new Date(),
    });
  }

  // Missing address
  if (!booking.address || booking.address.trim() === '') {
    signals.push({
      id: `signal-${booking.id}-missing-address`,
      label: 'Missing Address',
      severity: 'critical',
      reason: 'Address information is missing',
      entityType: 'booking',
      entityId: booking.id,
      createdAt: new Date(),
    });
  }

  // Schedule incomplete
  if (!booking.timeSlots || booking.timeSlots.length === 0) {
    if (booking.service !== 'Housesitting' && booking.service !== '24/7 Care') {
      signals.push({
        id: `signal-${booking.id}-incomplete-schedule`,
        label: 'Incomplete Schedule',
        severity: 'warning',
        reason: 'No visit times specified',
        entityType: 'booking',
        entityId: booking.id,
        createdAt: new Date(),
      });
    }
  }

  return signals;
}

/**
 * Detect signals for calendar events
 */
export function detectCalendarSignals(
  events: CalendarEventData[],
  options?: {
    heavyDayThreshold?: number; // Default: 5
    clusterWindowHours?: number; // Default: 4
  }
): Signal[] {
  const signals: Signal[] = [];
  const heavyDayThreshold = options?.heavyDayThreshold ?? 5;
  const clusterWindowHours = options?.clusterWindowHours ?? 4;
  const now = new Date();

  // Detect conflicts
  const conflicts = detectConflicts(events);
  conflicts.forEach((conflictingEvents, eventId) => {
    signals.push({
      id: `signal-${eventId}-conflict`,
      label: 'Schedule Conflict',
      severity: 'critical',
      reason: `Overlaps with ${conflictingEvents.length} other event(s)`,
      entityType: 'calendarEvent',
      entityId: eventId,
      createdAt: new Date(),
      metadata: {
        conflictingEventIds: conflictingEvents.map(e => e.id),
      },
    });
  });

  // Group events by day
  const eventsByDay = new Map<string, CalendarEventData[]>();
  events.forEach(event => {
    const start = typeof event.startAt === 'string' ? new Date(event.startAt) : event.startAt;
    const dayKey = start.toISOString().split('T')[0];
    if (!eventsByDay.has(dayKey)) {
      eventsByDay.set(dayKey, []);
    }
    eventsByDay.get(dayKey)!.push(event);
  });

  // Heavy day load
  eventsByDay.forEach((dayEvents, dayKey) => {
    if (dayEvents.length > heavyDayThreshold) {
      dayEvents.forEach(event => {
        signals.push({
          id: `signal-${event.id}-heavy-day`,
          label: 'Heavy Day Load',
          severity: dayEvents.length > 10 ? 'critical' : 'warning',
          reason: `${dayEvents.length} events scheduled for this day`,
          entityType: 'calendarEvent',
          entityId: event.id,
          createdAt: new Date(),
        });
      });
    }
  });

  // Upcoming cluster detection
  const upcomingEvents = events.filter(event => {
    const start = typeof event.startAt === 'string' ? new Date(event.startAt) : event.startAt;
    const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntil > 0 && hoursUntil <= 48;
  }).sort((a, b) => {
    const startA = typeof a.startAt === 'string' ? new Date(a.startAt) : a.startAt;
    const startB = typeof b.startAt === 'string' ? new Date(b.startAt) : b.startAt;
    return startA.getTime() - startB.getTime();
  });

  // Check for clusters
  for (let i = 0; i < upcomingEvents.length; i++) {
    const cluster: CalendarEventData[] = [upcomingEvents[i]];
    const clusterStart = new Date(upcomingEvents[i].startAt);

    for (let j = i + 1; j < upcomingEvents.length; j++) {
      const eventStart = new Date(upcomingEvents[j].startAt);
      const hoursDiff = (eventStart.getTime() - clusterStart.getTime()) / (1000 * 60 * 60);

      if (hoursDiff <= clusterWindowHours) {
        cluster.push(upcomingEvents[j]);
      } else {
        break;
      }
    }

    if (cluster.length >= 3) {
      cluster.forEach(event => {
        signals.push({
          id: `signal-${event.id}-cluster`,
          label: 'Upcoming Cluster',
          severity: 'info',
          reason: `${cluster.length} events within ${clusterWindowHours} hours`,
          entityType: 'calendarEvent',
          entityId: event.id,
          createdAt: new Date(),
        });
      });
    }
  }

  // Unassigned events in next 48h
  upcomingEvents.forEach(event => {
    if (!event.sitter?.id) {
      signals.push({
        id: `signal-${event.id}-unassigned-48h`,
        label: 'Unassigned (48h)',
        severity: 'critical',
        reason: 'No sitter assigned for upcoming event',
        entityType: 'calendarEvent',
        entityId: event.id,
        createdAt: new Date(),
      });
    }
  });

  return signals;
}
