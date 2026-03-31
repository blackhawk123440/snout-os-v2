/**
 * Command Definitions
 * UI Constitution V1 - Phase 3
 * 
 * Register all commands here.
 */

import React from 'react';
import { Command, CommandCategory, CommandContext, CommandResult } from './types';
import {
  availableOnRoute,
  hasBookingEntity,
  hasClientEntity,
  hasBookingStatus,
} from './availability';
import { defaultPermission, alwaysAllowed } from './permissions';
import { registerCommand } from './registry';
import { tokens } from '@/lib/design-tokens';
import {
  Home, Calendar, Table, Users, UserCheck, Wand2,
  Mail, DollarSign, ExternalLink, MessageCircle,
  History, PlusCircle, Moon, Palette,
} from 'lucide-react';

/**
 * Navigation Commands
 */
const navigationCommands: Command[] = [
  {
    id: 'navigation.dashboard',
    label: 'Go to Dashboard',
    description: 'Navigate to the dashboard',
    category: CommandCategory.Navigation,
    icon: <Home className="w-4 h-4" />,
    shortcut: 'cmd+1',
    availability: (ctx) => ctx.currentRoute !== '/dashboard',
    permission: alwaysAllowed,
    preview: () => (
      <div style={{ padding: tokens.spacing[4] }}>
        <p>Navigate to the dashboard to view overview statistics.</p>
      </div>
    ),
    execute: async () => ({
      status: 'success',
      redirect: '/dashboard',
      telemetry: { route: '/dashboard' },
    }),
  },
  {
    id: 'navigation.bookings',
    label: 'Go to Bookings',
    description: 'Navigate to bookings page',
    category: CommandCategory.Navigation,
    icon: <Calendar className="w-4 h-4" />,
    shortcut: 'cmd+2',
    availability: (ctx) => ctx.currentRoute !== '/bookings',
    permission: alwaysAllowed,
    preview: () => (
      <div style={{ padding: tokens.spacing[4] }}>
        <p>Navigate to the bookings page to manage all bookings.</p>
      </div>
    ),
    execute: async () => ({
      status: 'success',
      redirect: '/bookings',
      telemetry: { route: '/bookings' },
    }),
  },
  {
    id: 'navigation.calendar',
    label: 'Go to Calendar',
    description: 'Navigate to calendar view',
    category: CommandCategory.Navigation,
    icon: <Table className="w-4 h-4" />,
    shortcut: 'cmd+3',
    availability: (ctx) => ctx.currentRoute !== '/calendar',
    permission: alwaysAllowed,
    preview: () => (
      <div style={{ padding: tokens.spacing[4] }}>
        <p>Navigate to the calendar to view bookings in calendar format.</p>
      </div>
    ),
    execute: async () => ({
      status: 'success',
      redirect: '/calendar',
      telemetry: { route: '/calendar' },
    }),
  },
  {
    id: 'navigation.clients',
    label: 'Go to Clients',
    description: 'Navigate to clients page',
    category: CommandCategory.Navigation,
    icon: <Users className="w-4 h-4" />,
    shortcut: 'cmd+4',
    availability: (ctx) => ctx.currentRoute !== '/clients',
    permission: alwaysAllowed,
    preview: () => (
      <div style={{ padding: tokens.spacing[4] }}>
        <p>Navigate to the clients page to manage all clients.</p>
      </div>
    ),
    execute: async () => ({
      status: 'success',
      redirect: '/clients',
      telemetry: { route: '/clients' },
    }),
  },
  {
    id: 'navigation.sitters',
    label: 'Go to Sitters',
    description: 'Navigate to sitters page',
    category: CommandCategory.Navigation,
    icon: <UserCheck className="w-4 h-4" />,
    shortcut: 'cmd+5',
    availability: (ctx) => ctx.currentRoute !== '/bookings/sitters',
    permission: alwaysAllowed,
    preview: () => (
      <div style={{ padding: tokens.spacing[4] }}>
        <p>Navigate to the sitters page to manage all sitters.</p>
      </div>
    ),
    execute: async () => ({
      status: 'success',
      redirect: '/bookings/sitters',
      telemetry: { route: '/bookings/sitters' },
    }),
  },
  {
    id: 'navigation.automations',
    label: 'Go to Automations',
    description: 'Navigate to automations page',
    category: CommandCategory.Navigation,
    icon: <Wand2 className="w-4 h-4" />,
    shortcut: 'cmd+6',
    availability: (ctx) => ctx.currentRoute !== '/automation',
    permission: alwaysAllowed,
    preview: () => (
      <div style={{ padding: tokens.spacing[4] }}>
        <p>Navigate to the automations page to manage automation rules.</p>
      </div>
    ),
    execute: async () => ({
      status: 'success',
      redirect: '/automation',
      telemetry: { route: '/automation' },
    }),
  },
];

/**
 * Booking Commands
 */
const bookingCommands: Command[] = [
  {
    id: 'booking.send-confirmation',
    label: 'Send Confirmation Message',
    description: 'Send confirmation message to client for selected booking',
    category: CommandCategory.Booking,
    icon: <Mail className="w-4 h-4" />,
    availability: hasBookingEntity,
    permission: defaultPermission,
    preview: (ctx) => {
      const booking = ctx.selectedEntity?.data;
      return (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Send a confirmation message to the client for booking:</p>
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
          message: 'Confirmation message sent successfully',
          telemetry: { bookingId, action: 'send-confirmation' },
        };
      } catch (error) {
        return {
          status: 'failed' as const,
          message: 'Failed to send confirmation message',
        };
      }
    },
  },
  {
    id: 'booking.collect-payment',
    label: 'Collect Payment',
    description: 'Generate payment link for selected booking',
    category: CommandCategory.Booking,
    icon: <DollarSign className="w-4 h-4" />,
    availability: hasBookingEntity,
    permission: defaultPermission,
    preview: (ctx) => {
      const booking = ctx.selectedEntity?.data;
      return (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Generate a payment link for booking:</p>
          <p style={{ fontWeight: tokens.typography.fontWeight.bold, marginTop: tokens.spacing[2] }}>
            {booking?.firstName} {booking?.lastName} - ${booking?.totalPrice || 0}
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
          message: 'Payment link generated successfully',
          telemetry: { bookingId, action: 'collect-payment' },
        };
      } catch (error) {
        return {
          status: 'failed' as const,
          message: 'Failed to generate payment link',
        };
      }
    },
  },
  {
    id: 'booking.assign-sitter',
    label: 'Assign Sitter',
    description: 'Assign a sitter to the selected booking',
    category: CommandCategory.Booking,
    icon: <UserCheck className="w-4 h-4" />,
    availability: hasBookingEntity,
    permission: defaultPermission,
    preview: (ctx) => {
      const booking = ctx.selectedEntity?.data;
      return (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Assign a sitter to booking:</p>
          <p style={{ fontWeight: tokens.typography.fontWeight.bold, marginTop: tokens.spacing[2] }}>
            {booking?.firstName} {booking?.lastName} - {booking?.service}
          </p>
          <p style={{ marginTop: tokens.spacing[2], fontSize: tokens.typography.fontSize.sm[0], color: tokens.colors.text.secondary }}>
            This will open the sitter assignment dialog.
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
          message: 'Sitter assignment dialog opened',
          telemetry: { bookingId, action: 'assign-sitter' },
        };
      } catch (error) {
        return {
          status: 'failed' as const,
          message: 'Failed to assign sitter',
        };
      }
    },
  },
  {
    id: 'booking.trigger-automation',
    label: 'Trigger Automation Pack',
    description: 'Trigger automation pack for selected booking',
    category: CommandCategory.Booking,
    icon: <Wand2 className="w-4 h-4" />,
    availability: hasBookingEntity,
    permission: defaultPermission,
    preview: (ctx) => {
      const booking = ctx.selectedEntity?.data;
      return (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Trigger automation pack for booking:</p>
          <p style={{ fontWeight: tokens.typography.fontWeight.bold, marginTop: tokens.spacing[2] }}>
            {booking?.firstName} {booking?.lastName}
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
          message: 'Automation pack triggered',
          telemetry: { bookingId, action: 'trigger-automation' },
        };
      } catch (error) {
        return {
          status: 'failed' as const,
          message: 'Failed to trigger automation',
        };
      }
    },
  },
  {
    id: 'booking.open-new-tab',
    label: 'Open Booking in New Tab',
    description: 'Open the selected booking in a new browser tab',
    category: CommandCategory.Booking,
    icon: <ExternalLink className="w-4 h-4" />,
    availability: hasBookingEntity,
    permission: alwaysAllowed,
    preview: (ctx) => {
      const bookingId = ctx.selectedEntity?.id;
      return (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Open booking in a new browser tab:</p>
          <p style={{ fontWeight: tokens.typography.fontWeight.bold, marginTop: tokens.spacing[2] }}>
            Booking ID: {bookingId}
          </p>
        </div>
      );
    },
    execute: async (ctx) => {
      const bookingId = ctx.selectedEntity?.id;
      const url = `/bookings/${bookingId}`;
      window.open(url, '_blank');
      return {
        status: 'success' as const,
        message: 'Opened in new tab',
        telemetry: { bookingId, action: 'open-new-tab' },
      };
    },
  },
];

/**
 * Client Commands
 */
const clientCommands: Command[] = [
  {
    id: 'client.message',
    label: 'Message Client',
    description: 'Send a message to the selected client',
    category: CommandCategory.Client,
    icon: <MessageCircle className="w-4 h-4" />,
    availability: hasClientEntity,
    permission: defaultPermission,
    preview: (ctx) => {
      const client = ctx.selectedEntity?.data;
      return (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Send a message to client:</p>
          <p style={{ fontWeight: tokens.typography.fontWeight.bold, marginTop: tokens.spacing[2] }}>
            {client?.firstName} {client?.lastName}
          </p>
        </div>
      );
    },
    execute: async (ctx) => {
      const clientId = ctx.selectedEntity?.id;
      try {
        // Mock implementation - replace with actual API call
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
          status: 'success' as const,
          message: 'Message sent successfully',
          telemetry: { clientId, action: 'message-client' },
        };
      } catch (error) {
        return {
          status: 'failed' as const,
          message: 'Failed to send message',
        };
      }
    },
  },
  {
    id: 'client.view-history',
    label: 'View Booking History',
    description: 'View booking history for the selected client',
    category: CommandCategory.Client,
    icon: <History className="w-4 h-4" />,
    availability: hasClientEntity,
    permission: defaultPermission,
    preview: (ctx) => {
      const client = ctx.selectedEntity?.data;
      return (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>View booking history for client:</p>
          <p style={{ fontWeight: tokens.typography.fontWeight.bold, marginTop: tokens.spacing[2] }}>
            {client?.firstName} {client?.lastName}
          </p>
        </div>
      );
    },
    execute: async (ctx) => {
      const clientId = ctx.selectedEntity?.id;
      return {
        status: 'success' as const,
        redirect: `/clients/${clientId}?tab=history`,
        telemetry: { clientId, action: 'view-history' },
      };
    },
  },
  {
    id: 'client.create-booking',
    label: 'Create New Booking',
    description: 'Create a new booking for the selected client',
    category: CommandCategory.Client,
    icon: <PlusCircle className="w-4 h-4" />,
    availability: hasClientEntity,
    permission: defaultPermission,
    preview: (ctx) => {
      const client = ctx.selectedEntity?.data;
      return (
        <div style={{ padding: tokens.spacing[4] }}>
          <p>Create a new booking for client:</p>
          <p style={{ fontWeight: tokens.typography.fontWeight.bold, marginTop: tokens.spacing[2] }}>
            {client?.firstName} {client?.lastName}
          </p>
          <p style={{ marginTop: tokens.spacing[2], fontSize: tokens.typography.fontSize.sm[0], color: tokens.colors.text.secondary }}>
            This will open the booking creation form.
          </p>
        </div>
      );
    },
    execute: async (ctx) => {
      const clientId = ctx.selectedEntity?.id;
      try {
        // Mock implementation - replace with actual navigation
        await new Promise(resolve => setTimeout(resolve, 300));
        return {
          status: 'success' as const,
          redirect: `/bookings/new?clientId=${clientId}`,
          telemetry: { clientId, action: 'create-booking' },
        };
      } catch (error) {
        return {
          status: 'failed' as const,
          message: 'Failed to create booking',
        };
      }
    },
  },
];

/**
 * System Commands
 */
const systemCommands: Command[] = [
  {
    id: 'system.toggle-dark-mode',
    label: 'Toggle Dark Mode',
    description: 'Toggle dark mode theme',
    category: CommandCategory.System,
    icon: <Moon className="w-4 h-4" />,
    availability: alwaysAllowed,
    permission: alwaysAllowed,
    preview: () => (
      <div style={{ padding: tokens.spacing[4] }}>
        <p>Toggle between light and dark mode.</p>
        <p style={{ marginTop: tokens.spacing[2], fontSize: tokens.typography.fontSize.sm[0], color: tokens.colors.text.secondary }}>
          Switches between Snout and Snout Dark themes.
        </p>
      </div>
    ),
    execute: async () => {
      const current = localStorage.getItem('snout-theme') || 'snout';
      const next = (current === 'snout' || current === 'light') ? 'snout-dark' : 'snout';
      const html = document.documentElement;
      html.classList.remove('dark', 'theme-snout', 'theme-snout-dark');
      if (next === 'snout-dark') html.classList.add('theme-snout-dark');
      else html.classList.add('theme-snout');
      localStorage.setItem('snout-theme', next);
      return {
        status: 'success' as const,
        message: next.includes('dark') ? 'Dark mode enabled' : 'Light mode enabled',
        telemetry: { action: 'toggle-dark-mode', theme: next },
      };
    },
  },
  {
    id: 'system.open-ui-kit',
    label: 'Open UI Kit Demo',
    description: 'Navigate to the UI kit demo page',
    category: CommandCategory.System,
    icon: <Palette className="w-4 h-4" />,
    availability: (ctx) => ctx.currentRoute !== '/ui-kit',
    permission: alwaysAllowed,
    preview: () => (
      <div style={{ padding: tokens.spacing[4] }}>
        <p>Navigate to the UI kit demo page to view all components.</p>
      </div>
    ),
    execute: async () => ({
      status: 'success' as const,
      redirect: '/ui-kit',
      telemetry: { route: '/ui-kit' },
    }),
  },
];

/**
 * Register all commands
 */
export function registerAllCommands(): void {
  // Import calendar commands dynamically to avoid circular dependencies
  let calendarCommands: Command[] = [];
  try {
    const { calendarViewCommands } = require('./calendar-commands');
    calendarCommands = calendarViewCommands;
  } catch (error) {
    console.warn('Calendar commands not available:', error);
  }

  // Import booking commands dynamically
  let bookingStatusCommands: Command[] = [];
  try {
    const { bookingStatusCommands: commands } = require('./booking-commands');
    bookingStatusCommands = commands;
  } catch (error) {
    console.warn('Booking status commands not available:', error);
  }

  const allCommands = [
    ...navigationCommands,
    ...bookingCommands,
    ...clientCommands,
    ...systemCommands,
    ...calendarCommands,
    ...bookingStatusCommands,
  ];

  allCommands.forEach(command => {
    try {
      registerCommand(command);
    } catch (error) {
      console.error(`Failed to register command ${command.id}:`, error);
    }
  });

  console.log(`✅ Registered ${allCommands.length} commands`);
}
