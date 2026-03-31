/**
 * Resonance Layer Types
 * UI Constitution V1 - Phase 6
 * 
 * Type definitions for signals and suggestions.
 */

export type SignalSeverity = 'info' | 'warning' | 'critical';

export type EntityType = 'booking' | 'calendarEvent';

/**
 * Signal: An observable condition that requires attention
 */
export interface Signal {
  id: string;
  label: string;
  severity: SignalSeverity;
  reason: string;
  entityType: EntityType;
  entityId: string;
  createdAt: Date;
  metadata?: Record<string, any>; // No PII allowed
}

/**
 * Suggestion: An actionable recommendation derived from signals
 */
export interface Suggestion {
  id: string;
  label: string;
  priorityScore: number;
  reason: string;
  entityType: EntityType;
  entityId: string;
  actionCommandId: string;
  constraints?: {
    commandAvailable?: boolean;
    entityExists?: boolean;
  };
  metadata?: Record<string, any>;
}

/**
 * Booking data structure for signal computation
 */
export interface BookingData {
  id: string;
  firstName?: string;
  lastName?: string;
  startAt: Date | string;
  endAt: Date | string;
  status: string;
  service?: string;
  paymentStatus?: 'paid' | 'unpaid' | 'partial';
  sitter?: {
    id: string;
    firstName?: string;
    lastName?: string;
  } | null;
  address?: string;
  entryInstructions?: string;
  timeSlots?: Array<{
    startAt: Date | string;
    endAt: Date | string;
  }>;
  pets?: Array<{ species: string; name?: string }>;
}

/**
 * Calendar event data structure
 */
export interface CalendarEventData {
  id: string;
  startAt: Date | string;
  endAt: Date | string;
  sitter?: {
    id: string;
  } | null;
}

/**
 * Scoring configuration
 */
export interface ScoringConfig {
  weights: {
    timeProximity24h: number;
    timeProximity48h: number;
    timeProximity7d: number;
    unpaid: number;
    unassigned: number;
    conflict: number;
    missingEntryInstructions: number;
    missingAddress: number;
  };
}
