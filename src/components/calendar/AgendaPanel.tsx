/**
 * Agenda Panel Component
 *
 * Desktop side panel that displays bookings for selected date
 */

'use client';

import React from 'react';
import { tokens } from '@/lib/design-tokens';
import { Card, SectionHeader, Button, Badge } from '@/components/ui';
import { BookingScheduleDisplay } from '@/components/booking';
import { SitterAssignmentDisplay } from '@/components/sitter';
import { formatServiceName } from '@/lib/format-utils';

export interface AgendaBooking {
  id: string;
  firstName: string;
  lastName: string;
  service: string;
  startAt: Date | string;
  endAt: Date | string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  totalPrice: number;
  sitter?: {
    id: string;
    firstName: string;
    lastName: string;
    currentTier?: {
      id: string;
      name: string;
      priorityLevel?: number;
      color?: string;
    } | null;
  } | null;
  timeSlots?: Array<{
    id: string;
    startAt: Date | string;
    endAt: Date | string;
    duration?: number;
  }>;
}

export interface AgendaPanelProps {
  selectedDate: Date | null;
  bookings: AgendaBooking[];
  onBookingClick: (booking: AgendaBooking) => void;
  formatTime?: (date: Date | string) => string;
}

const getStatusBadgeVariant = (status: string): 'default' | 'info' | 'success' | 'warning' | 'error' => {
  switch (status) {
    case 'confirmed': return 'success';
    case 'pending': return 'warning';
    case 'completed': return 'info';
    case 'cancelled': return 'error';
    default: return 'default';
  }
};

export const AgendaPanel: React.FC<AgendaPanelProps> = ({
  selectedDate,
  bookings,
  onBookingClick,
  formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
}) => {
  if (!selectedDate) {
    return (
      <Card style={{ height: '100%' }}>
        <SectionHeader title="Agenda" />
        <div className="p-6 text-center text-text-secondary">
          Select a date to view bookings
        </div>
      </Card>
    );
  }

  const dateKey = selectedDate.toISOString().split('T')[0];
  const dayBookings = bookings.filter((booking) => {
    const bookingDate = new Date(booking.startAt);
    const bookingDateKey = bookingDate.toISOString().split('T')[0];
    return bookingDateKey === dateKey;
  });

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Card style={{ height: '100%' }} className="flex flex-col">
      <SectionHeader title="Agenda" />
      <div className="p-4 border-b border-border-default">
        <div className="text-lg font-semibold">
          {formatDate(selectedDate)}
        </div>
        <div className="text-sm text-text-secondary mt-1">
          {dayBookings.length} {dayBookings.length === 1 ? 'booking' : 'bookings'}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {dayBookings.length === 0 ? (
          <div className="text-center text-text-secondary p-6">
            No bookings scheduled for this date
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {dayBookings.map((booking) => (
              <Card
                key={booking.id}
                className="cursor-pointer transition-all duration-normal"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.colors.background.secondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.colors.background.primary;
                }}
                onClick={() => onBookingClick(booking)}
              >
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-base">
                      {booking.firstName} {booking.lastName}
                    </div>
                    <Badge variant={getStatusBadgeVariant(booking.status)}>
                      {booking.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-text-secondary mb-2">
                    {formatServiceName(booking.service)}
                  </div>
                  {booking.timeSlots && booking.timeSlots.length > 0 ? (
                    <div className="text-sm text-text-secondary">
                      {booking.timeSlots.map((slot, idx) => (
                        <div key={slot.id}>
                          {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
                          {slot.duration && ` (${slot.duration}m)`}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-text-secondary">
                      {formatTime(booking.startAt)} - {formatTime(booking.endAt)}
                    </div>
                  )}
                  {booking.sitter && (
                    <div className="mt-2 pt-2 border-t border-border-default">
                      <SitterAssignmentDisplay sitter={booking.sitter} showTierBadge compact />
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
