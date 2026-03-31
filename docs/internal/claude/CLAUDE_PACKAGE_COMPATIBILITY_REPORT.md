# CLAUDE PACKAGE COMPATIBILITY REPORT

Branch: `chore/claude-package-compat-review`  
Package reviewed from: `/Users/leahhudson/Downloads/files.zip` (nested `snout-os-v2-real-gaps.tar.gz`)

## Classification Table

| Claude file | Classification | Production risk |
|---|---|---|
| `ui/AppDrawer.tsx` | ADAPT BEFORE MERGE | Medium |
| `ui/AppChartCard.tsx` | ADAPT BEFORE MERGE | Medium |
| `ui/AppTable.tsx` | ADAPT BEFORE MERGE | Medium |
| `ui/AppFilterBar.tsx` | MERGE NOW | Low |
| `ui/ThemeToggle.tsx` | MERGE NOW | Low |
| `availability/recurring-engine.ts` | DO NOT MERGE YET | High |
| `calendar/bidirectional-sync.ts` | ADAPT BEFORE MERGE | High |
| `stripe-connect/stripe-connect-payouts.ts` | ADAPT BEFORE MERGE | High |
| `workers/automation-worker-v2.ts` | DO NOT MERGE YET | Critical |

## Collision / Compatibility Details

### 1) `ui/AppDrawer.tsx` — ADAPT BEFORE MERGE
- **Conflicts with:** `src/components/app/AppDrawer.tsx`
- **Collision points**
  - Existing drawer already has focus trap + keyboard handling + side support (`left|right`) and should not be replaced.
  - Claude version adds subtitle/footer and width presets, but drops current accessibility behavior details.
- **Safe integration path**
  - Keep current implementation and port only additive props.
  - Implemented additive enhancements: optional `subtitle` and optional `footer`.
- **Required tests**
  - Existing drawer test coverage is indirect; consider adding direct interaction tests later (escape, focus return, footer render).
- **Risk**
  - Low after additive-only merge.

### 2) `ui/AppChartCard.tsx` — ADAPT BEFORE MERGE
- **Conflicts with:** `src/components/app/AppChartCard.tsx`
- **Collision points**
  - Prop contract mismatch (`loading/empty` vs `isLoading/isEmpty`, fixed timeframe options vs dynamic options, no `headerRight`).
- **Safe integration path**
  - Keep current card shell and add backward-compatible optional props only.
  - Implemented additive enhancements:
    - `timeframes?: {value,label}[]`
    - `headerRight?: ReactNode`
    - aliases: `isLoading`, `isEmpty`
- **Required tests**
  - Typecheck contract checks are sufficient for now; add focused rendering tests for custom timeframe options later.
- **Risk**
  - Low-medium (UI-only behavior).

### 3) `ui/AppTable.tsx` — ADAPT BEFORE MERGE
- **Conflicts with:** `src/components/app/AppTable.tsx`
- **Collision points**
  - Different table model assumptions (`id` generic constraint vs `keyExtractor` API).
  - Different bulk action shape and column picker behavior.
- **Safe integration path**
  - Keep existing API contract.
  - Port one safe UX improvement only: prevent hiding all columns in column picker.
- **Required tests**
  - Existing typecheck catches API breakage.
  - Add table interaction test for “at least one column visible” when feasible.
- **Risk**
  - Low after minimal change.

### 4) `ui/AppFilterBar.tsx` — MERGE NOW
- **Conflicts with:** `src/components/app/AppFilterBar.tsx`
- **Collision points**
  - Claude adds saved-view chips and conditional clear behavior.
- **Safe integration path**
  - Additive-only props added:
    - `savedViews`, `activeView`, `onViewChange`
  - Keep existing filter controls and current usages intact.
  - Clear button now appears only when active filters exist.
- **Required tests**
  - Typecheck verified compatibility.
  - Add small rendering test for saved views later.
- **Risk**
  - Low.

### 5) `ui/ThemeToggle.tsx` — MERGE NOW
- **Conflicts with:** no direct file conflict (new file)
- **Collision points**
  - Existing topbar already had inline dark/light button.
- **Safe integration path**
  - Added reusable `src/components/app/ThemeToggle.tsx`.
  - Updated `src/components/app/AppTopbar.tsx` to use the new component.
- **Required tests**
  - Typecheck covered API.
- **Risk**
  - Low.

### 6) `availability/recurring-engine.ts` — DO NOT MERGE YET
- **Conflicts with existing subsystem**
  - `src/lib/availability/engine.ts`
  - `src/lib/availability/booking-conflict.ts`
- **Exact incompatibilities**
  - Assumes schema fields that do not exist:
    - `SitterAvailabilityRule.dayOfWeek`, `effectiveFrom`, `effectiveUntil`
    - override `type` semantics differ from current `isAvailable`
    - `SitterTimeOff.startDate/endDate/status` vs current `startsAt/endsAt` model
  - Uses direct `prisma` and includes hardcoded `orgId: 'default'` in audit path.
  - Bypasses current conflict/audit flow already wired and tested.
- **Safe integration path**
  - Do not import this file.
  - Current repo already has a recurring engine in `src/lib/availability/engine.ts` with booking/time-off/override and timezone handling.
  - If enhancements are desired, port individual pure helpers behind tests only.
- **Required tests**
  - Already present for engine and conflict behavior; expand with additional timezone edge cases if needed.
- **Risk**
  - High if replaced directly (booking correctness regression risk).

### 7) `calendar/bidirectional-sync.ts` — ADAPT BEFORE MERGE
- **Conflicts with existing subsystem**
  - `src/lib/calendar/sync.ts` (canonical one-way sync)
  - `src/lib/calendar-queue.ts` (queue + observability + correlation IDs)
- **Exact incompatibilities**
  - New queue/worker path bypasses existing queue instrumentation and retry/repair conventions.
  - Uses event log fields/patterns not aligned with current `logEvent` conventions.
  - Introduces direct booking mutation path without explicit route-level/queue-level feature gating.
- **Safe integration path**
  - Add as inbound adapter only (do not replace existing sync).
  - Gate behind env flag: `ENABLE_GOOGLE_BIDIRECTIONAL_SYNC`.
  - Reuse existing queue + `attachQueueWorkerInstrumentation` + correlation IDs + ops failure channels.
  - Start read/compare mode first; only then allow writes.
- **Required tests before enable**
  - external event moved
  - external event deleted/missing
  - duplicate ingestion prevention
  - conflict marking behavior (no silent overwrite)
- **Risk**
  - High without adapter hardening + flag gate.

### 8) `stripe-connect/stripe-connect-payouts.ts` — ADAPT BEFORE MERGE
- **Conflicts with existing subsystem**
  - `src/lib/stripe-connect.ts`
  - `src/lib/payout/payout-engine.ts`
  - `prisma/schema.prisma` Stripe Connect models
- **Exact incompatibilities**
  - Field-name and status mismatches with schema:
    - expects `stripeAccountId` and `status` on `SitterStripeAccount`; schema uses `accountId`, `onboardingStatus`, `payoutsEnabled`, `chargesEnabled`
    - expects `amountCents` and status values not matching `PayoutTransfer.amount` + existing status values
    - expects `SitterEarning` fields like `amountCents/type/stripeTransferId` that are not modeled
  - Writes ledger and payout states with assumptions that do not match current payout lifecycle.
- **Safe integration path**
  - Keep current payout engine as source of truth.
  - Add optional adapter layer only, behind env flag `ENABLE_STRIPE_CONNECT_PAYOUTS`.
  - Align state mapping to existing schema first.
- **Required tests before enable**
  - missing connected account
  - payout validation / amount sanity
  - reconciliation mapping to ledger
  - org/sitter authorization boundaries
- **Risk**
  - High if merged as-is.

### 9) `workers/automation-worker-v2.ts` — DO NOT MERGE YET
- **Conflicts with existing subsystem**
  - `src/lib/automation-queue.ts`
  - `src/worker/automation-worker.ts`
  - `src/worker/index.ts`
- **Exact incompatibilities**
  - Introduces parallel worker model and queue naming that can duplicate/compete with current production jobs.
  - Changes trigger model and execution path without migration of current job producers.
  - Does not align with current observability + correlation integration patterns already hardened.
- **Safe integration path**
  - Do not swap entrypoint.
  - Cherry-pick improvements into current architecture incrementally:
    - idempotency key conventions
    - delayed action scheduling helpers
    - condition/action modularization
  - Keep current worker running until a staged migration plan + shadow mode proves parity.
- **Required tests before any rollout**
  - dedupe/idempotency across retries
  - org scoping on every job
  - reminder timing parity
  - retry + dead-letter behavior parity
- **Risk**
  - Critical if directly replaced.

## Missing Schema / Env / Route Assumptions Found

### Missing or mismatched schema assumptions in Claude package
- `SitterAvailabilityRule.dayOfWeek/effectiveFrom/effectiveUntil` (not current schema)
- `SitterTimeOff.startDate/endDate/status` (current schema uses `startsAt/endsAt`)
- `SitterStripeAccount.stripeAccountId/status` (current schema uses `accountId`, booleans + onboarding status)
- `PayoutTransfer.amountCents` + status vocabulary mismatch
- `SitterEarning` field set mismatch

### Env / config assumptions
- `REDIS_URL` required for inbound calendar queue/worker paths.
- New feature-gated rollout should use:
  - `ENABLE_GOOGLE_BIDIRECTIONAL_SYNC`
  - `ENABLE_STRIPE_CONNECT_PAYOUTS`

### Worker / route duplication risks
- Calendar inbound worker duplicates queue orchestration if added as-is.
- Automation v2 worker duplicates/competes with existing automation queue processing.
- Stripe v2 payout service duplicates payout lifecycle already in `payout-engine`.

## Safe Patch Applied (This Branch)

### Files changed
- `src/components/app/ThemeToggle.tsx` (new)
- `src/components/app/AppTopbar.tsx`
- `src/components/app/AppFilterBar.tsx`
- `src/components/app/AppChartCard.tsx`
- `src/components/app/AppTable.tsx`
- `src/components/app/AppDrawer.tsx`
- `src/lib/flags.ts`
- `CLAUDE_PACKAGE_COMPATIBILITY_REPORT.md` (new)

### What was intentionally NOT merged
- No merge of `workers/automation-worker-v2.ts`
- No direct merge of Claude calendar inbound sync implementation
- No direct merge of Claude Stripe Connect payout implementation
- No replacement of existing availability engine

## Migrations Required (If pursuing full Claude parity)

No migration was applied in this safe patch.

To adopt Claude Stripe/availability internals fully, a dedicated migration plan would be required to reconcile naming and lifecycle mismatches. Recommended approach:
- keep current schema and adapt Claude logic to current models instead of reshaping production models abruptly;
- if new fields are required, add additive nullable fields + backfill scripts + rollout checkpoints.

## Feature Flags Introduced

- `ENABLE_GOOGLE_BIDIRECTIONAL_SYNC` (env flag constant added; default off)
- `ENABLE_STRIPE_CONNECT_PAYOUTS` (env flag constant added; default off)

## Validation Summary

- `npm run typecheck` ✅ passed
- `npm run test` ✅ passed (`115` files, `563` tests)
- `npx prisma generate` not required (no schema change in this patch)

## Final Recommendation

- **Safe to merge now**
  - `ui/ThemeToggle.tsx` (as additive component)
  - `ui/AppFilterBar.tsx` additive saved-view support
  - additive UI refinements in existing app primitives (`AppDrawer`, `AppChartCard`, `AppTable`)

- **Safe to merge behind flags**
  - calendar inbound adapter work only after refactor into existing queue/observability framework
  - Stripe Connect payout adapter only after schema-aligned service mapping and authorization tests

- **Not safe yet**
  - direct merge of `availability/recurring-engine.ts` (as-is)
  - direct merge of `workers/automation-worker-v2.ts`
