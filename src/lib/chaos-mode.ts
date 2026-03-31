/**
 * Chaos Mode Utilities
 * 
 * Staging-only utilities to simulate production failures:
 * - Duplicate messages
 * - Delayed delivery
 * - Random failures
 */

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

interface ChaosModeSettings {
  enabled: boolean;
  duplicateProbability: number; // 0-1
  delayProbability: number; // 0-1
  delayMs: number;
  failureProbability: number; // 0-1
  failureRate: number; // 0-1, percentage of requests that fail
}

const DEFAULT_CHAOS_SETTINGS: ChaosModeSettings = {
  enabled: false,
  duplicateProbability: 0.1,
  delayProbability: 0.2,
  delayMs: 1000,
  failureProbability: 0.05,
  failureRate: 0.1,
};

async function getChaosModeSettings(): Promise<ChaosModeSettings> {
  // HARD BLOCK: Never allow in production, regardless of env var
  if (env.NODE_ENV === 'production') {
    return { ...DEFAULT_CHAOS_SETTINGS, enabled: false };
  }

  // Note: Setting model not available in API schema
  const settings: any[] = [];

  const result: Partial<ChaosModeSettings> = {};
  for (const setting of settings) {
    const key = setting.key.replace('ops.chaosMode.', '') as keyof ChaosModeSettings;
    if (key === 'enabled') {
      result[key] = setting.value === 'true';
    } else if (typeof DEFAULT_CHAOS_SETTINGS[key] === 'number') {
      result[key] = parseFloat(setting.value) || DEFAULT_CHAOS_SETTINGS[key];
    }
  }

  return { ...DEFAULT_CHAOS_SETTINGS, ...result };
}

/**
 * Apply chaos mode effects to a message send operation
 */
export async function applyChaosMode(
  operation: 'send' | 'webhook' | 'routing'
): Promise<{ shouldFail: boolean; delayMs: number; shouldDuplicate: boolean }> {
  const settings = await getChaosModeSettings();
  
  if (!settings.enabled) {
    return { shouldFail: false, delayMs: 0, shouldDuplicate: false };
  }

  const shouldFail = Math.random() < settings.failureProbability;
  const delayMs = Math.random() < settings.delayProbability ? settings.delayMs : 0;
  const shouldDuplicate = Math.random() < settings.duplicateProbability;

  return { shouldFail, delayMs, shouldDuplicate };
}
