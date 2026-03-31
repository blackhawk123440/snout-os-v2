/**
 * BookingScheduleDisplay Component
 *
 * Shared primitive for rendering booking schedules consistently across the app.
 * Handles two schedule models:
 * - Overnight range services (Housesitting, 24/7 Care): start/end date/time + nights count
 * - Multi-visit services (Drop-ins, Dog walking, Pet taxi): per-date entries with duration labels
 *
 * Universal Law: ONE SCHEDULE RENDERING ENGINE
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/Badge';

export interface TimeSlot {
  id?: string;
  startAt: Date | string;
  endAt: Date | string;
  duration?: number;
}

export interface BookingScheduleDisplayProps {
  service: string;
  startAt: Date | string;
  endAt: Date | string;
  timeSlots?: TimeSlot[];
  address?: string | null;
  compact?: boolean; // For use in lists/cards
}

/**
 * Determines if a service uses the overnight range model
 */
export function isOvernightRangeService(service: string): boolean {
  return service === 'Housesitting' || service === '24/7 Care';
}

/**
 * Formats a date for display
 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats a time for display
 */
function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Calculates number of nights between two dates
 */
function calculateNights(startAt: Date | string, endAt: Date | string): number {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Calculates duration in minutes between two times
 */
function calculateDurationMinutes(startAt: Date | string, endAt: Date | string): number {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

export const BookingScheduleDisplay: React.FC<BookingScheduleDisplayProps> = ({
  service,
  startAt,
  endAt,
  timeSlots = [],
  address,
  compact = false,
}) => {
  const isOvernight = isOvernightRangeService(service);

  if (isOvernight) {
    // Overnight range services: Housesitting, 24/7 Care
    const nights = calculateNights(startAt, endAt);

    if (compact) {
      // Compact version for lists/cards - Made bigger per requirements
      return (
        <div className="flex flex-col gap-1">
          <div className="text-base font-semibold">
            Scheduled
          </div>
          <div className="text-base font-medium">
            {formatDate(startAt)} - {formatDate(endAt)}
          </div>
          <div className="text-base text-text-secondary font-medium">
            {formatTime(startAt)} - {formatTime(endAt)} • {nights} {nights === 1 ? 'Night' : 'Nights'}
          </div>
        </div>
      );
    }

    // Full version for detail pages
    return (
      <div>
        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
          <div>
            <div className="text-xs text-text-secondary mb-1">Start</div>
            <div className="font-medium">{formatDate(startAt)}</div>
            <div className="text-xs text-text-secondary mt-1">{formatTime(startAt)}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary mb-1">End</div>
            <div className="font-medium">{formatDate(endAt)}</div>
            <div className="text-xs text-text-secondary mt-1">{formatTime(endAt)}</div>
          </div>
        </div>
        <div className="p-2 bg-surface-secondary rounded-sm mb-3">
          <div className="text-xs text-text-secondary mb-1">Duration</div>
          <div className="font-semibold text-base">
            {nights} {nights === 1 ? 'Night' : 'Nights'}
          </div>
        </div>
        {address && (
          <div className="mt-3 pt-3 border-t border-border-default">
            <div className="text-xs text-text-secondary mb-1">Address</div>
            <div className="text-sm">{address}</div>
          </div>
        )}
      </div>
    );
  }

  // Multi-visit services: Drop-ins, Dog walking, Pet taxi
  if (timeSlots && timeSlots.length > 0) {
    // Group visits by date
    const visitsByDate = timeSlots.reduce((acc, slot) => {
      const dateKey = formatDate(slot.startAt);
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(slot);
      return acc;
    }, {} as Record<string, TimeSlot[]>);

    if (compact) {
      // Compact version: show first date and total visit count
      const firstDate = Object.keys(visitsByDate)[0];
      const totalVisits = timeSlots.length;
      return (
        <div className="flex flex-col gap-1">
          <div className="text-sm font-medium">
            {firstDate}
            {Object.keys(visitsByDate).length > 1 && ` +${Object.keys(visitsByDate).length - 1} more`}
          </div>
          <div className="text-xs text-text-secondary">
            {totalVisits} {totalVisits === 1 ? 'visit' : 'visits'}
          </div>
        </div>
      );
    }

    // Full version: show all visits grouped by date
    return (
      <div>
        <div className="flex flex-col gap-3">
          {Object.entries(visitsByDate).map(([date, visits]) => (
            <div key={date} className="p-3 bg-surface-secondary rounded-sm">
              <div className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                {date}
              </div>
              <div className="flex flex-col gap-2">
                {visits.map((slot, index) => {
                  const duration = slot.duration || calculateDurationMinutes(slot.startAt, slot.endAt);
                  return (
                    <div key={slot.id || index} className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-sm">
                          {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
                        </div>
                      </div>
                      <Badge variant="default">
                        {duration}m
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {address && (
          <div className="mt-3 pt-3 border-t border-border-default">
            <div className="text-xs text-text-secondary mb-1">Address</div>
            <div className="text-sm">{address}</div>
          </div>
        )}
      </div>
    );
  }

  // No time slots scheduled
  return (
    <div className="text-sm text-text-secondary">
      No time slots scheduled
    </div>
  );
};
