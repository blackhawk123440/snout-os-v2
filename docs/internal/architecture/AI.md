# AI Governance

This document describes the AI governance layer: budgets, prompt templates, usage logs, and how AI features are controlled per organization.

## Overview

AI features (daily delight, sitter match, revenue forecast, etc.) are governed by:

- **OrgAISettings** – per-org enable/disable, monthly budget, and hard stop
- **AIPromptTemplate** – versioned prompt templates (org override or global)
- **AIUsageLog** – every AI call is logged with tokens, cost estimate, and status

All AI calls go through `governedAICall()` in `src/lib/ai/governed-call.ts`, which:

1. Asserts AI is allowed (enabled, budget not exceeded when hardStop)
2. Calls OpenAI
3. Logs usage (success or failure)

## Budgets

- **monthlyBudgetCents** – cap in cents per calendar month
- **hardStop** – when `true`, AI calls are blocked (402) once the budget is exceeded
- When `hardStop` is `false`, usage continues to be logged but calls are not blocked

Usage is aggregated from `AIUsageLog` rows with `status = 'succeeded'` for the current month. Cost is estimated deterministically from token counts using a fixed price table (see `MODEL_PRICE_PER_1K` in `governance.ts`).

## Prompt Templates

- **key** – feature identifier (e.g. `daily_delight`, `sitter_match`, `pricing_suggestion`)
- **version** – integer; higher versions supersede lower ones when active
- **active** – only one template per (orgId, key) should be active
- **orgId** – `null` = global template; non-null = org override

Resolution order: org override (active, highest version) → global template (active, highest version) → `null` (caller uses default).

Owners can create org overrides via `/ops/ai` to customize prompts without changing code.

## Usage Logs

Every AI call produces an `AIUsageLog` row with:

- `orgId`, `userId` (optional)
- `featureKey`, `model`, `promptVersion`
- `inputTokens`, `outputTokens`, `totalTokens`
- `costCents` – estimated from the price table
- `status` – `succeeded`, `failed`, or `blocked`
- `error` – message when failed/blocked
- `metadata` – optional JSON (e.g. `bookingId`, `sitterId`)

Logs are visible on `/ops/ai` (last 50 entries) and used for budget aggregation.

## Owner Controls

At `/ops/ai`, owners and admins can:

- Toggle AI on/off
- Set monthly budget (cents)
- Toggle hard stop when budget exceeded
- View current month usage and recent logs
- Create org prompt overrides and activate versions

## Cost Estimation

Cost is estimated in code using `MODEL_PRICE_PER_1K` (cents per 1K tokens). It does not need to match OpenAI’s exact pricing; it must be **consistent** for budget enforcement and auditing.

Supported models: `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo`. Unknown models fall back to `gpt-4o-mini` pricing.

## Error Codes

- **403** – AI disabled for this organization
- **402** – AI budget exceeded for this month (when hardStop is true)
