/**
 * Booking Commands
 * UI Constitution V1 - Phase 5
 * 
 * Booking-specific commands for status changes and actions.
 */

import { Command, CommandCategory, CommandContext, CommandResult } from './types';
import { hasBookingEntity, hasBookingStatus } from './availability';
import { defaultPermission } from './permissions';
import { tokens } from '@/lib/design-tokens';
import { CheckCircle2, CheckCheck, XCircle, Info } from 'lucide-react';

/**
 * Booking status change commands
 */
export const bookingStatusCommands: Command[] = [
  {
    id: 'booking.change-status-confirm',
    label: 'Confirm Booking',
    description: 'Change booking status to confirmed',
    category: CommandCategory.Booking,
    icon: <CheckCircle2 className="w-4 h-4" />,
    availability: (ctx) => hasBookingEntity(ctx) && hasBookingStatus(ctx, 'pending'),
    permission: defaultPermission,
    preview: (ctx) => {
      const booking = ctx.selectedEntity?.data;
      return (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Confirm this booking:</p>
          <p style={{ fontWeight: tokens.typography.fontWeight.bold, marginTop: tokens.spacing[2] }}>
            {booking?.firstName} {booking?.lastName} - {booking?.service}
          </p>
        </div>
      );
    },
    execute: async (ctx) => {
      const bookingId = ctx.selectedEntity?.id;
      try {
        // Mock implementation - replace with actual API call
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
          status: 'success' as const,
          message: 'Booking confirmed',
          telemetry: { bookingId, action: 'confirm-booking' },
        };
      } catch (error) {
        return {
          status: 'failed' as const,
          message: 'Failed to confirm booking',
        };
      }
    },
  },
  {
    id: 'booking.change-status-complete',
    label: 'Mark Complete',
    description: 'Mark booking as completed',
    category: CommandCategory.Booking,
    icon: <CheckCheck className="w-4 h-4" />,
    availability: (ctx) => hasBookingEntity(ctx) && (hasBookingStatus(ctx, 'confirmed') || hasBookingStatus(ctx, 'in-progress')),
    permission: defaultPermission,
    preview: (ctx) => {
      const booking = ctx.selectedEntity?.data;
      return (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Mark this booking as completed:</p>
          <p style={{ fontWeight: tokens.typography.fontWeight.bold, marginTop: tokens.spacing[2] }}>
            {booking?.firstName} {booking?.lastName}
          </p>
        </div>
      );
    },
    execute: async (ctx) => {
      const bookingId = ctx.selectedEntity?.id;
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
          status: 'success' as const,
          message: 'Booking marked as complete',
          telemetry: { bookingId, action: 'complete-booking' },
        };
      } catch (error) {
        return {
          status: 'failed' as const,
          message: 'Failed to mark booking complete',
        };
      }
    },
  },
  {
    id: 'booking.change-status-cancel',
    label: 'Cancel Booking',
    description: 'Cancel this booking',
    category: CommandCategory.Booking,
    icon: <XCircle className="w-4 h-4" />,
    danger: true,
    availability: (ctx) => hasBookingEntity(ctx) && (hasBookingStatus(ctx, 'pending') || hasBookingStatus(ctx, 'confirmed')),
    permission: defaultPermission,
    preview: (ctx) => {
      const booking = ctx.selectedEntity?.data;
      return (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Cancel this booking:</p>
          <p style={{ fontWeight: tokens.typography.fontWeight.bold, marginTop: tokens.spacing[2] }}>
            {booking?.firstName} {booking?.lastName} - {booking?.service}
          </p>
          <p style={{ marginTop: tokens.spacing[2], fontSize: tokens.typography.fontSize.sm[0], color: tokens.colors.text.secondary }}>
            This action cannot be undone.
          </p>
        </div>
      );
    },
    execute: async (ctx) => {
      const bookingId = ctx.selectedEntity?.id;
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
          status: 'success' as const,
          message: 'Booking cancelled',
          telemetry: { bookingId, action: 'cancel-booking' },
        };
      } catch (error) {
        return {
          status: 'failed' as const,
          message: 'Failed to cancel booking',
        };
      }
    },
  },
  {
    id: 'booking.open-drawer',
    label: 'Open Booking Details',
    description: 'Open booking details drawer',
    category: CommandCategory.Booking,
    icon: <Info className="w-4 h-4" />,
    availability: hasBookingEntity,
    permission: defaultPermission,
    preview: (ctx) => {
      const booking = ctx.selectedEntity?.data;
      return (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Open details for booking:</p>
          <p style={{ fontWeight: tokens.typography.fontWeight.bold, marginTop: tokens.spacing[2] }}>
            {booking?.firstName} {booking?.lastName}
          </p>
        </div>
      );
    },
    execute: async (ctx) => {
      // This command is handled by UI - trigger drawer open event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('booking-open-drawer', { detail: { bookingId: ctx.selectedEntity?.id } }));
      }
      return {
        status: 'success' as const,
        message: 'Opening booking details',
        telemetry: { bookingId: ctx.selectedEntity?.id, action: 'open-drawer' },
      };
    },
  },
];
