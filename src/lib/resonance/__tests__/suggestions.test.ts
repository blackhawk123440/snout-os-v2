/**
 * Resonance Suggestions Tests
 * UI Constitution V1 - Phase 6
 */

import { describe, it, expect } from 'vitest';
import {
  generateBookingSuggestions,
  generateCalendarSuggestions,
  sortSuggestionsByPriority,
  filterValidSuggestions,
} from '../suggestions';
import { Signal, BookingData, CalendarEventData } from '../types';
import { detectBookingSignals, detectCalendarSignals } from '../signals';

describe('Resonance Suggestions', () => {
  describe('Booking Suggestions', () => {
    it('should generate assign sitter suggestion for unassigned booking', () => {
      const booking: BookingData = {
        id: 'booking1',
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
        status: 'confirmed',
        sitter: null,
      };

      const signals = detectBookingSignals(booking);
      const suggestions = generateBookingSuggestions(booking, signals);

      const assignSitterSuggestion = suggestions.find(s => s.actionCommandId === 'booking.assign-sitter');
      expect(assignSitterSuggestion).toBeDefined();
      expect(assignSitterSuggestion?.priorityScore).toBeGreaterThan(0);
    });

    it('should generate collect payment suggestion for unpaid booking', () => {
      const booking: BookingData = {
        id: 'booking1',
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
        status: 'confirmed',
        paymentStatus: 'unpaid',
      };

      const signals = detectBookingSignals(booking);
      const suggestions = generateBookingSuggestions(booking, signals);

      const collectPaymentSuggestion = suggestions.find(s => s.actionCommandId === 'booking.collect-payment');
      expect(collectPaymentSuggestion).toBeDefined();
    });
  });

  describe('Suggestion Sorting', () => {
    it('should sort suggestions by priority score descending', () => {
      const suggestions = [
        { id: '1', priorityScore: 30, actionCommandId: 'cmd1', label: '', reason: '', entityType: 'booking', entityId: '1' },
        { id: '2', priorityScore: 50, actionCommandId: 'cmd2', label: '', reason: '', entityType: 'booking', entityId: '2' },
        { id: '3', priorityScore: 20, actionCommandId: 'cmd3', label: '', reason: '', entityType: 'booking', entityId: '3' },
      ];

      const sorted = sortSuggestionsByPriority(suggestions);
      expect(sorted[0].priorityScore).toBe(50);
      expect(sorted[1].priorityScore).toBe(30);
      expect(sorted[2].priorityScore).toBe(20);
    });
  });

  describe('Filter Valid Suggestions', () => {
    it('should filter out suggestions with invalid constraints', () => {
      const suggestions = [
        {
          id: '1',
          priorityScore: 50,
          actionCommandId: 'booking.assign-sitter',
          label: 'Assign Sitter',
          reason: '',
          entityType: 'booking',
          entityId: '1',
          constraints: { entityExists: true },
        },
        {
          id: '2',
          priorityScore: 30,
          actionCommandId: 'booking.collect-payment',
          label: 'Collect Payment',
          reason: '',
          entityType: 'booking',
          entityId: '2',
          constraints: { entityExists: false },
        },
      ];

      const filtered = filterValidSuggestions(suggestions);
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('1');
    });
  });
});
