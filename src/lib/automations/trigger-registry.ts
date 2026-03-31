/**
 * Automation Trigger Registry
 * 
 * Central registry for all automation trigger types with typed configurations
 * and validation schemas.
 */

import { z } from 'zod';

/**
 * Base trigger configuration schema
 */
export interface TriggerConfig {
  [key: string]: any;
}

/**
 * Trigger definition with validation and preview
 */
export interface TriggerDefinition {
  id: string;
  name: string;
  description: string;
  category: 'booking' | 'messaging' | 'payroll' | 'sitter' | 'calendar' | 'time';
  configSchema: z.ZodSchema;
  preview: (config: TriggerConfig, entity?: any) => string;
  providesData: string[]; // List of data keys this trigger provides
}

/**
 * Booking Triggers
 */
export const bookingTriggers: TriggerDefinition[] = [
  {
    id: 'booking.created',
    name: 'Booking Created',
    description: 'Fires when a new booking is created',
    category: 'booking',
    configSchema: z.object({}),
    preview: () => 'When a booking is created',
    providesData: ['booking', 'client', 'pets', 'timeSlots'],
  },
  {
    id: 'booking.updated',
    name: 'Booking Updated',
    description: 'Fires when any booking field is updated',
    category: 'booking',
    configSchema: z.object({}),
    preview: () => 'When a booking is updated',
    providesData: ['booking', 'client', 'pets', 'timeSlots', 'changes'],
  },
  {
    id: 'booking.statusChanged',
    name: 'Booking Status Changed',
    description: 'Fires when booking status changes',
    category: 'booking',
    configSchema: z.object({
      fromStatus: z.string().optional(),
      toStatus: z.string().optional(),
    }),
    preview: (config) => {
      const from = config.fromStatus ? ` from ${config.fromStatus}` : '';
      const to = config.toStatus ? ` to ${config.toStatus}` : '';
      return `When booking status changes${from}${to}`;
    },
    providesData: ['booking', 'client', 'previousStatus', 'newStatus'],
  },
  {
    id: 'booking.assigned',
    name: 'Sitter Assigned',
    description: 'Fires when a sitter is assigned to a booking',
    category: 'booking',
    configSchema: z.object({
      sitterTier: z.string().optional(),
    }),
    preview: (config) => {
      const tier = config.sitterTier ? ` (${config.sitterTier} tier)` : '';
      return `When a sitter is assigned to booking${tier}`;
    },
    providesData: ['booking', 'client', 'sitter', 'sitterTier'],
  },
  {
    id: 'booking.unassigned',
    name: 'Sitter Unassigned',
    description: 'Fires when a sitter is removed from a booking',
    category: 'booking',
    configSchema: z.object({}),
    preview: () => 'When a sitter is unassigned from booking',
    providesData: ['booking', 'client', 'previousSitter'],
  },
  {
    id: 'booking.upcomingReminder',
    name: 'Upcoming Reminder Window',
    description: 'Fires at a specified time before booking start',
    category: 'booking',
    configSchema: z.object({
      hoursBefore: z.number().min(0).max(168), // 0-7 days
    }),
    preview: (config) => {
      const hours = config.hoursBefore || 24;
      return `When booking starts in ${hours} hours`;
    },
    providesData: ['booking', 'client', 'sitter', 'timeUntilStart'],
  },
  {
    id: 'booking.completed',
    name: 'Booking Completed',
    description: 'Fires when booking status changes to completed',
    category: 'booking',
    configSchema: z.object({}),
    preview: () => 'When booking is marked as completed',
    providesData: ['booking', 'client', 'sitter', 'report'],
  },
  {
    id: 'payment.linkSent',
    name: 'Payment Link Sent',
    description: 'Fires when a payment link is sent to client',
    category: 'booking',
    configSchema: z.object({}),
    preview: () => 'When payment link is sent',
    providesData: ['booking', 'client', 'paymentLink'],
  },
  {
    id: 'payment.succeeded',
    name: 'Payment Succeeded',
    description: 'Fires when payment is successfully processed',
    category: 'booking',
    configSchema: z.object({}),
    preview: () => 'When payment succeeds',
    providesData: ['booking', 'client', 'payment', 'amount'],
  },
  {
    id: 'payment.tipReceived',
    name: 'Tip Received',
    description: 'Fires when a tip is received',
    category: 'booking',
    configSchema: z.object({}),
    preview: () => 'When a tip is received',
    providesData: ['booking', 'client', 'tip', 'amount'],
  },
  {
    id: 'booking.visitMissed',
    name: 'Visit Missed or Late',
    description: 'Fires when a visit is flagged as missed or late',
    category: 'booking',
    configSchema: z.object({
      thresholdMinutes: z.number().min(0).optional(),
    }),
    preview: (config) => {
      const threshold = config.thresholdMinutes ? ` (${config.thresholdMinutes} min threshold)` : '';
      return `When visit is missed or late${threshold}`;
    },
    providesData: ['booking', 'client', 'sitter', 'scheduledTime', 'actualTime'],
  },
];

/**
 * Messaging Triggers
 */
export const messagingTriggers: TriggerDefinition[] = [
  {
    id: 'message.conversationCreated',
    name: 'Conversation Created',
    description: 'Fires when a new conversation thread is created',
    category: 'messaging',
    configSchema: z.object({}),
    preview: () => 'When a conversation is created',
    providesData: ['conversation', 'client', 'booking'],
  },
  {
    id: 'message.received',
    name: 'Message Received from Client',
    description: 'Fires when a message is received from a client',
    category: 'messaging',
    configSchema: z.object({}),
    preview: () => 'When message is received from client',
    providesData: ['message', 'conversation', 'client', 'booking'],
  },
  {
    id: 'message.notResponded',
    name: 'Message Not Responded',
    description: 'Fires when a message has not been responded to within X minutes',
    category: 'messaging',
    configSchema: z.object({
      minutes: z.number().min(1).max(10080), // 1 minute to 7 days
    }),
    preview: (config) => {
      const mins = config.minutes || 30;
      return `When message not responded within ${mins} minutes`;
    },
    providesData: ['message', 'conversation', 'client', 'booking', 'minutesSince'],
  },
  {
    id: 'message.templateSent',
    name: 'Template Sent',
    description: 'Fires when a message template is sent',
    category: 'messaging',
    configSchema: z.object({
      templateKey: z.string().optional(),
    }),
    preview: (config) => {
      const template = config.templateKey ? ` (${config.templateKey})` : '';
      return `When template message is sent${template}`;
    },
    providesData: ['message', 'template', 'client', 'booking'],
  },
  {
    id: 'message.sitterRequired',
    name: 'Sitter Message Required',
    description: 'Fires when a sitter response is required',
    category: 'messaging',
    configSchema: z.object({}),
    preview: () => 'When sitter message response is required',
    providesData: ['message', 'sitter', 'booking'],
  },
];

/**
 * Payroll Triggers
 */
export const payrollTriggers: TriggerDefinition[] = [
  {
    id: 'payroll.periodOpened',
    name: 'Payroll Period Opened',
    description: 'Fires when a new payroll period is opened',
    category: 'payroll',
    configSchema: z.object({}),
    preview: () => 'When payroll period opens',
    providesData: ['payrollRun', 'periodStart', 'periodEnd'],
  },
  {
    id: 'payroll.runGenerated',
    name: 'Payroll Run Generated',
    description: 'Fires when a payroll run is generated',
    category: 'payroll',
    configSchema: z.object({}),
    preview: () => 'When payroll run is generated',
    providesData: ['payrollRun', 'lineItems', 'totalAmount'],
  },
  {
    id: 'payroll.approved',
    name: 'Payroll Approved',
    description: 'Fires when payroll is approved',
    category: 'payroll',
    configSchema: z.object({}),
    preview: () => 'When payroll is approved',
    providesData: ['payrollRun', 'approvedBy', 'approvedAt'],
  },
  {
    id: 'payroll.paid',
    name: 'Payroll Paid',
    description: 'Fires when payroll is marked as paid',
    category: 'payroll',
    configSchema: z.object({}),
    preview: () => 'When payroll is paid',
    providesData: ['payrollRun', 'paidAt', 'payouts'],
  },
  {
    id: 'payroll.sitterPayoutException',
    name: 'Sitter Payout Exception',
    description: 'Fires when there is an exception with a sitter payout',
    category: 'payroll',
    configSchema: z.object({}),
    preview: () => 'When sitter payout exception occurs',
    providesData: ['payrollRun', 'sitter', 'exception', 'reason'],
  },
];

/**
 * Sitter Triggers
 */
export const sitterTriggers: TriggerDefinition[] = [
  {
    id: 'sitter.tierChanged',
    name: 'Sitter Tier Changed',
    description: 'Fires when a sitter tier changes',
    category: 'sitter',
    configSchema: z.object({
      fromTier: z.string().optional(),
      toTier: z.string().optional(),
    }),
    preview: (config) => {
      const from = config.fromTier ? ` from ${config.fromTier}` : '';
      const to = config.toTier ? ` to ${config.toTier}` : '';
      return `When sitter tier changes${from}${to}`;
    },
    providesData: ['sitter', 'previousTier', 'newTier'],
  },
  {
    id: 'sitter.joinedPool',
    name: 'Sitter Joins Pool',
    description: 'Fires when a sitter joins a sitter pool',
    category: 'sitter',
    configSchema: z.object({}),
    preview: () => 'When sitter joins pool',
    providesData: ['sitter', 'booking', 'pool'],
  },
  {
    id: 'sitter.removedFromPool',
    name: 'Sitter Removed from Pool',
    description: 'Fires when a sitter is removed from a pool',
    category: 'sitter',
    configSchema: z.object({}),
    preview: () => 'When sitter is removed from pool',
    providesData: ['sitter', 'booking', 'pool'],
  },
  {
    id: 'sitter.inactive',
    name: 'Sitter Inactive',
    description: 'Fires when a sitter is marked inactive',
    category: 'sitter',
    configSchema: z.object({}),
    preview: () => 'When sitter is marked inactive',
    providesData: ['sitter', 'reason'],
  },
];

/**
 * Calendar Triggers
 */
export const calendarTriggers: TriggerDefinition[] = [
  {
    id: 'calendar.overbookingThreshold',
    name: 'Day Has Overbooking Threshold',
    description: 'Fires when a day exceeds overbooking threshold',
    category: 'calendar',
    configSchema: z.object({
      threshold: z.number().min(1),
    }),
    preview: (config) => {
      const threshold = config.threshold || 5;
      return `When day has more than ${threshold} bookings`;
    },
    providesData: ['date', 'bookingCount', 'threshold'],
  },
  {
    id: 'calendar.unassignedThreshold',
    name: 'Unassigned Bookings Exceed Threshold',
    description: 'Fires when unassigned bookings exceed threshold',
    category: 'calendar',
    configSchema: z.object({
      threshold: z.number().min(1),
    }),
    preview: (config) => {
      const threshold = config.threshold || 3;
      return `When unassigned bookings exceed ${threshold}`;
    },
    providesData: ['unassignedCount', 'threshold', 'bookings'],
  },
  {
    id: 'calendar.sameDayBooking',
    name: 'Same Day Booking Created',
    description: 'Fires when a same-day booking is created',
    category: 'calendar',
    configSchema: z.object({}),
    preview: () => 'When same-day booking is created',
    providesData: ['booking', 'client', 'hoursUntilStart'],
  },
];

/**
 * Time-based Triggers
 */
export const timeTriggers: TriggerDefinition[] = [
  {
    id: 'time.scheduled',
    name: 'At Specific Time',
    description: 'Fires at a specific time on specific days',
    category: 'time',
    configSchema: z.object({
      time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM format
      timezone: z.string().default('America/New_York'),
      daysOfWeek: z.array(z.number().min(0).max(6)).optional(), // 0=Sunday, 6=Saturday
    }),
    preview: (config) => {
      const time = config.time || '09:00';
      const tz = config.timezone || 'America/New_York';
      return `At ${time} ${tz}`;
    },
    providesData: ['currentTime', 'timezone'],
  },
  {
    id: 'time.relativeToBookingStart',
    name: 'Relative to Booking Start',
    description: 'Fires X hours/minutes before or after booking start',
    category: 'time',
    configSchema: z.object({
      offset: z.object({
        value: z.number(),
        unit: z.enum(['minutes', 'hours', 'days']),
        direction: z.enum(['before', 'after']),
      }),
    }),
    preview: (config) => {
      const offset = config.offset || { value: 24, unit: 'hours', direction: 'before' };
      return `${offset.value} ${offset.unit} ${offset.direction} booking start`;
    },
    providesData: ['booking', 'client', 'sitter', 'scheduledTime', 'triggerTime'],
  },
  {
    id: 'time.relativeToBookingEnd',
    name: 'Relative to Booking End',
    description: 'Fires X hours/minutes before or after booking end',
    category: 'time',
    configSchema: z.object({
      offset: z.object({
        value: z.number(),
        unit: z.enum(['minutes', 'hours', 'days']),
        direction: z.enum(['before', 'after']),
      }),
    }),
    preview: (config) => {
      const offset = config.offset || { value: 30, unit: 'minutes', direction: 'after' };
      return `${offset.value} ${offset.unit} ${offset.direction} booking end`;
    },
    providesData: ['booking', 'client', 'sitter', 'endTime', 'triggerTime'],
  },
  {
    id: 'time.dailySummary',
    name: 'Daily Summary',
    description: 'Fires daily at specified time with summary',
    category: 'time',
    configSchema: z.object({
      time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      timezone: z.string().default('America/New_York'),
    }),
    preview: (config) => {
      const time = config.time || '07:00';
      return `Daily summary at ${time}`;
    },
    providesData: ['date', 'summary', 'bookings', 'stats'],
  },
  {
    id: 'time.weeklySummary',
    name: 'Weekly Summary',
    description: 'Fires weekly at specified time with summary',
    category: 'time',
    configSchema: z.object({
      dayOfWeek: z.number().min(0).max(6), // 0=Sunday
      time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      timezone: z.string().default('America/New_York'),
    }),
    preview: (config) => {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const day = days[config.dayOfWeek || 0];
      const time = config.time || '09:00';
      return `Weekly summary on ${day} at ${time}`;
    },
    providesData: ['weekStart', 'weekEnd', 'summary', 'bookings', 'stats'],
  },
];

/**
 * All triggers combined
 */
export const allTriggers: TriggerDefinition[] = [
  ...bookingTriggers,
  ...messagingTriggers,
  ...payrollTriggers,
  ...sitterTriggers,
  ...calendarTriggers,
  ...timeTriggers,
];

/**
 * Get trigger by ID
 */
export function getTriggerById(id: string): TriggerDefinition | undefined {
  return allTriggers.find(t => t.id === id);
}

/**
 * Get triggers by category
 */
export function getTriggersByCategory(category: TriggerDefinition['category']): TriggerDefinition[] {
  return allTriggers.filter(t => t.category === category);
}

/**
 * Validate trigger config
 */
export function validateTriggerConfig(triggerId: string, config: TriggerConfig): { valid: boolean; error?: string } {
  const trigger = getTriggerById(triggerId);
  if (!trigger) {
    return { valid: false, error: `Unknown trigger: ${triggerId}` };
  }

  try {
    trigger.configSchema.parse(config);
    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}
