/**
 * Tests for Feature Flags
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getFeatureFlag, setFeatureFlag, getFeatureFlags } from "./feature-flags";
import { prisma } from "./db";

// Mock Prisma
vi.mock("./db", () => ({
  prisma: {
    featureFlag: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("Feature Flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFeatureFlag", () => {
    it("should return enabled status when flag exists", async () => {
      vi.mocked(prisma.featureFlag.findUnique).mockResolvedValue({
        id: "1",
        key: "pricingEngineV2.enabled",
        enabled: true,
      });

      const result = await getFeatureFlag("pricingEngineV2.enabled");
      expect(result).toBe(true);
    });

    it("should return false when flag exists and is disabled", async () => {
      vi.mocked(prisma.featureFlag.findUnique).mockResolvedValue({
        id: "1",
        key: "pricingEngineV2.enabled",
        enabled: false,
      });

      const result = await getFeatureFlag("pricingEngineV2.enabled");
      expect(result).toBe(false);
    });

    it("should return default when flag does not exist", async () => {
      vi.mocked(prisma.featureFlag.findUnique).mockResolvedValue(null);

      const result = await getFeatureFlag("pricingEngineV2.enabled");
      expect(result).toBe(false); // Default for pricingEngineV2.enabled
    });

    it("should return false on error", async () => {
      vi.mocked(prisma.featureFlag.findUnique).mockRejectedValue(
        new Error("Database error")
      );

      const result = await getFeatureFlag("pricingEngineV2.enabled");
      expect(result).toBe(false); // Default on error
    });
  });

  describe("setFeatureFlag", () => {
    it("should create new flag when it doesn't exist", async () => {
      vi.mocked(prisma.featureFlag.upsert).mockResolvedValue({
        id: "1",
        key: "pricingEngineV2.enabled",
        enabled: true,
        description: "Test description",
        metadata: null,
      });

      const result = await setFeatureFlag("pricingEngineV2.enabled", true, "Test description");
      expect(result.enabled).toBe(true);
      expect(result.key).toBe("pricingEngineV2.enabled");
      expect(prisma.featureFlag.upsert).toHaveBeenCalledWith({
        where: { key: "pricingEngineV2.enabled" },
        update: {
          enabled: true,
          description: "Test description",
        },
        create: {
          key: "pricingEngineV2.enabled",
          enabled: true,
          description: "Test description",
          metadata: null,
        },
      });
    });

    it("should update existing flag", async () => {
      vi.mocked(prisma.featureFlag.upsert).mockResolvedValue({
        id: "1",
        key: "pricingEngineV2.enabled",
        enabled: false,
        description: "Updated description",
        metadata: JSON.stringify({ test: "data" }),
      });

      const result = await setFeatureFlag(
        "pricingEngineV2.enabled",
        false,
        "Updated description",
        { test: "data" }
      );
      expect(result.enabled).toBe(false);
      expect(prisma.featureFlag.upsert).toHaveBeenCalled();
    });
  });

  describe("getFeatureFlags", () => {
    it("should return flags for requested keys", async () => {
      vi.mocked(prisma.featureFlag.findMany).mockResolvedValue([
        {
          id: "1",
          key: "pricingEngineV2.enabled",
          enabled: true,
        },
        {
          id: "2",
          key: "authWalls.enabled",
          enabled: false,
        },
      ]);

      const result = await getFeatureFlags([
        "pricingEngineV2.enabled",
        "authWalls.enabled",
        "automationBuilderV2.enabled",
      ]);

      expect(result["pricingEngineV2.enabled"]).toBe(true);
      expect(result["authWalls.enabled"]).toBe(false);
      expect(result["automationBuilderV2.enabled"]).toBe(false); // Default
    });

    it("should return defaults on error", async () => {
      vi.mocked(prisma.featureFlag.findMany).mockRejectedValue(
        new Error("Database error")
      );

      const result = await getFeatureFlags(["pricingEngineV2.enabled"]);
      expect(result["pricingEngineV2.enabled"]).toBe(false); // Default
    });
  });
});

