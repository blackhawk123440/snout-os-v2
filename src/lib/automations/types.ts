/**
 * Canonical automation settings shape.
 * Stored per-org in Setting table with key AUTOMATION_SETTINGS_KEY.
 * Used by executor (getAutomationSettings / getMessageTemplate) and /api/automations.
 */

export const AUTOMATION_SETTINGS_KEY = "automation";

export type AutomationTypeId =
  | "bookingConfirmation"
  | "nightBeforeReminder"
  | "paymentReminder"
  | "sitterAssignment"
  | "postVisitThankYou"
  | "ownerNewBookingAlert"
  | "checkinNotification"
  | "checkoutNotification"
  | "bookingCancellation"
  | "visitReportNotification";

export interface AutomationSettings {
  bookingConfirmation: {
    enabled: boolean;
    sendToClient: boolean;
    sendToSitter: boolean;
    sendToOwner: boolean;
    messageTemplateClient?: string;
    messageTemplateSitter?: string;
    messageTemplateOwner?: string;
  };
  nightBeforeReminder: {
    enabled: boolean;
    sendToClient: boolean;
    sendToSitter: boolean;
    reminderTime: string;
    messageTemplateClient?: string;
    messageTemplateSitter?: string;
  };
  paymentReminder: {
    enabled: boolean;
    sendToClient: boolean;
    reminderDelay: number;
    repeatReminder: boolean;
    repeatInterval: number;
    messageTemplateClient?: string;
  };
  sitterAssignment: {
    enabled: boolean;
    sendToSitter: boolean;
    sendToOwner: boolean;
    messageTemplateSitter?: string;
    messageTemplateOwner?: string;
  };
  postVisitThankYou: {
    enabled: boolean;
    sendToClient: boolean;
    delayAfterVisit: number;
    messageTemplateClient?: string;
  };
  ownerNewBookingAlert: {
    enabled: boolean;
    sendToOwner: boolean;
    sendToClient?: boolean;
    ownerPhoneType: "personal" | "messaging";
    messageTemplateClient?: string;
    messageTemplateOwner?: string;
  };
  checkinNotification: {
    enabled: boolean;
    sendToClient: boolean;
    sendToOwner: boolean;
    messageTemplateClient?: string;
    messageTemplateOwner?: string;
  };
  checkoutNotification: {
    enabled: boolean;
    sendToClient: boolean;
    sendToOwner: boolean;
    messageTemplateClient?: string;
    messageTemplateOwner?: string;
  };
  bookingCancellation: {
    enabled: boolean;
    sendToClient: boolean;
    sendToSitter: boolean;
    sendToOwner: boolean;
    messageTemplateClient?: string;
    messageTemplateSitter?: string;
    messageTemplateOwner?: string;
  };
  visitReportNotification: {
    enabled: boolean;
    sendToClient: boolean;
    messageTemplateClient?: string;
  };
}

/** Default: all automations enabled — zero manual ops from day one. */
export function getDefaultAutomationSettings(): AutomationSettings {
  return {
    bookingConfirmation: {
      enabled: true,
      sendToClient: true,
      sendToSitter: false,
      sendToOwner: false,
    },
    nightBeforeReminder: {
      enabled: true,
      sendToClient: true,
      sendToSitter: true,
      reminderTime: "19:00",
    },
    paymentReminder: {
      enabled: true,
      sendToClient: true,
      reminderDelay: 24,
      repeatReminder: true,
      repeatInterval: 7,
    },
    sitterAssignment: {
      enabled: true,
      sendToSitter: true,
      sendToOwner: true,
    },
    postVisitThankYou: {
      enabled: true,
      sendToClient: true,
      delayAfterVisit: 30,
    },
    ownerNewBookingAlert: {
      enabled: true,
      sendToOwner: true,
      sendToClient: false,
      ownerPhoneType: "personal",
    },
    checkinNotification: {
      enabled: true,
      sendToClient: true,
      sendToOwner: true,
    },
    checkoutNotification: {
      enabled: true,
      sendToClient: true,
      sendToOwner: true,
    },
    bookingCancellation: {
      enabled: true,
      sendToClient: true,
      sendToSitter: true,
      sendToOwner: true,
    },
    visitReportNotification: {
      enabled: true,
      sendToClient: true,
    },
  };
}

export const AUTOMATION_TYPE_IDS: AutomationTypeId[] = [
  "bookingConfirmation",
  "nightBeforeReminder",
  "paymentReminder",
  "sitterAssignment",
  "postVisitThankYou",
  "ownerNewBookingAlert",
  "checkinNotification",
  "checkoutNotification",
  "bookingCancellation",
  "visitReportNotification",
];
