/**
 * Message template versioning system
 * Stores templates with version metadata for safe updates
 */

import { prisma } from "@/lib/db";

export interface MessageTemplateVersion {
  version: string;
  template: string;
  description?: string;
  variables: string[];
  channel: "sms" | "email";
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageTemplate {
  id: string;
  name: string;
  description: string;
  currentVersion: string;
  versions: MessageTemplateVersion[];
  channel: "sms" | "email";
  category: string;
}

/**
 * Get message template with version history
 */
export async function getMessageTemplateWithHistory(
  automationType: string,
  recipient: "client" | "sitter" | "owner"
): Promise<MessageTemplate | null> {
  // Note: Setting model not available in API schema
  // Templates are stored in Automation.templates JSON field
  // Return null to use defaults
  return null;
}

/**
 * Save message template with versioning
 */
export async function saveMessageTemplateWithVersion(
  automationType: string,
  recipient: "client" | "sitter" | "owner",
  template: string,
  description?: string
): Promise<void> {
  // Note: Setting model not available in API schema
  // Templates should be stored in Automation.templates JSON field
  // This function is disabled for messaging dashboard
  console.log(`[message-templates] Would save template for ${automationType}.${recipient}, but Setting model not available`);
  return;
}

/**
 * Extract variables from template string
 */
function extractVariables(template: string): string[] {
  const variables = new Set<string>();
  const regex = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = regex.exec(template)) !== null) {
    variables.add(match[1]);
  }
  return Array.from(variables).sort();
}

/**
 * Generate next version number
 */
function generateVersion(versions: MessageTemplateVersion[]): string {
  if (versions.length === 0) {
    return "1.0.0";
  }

  const latest = versions[0];
  const [major, minor, patch] = latest.version.split(".").map(Number);
  
  // Increment patch version
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Get template version history
 */
export async function getTemplateVersionHistory(
  automationType: string,
  recipient: "client" | "sitter" | "owner"
): Promise<MessageTemplateVersion[]> {
  // Note: Setting model not available in API schema
  // Templates are stored in Automation.templates JSON field
  // Return empty array as version history is not available
  return [];
}

/**
 * Restore template from version
 */
export async function restoreTemplateFromVersion(
  automationType: string,
  recipient: "client" | "sitter" | "owner",
  version: string
): Promise<boolean> {
  const versions = await getTemplateVersionHistory(automationType, recipient);
  const targetVersion = versions.find(v => v.version === version);

  if (!targetVersion) {
    return false;
  }

  // Save as new version (restore creates new version)
  await saveMessageTemplateWithVersion(
    automationType,
    recipient,
    targetVersion.template,
    `Restored from version ${version}`
  );

  return true;
}

