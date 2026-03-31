/**
 * AI Governance: budget enforcement, usage logging, prompt template resolution.
 * Use getScopedDb for all org-scoped operations.
 */

import { getScopedDb } from "@/lib/tenancy";
import { prisma } from "@/lib/db";
import { InvariantError } from "@/lib/invariant";

/** Model pricing per 1K tokens (input, output) - cents. Deterministic, consistent. */
export const MODEL_PRICE_PER_1K: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
};

const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Estimate cost in cents from token counts.
 */
export function estimateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const prices = MODEL_PRICE_PER_1K[model] ?? MODEL_PRICE_PER_1K[DEFAULT_MODEL];
  const inputCost = (inputTokens / 1000) * prices.input;
  const outputCost = (outputTokens / 1000) * prices.output;
  return Math.ceil(inputCost + outputCost);
}

/**
 * Assert AI is allowed for this org and feature. Throws InvariantError 402/403 when blocked.
 */
export async function assertAIAllowed(params: {
  orgId: string;
  featureKey: string;
}): Promise<void> {
  const { orgId, featureKey } = params;
  const db = getScopedDb({ orgId });

  const settings = await db.orgAISettings.findFirst({
    where: {},
  });

  if (!settings) {
    // No settings = default allow (backward compat)
    return;
  }

  if (!settings.enabled) {
    throw new InvariantError(403, "AI is disabled for this organization", {
      orgId,
      featureKey,
      entityType: "ai",
    });
  }

  const allowedModels = settings.allowedModels as string[] | null;
  if (Array.isArray(allowedModels) && allowedModels.length > 0) {
    // If allowedModels is set, we could validate model choice here.
    // For now we only validate at call time when we know the model.
  }

  // 0 = unlimited; skip budget check
  if (settings.monthlyBudgetCents === 0 || !settings.hardStop) {
    return;
  }

  const usageCents = await getBudgetUsageCents(orgId, new Date());
  if (usageCents >= settings.monthlyBudgetCents) {
    throw new InvariantError(402, "AI budget exceeded for this month", {
      orgId,
      featureKey,
      usageCents,
      monthlyBudgetCents: settings.monthlyBudgetCents,
      entityType: "ai",
    });
  }
}

/**
 * Get total AI usage in cents for an org in a given month.
 * Sums costCents where status != 'blocked' (succeeded + failed).
 */
export async function getBudgetUsageCents(
  orgId: string,
  month: Date
): Promise<number> {
  const db = getScopedDb({ orgId });
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);

  const result = await db.aIUsageLog.aggregate({
    where: {
      createdAt: { gte: start, lte: end },
      status: { not: "blocked" },
    },
    _sum: { costCents: true },
  });

  return result._sum.costCents ?? 0;
}

/** @deprecated Use getBudgetUsageCents */
export const getOrgAIBudgetUsage = getBudgetUsageCents;

/**
 * Record AI usage. Fire-and-forget; does not throw.
 */
export async function recordAIUsage(params: {
  orgId: string;
  userId?: string | null;
  featureKey: string;
  model: string;
  promptKey?: string;
  promptVersion?: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
  status: "succeeded" | "failed" | "blocked";
  error?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const db = getScopedDb({ orgId: params.orgId });
    await db.aIUsageLog.create({
      data: {
        orgId: params.orgId,
        userId: params.userId ?? undefined,
        featureKey: params.featureKey,
        model: params.model,
        promptKey: params.promptKey ?? params.featureKey,
        promptVersion: params.promptVersion ?? 0,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        totalTokens: params.totalTokens,
        costCents: params.costCents,
        status: params.status,
        error: params.error ?? undefined,
        metadata: params.metadata ? (params.metadata as object) : undefined,
      },
    });
  } catch (err) {
    console.error("[AI Governance] Failed to record usage:", err);
  }
}

/**
 * Resolve prompt template: org override first, then global (orgId=null).
 */
export async function getPromptTemplate(params: {
  orgId: string;
  key: string;
}): Promise<{ template: string; version: number } | null> {
  const db = getScopedDb({ orgId: params.orgId });

  // Try org-specific first
  const orgTemplate = await db.aIPromptTemplate.findFirst({
    where: { key: params.key, active: true },
    orderBy: { version: "desc" },
  });

  if (orgTemplate) {
    return { template: orgTemplate.template, version: orgTemplate.version };
  }

  // Fall back to global (orgId=null) - use prisma directly
  const globalTemplate = await prisma.aIPromptTemplate.findFirst({
    where: { orgId: null, key: params.key, active: true },
    orderBy: { version: "desc" },
  });

  if (globalTemplate) {
    return { template: globalTemplate.template, version: globalTemplate.version };
  }

  return null;
}

/**
 * List all global (orgId=null) AI prompt templates. Used by ops API for template listing.
 * Must use prisma directly since getScopedDb scopes to org.
 */
export async function getGlobalAIPromptTemplates() {
  return prisma.aIPromptTemplate.findMany({
    where: { orgId: null },
    orderBy: [{ key: "asc" }, { version: "desc" }],
  });
}

/**
 * Get or create default OrgAISettings for an org.
 */
export async function getOrCreateOrgAISettings(orgId: string): Promise<{
  enabled: boolean;
  monthlyBudgetCents: number;
  hardStop: boolean;
  allowedModels: string[] | null;
}> {
  const db = getScopedDb({ orgId });

  let settings = await db.orgAISettings.findFirst({ where: {} });

  if (!settings) {
    settings = await db.orgAISettings.create({
      data: {
        orgId,
        enabled: true,
        monthlyBudgetCents: 0, // 0 = unlimited
        hardStop: false,
      },
    });
  }

  return {
    enabled: settings.enabled,
    monthlyBudgetCents: settings.monthlyBudgetCents,
    hardStop: settings.hardStop,
    allowedModels: settings.allowedModels as string[] | null,
  };
}
