/**
 * Calendar Commands
 * UI Constitution V1 - Phase 4
 * 
 * Calendar-specific commands for view management and navigation.
 */

import { Command, CommandCategory, CommandContext, CommandResult } from './types';
import { alwaysAllowed, defaultPermission } from './permissions';
import { tokens } from '@/lib/design-tokens';
import {
  CalendarDays, CalendarRange, Calendar, CalendarCheck,
  ChevronRight, ChevronLeft, ExternalLink, MessageCircle,
  UserCheck, DollarSign,
} from 'lucide-react';

/**
 * Calendar view commands
 */
export const calendarViewCommands: Command[] = [
  {
    id: 'calendar.view-day',
    label: 'Set View: Day',
    description: 'Switch calendar to day view',
    category: CommandCategory.System,
    icon: <CalendarDays className="w-4 h-4" />,
    availability: (ctx) => ctx.currentRoute === '/calendar',
    permission: alwaysAllowed,
    preview: () => (
      <div style={{ padding: tokens.spacing[4] }}>
        <p>Switch calendar view to show a single day.</p>
      </div>
    ),
    execute: async () => {
      // Store view preference in localStorage or context
      if (typeof window !== 'undefined') {
        localStorage.setItem('calendar-view', 'day');
      }
      return {
        status: 'success' as const,
        message: 'Switched to day view',
        telemetry: { view: 'day' },
      };
    },
  },
  {
    id: 'calendar.view-week',
    label: 'Set View: Week',
    description: 'Switch calendar to week view',
    category: CommandCategory.System,
    icon: <CalendarRange className="w-4 h-4" />,
    availability: (ctx) => ctx.currentRoute === '/calendar',
    permission: alwaysAllowed,
    preview: () => (
      <div style={{ padding: tokens.spacing[4] }}>
        <p>Switch calendar view to show a week.</p>
      </div>
    ),
    execute: async () => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('calendar-view', 'week');
      }
      return {
        status: 'success' as const,
        message: 'Switched to week view',
        telemetry: { view: 'week' },
      };
    },
  },
  {
    id: 'calendar.view-month',
    label: 'Set View: Month',
    description: 'Switch calendar to month view',
    category: CommandCategory.System,
    icon: <Calendar className="w-4 h-4" />,
    availability: (ctx) => ctx.currentRoute === '/calendar',
    permission: alwaysAllowed,
    preview: () => (
      <div style={{ padding: tokens.spacing[4] }}>
        <p>Switch calendar view to show a month.</p>
      </div>
    ),
    execute: async () => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('calendar-view', 'month');
      }
      return {
        status: 'success' as const,
        message: 'Switched to month view',
        telemetry: { view: 'month' },
      };
    },
  },
  {
    id: 'calendar.jump-today',
    label: 'Jump to Today',
    description: 'Navigate calendar to today',
    category: CommandCategory.Navigation,
    icon: <CalendarCheck className="w-4 h-4" />,
    shortcut: 'cmd+t',
    availability: (ctx) => ctx.currentRoute === '/calendar',
    permission: alwaysAllowed,
    preview: () => (
      <div style={{ padding: tokens.spacing[4] }}>
        <p>Navigate calendar to today's date.</p>
      </div>
    ),
    execute: async () => {
      if (typeof window !== 'undefined') {
        // Trigger custom event to update calendar
        window.dispatchEvent(new CustomEvent('calendar-jump-today'));
      }
      return {
        status: 'success' as const,
        message: 'Jumped to today',
        telemetry: { action: 'jump-today' },
      };
    },
  },
  {
    id: 'calendar.next-period',
    label: 'Next Period',
    description: 'Navigate to next period in calendar',
    category: CommandCategory.Navigation,
    icon: <ChevronRight className="w-4 h-4" />,
    shortcut: 'cmd+]',
    availability: (ctx) => ctx.currentRoute === '/calendar',
    permission: alwaysAllowed,
    preview: () => (
      <div style={{ padding: tokens.spacing[4] }}>
        <p>Navigate to the next period (day/week/month).</p>
      </div>
    ),
    execute: async () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('calendar-next-period'));
      }
      return {
        status: 'success' as const,
        message: 'Moved to next period',
        telemetry: { action: 'next-period' },
      };
    },
  },
  {
    id: 'calendar.prev-period',
    label: 'Previous Period',
    description: 'Navigate to previous period in calendar',
    category: CommandCategory.Navigation,
    icon: <ChevronLeft className="w-4 h-4" />,
    shortcut: 'cmd+[',
    availability: (ctx) => ctx.currentRoute === '/calendar',
    permission: alwaysAllowed,
    preview: () => (
      <div style={{ padding: tokens.spacing[4] }}>
        <p>Navigate to the previous period (day/week/month).</p>
      </div>
    ),
    execute: async () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('calendar-prev-period'));
      }
      return {
        status: 'success' as const,
        message: 'Moved to previous period',
        telemetry: { action: 'prev-period' },
      };
    },
  },
];

/**
 * Calendar event selection commands
 */
export function createCalendarEventCommands(eventData?: {
  bookingId: string;
  clientId?: string;
  hasSitter?: boolean;
  isPaid?: boolean;
}): Command[] {
  const baseContext = {
    currentRoute: '/calendar',
    selectedEntity: eventData ? {
      type: 'booking' as const,
      id: eventData.bookingId,
      data: eventData,
    } : null,
  };

  const commands: Command[] = [];

  if (eventData?.bookingId) {
    commands.push({
      id: 'calendar.event.open-booking',
      label: 'Open Booking Details',
      description: 'Open the selected booking in detail view',
      category: CommandCategory.Booking,
      icon: <ExternalLink className="w-4 h-4" />,
      availability: (ctx) => !!ctx.selectedEntity?.id,
      permission: defaultPermission,
      preview: () => (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Open booking details in a new view.</p>
        </div>
      ),
      execute: async (ctx) => {
        const bookingId = ctx.selectedEntity?.id;
        if (bookingId) {
          return {
            status: 'success' as const,
            redirect: `/bookings/${bookingId}`,
            telemetry: { bookingId, action: 'open-booking' },
          };
        }
        return { status: 'failed' as const, message: 'No booking selected' };
      },
    });
  }

  if (eventData?.clientId) {
    commands.push({
      id: 'calendar.event.message-client',
      label: 'Message Client',
      description: 'Send a message to the client for this booking',
      category: CommandCategory.Booking,
      icon: <MessageCircle className="w-4 h-4" />,
      availability: (ctx) => !!ctx.selectedEntity?.id && !!eventData.clientId,
      permission: defaultPermission,
      preview: () => (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Open message dialog for the client.</p>
        </div>
      ),
      execute: async (ctx) => {
        // Mock implementation - open messaging UI
        return {
          status: 'success' as const,
          message: 'Message dialog opened',
          telemetry: { bookingId: eventData.bookingId, clientId: eventData.clientId, action: 'message-client' },
        };
      },
    });
  }

  if (!eventData?.hasSitter) {
    commands.push({
      id: 'calendar.event.assign-sitter',
      label: 'Assign Sitter',
      description: 'Assign a sitter to this booking',
      category: CommandCategory.Booking,
      icon: <UserCheck className="w-4 h-4" />,
      availability: (ctx) => !!ctx.selectedEntity?.id && !eventData?.hasSitter,
      permission: defaultPermission,
      preview: () => (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Open sitter assignment dialog.</p>
        </div>
      ),
      execute: async (ctx) => {
        return {
          status: 'success' as const,
          message: 'Sitter assignment dialog opened',
          telemetry: { bookingId: eventData?.bookingId, action: 'assign-sitter' },
        };
      },
    });
  }

  if (!eventData?.isPaid) {
    commands.push({
      id: 'calendar.event.collect-payment',
      label: 'Collect Payment',
      description: 'Generate payment link for this booking',
      category: CommandCategory.Booking,
      icon: <DollarSign className="w-4 h-4" />,
      availability: (ctx) => !!ctx.selectedEntity?.id && !eventData?.isPaid,
      permission: defaultPermission,
      preview: () => (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Generate a payment link for this booking.</p>
        </div>
      ),
      execute: async (ctx) => {
        return {
          status: 'success' as const,
          message: 'Payment link generated',
          telemetry: { bookingId: eventData?.bookingId, action: 'collect-payment' },
        };
      },
    });
  }

  return commands;
}
