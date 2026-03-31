/**
 * Helper functions for automation management.
 * Reads/writes canonical automation settings from Setting table (org-scoped).
 */

import { prisma } from "@/lib/db";
import { formatClientNameForSitter } from "@/lib/booking-utils";
import {
  AUTOMATION_SETTINGS_KEY,
  getDefaultAutomationSettings,
  type AutomationSettings,
  type AutomationTypeId,
} from "@/lib/automations/types";

/**
 * Get automation settings for an org from the database.
 * Returns merged default + persisted; missing row = all automations disabled.
 */
export async function getAutomationSettings(orgId: string): Promise<Record<string, any>> {
  const safeOrgId = orgId || "default";
  const row = await prisma.setting.findUnique({
    where: {
      orgId_key: { orgId: safeOrgId, key: AUTOMATION_SETTINGS_KEY },
    },
  });
  if (!row?.value) {
    return getDefaultAutomationSettings() as unknown as Record<string, any>;
  }
  try {
    const parsed = JSON.parse(row.value) as Partial<AutomationSettings>;
    const defaults = getDefaultAutomationSettings();
    return {
      ...defaults,
      ...parsed,
      bookingConfirmation: { ...defaults.bookingConfirmation, ...parsed.bookingConfirmation },
      nightBeforeReminder: { ...defaults.nightBeforeReminder, ...parsed.nightBeforeReminder },
      paymentReminder: { ...defaults.paymentReminder, ...parsed.paymentReminder },
      sitterAssignment: { ...defaults.sitterAssignment, ...parsed.sitterAssignment },
      postVisitThankYou: { ...defaults.postVisitThankYou, ...parsed.postVisitThankYou },
      ownerNewBookingAlert: { ...defaults.ownerNewBookingAlert, ...parsed.ownerNewBookingAlert },
    } as unknown as Record<string, any>;
  } catch {
    return getDefaultAutomationSettings() as unknown as Record<string, any>;
  }
}

const RECIPIENT_TEMPLATE_KEYS: Record<"client" | "sitter" | "owner", string> = {
  client: "messageTemplateClient",
  sitter: "messageTemplateSitter",
  owner: "messageTemplateOwner",
};

/**
 * Get message template for an automation type and recipient from persisted settings.
 * Returns null if not set so caller can use default template.
 */
export async function getMessageTemplate(
  automationType: string,
  recipient: "client" | "sitter" | "owner",
  orgId: string
): Promise<string | null> {
  const settings = await getAutomationSettings(orgId);
  const block = settings[automationType];
  if (!block || typeof block !== "object") return null;
  const key = RECIPIENT_TEMPLATE_KEYS[recipient];
  const value = block[key];
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

/**
 * Replace template variables in a message
 * For sitter messages, if totalPrice or total is present and sitterCommissionPercentage is provided,
 * it will be replaced with earnings instead of the full total
 * For sitter messages, client names are automatically formatted as "FirstName LastInitial"
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string | number>,
  options?: {
    sitterCommissionPercentage?: number;
    isSitterMessage?: boolean;
  }
): string {
  let message = template;

  // For sitter messages, format client names as "FirstName LastInitial"
  if (options?.isSitterMessage) {
    const firstName = variables.firstName ? String(variables.firstName) : "";
    const lastName = variables.lastName ? String(variables.lastName) : "";

    if (firstName && lastName) {
      const clientName = formatClientNameForSitter(firstName, lastName);
      message = message.replace(/\{\{clientName\}\}/g, clientName);
      message = message.replace(/\{\{firstName\}\}\s+\{\{lastName\}\}/g, clientName);
      message = message.replace(/\{\{firstName\}\}\s+{{lastName}}/g, clientName);
      const fullNamePattern = new RegExp(`\\b${firstName}\\s+${lastName}\\b`, "g");
      message = message.replace(fullNamePattern, clientName);
      const possessivePattern = new RegExp(`\\b${firstName}\\s+${lastName}'s\\b`, "g");
      message = message.replace(possessivePattern, `${clientName}'s`);
    }
  }

  if (options?.isSitterMessage && options?.sitterCommissionPercentage !== undefined) {
    let totalPrice: number | null = null;
    if (variables.totalPrice !== undefined) {
      totalPrice =
        typeof variables.totalPrice === "number"
          ? variables.totalPrice
          : parseFloat(String(variables.totalPrice));
    } else if (variables.total !== undefined) {
      totalPrice =
        typeof variables.total === "number"
          ? variables.total
          : parseFloat(String(variables.total));
    }
    if (totalPrice !== null && !isNaN(totalPrice)) {
      const earnings = (totalPrice * options.sitterCommissionPercentage) / 100;
      message = message.replace(/\{\{totalPrice\}\}/g, earnings.toFixed(2));
      message = message.replace(/\{\{total\}\}/g, earnings.toFixed(2));
      message = message.replace(/\[TotalPrice\]/gi, earnings.toFixed(2));
      message = message.replace(/\[Total\]/gi, earnings.toFixed(2));
    }
  }

  Object.keys(variables).forEach((key) => {
    if (options?.isSitterMessage && (key === "totalPrice" || key === "total")) return;
    const value = String(variables[key]);
    message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    const oldKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1").trim();
    message = message.replace(new RegExp(`\\[${oldKey}\\]`, "gi"), value);
  });
  return message;
}

/**
 * Check if an automation is enabled for the org.
 */
export async function isAutomationEnabled(
  automationType: string,
  orgId: string
): Promise<boolean> {
  const settings = await getAutomationSettings(orgId);
  const automation = settings[automationType];
  if (!automation || typeof automation !== "object") return false;
  return automation.enabled === true;
}

/**
 * Check if automation should send to a specific recipient (org-scoped).
 */
export async function shouldSendToRecipient(
  automationType: string,
  recipient: "client" | "sitter" | "owner",
  orgId: string
): Promise<boolean> {
  if (!(await isAutomationEnabled(automationType, orgId))) return false;
  const settings = await getAutomationSettings(orgId);
  const automation = settings[automationType];
  if (!automation || typeof automation !== "object") return false;
  switch (recipient) {
    case "client":
      return automation.sendToClient === true;
    case "sitter":
      return automation.sendToSitter === true || automation.sendToSitters === true;
    case "owner":
      return automation.sendToOwner === true;
    default:
      return false;
  }
}

/**
 * Persist automation settings for an org (owner/admin only; caller must enforce auth).
 */
export async function setAutomationSettings(
  orgId: string,
  settings: Partial<AutomationSettings>
): Promise<AutomationSettings> {
  const safeOrgId = orgId || "default";
  const current = (await getAutomationSettings(safeOrgId)) as AutomationSettings;
  const merged: AutomationSettings = {
    bookingConfirmation: { ...current.bookingConfirmation, ...(settings.bookingConfirmation ?? {}) },
    nightBeforeReminder: { ...current.nightBeforeReminder, ...(settings.nightBeforeReminder ?? {}) },
    paymentReminder: { ...current.paymentReminder, ...(settings.paymentReminder ?? {}) },
    sitterAssignment: { ...current.sitterAssignment, ...(settings.sitterAssignment ?? {}) },
    postVisitThankYou: { ...current.postVisitThankYou, ...(settings.postVisitThankYou ?? {}) },
    ownerNewBookingAlert: { ...current.ownerNewBookingAlert, ...(settings.ownerNewBookingAlert ?? {}) },
    checkinNotification: { ...current.checkinNotification, ...(settings.checkinNotification ?? {}) },
    checkoutNotification: { ...current.checkoutNotification, ...(settings.checkoutNotification ?? {}) },
    bookingCancellation: { ...current.bookingCancellation, ...(settings.bookingCancellation ?? {}) },
    visitReportNotification: { ...current.visitReportNotification, ...(settings.visitReportNotification ?? {}) },
  };
  await prisma.setting.upsert({
    where: { orgId_key: { orgId: safeOrgId, key: AUTOMATION_SETTINGS_KEY } },
    create: {
      orgId: safeOrgId,
      key: AUTOMATION_SETTINGS_KEY,
      value: JSON.stringify(merged),
      category: "automation",
    },
    update: { value: JSON.stringify(merged) },
  });
  return merged;
}
