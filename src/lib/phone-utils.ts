/**
 * Helper functions for phone number management
 */

import { prisma } from "@/lib/db";
import { getAutomationSettings } from "@/lib/automation-utils";

/**
 * Get the appropriate phone number for a sitter based on their phone type preference or automation settings
 */
export async function getSitterPhone(
  sitterId: string,
  orgId?: string,
  automationType?: string // e.g., "sitterPoolOffers", "nightBeforeReminder", etc.
): Promise<string | null> {
  // Stub: Sitter model phone fields not yet available.
  // When implemented, use orgId to scope the sitter lookup and automationType
  // to determine which phone type (personal vs masked) to return.
  return null;
}

/**
 * Get the appropriate phone number for the owner based on phone type preference or automation settings
 */
export async function getOwnerPhone(
  phoneType?: "personal" | "openphone",
  automationType?: string, // e.g., "ownerNewBookingAlert", "sitterPoolOffers", "dailySummary", etc.
  orgId?: string
): Promise<string | null> {
  let preferredType = phoneType;

  if (!preferredType && automationType) {
    try {
      const automationSettings = await getAutomationSettings(orgId ?? "default");
      const automationConfig = automationSettings[automationType];
      if (automationConfig?.ownerPhoneType) {
        preferredType = automationConfig.ownerPhoneType;
      }
    } catch (error) {
      console.error("Error getting automation settings for owner phone:", error);
    }
  }

  // Note: Setting model not available in API schema
  // Use environment variables instead
  const ownerPersonalPhone = process.env.OWNER_PERSONAL_PHONE || null;
  const ownerOpenphonePhone = process.env.OWNER_OPENPHONE_PHONE || null;
  const defaultPhoneType = process.env.OWNER_PHONE_TYPE || "personal";

  if (!preferredType) {
    preferredType = defaultPhoneType as "personal" | "openphone" | undefined;
  }

  if (preferredType === "openphone" && ownerOpenphonePhone) {
    return ownerOpenphonePhone;
  }

  if (preferredType === "personal" && ownerPersonalPhone) {
    return ownerPersonalPhone;
  }

  return ownerPersonalPhone || ownerOpenphonePhone || process.env.OWNER_PHONE || null;
}

/**
 * Get the owner's OpenPhone number ID (not the phone number, but the OpenPhone number ID)
 */
export async function getOwnerOpenPhoneNumberId(): Promise<string | null> {
  // First check environment variable for OpenPhone number ID
  const envNumberId = process.env.OPENPHONE_NUMBER_ID;
  if (envNumberId) {
    return envNumberId;
  }

  // Note: Setting model not available in API schema
  // Use environment variable only
  return null;
}
















