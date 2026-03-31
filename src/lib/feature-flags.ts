/**
 * Feature Flag System — UNUSED SCAFFOLDING
 *
 * This DB-backed flag system (FeatureFlag Prisma model + these functions)
 * has ZERO callers in the codebase. The functions are exported but nothing
 * imports getFeatureFlag, setFeatureFlag, or getAllFeatureFlags.
 *
 * Actual flag enforcement uses:
 * - src/lib/flags.ts (env-based constants for feature gating)
 * - src/lib/env.ts (auth/permission flags enforced in middleware)
 *
 * If you need DB-backed flags in the future, this system is ready to use.
 * Just import and call getFeatureFlag('key') from your API route or lib.
 */

import { prisma } from "@/lib/db";

export interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description?: string;
  metadata?: Record<string, any>;
}

const DEFAULT_FLAGS: Array<{ key: string; enabled: boolean; description: string }> = [
  {
    key: "pricingEngineV2.enabled",
    enabled: false,
    description: "Enable new pricing engine version 2",
  },
  {
    key: "automationBuilderV2.enabled",
    enabled: false,
    description: "Enable new automation builder version 2",
  },
  {
    key: "authWalls.enabled",
    enabled: false,
    description: "Enable authentication and authorization walls",
  },
  {
    key: "messageConfirmOnPayment.enabled",
    enabled: false,
    description: "Send confirmation message when payment is received",
  },
];

/**
 * Get a feature flag value
 */
export async function getFeatureFlag(key: string): Promise<boolean> {
  try {
    const flag = await (prisma as any).featureFlag.findUnique({
      where: { key },
    });

    if (flag && typeof flag === 'object' && 'enabled' in flag) {
      return (flag as any).enabled;
    }

    // Return default if flag doesn't exist
    const defaultFlag = DEFAULT_FLAGS.find((f) => f.key === key);
    return defaultFlag?.enabled ?? false;
  } catch (error) {
    console.error(`Error getting feature flag ${key}:`, error);
    // Return default on error
    const defaultFlag = DEFAULT_FLAGS.find((f) => f.key === key);
    return defaultFlag?.enabled ?? false;
  }
}

/**
 * Get all feature flags
 */
export async function getAllFeatureFlags(): Promise<FeatureFlag[]> {
  try {
    const flags = await (prisma as any).featureFlag.findMany({
      orderBy: { key: "asc" },
    });

    // Merge with defaults to ensure all flags exist
    const flagMap = new Map(flags.map((f: any) => [f.key, f]));
    const result: FeatureFlag[] = [];

    for (const defaultFlag of DEFAULT_FLAGS) {
      const existing = flagMap.get(defaultFlag.key) as any;
      if (existing) {
        result.push({
          id: existing.id,
          key: existing.key,
          enabled: existing.enabled,
          description: existing.description || defaultFlag.description,
          metadata: existing.metadata ? JSON.parse(existing.metadata) : undefined,
        });
      } else {
        // Create missing flag with default value
        const created = await (prisma as any).featureFlag.create({
          data: {
            key: defaultFlag.key,
            enabled: defaultFlag.enabled,
            description: defaultFlag.description,
          },
        });
        result.push({
          id: created.id,
          key: created.key,
          enabled: created.enabled,
          description: created.description || undefined,
        });
      }
    }

    return result;
  } catch (error) {
    console.error("Error getting all feature flags:", error);
    // Return defaults on error
    return DEFAULT_FLAGS.map((f) => ({
      id: "",
      key: f.key,
      enabled: f.enabled,
      description: f.description,
    }));
  }
}

/**
 * Set a feature flag value
 */
export async function setFeatureFlag(
  key: string,
  enabled: boolean,
  description?: string,
  metadata?: Record<string, any>
): Promise<FeatureFlag> {
  try {
    const flag = await (prisma as any).featureFlag.upsert({
      where: { key },
      update: {
        enabled,
        ...(description !== undefined && { description }),
        ...(metadata !== undefined && { metadata: JSON.stringify(metadata) }),
      },
      create: {
        key,
        enabled,
        description,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    return {
      id: flag.id,
      key: flag.key,
      enabled: flag.enabled,
      description: flag.description || undefined,
      metadata: flag.metadata ? JSON.parse(flag.metadata) : undefined,
    };
  } catch (error) {
    console.error(`Error setting feature flag ${key}:`, error);
    throw error;
  }
}

/**
 * Batch get feature flags
 */
export async function getFeatureFlags(keys: string[]): Promise<Record<string, boolean>> {
  try {
    const flags = await (prisma as any).featureFlag.findMany({
      where: {
        key: { in: keys },
      },
    });

    const flagMap = new Map(flags.map((f: any) => [f.key, f.enabled]));
    const result: Record<string, boolean> = {};

    for (const key of keys) {
      result[key] = (flagMap.get(key) as boolean | undefined) ?? (DEFAULT_FLAGS.find((f) => f.key === key)?.enabled ?? false);
    }

    return result;
  } catch (error) {
    console.error("Error batch getting feature flags:", error);
    // Return defaults on error
    const result: Record<string, boolean> = {};
    for (const key of keys) {
      result[key] = DEFAULT_FLAGS.find((f) => f.key === key)?.enabled ?? false;
    }
    return result;
  }
}

