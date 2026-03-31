/**
 * Automation Templates Library
 * 
 * Master Spec Reference: Section 6.3, Epic 12.3.4
 * 
 * Pre-built automation templates for "plug and play" UX.
 * Templates include common automation patterns that can be instantiated and customized.
 */

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: "booking" | "payment" | "reminder" | "notification" | "review";
  trigger: string;
  conditions: Array<{
    field: string;
    operator: string;
    value: string;
    logic?: "AND" | "OR";
  }>;
  actions: Array<{
    type: string;
    config: Record<string, any>;
    delayMinutes?: number;
  }>;
  defaultEnabled: boolean;
}

/**
 * Template library as defined in Master Spec Section 6.3.1
 * 
 * Templates include:
 * - booking confirmed
 * - payment failed
 * - arrival
 * - departure
 * - review request
 * - sitter assignment
 * - key pickup reminder
 */
export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "booking-confirmed",
    name: "Booking Confirmation",
    description: "Send confirmation messages when a booking is confirmed",
    category: "booking",
    trigger: "booking.confirmed",
    conditions: [
      {
        field: "status",
        operator: "equals",
        value: "confirmed",
      },
    ],
    actions: [
      {
        type: "sendSMS",
        config: {
          recipient: "client",
          template: "bookingConfirmation",
        },
      },
      {
        type: "sendSMS",
        config: {
          recipient: "sitter",
          template: "bookingConfirmation",
        },
        delayMinutes: 0,
      },
      {
        type: "notifyOwner",
        config: {
          message: "Booking confirmed: {{clientName}} - {{service}}",
        },
      },
    ],
    defaultEnabled: true,
  },
  {
    id: "payment-failed",
    name: "Payment Failed Notification",
    description: "Notify owner and client when payment fails",
    category: "payment",
    trigger: "payment.failed",
    conditions: [
      {
        field: "paymentStatus",
        operator: "equals",
        value: "failed",
      },
    ],
    actions: [
      {
        type: "sendSMS",
        config: {
          recipient: "client",
          template: "paymentFailed",
        },
      },
      {
        type: "notifyOwner",
        config: {
          message: "Payment failed for booking: {{clientName}} - ${{totalPrice}}",
        },
      },
    ],
    defaultEnabled: true,
  },
  {
    id: "sitter-assignment",
    name: "Sitter Assignment Notification",
    description: "Notify sitter and owner when a sitter is assigned",
    category: "notification",
    trigger: "sitter.assigned",
    conditions: [
      {
        field: "sitterId",
        operator: "notEquals",
        value: "",
      },
    ],
    actions: [
      {
        type: "sendSMS",
        config: {
          recipient: "sitter",
          template: "sitterAssignment",
        },
      },
      {
        type: "notifyOwner",
        config: {
          message: "Sitter assigned: {{sitterName}} to {{clientName}}",
        },
      },
    ],
    defaultEnabled: true,
  },
  {
    id: "night-before-reminder",
    name: "Night Before Reminder",
    description: "Send reminder the night before a booking",
    category: "reminder",
    trigger: "booking.nightBefore",
    conditions: [
      {
        field: "status",
        operator: "equals",
        value: "confirmed",
      },
    ],
    actions: [
      {
        type: "sendSMS",
        config: {
          recipient: "client",
          template: "nightBeforeReminder",
        },
        delayMinutes: 0,
      },
      {
        type: "sendSMS",
        config: {
          recipient: "sitter",
          template: "nightBeforeReminder",
        },
        delayMinutes: 0,
      },
    ],
    defaultEnabled: true,
  },
  {
    id: "post-visit-thank-you",
    name: "Post-Visit Thank You",
    description: "Send thank you message after visit completion",
    category: "notification",
    trigger: "booking.completed",
    conditions: [
      {
        field: "status",
        operator: "equals",
        value: "completed",
      },
    ],
    actions: [
      {
        type: "sendSMS",
        config: {
          recipient: "client",
          template: "postVisitThankYou",
        },
        delayMinutes: 30, // 30 minutes after completion
      },
    ],
    defaultEnabled: true,
  },
  {
    id: "review-request",
    name: "Review Request",
    description: "Request review after completed visit",
    category: "review",
    trigger: "booking.completed",
    conditions: [
      {
        field: "status",
        operator: "equals",
        value: "completed",
      },
    ],
    actions: [
      {
        type: "sendSMS",
        config: {
          recipient: "client",
          template: "reviewRequest",
        },
        delayMinutes: 1440, // 24 hours after completion
      },
    ],
    defaultEnabled: true,
  },
  {
    id: "payment-reminder",
    name: "Payment Reminder",
    description: "Remind client about unpaid booking",
    category: "payment",
    trigger: "booking.unpaid",
    conditions: [
      {
        field: "paymentStatus",
        operator: "equals",
        value: "unpaid",
      },
      {
        field: "status",
        operator: "notEquals",
        value: "completed",
        logic: "AND",
      },
    ],
    actions: [
      {
        type: "sendSMS",
        config: {
          recipient: "client",
          template: "paymentReminder",
        },
        delayMinutes: 0,
      },
    ],
    defaultEnabled: true,
  },
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): AutomationTemplate | undefined {
  return AUTOMATION_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: AutomationTemplate["category"]): AutomationTemplate[] {
  return AUTOMATION_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get all templates
 */
export function getAllTemplates(): AutomationTemplate[] {
  return AUTOMATION_TEMPLATES;
}

