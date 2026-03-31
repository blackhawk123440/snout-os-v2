/**
 * AI governance tests:
 * - AI blocked when disabled
 * - AI blocked when budget exceeded and hardStop true
 * - Usage log created on success and failure
 * - Prompt template resolution (org override > global)
 * - Budget usage aggregation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { InvariantError } from "@/lib/invariant";

const mockOrgAISettings = {
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};
const mockAIUsageLog = {
  create: vi.fn(),
  aggregate: vi.fn(),
};
const mockAIPromptTemplate = {
  findFirst: vi.fn(),
  findUnique: vi.fn(),
};

const mockDb = {
  orgAISettings: mockOrgAISettings,
  aIUsageLog: mockAIUsageLog,
  aIPromptTemplate: mockAIPromptTemplate,
};

vi.mock("@/lib/tenancy", () => ({
  getScopedDb: vi.fn(() => mockDb),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    aIPromptTemplate: { findFirst: vi.fn() },
  },
}));

import {
  assertAIAllowed,
  recordAIUsage,
  getBudgetUsageCents,
  getPromptTemplate,
  estimateCostCents,
  getOrCreateOrgAISettings,
} from "@/lib/ai/governance";
import { prisma } from "@/lib/db";

describe("AI governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assertAIAllowed", () => {
    it("allows when no settings exist (backward compat)", async () => {
      mockOrgAISettings.findFirst.mockResolvedValue(null);
      await expect(assertAIAllowed({ orgId: "org-1", featureKey: "daily_delight" })).resolves.toBeUndefined();
    });

    it("blocks with 403 when AI disabled", async () => {
      mockOrgAISettings.findFirst.mockResolvedValue({
        enabled: false,
        monthlyBudgetCents: 10000,
        hardStop: false,
      });
      await expect(assertAIAllowed({ orgId: "org-1", featureKey: "daily_delight" })).rejects.toThrow(InvariantError);
      const err = await assertAIAllowed({ orgId: "org-1", featureKey: "x" }).catch((e) => e);
      expect(err).toBeInstanceOf(InvariantError);
      expect((err as InvariantError).code).toBe(403);
    });

    it("allows when monthlyBudgetCents is 0 (unlimited)", async () => {
      mockOrgAISettings.findFirst.mockResolvedValue({
        enabled: true,
        monthlyBudgetCents: 0,
        hardStop: true,
      });
      mockAIUsageLog.aggregate.mockResolvedValue({ _sum: { costCents: 99999 } });
      await expect(assertAIAllowed({ orgId: "org-1", featureKey: "daily_delight" })).resolves.toBeUndefined();
      expect(mockAIUsageLog.aggregate).not.toHaveBeenCalled();
    });

    it("blocks with 402 when budget exceeded and hardStop true", async () => {
      mockOrgAISettings.findFirst.mockResolvedValue({
        enabled: true,
        monthlyBudgetCents: 100,
        hardStop: true,
      });
      mockAIUsageLog.aggregate.mockResolvedValue({ _sum: { costCents: 150 } });
      await expect(assertAIAllowed({ orgId: "org-1", featureKey: "daily_delight" })).rejects.toThrow(InvariantError);
      const err = await assertAIAllowed({ orgId: "org-1", featureKey: "x" }).catch((e) => e);
      expect(err).toBeInstanceOf(InvariantError);
      expect((err as InvariantError).code).toBe(402);
    });

    it("allows when budget exceeded but hardStop false", async () => {
      mockOrgAISettings.findFirst.mockResolvedValue({
        enabled: true,
        monthlyBudgetCents: 100,
        hardStop: false,
      });
      mockAIUsageLog.aggregate.mockResolvedValue({ _sum: { costCents: 200 } });
      await expect(assertAIAllowed({ orgId: "org-1", featureKey: "daily_delight" })).resolves.toBeUndefined();
    });
  });

  describe("recordAIUsage", () => {
    it("creates usage log on success", async () => {
      mockAIUsageLog.create.mockResolvedValue({});
      await recordAIUsage({
        orgId: "org-1",
        featureKey: "daily_delight",
        model: "gpt-4o-mini",
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        costCents: 1,
        status: "succeeded",
      });
      expect(mockAIUsageLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orgId: "org-1",
            featureKey: "daily_delight",
            model: "gpt-4o-mini",
            status: "succeeded",
            costCents: 1,
          }),
        })
      );
    });

    it("creates usage log on failure", async () => {
      mockAIUsageLog.create.mockResolvedValue({});
      await recordAIUsage({
        orgId: "org-1",
        featureKey: "sitter_match",
        model: "gpt-4o-mini",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costCents: 0,
        status: "failed",
        error: "API error",
      });
      expect(mockAIUsageLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "failed",
            error: "API error",
          }),
        })
      );
    });
  });

  describe("getBudgetUsageCents", () => {
    it("aggregates usage for month (status != blocked)", async () => {
      mockAIUsageLog.aggregate.mockResolvedValue({ _sum: { costCents: 250 } });
      const usage = await getBudgetUsageCents("org-1", new Date("2025-03-15"));
      expect(usage).toBe(250);
      expect(mockAIUsageLog.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: "blocked" },
            createdAt: expect.any(Object),
          }),
          _sum: { costCents: true },
        })
      );
    });

    it("returns 0 when no usage", async () => {
      mockAIUsageLog.aggregate.mockResolvedValue({ _sum: { costCents: null } });
      const usage = await getBudgetUsageCents("org-1", new Date());
      expect(usage).toBe(0);
    });
  });

  describe("getPromptTemplate", () => {
    it("returns org override when present", async () => {
      mockAIPromptTemplate.findFirst.mockResolvedValue({
        template: "Org custom prompt",
        version: 2,
      });
      const result = await getPromptTemplate({ orgId: "org-1", key: "daily_delight" });
      expect(result).toEqual({ template: "Org custom prompt", version: 2 });
      expect(prisma.aIPromptTemplate.findFirst).not.toHaveBeenCalled();
    });

    it("falls back to global when no org override", async () => {
      mockAIPromptTemplate.findFirst.mockResolvedValue(null);
      (prisma.aIPromptTemplate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        template: "Global default",
        version: 1,
      });
      const result = await getPromptTemplate({ orgId: "org-1", key: "daily_delight" });
      expect(result).toEqual({ template: "Global default", version: 1 });
    });

    it("returns null when no template exists", async () => {
      mockAIPromptTemplate.findFirst.mockResolvedValue(null);
      (prisma.aIPromptTemplate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const result = await getPromptTemplate({ orgId: "org-1", key: "nonexistent" });
      expect(result).toBeNull();
    });
  });

  describe("estimateCostCents", () => {
    it("estimates cost for gpt-4o-mini", () => {
      // 1000 input * 0.15/1k + 500 output * 0.6/1k = 0.15 + 0.3 = 0.45 -> ceil = 1
      expect(estimateCostCents("gpt-4o-mini", 1000, 500)).toBe(1);
      // 2000 input + 1000 output = 0.3 + 0.6 = 0.9 -> ceil = 1
      expect(estimateCostCents("gpt-4o-mini", 2000, 1000)).toBe(1);
      // 10000 input + 5000 output = 1.5 + 3 = 4.5 -> ceil = 5
      expect(estimateCostCents("gpt-4o-mini", 10000, 5000)).toBe(5);
    });

    it("uses default model for unknown model", () => {
      const c = estimateCostCents("unknown-model", 1000, 500);
      expect(c).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getOrCreateOrgAISettings", () => {
    it("returns existing settings", async () => {
      mockOrgAISettings.findFirst.mockResolvedValue({
        enabled: false,
        monthlyBudgetCents: 5000,
        hardStop: true,
        allowedModels: ["gpt-4o-mini"],
      });
      const settings = await getOrCreateOrgAISettings("org-1");
      expect(settings).toEqual({
        enabled: false,
        monthlyBudgetCents: 5000,
        hardStop: true,
        allowedModels: ["gpt-4o-mini"],
      });
      expect(mockOrgAISettings.create).not.toHaveBeenCalled();
    });

    it("creates default settings when none exist", async () => {
      mockOrgAISettings.findFirst.mockResolvedValue(null);
      mockOrgAISettings.create.mockResolvedValue({
        enabled: true,
        monthlyBudgetCents: 10000,
        hardStop: false,
        allowedModels: null,
      });
      const settings = await getOrCreateOrgAISettings("org-1");
      expect(settings.enabled).toBe(true);
      expect(settings.monthlyBudgetCents).toBe(10000);
      expect(settings.hardStop).toBe(false);
      expect(mockOrgAISettings.create).toHaveBeenCalled();
    });
  });
});
