/**
 * Automation Action Registry
 * 
 * Central registry for all automation action types with typed configurations,
 * validation schemas, and safety previews.
 */

import { z } from 'zod';

/**
 * Base action configuration schema
 */
export interface ActionConfig {
  [key: string]: any;
}

/**
 * Action definition with validation and safety preview
 */
export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  category: 'messaging' | 'booking' | 'payment' | 'payroll' | 'admin';
  configSchema: z.ZodSchema;
  preview: (config: ActionConfig, context?: any) => string;
  isDestructive: boolean; // Whether this action modifies data
  requiresConfirmation: boolean; // Whether to show confirmation before enabling
}

/**
 * Messaging Actions
 */
export const messagingActions: ActionDefinition[] = [
  {
    id: 'sendSMS.client',
    name: 'Send SMS to Client',
    description: 'Send SMS message to client using template',
    category: 'messaging',
    configSchema: z.object({
      templateId: z.string().optional(),
      message: z.string().optional(),
      phone: z.string().optional(), // Override client phone
    }),
    preview: (config, context) => {
      const client = context?.client || context?.booking;
      const name = client ? `${client.firstName} ${client.lastName}` : 'client';
      return `Will send SMS to ${name}`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    id: 'sendSMS.sitter',
    name: 'Send SMS to Sitter',
    description: 'Send SMS message to sitter using template',
    category: 'messaging',
    configSchema: z.object({
      templateId: z.string().optional(),
      message: z.string().optional(),
      sitterId: z.string().optional(), // Override sitter
    }),
    preview: (config, context) => {
      const sitter = context?.sitter;
      const name = sitter ? `${sitter.firstName} ${sitter.lastName}` : 'sitter';
      return `Will send SMS to ${name}`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    id: 'sendInternalMessage',
    name: 'Send Internal Message',
    description: 'Create internal message in Snout OS',
    category: 'messaging',
    configSchema: z.object({
      message: z.string(),
      threadId: z.string().optional(),
      assignTo: z.string().optional(), // User ID
    }),
    preview: (config) => {
      const assign = config.assignTo ? ` assigned to user` : '';
      return `Will create internal message${assign}`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    id: 'createMessageTask',
    name: 'Create Message Task Reminder',
    description: 'Create a task reminder for message follow-up',
    category: 'messaging',
    configSchema: z.object({
      message: z.string(),
      dueInMinutes: z.number().min(0).optional(),
      assignTo: z.string().optional(),
    }),
    preview: (config) => {
      const due = config.dueInMinutes ? ` due in ${config.dueInMinutes} minutes` : '';
      return `Will create message task reminder${due}`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
];

/**
 * Booking Actions
 */
export const bookingActions: ActionDefinition[] = [
  {
    id: 'changeBookingStatus',
    name: 'Change Booking Status',
    description: 'Update booking status',
    category: 'booking',
    configSchema: z.object({
      status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
    }),
    preview: (config, context) => {
      const booking = context?.booking;
      const bookingId = booking?.id || 'booking';
      return `Will change booking ${bookingId} status to ${config.status}`;
    },
    isDestructive: true,
    requiresConfirmation: true,
  },
  {
    id: 'assignSitter',
    name: 'Assign Sitter',
    description: 'Assign a sitter to booking',
    category: 'booking',
    configSchema: z.object({
      sitterId: z.string().optional(), // If not provided, uses context sitter
      sitterTier: z.string().optional(), // Assign by tier
    }),
    preview: (config, context) => {
      const booking = context?.booking;
      const bookingId = booking?.id || 'booking';
      if (config.sitterId) {
        return `Will assign sitter ${config.sitterId} to booking ${bookingId}`;
      }
      if (config.sitterTier) {
        return `Will assign sitter from ${config.sitterTier} tier to booking ${bookingId}`;
      }
      return `Will assign sitter to booking ${bookingId}`;
    },
    isDestructive: true,
    requiresConfirmation: true,
  },
  {
    id: 'addSitterPool',
    name: 'Add to Sitter Pool',
    description: 'Add sitters to booking pool',
    category: 'booking',
    configSchema: z.object({
      sitterIds: z.array(z.string()),
    }),
    preview: (config, context) => {
      const booking = context?.booking;
      const bookingId = booking?.id || 'booking';
      const count = config.sitterIds?.length || 0;
      return `Will add ${count} sitter(s) to pool for booking ${bookingId}`;
    },
    isDestructive: true,
    requiresConfirmation: true,
  },
  {
    id: 'removeFromPool',
    name: 'Remove from Pool',
    description: 'Remove sitter from booking pool',
    category: 'booking',
    configSchema: z.object({
      sitterId: z.string(),
    }),
    preview: (config, context) => {
      const booking = context?.booking;
      const bookingId = booking?.id || 'booking';
      return `Will remove sitter ${config.sitterId} from pool for booking ${bookingId}`;
    },
    isDestructive: true,
    requiresConfirmation: true,
  },
  {
    id: 'addInternalNote',
    name: 'Add Internal Note',
    description: 'Add note to booking',
    category: 'booking',
    configSchema: z.object({
      note: z.string(),
    }),
    preview: (config, context) => {
      const booking = context?.booking;
      const bookingId = booking?.id || 'booking';
      return `Will add internal note to booking ${bookingId}`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    id: 'createFollowUpTask',
    name: 'Create Follow-up Task',
    description: 'Create a follow-up task for booking',
    category: 'booking',
    configSchema: z.object({
      task: z.string(),
      dueInMinutes: z.number().min(0).optional(),
      assignTo: z.string().optional(),
    }),
    preview: (config) => {
      const due = config.dueInMinutes ? ` due in ${config.dueInMinutes} minutes` : '';
      return `Will create follow-up task${due}`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
];

/**
 * Payment Actions
 */
export const paymentActions: ActionDefinition[] = [
  {
    id: 'generatePaymentLink',
    name: 'Generate Payment Link',
    description: 'Generate Stripe payment link for booking',
    category: 'payment',
    configSchema: z.object({
      amount: z.number().optional(), // Override booking total
    }),
    preview: (config, context) => {
      const booking = context?.booking;
      const bookingId = booking?.id || 'booking';
      const amount = config.amount ? ` for $${config.amount}` : '';
      return `Will generate payment link for booking ${bookingId}${amount}`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    id: 'sendPaymentLink',
    name: 'Send Payment Link',
    description: 'Send payment link to client',
    category: 'payment',
    configSchema: z.object({
      linkUrl: z.string().optional(), // If not provided, uses booking payment link
    }),
    preview: (config, context) => {
      const client = context?.client || context?.booking;
      const name = client ? `${client.firstName} ${client.lastName}` : 'client';
      return `Will send payment link to ${name}`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    id: 'markPaymentStatus',
    name: 'Mark Payment Status',
    description: 'Update internal payment status',
    category: 'payment',
    configSchema: z.object({
      status: z.enum(['paid', 'unpaid', 'partial', 'refunded']),
    }),
    preview: (config, context) => {
      const booking = context?.booking;
      const bookingId = booking?.id || 'booking';
      return `Will mark payment status as ${config.status} for booking ${bookingId}`;
    },
    isDestructive: true,
    requiresConfirmation: true,
  },
  {
    id: 'notifyOwnerPaymentFailure',
    name: 'Notify Owner of Payment Failure',
    description: 'Send notification to owner about payment failure',
    category: 'payment',
    configSchema: z.object({
      message: z.string().optional(),
    }),
    preview: (config, context) => {
      const booking = context?.booking;
      const bookingId = booking?.id || 'booking';
      return `Will notify owner of payment failure for booking ${bookingId}`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
];

/**
 * Payroll Actions
 */
export const payrollActions: ActionDefinition[] = [
  {
    id: 'createPayrollAdjustment',
    name: 'Create Payroll Adjustment',
    description: 'Create bonus or deduction for sitter',
    category: 'payroll',
    configSchema: z.object({
      sitterId: z.string(),
      type: z.enum(['bonus', 'deduction']),
      amount: z.number(),
      reason: z.string(),
    }),
    preview: (config, context) => {
      const sitter = context?.sitter;
      const name = sitter ? `${sitter.firstName} ${sitter.lastName}` : config.sitterId;
      return `Will create ${config.type} of $${config.amount} for ${name}`;
    },
    isDestructive: true,
    requiresConfirmation: true,
  },
  {
    id: 'holdPayout',
    name: 'Hold Payout',
    description: 'Hold sitter payout',
    category: 'payroll',
    configSchema: z.object({
      sitterId: z.string(),
      reason: z.string(),
    }),
    preview: (config, context) => {
      const sitter = context?.sitter;
      const name = sitter ? `${sitter.firstName} ${sitter.lastName}` : config.sitterId;
      return `Will hold payout for ${name}`;
    },
    isDestructive: true,
    requiresConfirmation: true,
  },
  {
    id: 'notifyOwnerPayoutException',
    name: 'Notify Owner of Payout Exception',
    description: 'Notify owner about payout exception',
    category: 'payroll',
    configSchema: z.object({
      message: z.string().optional(),
    }),
    preview: (config, context) => {
      const sitter = context?.sitter;
      const name = sitter ? `${sitter.firstName} ${sitter.lastName}` : 'sitter';
      return `Will notify owner of payout exception for ${name}`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    id: 'generatePayrollReport',
    name: 'Generate Payroll Report',
    description: 'Generate and send payroll report',
    category: 'payroll',
    configSchema: z.object({
      periodStart: z.string().optional(), // ISO date string
      periodEnd: z.string().optional(),
      sendTo: z.array(z.string()).optional(), // Email addresses
    }),
    preview: (config) => {
      const recipients = config.sendTo?.length || 0;
      return `Will generate payroll report${recipients > 0 ? ` and send to ${recipients} recipient(s)` : ''}`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
];

/**
 * Admin Actions
 */
export const adminActions: ActionDefinition[] = [
  {
    id: 'createAlert',
    name: 'Create Alert',
    description: 'Create system alert',
    category: 'admin',
    configSchema: z.object({
      title: z.string(),
      message: z.string(),
      severity: z.enum(['info', 'warning', 'error']).optional(),
    }),
    preview: (config) => {
      return `Will create alert: ${config.title}`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    id: 'postToNotifications',
    name: 'Post to Notifications Feed',
    description: 'Post notification to feed',
    category: 'admin',
    configSchema: z.object({
      message: z.string(),
      type: z.enum(['info', 'success', 'warning', 'error']).optional(),
    }),
    preview: (config) => {
      return `Will post notification to feed`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    id: 'escalateToOwner',
    name: 'Escalate to Owner',
    description: 'Escalate issue to owner',
    category: 'admin',
    configSchema: z.object({
      message: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    }),
    preview: (config) => {
      const priority = config.priority ? ` (${config.priority} priority)` : '';
      return `Will escalate to owner${priority}`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    id: 'createChecklistItem',
    name: 'Create Checklist Item',
    description: 'Create checklist item',
    category: 'admin',
    configSchema: z.object({
      item: z.string(),
      assignTo: z.string().optional(),
      dueInMinutes: z.number().min(0).optional(),
    }),
    preview: (config) => {
      const due = config.dueInMinutes ? ` due in ${config.dueInMinutes} minutes` : '';
      return `Will create checklist item${due}`;
    },
    isDestructive: false,
    requiresConfirmation: false,
  },
];

/**
 * All actions combined
 */
export const allActions: ActionDefinition[] = [
  ...messagingActions,
  ...bookingActions,
  ...paymentActions,
  ...payrollActions,
  ...adminActions,
];

/**
 * Get action by ID
 */
export function getActionById(id: string): ActionDefinition | undefined {
  return allActions.find(a => a.id === id);
}

/**
 * Get actions by category
 */
export function getActionsByCategory(category: ActionDefinition['category']): ActionDefinition[] {
  return allActions.filter(a => a.category === category);
}

/**
 * Validate action config
 */
export function validateActionConfig(actionId: string, config: ActionConfig): { valid: boolean; error?: string } {
  const action = getActionById(actionId);
  if (!action) {
    return { valid: false, error: `Unknown action: ${actionId}` };
  }

  try {
    action.configSchema.parse(config);
    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}
