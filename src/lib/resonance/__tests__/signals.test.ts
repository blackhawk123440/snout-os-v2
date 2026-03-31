/**
 * Resonance Signals Tests
 * UI Constitution V1 - Phase 6
 */

import { describe, it, expect } from 'vitest';
import { detectBookingSignals, detectCalendarSignals } from '../signals';
import { BookingData, CalendarEventData } from '../types';

describe('Resonance Signals', () => {
  describe('Booking Signals', () => {
    it('should detect unassigned sitter signal', () => {
      const booking: BookingData = {
        id: 'booking1',
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
        status: 'confirmed',
        sitter: null,
      };

      const signals = detectBookingSignals(booking);
      const unassignedSignal = signals.find(s => s.id.includes('unassigned'));
      expect(unassignedSignal).toBeDefined();
      // Within 24h should be critical, otherwise warning
      expect(['critical', 'warning']).toContain(unassignedSignal?.severity);
    });

    it('should detect unpaid signal', () => {
      const booking: BookingData = {
        id: 'booking1',
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
        status: 'confirmed',
        paymentStatus: 'unpaid',
      };

      const signals = detectBookingSignals(booking);
      const unpaidSignal = signals.find(s => s.id.includes('unpaid'));
      expect(unpaidSignal).toBeDefined();
    });

    it('should detect missing address signal', () => {
      const booking: BookingData = {
        id: 'booking1',
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
        status: 'confirmed',
        address: '',
      };

      const signals = detectBookingSignals(booking);
      const missingAddressSignal = signals.find(s => s.id.includes('missing-address'));
      expect(missingAddressSignal).toBeDefined();
      expect(missingAddressSignal?.severity).toBe('critical');
    });

    it('should detect incomplete schedule signal', () => {
      const booking: BookingData = {
        id: 'booking1',
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
        status: 'confirmed',
        service: 'Dog Walking',
        timeSlots: [],
      };

      const signals = detectBookingSignals(booking);
      const incompleteSignal = signals.find(s => s.id.includes('incomplete-schedule'));
      expect(incompleteSignal).toBeDefined();
    });
  });

  describe('Calendar Signals', () => {
    it('should detect conflict signals', () => {
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

      const signals = detectCalendarSignals(events);
      const conflictSignals = signals.filter(s => s.id.includes('conflict'));
      expect(conflictSignals.length).toBeGreaterThan(0);
    });

    it('should detect heavy day load', () => {
      const events: CalendarEventData[] = Array.from({ length: 6 }, (_, i) => ({
        id: `event${i}`,
        startAt: new Date(`2024-01-01T${10 + i}:00:00`),
        endAt: new Date(`2024-01-01T${10 + i + 1}:00:00`),
      }));

      const signals = detectCalendarSignals(events, { heavyDayThreshold: 5 });
      const heavyDaySignals = signals.filter(s => s.id.includes('heavy-day'));
      expect(heavyDaySignals.length).toBeGreaterThan(0);
    });
  });
});
