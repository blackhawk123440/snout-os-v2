/**
 * Governed AI call tests:
 * - AI blocked when disabled -> records AIUsageLog status=blocked
 * - Budget exceeded with hardStop -> records blocked
 * - Successful call writes AIUsageLog succeeded with costCents > 0 (mock OpenAI)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { InvariantError } from "@/lib/invariant";

const mockRecordAIUsage = vi.fn().mockResolvedValue(undefined);
const mockAssertAIAllowed = vi.fn().mockResolvedValue(undefined);
const mockGetOrCreateOrgAISettings = vi.fn().mockResolvedValue({
  enabled: true,
  monthlyBudgetCents: 10000,
  hardStop: false,
  allowedModels: null,
});

vi.mock("@/lib/ai/governance", () => ({
  assertAIAllowed: (...args: unknown[]) => mockAssertAIAllowed(...args),
  recordAIUsage: (...args: unknown[]) => mockRecordAIUsage(...args),
  estimateCostCents: vi.fn((_m: string, i: number, o: number) => Math.ceil((i + o) / 1000)),
  getOrCreateOrgAISettings: (...args: unknown[]) => mockGetOrCreateOrgAISettings(...args),
}));

const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

describe("governedAICall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "sk-test";
    mockAssertAIAllowed.mockResolvedValue(undefined);
    mockGetOrCreateOrgAISettings.mockResolvedValue({
      enabled: true,
      monthlyBudgetCents: 10000,
      hardStop: false,
      allowedModels: null,
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Hello" } }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    });
  });

  it("records blocked when AI disabled (403)", async () => {
    mockAssertAIAllowed.mockRejectedValue(
      new InvariantError(403, "AI is disabled for this organization", {})
    );

    const { governedAICall } = await import("../governed-call");

    await expect(
      governedAICall({
        orgId: "org-1",
        featureKey: "daily_delight",
        messages: [{ role: "user", content: "test" }],
      })
    ).rejects.toThrow(InvariantError);

    expect(mockRecordAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        featureKey: "daily_delight",
        status: "blocked",
        error: "AI_DISABLED",
      })
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("records blocked when budget exceeded (402)", async () => {
    mockAssertAIAllowed.mockRejectedValue(
      new InvariantError(402, "AI budget exceeded", {})
    );

    const { governedAICall } = await import("../governed-call");

    await expect(
      governedAICall({
        orgId: "org-1",
        featureKey: "daily_delight",
        messages: [{ role: "user", content: "test" }],
      })
    ).rejects.toThrow(InvariantError);

    expect(mockRecordAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "blocked",
        error: "BUDGET_EXCEEDED",
      })
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("records succeeded with costCents > 0 on successful call", async () => {
    const { governedAICall } = await import("../governed-call");

    const result = await governedAICall({
      orgId: "org-1",
      featureKey: "daily_delight",
      messages: [{ role: "user", content: "test" }],
    });

    expect(result.content).toBe("Hello");
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
    expect(result.costCents).toBeGreaterThan(0);

    expect(mockRecordAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        featureKey: "daily_delight",
        status: "succeeded",
        inputTokens: 100,
        outputTokens: 50,
        costCents: expect.any(Number),
      })
    );
  });

  it("records failed when OpenAI throws", async () => {
    mockCreate.mockRejectedValue(new Error("API rate limit"));

    const { governedAICall } = await import("../governed-call");

    await expect(
      governedAICall({
        orgId: "org-1",
        featureKey: "daily_delight",
        messages: [{ role: "user", content: "test" }],
      })
    ).rejects.toThrow("API rate limit");

    expect(mockRecordAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error: "API rate limit",
        costCents: 0,
      })
    );
  });
});
