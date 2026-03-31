/**
 * Automation Engine — DEAD CODE / LEGACY
 *
 * WARNING: This module is NOT the live automation system.
 * The live automation path is: enqueueAutomation() → automation-queue.ts worker → automation-executor.ts
 *
 * This file contains an old event-subscription engine that:
 * - Subscribes to events via eventEmitter.onAll() (line 228)
 * - Fetches Automation model rules from DB
 * - Has an EARLY RETURN at line 202 that skips ALL processing
 * - All 7 action executors (sendMessage, updateBookingStatus, etc.) return errors or no-ops
 *
 * The "NestJS API" referenced in comments does not exist in this repository.
 * Those comments were written during a schema transition and are inaccurate.
 *
 * Safe to delete if automation-init.ts is updated to not call initializeAutomationEngine().
 */

import { prisma } from "@/lib/db";
import { eventEmitter } from "./event-emitter";

type EventType = string;
type EventContext = Record<string, any>;

interface AutomationCondition {
  field: string;
  operator: string;
  value: string;
  logic?: string;
}

interface AutomationAction {
  type: string;
  config: string;
  delayMinutes?: number;
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(
  condition: AutomationCondition,
  context: EventContext
): boolean {
  const { field, operator, value } = condition;
  const contextValue = getNestedValue(context, field);

  if (contextValue === undefined || contextValue === null) {
    return false;
  }

  const conditionValue = parseValue(value);
  const contextVal = parseValue(contextValue);

  switch (operator) {
    case "equals":
      return contextVal === conditionValue;
    case "notEquals":
      return contextVal !== conditionValue;
    case "contains":
      return String(contextVal).toLowerCase().includes(String(conditionValue).toLowerCase());
    case "notContains":
      return !String(contextVal).toLowerCase().includes(String(conditionValue).toLowerCase());
    case "greaterThan":
      return Number(contextVal) > Number(conditionValue);
    case "lessThan":
      return Number(contextVal) < Number(conditionValue);
    case "isEmpty":
      return !contextValue || String(contextValue).trim() === "";
    case "isNotEmpty":
      return !!contextValue && String(contextValue).trim() !== "";
    default:
      return false;
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Parse value to appropriate type
 */
function parseValue(value: string): any {
  // Try to parse as number
  if (!isNaN(Number(value)) && value.trim() !== '') {
    return Number(value);
  }
  // Try to parse as boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  // Return as string
  return value;
}

/**
 * Execute an action
 */
async function executeAction(
  action: AutomationAction,
  context: EventContext,
  automationId: string
): Promise<{ success: boolean; error?: string; result?: any }> {
  const { type, config } = action;
  const actionConfig = typeof config === 'string' ? JSON.parse(config || "{}") : config;

  switch (type) {
    case "sendMessage":
      return await executeSendMessage(actionConfig, context);
    case "updateBookingStatus":
      return await executeUpdateBookingStatus(actionConfig, context);
    case "assignSitter":
      return await executeAssignSitter(actionConfig, context);
    case "unassignSitter":
      return await executeUnassignSitter(actionConfig, context);
    case "applyFee":
      return await executeApplyFee(actionConfig, context);
    case "applyDiscount":
      return await executeApplyDiscount(actionConfig, context);
    case "writeInternalNote":
      return await executeWriteInternalNote(actionConfig, context);
    default:
      return { success: false, error: `Unknown action type: ${type}` };
  }
}

async function executeSendMessage(config: any, context: EventContext): Promise<{ success: boolean; error?: string }> {
  // Note: Message sending is handled by NestJS API for messaging dashboard
  console.log('[AutomationEngine] Would send message, but handled by NestJS API');
  return { success: true };
}

async function executeUpdateBookingStatus(config: any, context: EventContext): Promise<{ success: boolean; error?: string }> {
  // Note: Booking model not available in messaging dashboard schema
  // This function is for the original booking system only
  return { success: false, error: "Booking model not available in messaging dashboard" };
}

async function executeAssignSitter(config: any, context: EventContext): Promise<{ success: boolean; error?: string }> {
  // Note: Booking model not available in messaging dashboard schema
  // This function is for the original booking system only
  return { success: false, error: "Booking model not available in messaging dashboard" };
}

async function executeUnassignSitter(config: any, context: EventContext): Promise<{ success: boolean; error?: string }> {
  // Note: Booking model not available in messaging dashboard schema
  // This function is for the original booking system only
  return { success: false, error: "Booking model not available in messaging dashboard" };
}

async function executeApplyFee(config: any, context: EventContext): Promise<{ success: boolean; error?: string }> {
  // TODO: Implement fee application
  console.log("Fee application not yet implemented", config, context);
  return { success: false, error: "Fee application not yet implemented" };
}

async function executeApplyDiscount(config: any, context: EventContext): Promise<{ success: boolean; error?: string }> {
  // TODO: Implement discount application
  console.log("Discount application not yet implemented", config, context);
  return { success: false, error: "Discount application not yet implemented" };
}

async function executeWriteInternalNote(config: any, context: EventContext): Promise<{ success: boolean; error?: string }> {
  // Note: Booking model not available in messaging dashboard schema
  // This function is for the original booking system only
  return { success: false, error: "Booking model not available in messaging dashboard" };
}

/**
 * Process automations for a given event
 */
export async function processAutomations(
  eventType: EventType,
  context: EventContext
): Promise<void> {
  // Note: This automation engine is for the original booking system
  // The messaging dashboard uses a different automation system (handled by NestJS API)
  // For messaging-only deployments, automations are processed by the API's AutomationWorker
  // This function is disabled when using the messaging dashboard schema
  
  // Fetch all active automations and filter by trigger type in JavaScript
  // (since trigger is a JSON field, not a relation)
  const allAutomations = await prisma.automation.findMany({
    where: {
      status: 'active',
    },
  });

  // Filter automations where trigger JSON matches eventType
  // Note: trigger is a Json field, need to cast it
  const automations = allAutomations.filter((automation) => {
    try {
      const trigger = (automation as any).trigger as any;
      return trigger?.triggerType === eventType;
    } catch {
      return false;
    }
  });

  // Note: Full automation processing is handled by NestJS API's AutomationWorker
  // This Web service automation engine is for the original booking system only
  // For messaging dashboard, automations are processed server-side by the API
  if (automations.length > 0) {
    console.log(`[AutomationEngine] Found ${automations.length} automations for event ${eventType}, but processing is handled by NestJS API`);
  }
  
  return; // Early return - automations handled by API
}

/**
 * Log automation execution
 */
async function logAutomationExecution(
  automationId: string,
  trigger: string,
  context: EventContext,
  conditionGroups: any[],
  actions: any[],
  success: boolean,
  error: string | null
): Promise<void> {
  // Note: Automation execution logging is handled by NestJS API
  // This function is disabled when using the messaging dashboard schema
  // (automationRun and eventLog models don't exist in API schema)
  console.log(`[AutomationEngine] Would log execution for automation ${automationId}, but logging is handled by NestJS API`);
}

/**
 * Initialize automation engine - subscribe to events
 */
export function initializeAutomationEngine(): void {
  // Subscribe to all events
  eventEmitter.onAll(async (context: any) => {
    const eventType = context.eventType;
    if (eventType) {
      await processAutomations(eventType, context);
    }
  });
}
