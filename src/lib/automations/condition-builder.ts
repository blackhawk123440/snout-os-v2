/**
 * Automation Condition Builder
 * 
 * Handles nested condition groups with AND/OR logic and provides
 * readable sentence views.
 */

import { z } from 'zod';

/**
 * Condition type definitions
 */
export interface ConditionDefinition {
  id: string;
  name: string;
  description: string;
  category: 'booking' | 'client' | 'sitter' | 'payment' | 'payroll';
  configSchema: z.ZodSchema;
  evaluate: (config: any, context: any) => boolean;
  preview: (config: any) => string;
}

/**
 * Booking Conditions
 */
export const bookingConditions: ConditionDefinition[] = [
  {
    id: 'booking.service',
    name: 'Service Type',
    description: 'Check if booking service matches',
    category: 'booking',
    configSchema: z.object({
      service: z.string(),
      operator: z.enum(['equals', 'notEquals', 'in', 'notIn']).default('equals'),
    }),
    evaluate: (config, context) => {
      const booking = context.booking;
      if (!booking) return false;
      const service = booking.service || '';
      const operator = config.operator || 'equals';
      
      if (operator === 'equals') return service === config.service;
      if (operator === 'notEquals') return service !== config.service;
      if (operator === 'in') return Array.isArray(config.service) && config.service.includes(service);
      if (operator === 'notIn') return Array.isArray(config.service) && !config.service.includes(service);
      return false;
    },
    preview: (config) => {
      const operator = config.operator || 'equals';
      const service = Array.isArray(config.service) ? config.service.join(', ') : config.service;
      if (operator === 'equals') return `Service is ${service}`;
      if (operator === 'notEquals') return `Service is not ${service}`;
      if (operator === 'in') return `Service is one of: ${service}`;
      if (operator === 'notIn') return `Service is not one of: ${service}`;
      return `Service ${operator} ${service}`;
    },
  },
  {
    id: 'booking.status',
    name: 'Booking Status',
    description: 'Check booking status',
    category: 'booking',
    configSchema: z.object({
      status: z.string(),
      operator: z.enum(['equals', 'notEquals', 'in', 'notIn']).default('equals'),
    }),
    evaluate: (config, context) => {
      const booking = context.booking;
      if (!booking) return false;
      const status = booking.status || '';
      const operator = config.operator || 'equals';
      
      if (operator === 'equals') return status === config.status;
      if (operator === 'notEquals') return status !== config.status;
      if (operator === 'in') return Array.isArray(config.status) && config.status.includes(status);
      if (operator === 'notIn') return Array.isArray(config.status) && !config.status.includes(status);
      return false;
    },
    preview: (config) => {
      const operator = config.operator || 'equals';
      const status = Array.isArray(config.status) ? config.status.join(', ') : config.status;
      if (operator === 'equals') return `Status is ${status}`;
      if (operator === 'notEquals') return `Status is not ${status}`;
      if (operator === 'in') return `Status is one of: ${status}`;
      if (operator === 'notIn') return `Status is not one of: ${status}`;
      return `Status ${operator} ${status}`;
    },
  },
  {
    id: 'booking.dateRange',
    name: 'Date Range',
    description: 'Check if booking date is within range',
    category: 'booking',
    configSchema: z.object({
      startDate: z.string().optional(), // ISO date string
      endDate: z.string().optional(),
    }),
    evaluate: (config, context) => {
      const booking = context.booking;
      if (!booking || !booking.startAt) return false;
      const bookingDate = new Date(booking.startAt);
      const start = config.startDate ? new Date(config.startDate) : null;
      const end = config.endDate ? new Date(config.endDate) : null;
      
      if (start && bookingDate < start) return false;
      if (end && bookingDate > end) return false;
      return true;
    },
    preview: (config) => {
      const start = config.startDate ? new Date(config.startDate).toLocaleDateString() : 'any';
      const end = config.endDate ? new Date(config.endDate).toLocaleDateString() : 'any';
      return `Date is between ${start} and ${end}`;
    },
  },
  {
    id: 'booking.sameDay',
    name: 'Same Day Booking',
    description: 'Check if booking is same day',
    category: 'booking',
    configSchema: z.object({
      enabled: z.boolean().default(true),
    }),
    evaluate: (config, context) => {
      if (!config.enabled) return true;
      const booking = context.booking;
      if (!booking || !booking.startAt) return false;
      const bookingDate = new Date(booking.startAt);
      const today = new Date();
      return bookingDate.toDateString() === today.toDateString();
    },
    preview: () => 'Booking is same day',
  },
  {
    id: 'booking.isOvernight',
    name: 'Overnight vs Multi-Visit',
    description: 'Check if booking is overnight or multi-visit',
    category: 'booking',
    configSchema: z.object({
      type: z.enum(['overnight', 'multiVisit']),
    }),
    evaluate: (config, context) => {
      const booking = context.booking;
      if (!booking) return false;
      const isOvernight = booking.service?.toLowerCase().includes('overnight') || 
                         booking.service?.toLowerCase().includes('house sit');
      return config.type === 'overnight' ? isOvernight : !isOvernight;
    },
    preview: (config) => {
      return config.type === 'overnight' ? 'Booking is overnight' : 'Booking is multi-visit';
    },
  },
  {
    id: 'booking.totalValue',
    name: 'Total Value Threshold',
    description: 'Check if booking total exceeds threshold',
    category: 'booking',
    configSchema: z.object({
      threshold: z.number(),
      operator: z.enum(['greaterThan', 'lessThan', 'equals', 'greaterThanOrEqual', 'lessThanOrEqual']).default('greaterThan'),
    }),
    evaluate: (config, context) => {
      const booking = context.booking;
      if (!booking) return false;
      const total = booking.totalPrice || 0;
      const operator = config.operator || 'greaterThan';
      
      if (operator === 'greaterThan') return total > config.threshold;
      if (operator === 'lessThan') return total < config.threshold;
      if (operator === 'equals') return total === config.threshold;
      if (operator === 'greaterThanOrEqual') return total >= config.threshold;
      if (operator === 'lessThanOrEqual') return total <= config.threshold;
      return false;
    },
    preview: (config) => {
      const operator = config.operator || 'greaterThan';
      const opMap: Record<string, string> = {
        greaterThan: 'greater than',
        lessThan: 'less than',
        equals: 'equal to',
        greaterThanOrEqual: 'greater than or equal to',
        lessThanOrEqual: 'less than or equal to',
      };
      return `Total value is ${opMap[operator] || operator} $${config.threshold}`;
    },
  },
  {
    id: 'booking.petsCount',
    name: 'Pets Count',
    description: 'Check number of pets',
    category: 'booking',
    configSchema: z.object({
      count: z.number(),
      operator: z.enum(['equals', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual']).default('equals'),
    }),
    evaluate: (config, context) => {
      const booking = context.booking;
      if (!booking || !booking.pets) return false;
      const petCount = Array.isArray(booking.pets) ? booking.pets.length : 0;
      const operator = config.operator || 'equals';
      
      if (operator === 'equals') return petCount === config.count;
      if (operator === 'greaterThan') return petCount > config.count;
      if (operator === 'lessThan') return petCount < config.count;
      if (operator === 'greaterThanOrEqual') return petCount >= config.count;
      if (operator === 'lessThanOrEqual') return petCount <= config.count;
      return false;
    },
    preview: (config) => {
      const operator = config.operator || 'equals';
      const opMap: Record<string, string> = {
        equals: 'equals',
        greaterThan: 'greater than',
        lessThan: 'less than',
        greaterThanOrEqual: 'greater than or equal to',
        lessThanOrEqual: 'less than or equal to',
      };
      return `Pets count ${opMap[operator] || operator} ${config.count}`;
    },
  },
  {
    id: 'booking.location',
    name: 'Location Contains',
    description: 'Check if booking address contains text',
    category: 'booking',
    configSchema: z.object({
      text: z.string(),
    }),
    evaluate: (config, context) => {
      const booking = context.booking;
      if (!booking || !booking.address) return false;
      return booking.address.toLowerCase().includes(config.text.toLowerCase());
    },
    preview: (config) => `Location contains "${config.text}"`,
  },
  {
    id: 'booking.isAssigned',
    name: 'Assigned or Unassigned',
    description: 'Check if booking has assigned sitter',
    category: 'booking',
    configSchema: z.object({
      assigned: z.boolean(),
    }),
    evaluate: (config, context) => {
      const booking = context.booking;
      if (!booking) return false;
      const isAssigned = !!booking.sitterId;
      return config.assigned ? isAssigned : !isAssigned;
    },
    preview: (config) => config.assigned ? 'Booking is assigned' : 'Booking is unassigned',
  },
  {
    id: 'booking.sitterTier',
    name: 'Sitter Tier Required',
    description: 'Check if assigned sitter has required tier',
    category: 'booking',
    configSchema: z.object({
      tier: z.string(),
    }),
    evaluate: (config, context) => {
      const sitter = context.sitter;
      if (!sitter || !sitter.currentTier) return false;
      return sitter.currentTier.name === config.tier || sitter.currentTier.id === config.tier;
    },
    preview: (config) => `Sitter tier is ${config.tier}`,
  },
  {
    id: 'booking.sitterInPool',
    name: 'Sitter in Pool Contains',
    description: 'Check if specific sitter is in pool',
    category: 'booking',
    configSchema: z.object({
      sitterId: z.string(),
    }),
    evaluate: (config, context) => {
      const booking = context.booking;
      if (!booking || !booking.sitterPool) return false;
      return booking.sitterPool.some((p: any) => p.sitter?.id === config.sitterId);
    },
    preview: (config) => `Sitter ${config.sitterId} is in pool`,
  },
];

/**
 * Client Conditions
 */
export const clientConditions: ConditionDefinition[] = [
  {
    id: 'client.isNew',
    name: 'New Client',
    description: 'Check if client is new',
    category: 'client',
    configSchema: z.object({
      enabled: z.boolean().default(true),
    }),
    evaluate: (config, context) => {
      if (!config.enabled) return true;
      const client = context.client;
      if (!client) return false;
      // Check if this is first booking
      return context.isNewClient || false;
    },
    preview: () => 'Client is new',
  },
  {
    id: 'client.isVIP',
    name: 'VIP Client',
    description: 'Check if client is VIP',
    category: 'client',
    configSchema: z.object({
      enabled: z.boolean().default(true),
    }),
    evaluate: (config, context) => {
      if (!config.enabled) return true;
      const client = context.client;
      if (!client) return false;
      // Check tags or custom field
      const tags = client.tags ? JSON.parse(client.tags) : [];
      return Array.isArray(tags) && tags.includes('VIP');
    },
    preview: () => 'Client is VIP',
  },
  {
    id: 'client.hasOverduePayment',
    name: 'Has Overdue Payment',
    description: 'Check if client has overdue payment',
    category: 'client',
    configSchema: z.object({
      enabled: z.boolean().default(true),
    }),
    evaluate: (config, context) => {
      if (!config.enabled) return true;
      // Check if client has unpaid bookings
      return context.hasOverduePayment || false;
    },
    preview: () => 'Client has overdue payment',
  },
  {
    id: 'client.lifetimeValue',
    name: 'Lifetime Value Threshold',
    description: 'Check client lifetime value',
    category: 'client',
    configSchema: z.object({
      threshold: z.number(),
      operator: z.enum(['greaterThan', 'lessThan', 'equals']).default('greaterThan'),
    }),
    evaluate: (config, context) => {
      const client = context.client;
      if (!client) return false;
      const ltv = client.lifetimeValue || 0;
      const operator = config.operator || 'greaterThan';
      
      if (operator === 'greaterThan') return ltv > config.threshold;
      if (operator === 'lessThan') return ltv < config.threshold;
      if (operator === 'equals') return ltv === config.threshold;
      return false;
    },
    preview: (config) => {
      const operator = config.operator || 'greaterThan';
      return `Lifetime value is ${operator === 'greaterThan' ? 'greater than' : operator === 'lessThan' ? 'less than' : 'equal to'} $${config.threshold}`;
    },
  },
  {
    id: 'client.lastBookingDate',
    name: 'Last Booking Date',
    description: 'Check when client last had a booking',
    category: 'client',
    configSchema: z.object({
      daysAgo: z.number(),
      operator: z.enum(['greaterThan', 'lessThan', 'equals']).default('greaterThan'),
    }),
    evaluate: (config, context) => {
      const client = context.client;
      if (!client || !client.lastBookingAt) return false;
      const lastBooking = new Date(client.lastBookingAt);
      const daysAgo = Math.floor((Date.now() - lastBooking.getTime()) / (1000 * 60 * 60 * 24));
      const operator = config.operator || 'greaterThan';
      
      if (operator === 'greaterThan') return daysAgo > config.daysAgo;
      if (operator === 'lessThan') return daysAgo < config.daysAgo;
      if (operator === 'equals') return daysAgo === config.daysAgo;
      return false;
    },
    preview: (config) => {
      const operator = config.operator || 'greaterThan';
      return `Last booking was ${operator === 'greaterThan' ? 'more than' : operator === 'lessThan' ? 'less than' : 'exactly'} ${config.daysAgo} days ago`;
    },
  },
];

/**
 * All conditions combined
 */
export const allConditions: ConditionDefinition[] = [
  ...bookingConditions,
  ...clientConditions,
];

/**
 * Get condition by ID
 */
export function getConditionById(id: string): ConditionDefinition | undefined {
  return allConditions.find(c => c.id === id);
}

/**
 * Get conditions by category
 */
export function getConditionsByCategory(category: ConditionDefinition['category']): ConditionDefinition[] {
  return allConditions.filter(c => c.category === category);
}

/**
 * Evaluate a condition group
 */
export function evaluateConditionGroup(
  group: { operator: string; conditions: Array<{ conditionType: string; conditionConfig: string }> },
  context: any
): boolean {
  if (!group.conditions || group.conditions.length === 0) {
    return true; // No conditions = always true
  }

  const results = group.conditions.map(condition => {
    const def = getConditionById(condition.conditionType);
    if (!def) return false;
    
    try {
      const config = JSON.parse(condition.conditionConfig || '{}');
      return def.evaluate(config, context);
    } catch {
      return false;
    }
  });

  if (group.operator === 'any') {
    return results.some(r => r === true);
  } else {
    return results.every(r => r === true);
  }
}

/**
 * Evaluate all condition groups for an automation
 */
export function evaluateAllConditionGroups(
  groups: Array<{ operator: string; conditions: Array<{ conditionType: string; conditionConfig: string }> }>,
  context: any
): boolean {
  if (!groups || groups.length === 0) {
    return true; // No groups = always true
  }

  // All groups must pass (implicit AND between groups)
  return groups.every(group => evaluateConditionGroup(group, context));
}

/**
 * Generate readable sentence from condition groups
 */
export function generateConditionSentence(
  groups: Array<{ operator: string; conditions: Array<{ conditionType: string; conditionConfig: string }> }>
): string {
  if (!groups || groups.length === 0) {
    return 'No conditions';
  }

  const groupSentences = groups.map(group => {
    if (!group.conditions || group.conditions.length === 0) {
      return '';
    }

    const conditionSentences = group.conditions
      .map(condition => {
        const def = getConditionById(condition.conditionType);
        if (!def) return '';
        
        try {
          const config = JSON.parse(condition.conditionConfig || '{}');
          return def.preview(config);
        } catch {
          return '';
        }
      })
      .filter(Boolean);

    if (conditionSentences.length === 0) return '';
    
    const operator = group.operator === 'any' ? ' OR ' : ' AND ';
    return `(${conditionSentences.join(operator)})`;
  }).filter(Boolean);

  return groupSentences.join(' AND ');
}
