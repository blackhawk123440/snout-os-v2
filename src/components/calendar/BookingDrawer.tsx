/**
 * Booking Drawer Component
 *
 * Desktop right-side drawer for booking details
 * Reuses booking detail components and logic
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { tokens } from '@/lib/design-tokens';
import { Card, SectionHeader, Button, Badge, Modal } from '@/components/ui';
import { BookingScheduleDisplay } from '@/components/booking';
import { SitterAssignmentDisplay } from '@/components/sitter';
import { formatServiceName } from '@/lib/format-utils';

export interface BookingDrawerBooking {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  address: string;
  service: string;
  startAt: Date | string;
  endAt: Date | string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paymentStatus: string;
  totalPrice: number;
  notes?: string | null;
  pets: Array<{ species: string; name?: string }>;
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

export interface BookingDrawerProps {
  isOpen: boolean;
  booking: BookingDrawerBooking | null;
  onClose: () => void;
  onEdit?: () => void;
  onViewFull?: () => void;
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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const BookingDrawer: React.FC<BookingDrawerProps> = ({
  isOpen,
  booking,
  onClose,
  onEdit,
  onViewFull,
}) => {
  if (!isOpen || !booking) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: '480px',
        backgroundColor: tokens.colors.background.primary,
        boxShadow: tokens.shadows.lg,
        zIndex: tokens.zIndex.modal,
      }}
      className="flex flex-col overflow-y-auto"
    >
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between sticky top-0 z-layer-elevated"
        style={{
          borderBottom: `1px solid ${tokens.colors.border.default}`,
          backgroundColor: tokens.colors.background.primary,
        }}
      >
        <div>
          <h2 className="text-xl font-bold m-0 mb-1">
            {booking.firstName} {booking.lastName}
          </h2>
          <Badge variant={getStatusBadgeVariant(booking.status)}>
            {booking.status}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {/* Schedule */}
          <Card>
            <SectionHeader title="Schedule & Service" />
            <div className="p-4">
              <BookingScheduleDisplay
                service={formatServiceName(booking.service)}
                startAt={booking.startAt}
                endAt={booking.endAt}
                timeSlots={booking.timeSlots}
                address={booking.address}
              />
            </div>
          </Card>

          {/* Client Info */}
          <Card>
            <SectionHeader title="Client" />
            <div className="p-4 flex flex-col gap-3">
              <div>
                <div className="text-sm text-text-secondary mb-1">
                  Name
                </div>
                <div className="font-medium">
                  {booking.firstName} {booking.lastName}
                </div>
              </div>
              <div>
                <div className="text-sm text-text-secondary mb-1">
                  Phone
                </div>
                <a href={`tel:${booking.phone}`} title="Owner/admin operational call exception" className="text-accent-primary no-underline">
                  {booking.phone}
                </a>
              </div>
              {booking.email && (
                <div>
                  <div className="text-sm text-text-secondary mb-1">
                    Email
                  </div>
                  <a href={`mailto:${booking.email}`} className="text-accent-primary no-underline">
                    {booking.email}
                  </a>
                </div>
              )}
            </div>
          </Card>

          {/* Assignment */}
          <Card>
            <SectionHeader title="Assignment" />
            <div className="p-4">
              {booking.sitter ? (
                <SitterAssignmentDisplay sitter={booking.sitter} showTierBadge />
              ) : (
                <div className="text-sm text-text-secondary">
                  No sitter assigned
                </div>
              )}
            </div>
          </Card>

          {/* Pricing */}
          <Card>
            <SectionHeader title="Pricing" />
            <div className="p-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-text-secondary">
                  Total
                </div>
                <div className="text-xl font-bold">
                  {formatCurrency(booking.totalPrice)}
                </div>
              </div>
              <div className="mt-2 text-sm text-text-secondary">
                Payment Status: {booking.paymentStatus}
              </div>
            </div>
          </Card>

          {/* Pets */}
          {booking.pets.length > 0 && (
            <Card>
              <SectionHeader title="Pets" />
              <div className="p-4">
                <div className="flex flex-col gap-2">
                  {booking.pets.map((pet, idx) => (
                    <div key={idx} className="text-sm">
                      {pet.name || 'Unnamed'} ({pet.species})
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Notes */}
          {booking.notes && (
            <Card>
              <SectionHeader title="Notes" />
              <div className="p-4">
                <div className="text-sm whitespace-pre-wrap">
                  {booking.notes}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Actions */}
      <div
        className="p-4 flex gap-2"
        style={{ borderTop: `1px solid ${tokens.colors.border.default}` }}
      >
        {onViewFull && (
          <Button variant="primary" style={{ flex: 1 }} onClick={onViewFull}>
            View Full Details
          </Button>
        )}
        {onEdit && (
          <Button variant="secondary" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>
    </div>
  );
};
