/**
 * Resonance Scoring Tests
 * UI Constitution V1 - Phase 6
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBookingPriorityScore,
  calculateCalendarEventPriorityScore,
  checkEventOverlap,
  detectConflicts,
  defaultScoringConfig,
} from '../scoring';
import { BookingData, CalendarEventData } from '../types';

describe('Resonance Scoring', () => {
  const baseBooking: BookingData = {
    id: 'booking1',
    startAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
    endAt: new Date(Date.now() + 13 * 60 * 60 * 1000),
    status: 'confirmed',
  };

  it('should calculate high score for booking within 24h', () => {
    const booking: BookingData = {
      ...baseBooking,
      startAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
    };
    const score = calculateBookingPriorityScore(booking);
    expect(score).toBeGreaterThan(40); // Should include timeProximity24h weight
  });

  it('should add unpaid weight to score', () => {
    const booking: BookingData = {
      ...baseBooking,
      paymentStatus: 'unpaid',
    };
    const score = calculateBookingPriorityScore(booking);
    expect(score).toBeGreaterThanOrEqual(defaultScoringConfig.weights.unpaid);
  });

  it('should add unassigned weight to score', () => {
    const booking: BookingData = {
      ...baseBooking,
      sitter: null,
    };
    const score = calculateBookingPriorityScore(booking);
    expect(score).toBeGreaterThanOrEqual(defaultScoringConfig.weights.unassigned);
  });

  it('should add missing entry instructions weight', () => {
    const booking: BookingData = {
      ...baseBooking,
      entryInstructions: '',
    };
    const score = calculateBookingPriorityScore(booking);
    expect(score).toBeGreaterThanOrEqual(defaultScoringConfig.weights.missingEntryInstructions);
  });

  it('should add missing address weight', () => {
    const booking: BookingData = {
      ...baseBooking,
      address: '',
    };
    const score = calculateBookingPriorityScore(booking);
    expect(score).toBeGreaterThanOrEqual(defaultScoringConfig.weights.missingAddress);
  });

  it('should detect overlapping events', () => {
    const event1: CalendarEventData = {
      id: 'event1',
      startAt: new Date('2024-01-01T10:00:00'),
      endAt: new Date('2024-01-01T12:00:00'),
      sitter: { id: 'sitter1' },
    };
    const event2: CalendarEventData = {
      id: 'event2',
      startAt: new Date('2024-01-01T11:00:00'),
      endAt: new Date('2024-01-01T13:00:00'),
      sitter: { id: 'sitter1' },
    };

    expect(checkEventOverlap(event1, event2)).toBe(true);
  });

  it('should not detect overlap for different sitters', () => {
    const event1: CalendarEventData = {
      id: 'event1',
      startAt: new Date('2024-01-01T10:00:00'),
      endAt: new Date('2024-01-01T12:00:00'),
      sitter: { id: 'sitter1' },
    };
    const event2: CalendarEventData = {
      id: 'event2',
      startAt: new Date('2024-01-01T11:00:00'),
      endAt: new Date('2024-01-01T13:00:00'),
      sitter: { id: 'sitter2' },
    };

    expect(checkEventOverlap(event1, event2)).toBe(false);
  });

  it('should detect conflicts in event list', () => {
    const events: CalendarEventData[] = [
      {
        id: 'event1',
        startAt: new Date('2024-01-01T10:00:00'),
        endAt: new Date('2024-01-01T12:00:00'),
        sitter: { id: 'sitter1' },
      },
      {
        id: 'event2',
        startAt: new Date('2024-01-01T11:00:00'),
        endAt: new Date('2024-01-01T13:00:00'),
        sitter: { id: 'sitter1' },
      },
    ];

    const conflicts = detectConflicts(events);
    expect(conflicts.size).toBeGreaterThan(0);
    expect(conflicts.has('event1') || conflicts.has('event2')).toBe(true);
  });
});
