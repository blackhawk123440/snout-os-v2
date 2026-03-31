/**
 * BookingCardMobileSummary Component
 *
 * Mobile booking card with exact field order and inline controls.
 * Part B requirement: Exact order - Service+Status, Client name, Schedule, Pets+Total, Address, Inline controls
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { tokens } from '@/lib/design-tokens';
import { BookingScheduleDisplay } from '@/components/booking/BookingScheduleDisplay';
import { BookingStatusInlineControl } from './BookingStatusInlineControl';
import { SitterPoolPicker } from './SitterPoolPicker';
import { SitterInfo } from '@/components/sitter';
import { formatPetsByQuantity } from '@/lib/booking-utils';
import { formatServiceName } from '@/lib/format-utils';

export interface BookingCardMobileSummaryProps {
  booking: {
    id: string;
    service: string;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    firstName: string;
    lastName: string;
    startAt: Date | string;
    endAt: Date | string;
    timeSlots?: Array<{
      id?: string;
      startAt: Date | string;
      endAt: Date | string;
      duration?: number;
    }>;
    pets: Array<{ species: string }>;
    totalPrice: number;
    address?: string | null;
    sitterPool?: Array<{
      sitter: SitterInfo;
    }>;
  };
  onOpen?: () => void;
  onStatusChange: (bookingId: string, newStatus: string) => Promise<void>;
  onSitterPoolChange: (bookingId: string, sitterIds: string[]) => Promise<void>;
  availableSitters: SitterInfo[];
  showSelection?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
}

const getStatusVariant = (status: string): 'default' | 'success' | 'warning' | 'error' | 'neutral' => {
  switch (status) {
    case 'confirmed':
      return 'success';
    case 'pending':
      return 'warning';
    case 'completed':
      return 'default';
    case 'cancelled':
      return 'error';
    default:
      return 'neutral';
  }
};

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

export const BookingCardMobileSummary: React.FC<BookingCardMobileSummaryProps> = ({
  booking,
  onOpen,
  onStatusChange,
  onSitterPoolChange,
  availableSitters,
  showSelection = false,
  selected = false,
  onToggleSelected,
}) => {
  const sitterPool = booking.sitterPool || [];
  const sitterPoolSitters = sitterPool.map(p => p.sitter);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open if clicking checkbox or inline controls
    const target = e.target as HTMLElement;
    if (target.closest('[data-checkbox]') || target.closest('[data-inline-control]')) {
      e.stopPropagation();
      return;
    }
    onOpen?.();
  };

  return (
    <div
      onClick={handleCardClick}
      className={`w-full p-4 bg-surface-primary border border-border-default rounded-lg flex flex-col gap-4 relative ${
        onOpen ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      {/* Selection Checkbox */}
      {showSelection && onToggleSelected && (
        <div
          data-checkbox
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelected();
          }}
          className="absolute top-3 left-3 z-10"
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelected();
            }}
            className="w-5 h-5 cursor-pointer"
            style={{ accentColor: tokens.colors.primary.DEFAULT }}
          />
        </div>
      )}

      {/* Line 1: Service (left) + Status badge (right) */}
      <div
        className={`flex justify-between items-center gap-2 ${
          showSelection ? 'pr-6' : ''
        }`}
      >
        <div className="text-lg font-medium text-text-secondary leading-[1.4]">
          {formatServiceName(booking.service)}
        </div>
        <Badge variant={getStatusVariant(booking.status)} className="text-base">{booking.status}</Badge>
      </div>

      {/* Line 2: Client name (dominant anchor) */}
      <div className="text-2xl font-bold text-text-primary leading-[1.3]">
        {booking.firstName} {booking.lastName}
      </div>

      {/* Line 3: Date and time summary (secondary) - Made bigger */}
      <div className="text-base text-text-secondary leading-[1.4]">
        <BookingScheduleDisplay
          service={formatServiceName(booking.service)}
          startAt={booking.startAt}
          endAt={booking.endAt}
          timeSlots={booking.timeSlots}
          compact={true}
        />
      </div>

      {/* Compact info stack: Pets count, Total, Address, Sitter pool summary */}
      <div className="flex flex-col gap-2">
        {/* Pets count + Total on same line - Made bigger */}
        <div className="flex flex-col gap-2">
          <div className="text-sm text-text-secondary font-semibold">
            Total Price
          </div>
          <div className="text-2xl font-bold text-text-primary tabular-nums">
            {formatCurrency(booking.totalPrice)}
          </div>
          <div className="text-base text-text-secondary">
            {formatPetsByQuantity(booking.pets)}
          </div>
        </div>

        {/* Address */}
        {booking.address && (
          <div className="text-sm text-text-secondary break-words overflow-hidden leading-[1.4] line-clamp-2">
            {booking.address}
          </div>
        )}

        {/* Sitter pool summary */}
        {sitterPoolSitters.length > 0 && (
          <div className="text-sm text-text-secondary">
            Pool: {sitterPoolSitters.map(s => s.firstName).join(', ')}
            {sitterPoolSitters.length > 2 && ` +${sitterPoolSitters.length - 2}`}
          </div>
        )}
      </div>

      {/* Inline controls: Status control + Sitter pool control */}
      <div
        data-inline-control
        className="flex gap-2 mt-2 flex-wrap"
      >
        <BookingStatusInlineControl
          bookingId={booking.id}
          currentStatus={booking.status}
          onStatusChange={onStatusChange}
          compact={true}
        />
        <SitterPoolPicker
          bookingId={booking.id}
          currentPool={sitterPoolSitters}
          availableSitters={availableSitters}
          onPoolChange={onSitterPoolChange}
          compact={true}
        />
      </div>
    </div>
  );
};
