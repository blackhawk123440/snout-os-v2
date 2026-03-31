# AI Governance

This document describes the AI governance layer: settings, cost estimation, prompt templates, and usage logging.

## Settings (OrgAISettings)

| Field | Type | Meaning |
|-------|------|---------|
| `enabled` | boolean | When `false`, all AI endpoints are blocked with 403. |
| `monthlyBudgetCents` | int | Cap in cents per calendar month. **0 = unlimited** (no budget check). |
| `hardStop` | boolean | When `true`, AI calls are blocked (402) once the monthly budget is exceeded. Ignored when `monthlyBudgetCents` is 0. |

Defaults for new orgs: `enabled=true`, `monthlyBudgetCents=0` (unlimited), `hardStop=false`.

## Cost Estimation

Cost is estimated in code using a fixed price table (`MODEL_PRICE_PER_1K` in `src/lib/ai/governance.ts`). **This is an estimate, not actual billing.** It is deterministic and consistent for budget enforcement and auditing. Actual OpenAI charges may differ.

Supported models: `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo`. Unknown models fall back to `gpt-4o-mini` pricing.

## Prompt Templates

- **key** – Feature identifier (e.g. `daily_delight`, `sitter_match`, `sitter_suggestions`, `revenue_forecast`).
- **version** – Integer; higher versions supersede lower ones when active.
- **active** – Only one template per (orgId, key) should be active at a time.
- **orgId** – `null` = global template; non-null = org override.

**Resolution order:** Org override (active, highest version) → global template (active, highest version) → `null` (caller uses inline default).

Templates support `{{placeholder}}` substitution. Placeholders are replaced with values from the caller (e.g. `{{petName}}`, `{{breed}}`).

## Usage Logging (AIUsageLog)

Every AI attempt creates an `AIUsageLog` row:

| Field | Meaning |
|-------|---------|
| `featureKey` | Feature that triggered the call (e.g. `daily_delight`). |
| `promptKey` | Template key used (defaults to featureKey). |
| `promptVersion` | Template version. |
| `model` | Model used. |
| `inputTokens`, `outputTokens`, `totalTokens` | Token counts. |
| `costCents` | Estimated cost. |
| `status` | `succeeded`, `failed`, or `blocked`. |
| `error` | Message when failed/blocked (e.g. `AI_DISABLED`, `BUDGET_EXCEEDED`). |

**Budget aggregation** sums `costCents` where `status != 'blocked'` (succeeded + failed) for the current month.

## Error Codes

- **403** – AI disabled for this organization. Logged as `status=blocked`, `error=AI_DISABLED`.
- **402** – AI budget exceeded for this month (when hardStop is true). Logged as `status=blocked`, `error=BUDGET_EXCEEDED`.

## Owner Controls

At `/ops/ai`, owners and admins can:

- Toggle AI on/off
- Set monthly budget (0 = unlimited)
- Toggle hard stop when budget exceeded
- View current month usage and recent logs
- Create org prompt overrides and activate versions
