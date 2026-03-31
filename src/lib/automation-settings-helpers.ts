/**
 * Automation Settings Helpers
 * 
 * Master Spec Reference: Line 255
 * "Fix automation settings persistence as a hard requirement, save, reread, checksum, return canonical value"
 * 
 * Helper functions for robust automation settings persistence with validation.
 */

import crypto from "crypto";

/**
 * Calculate a checksum for automation settings
 * Used to detect if settings were actually persisted correctly
 */
export function calculateAutomationSettingsChecksum(settings: any): string {
  const normalized = JSON.stringify(settings, Object.keys(settings).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex").substring(0, 16);
}

/**
 * Validate that saved settings match what we tried to save
 * Returns true if checksums match, false otherwise
 */
export function validateAutomationSettings(saved: any, expected: any): boolean {
  const savedChecksum = calculateAutomationSettingsChecksum(saved);
  const expectedChecksum = calculateAutomationSettingsChecksum(expected);
  return savedChecksum === expectedChecksum;
}

/**
 * Normalize automation settings for consistent comparison
 * Sorts keys, removes undefined values, etc.
 */
export function normalizeAutomationSettings(settings: any): any {
  if (!settings || typeof settings !== "object") {
    return {};
  }

  // Deep clone and sort keys
  const normalized: any = {};
  const keys = Object.keys(settings).sort();
  
  for (const key of keys) {
    const value = settings[key];
    if (value !== undefined && value !== null) {
      if (typeof value === "object" && !Array.isArray(value)) {
        normalized[key] = normalizeAutomationSettings(value);
      } else {
        normalized[key] = value;
      }
    }
  }

  return normalized;
}

