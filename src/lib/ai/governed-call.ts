/**
 * Governed AI call: assert allowed, call OpenAI, log usage.
 */

import OpenAI from "openai";
import {
  assertAIAllowed,
  recordAIUsage,
  estimateCostCents,
  getOrCreateOrgAISettings,
} from "./governance";
import { InvariantError } from "@/lib/invariant";

const DEFAULT_MODEL = "gpt-4o-mini";

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  return new OpenAI({ apiKey: key });
}

export interface GovernedAICallParams {
  orgId: string;
  userId?: string | null;
  featureKey: string;
  promptKey?: string; // defaults to featureKey
  promptVersion?: number; // from template resolution
  model?: string;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  responseFormat?: { type: "json_object" } | { type: "text" };
}

export interface GovernedAICallResult {
  content: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
}

async function recordBlocked(params: {
  orgId: string;
  userId?: string | null;
  featureKey: string;
  promptKey?: string;
  promptVersion?: number;
  model: string;
  error: "AI_DISABLED" | "BUDGET_EXCEEDED";
}): Promise<void> {
  await recordAIUsage({
    orgId: params.orgId,
    userId: params.userId,
    featureKey: params.featureKey,
    model: params.model,
    promptKey: params.promptKey ?? params.featureKey,
    promptVersion: params.promptVersion ?? 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costCents: 0,
    status: "blocked",
    error: params.error,
    metadata: {},
  });
}

/**
 * Make an AI call with governance: check enabled + budget, then call, then log.
 * Throws InvariantError 402/403 when blocked. Records blocked usage before throwing.
 */
export async function governedAICall(
  params: GovernedAICallParams
): Promise<GovernedAICallResult> {
  const { orgId, userId, featureKey, promptKey, promptVersion, messages, responseFormat } = params;
  const model = params.model ?? DEFAULT_MODEL;

  try {
    await assertAIAllowed({ orgId, featureKey });
  } catch (err) {
    if (err instanceof InvariantError) {
      await recordBlocked({
        orgId,
        userId,
        featureKey,
        promptKey,
        promptVersion,
        model,
        error: err.code === 403 ? "AI_DISABLED" : "BUDGET_EXCEEDED",
      });
    }
    throw err;
  }

  const openai = getOpenAI();
  if (!openai) {
    throw new Error("OpenAI not configured");
  }

  const settings = await getOrCreateOrgAISettings(orgId);
  const allowedModels = settings.allowedModels;
  if (Array.isArray(allowedModels) && allowedModels.length > 0 && !allowedModels.includes(model)) {
    throw new Error(`Model ${model} is not allowed for this organization`);
  }

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages,
      response_format: responseFormat,
    });

    const choice = completion.choices[0];
    const content = choice?.message?.content ?? null;
    const inputTokens = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;
    const totalTokens = completion.usage?.total_tokens ?? inputTokens + outputTokens;
    const costCents = estimateCostCents(model, inputTokens, outputTokens);

    await recordAIUsage({
      orgId,
      userId,
      featureKey,
      model,
      promptKey: promptKey ?? featureKey,
      promptVersion: promptVersion ?? 0,
      inputTokens,
      outputTokens,
      totalTokens,
      costCents,
      status: "succeeded",
      metadata: {},
    });

    return {
      content,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      costCents,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordAIUsage({
      orgId,
      userId,
      featureKey,
      model,
      promptKey: promptKey ?? featureKey,
      promptVersion: promptVersion ?? 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costCents: 0,
      status: "failed",
      error: msg,
      metadata: {},
    });
    throw err;
  }
}
