# 04-TYPE-AUDIT.md
# Agent 04 (Type Safety Auditor) -- Complete Type Safety Audit Report
# Generated: 2026-03-29

---

## Executive Summary

The Snout OS codebase has **systemic type safety gaps** across all seven audit categories. The most critical finding is that the Prisma client is cast to `any` in **426 call sites across 77 files** (`(prisma as any).model.method()`), which means the ORM's type-checking is entirely defeated for a massive portion of the data access layer. Combined with ~120+ API routes that accept request bodies without Zod validation, the codebase is effectively running untyped at the most security-sensitive boundaries.

**Totals:**
- Explicit `any` usage (non-test): **~300+ instances across ~80+ production files**
- `as any` casts (non-test): **~350+ instances across ~70+ production files**
- `@ts-ignore` / `@ts-expect-error`: **0 instances** (good)
- Non-null assertions without guards: **5 instances**
- Untyped `JSON.parse` calls: **~50+ production instances**
- API routes without Zod validation: **~90+ of ~120+ POST/PATCH/PUT routes**
- Prisma `as any` casts: **426 occurrences across 77 files** (+ 181 via `(db as any)`)

---

## 1. Explicit `any` Usage

### P0 -- Critical (auth/middleware/security paths)

01. [P0] [src/lib/auth.ts:225] `async session({ session, token }: any)` -- NextAuth session callback params fully untyped. Session enrichment with orgId/role/sitterId/clientId done via `(session.user as any)`. This is the authentication core -- if the token shape changes, no compile error, just silent auth bypass.

02. [P0] [src/lib/auth.ts:248] `async jwt({ token, user }: any)` -- NextAuth JWT callback fully untyped. Token properties set via `(user as any).orgId`, `(user as any).role`, etc. Same risk as above.

03. [P0] [src/middleware.ts:56-57,88-89] `(session.user as any).clientId`, `(session.user as any).role` -- Middleware role-checking uses `as any` casts. If session shape changes, route protection silently fails.

04. [P0] [src/app/page.tsx:52-53] `(user as any).sitterId`, `(user as any).role` -- Root page role redirect logic uses `as any`. Could redirect users to wrong portal.

05. [P0] [src/app/setup/layout.tsx:20] `const user = session.user as any` -- Setup layout auth check fully untyped.

### P1 -- High (business logic engines)

06. [P1] [src/lib/event-emitter.ts:111,126,170-171,194,208,223,237-239,254-256,271-272,285,299] **Every exported event emitter function uses `booking: any`** -- 14 functions total. The entire event bus is untyped. Any booking property rename silently breaks all downstream listeners.

07. [P1] [src/lib/automation-executor.ts:31,78,160,288,402,601,775,924,1070,1103,1136,1178] **12 `booking: any` parameters** in the automation executor, plus `AutomationContext` uses `[key: string]: any`. The entire automation execution pipeline is untyped.

08. [P1] [src/lib/automation-engine.ts:80,87,106,130,136,142,148,154,160,166,220-221,236] **13 `any` usages** -- `getNestedValue(obj: any)`, `parseValue(): any`, every `execute*` function takes `config: any`, condition groups and actions typed as `any[]`.

09. [P1] [src/lib/event-queue-bridge.ts:20,36,40,55,59,75,87] **7 `any` parameters** -- `enqueueCalendarForBooking(booking: any)` and every event listener callback uses `context: any`.

10. [P1] [src/lib/pricing-engine.ts:24,40,80,107,186] **5 `any` usages** -- `PricingContext` has `[key: string]: any`, `evaluateCondition(condition: any)`, `evaluateConditions(conditions: any[])`, `getNestedValue(obj: any): any`, `applyCalculation(calculation: any)`.

11. [P1] [src/lib/notifications/triggers.ts:26-1152] **18 `(prisma as any)` casts** -- The entire notification trigger system bypasses Prisma types. Any schema drift = silent runtime failure in notification delivery.

12. [P1] [src/lib/tiers/srs-engine.ts:47-551] **30+ `(prisma as any)` and `: any` casts** -- SRS scoring engine has pervasive `any` usage. Score calculations use `(s: any) => s.rolling30dScore`, offer filtering uses `(o: any) => o.acceptedAt`. Incorrect data shape = wrong sitter tier assignments.

13. [P1] [src/lib/tiers/tier-engine-twilio.ts:82-383] **10+ `(prisma as any)` casts, 10+ `: any` callbacks** -- Same pattern in the Twilio tier engine.

14. [P1] [src/lib/tiers/srs-queue.ts:62-367] **18 `(prisma as any)` casts** -- SRS queue processing fully untyped.

15. [P1] [src/lib/tiers/tier-rules.ts:67-279] **9 `(prisma as any)` casts** -- Tier promotion/demotion rules untyped.

16. [P1] [src/lib/bookings/booking-confirmed-handler.ts:116-345] **16 `(prisma as any)` casts** -- Booking confirmation handler bypasses all Prisma types.

17. [P1] [src/lib/dispatch-control.ts:71-248] **6 `(prisma as any)` casts** -- Dispatch logic (assigning sitters to bookings) untyped.

18. [P1] [src/lib/recurring/generate.ts:16-205] **8 `(prisma as any)` casts** -- Recurring schedule generation fully untyped.

19. [P1] [src/lib/sitter-helpers.ts:99] `limitClientDataForSitter(booking: any): any` -- Function meant to restrict data exposure accepts and returns `any`.

### P2 -- Medium (UI components, data display)

20. [P2] [src/app/money/tabs/FinanceTab.tsx:179,227,375,389] `(inv: any)`, `(p: any)`, `(opp: any)`, `(s: any)` -- Finance tab renders fully untyped data.

21. [P2] [src/app/money/tabs/PaymentsTab.tsx:140,156,178] `(p: any)`, `(val: any)` -- Payments tab maps untyped payment objects.

22. [P2] [src/components/messaging/SittersPanel.tsx:48-207] **10 `any` casts** -- Sitter assignment windows typed as `any` throughout.

23. [P2] [src/components/messaging/ConversationView.tsx:119] `(msg: any)` -- Message transformation untyped.

24. [P2] [src/app/client/recurring/page.tsx:40-417] **10+ `any` usages** -- Recurring schedule page state, callbacks, and rendering all use `any`.

25. [P2] [src/app/dashboard/page.tsx:1134-1468] `(r: any)`, `(a: any)`, `(d: any)`, `(s: any)` -- Dashboard renders alerts, forecasts, and setup steps with `any`.

26. [P2] [src/components/sitter/SitterGrowthTab.tsx:45-54] `breakdown: any`, `current: any`, `rolling26w: any`, `compensation: any` -- SRS growth data typed as `any`.

27. [P2] [src/lib/api/owner-hooks.ts:46-109] **4 `any[]` response types** -- `ownerFetch<{ items: any[]; total: number }>` for bookings, clients, sitters.

28. [P2] [src/lib/api/client-hooks.ts:567,633] `methods: any[]`, `schedules: any[]` -- Client payment methods and recurring schedules untyped.

29. [P2] [src/lib/api/sitter-portal-hooks.ts:111,161,164] `reports: any[]`, `(t: any)`, `(b: any)` -- Sitter portal hooks use untyped responses.

### P3 -- Low (error catches, utility functions)

30. [P3] [Multiple files] ~50+ instances of `catch (error: any)` -- While TypeScript defaults `catch` to `unknown`, these explicitly opt into `any`. Prefer `catch (error: unknown)` with type narrowing.

31. [P3] [src/lib/stripe.ts:4] `apiVersion: "2023-10-16" as any` -- Stripe API version cast, acceptable workaround but should use Stripe's version type.

32. [P3] [src/lib/messaging/providers/twilio.ts:28] `let twilioClient: any = null` -- Twilio client untyped.

33. [P3] [src/commands/registry.ts:142,212] `context: any` -- Command palette context parameter untyped.

34. [P3] [src/lib/messaging/logging-helpers.ts:102,109] `safeLog(...args: any[])` -- Logging utility accepts any args.

---

## 2. Non-null Assertions Without Guards

35. [P1] [src/app/dashboard/page.tsx:1176] `b.topSuggestion!.sitterId` -- Bulk dispatch maps `topSuggestion!` without null check. Will throw at runtime if `topSuggestion` is null for any booking in the batch.

36. [P1] [src/app/dashboard/page.tsx:1228] `booking.topSuggestion!.sitterId` -- Same issue in single-assign click handler.

37. [P1] [src/app/api/webhooks/stripe/route.ts:390] `session.metadata!.clientId` -- Stripe webhook accesses metadata with non-null assertion. If Stripe sends an event without metadata, this crashes the webhook handler.

38. [P2] [src/app/api/ops/daily-board/route.ts:178] `sitter!.id` -- Daily board uses non-null assertion on sitter lookup result.

39. [P2] [src/app/api/messages/__tests__/phase-3-integration.test.ts:534] `currentUser!.id` -- Test file (acceptable).

---

## 3. Untyped API Response Consumers

The frontend extensively uses `fetch()` and `.json()` without type annotations or runtime validation.

### P1 -- High (data-driving critical flows)

40. [P1] [src/app/dashboard/page.tsx:173-211] Multiple `res.json()` calls for messaging-status, payment-analytics, daily-board, stats -- All return untyped data that drives the main owner dashboard.

41. [P1] [src/app/dashboard/page.tsx:785-842] `res.json()` for command-center attention and staffing resolve -- Critical ops data consumed without types.

42. [P1] [src/components/messaging/InboxView.tsx:103-104] `(window as any).__lastThreadsFetch` -- Global window property used for thread data, completely untyped.

### P2 -- Medium (portal pages)

43. [P2] [src/app/settings/recurring/page.tsx:86-87] `cJson.items.map((c: any) => ...)`, `sJson.items.filter((s: any) => ...)` -- Recurring settings page consumes client/sitter lists without types.

44. [P2] [src/app/bookings/new/page.tsx:26] `(data.items || []).map((c: any) => ...)` -- New booking page consumes client list untyped.

45. [P2] [src/app/client/home/page.tsx:139] `balanceData.bookings?.slice(0, 3).map((b: any) => ...)` -- Client home page renders untyped balance bookings.

46. [P2] [src/app/sitter/reports/page.tsx:63] `reports.map((r: any) => ...)` -- Sitter reports page renders untyped reports.

47. [P2] [src/app/clients/[id]/page.enterprise.tsx:243-348] `useQuery<{ keys: any[] }>`, `useQuery<{ households: any[] }>` -- Enterprise client page uses `any[]` for query types.

---

## 4. Missing Return Types On Public Functions

### P2 -- Medium

48. [P2] [src/lib/queue.ts:50] `export async function scheduleDailySummary()` -- No return type.

49. [P2] [src/lib/queue.ts:71] `export async function scheduleReconciliation()` -- No return type.

50. [P2] [src/lib/queue.ts:103] `export async function initializeQueues()` -- No return type.

51. [P2] [src/lib/stripe-sync.ts:17,99,165,231,304] All 5 exported sync functions lack return types: `syncStripeCharges`, `syncStripeRefunds`, `syncStripePayouts`, `syncStripeBalanceTransactions`, `syncAllStripeData`.

52. [P2] [src/lib/analytics.ts:8] `export function trackEvent(...)` -- No return type.

53. [P2] [src/lib/booking-status-history.ts:61] `export async function getBookingStatusHistory(bookingId: string)` -- No return type.

54. [P2] [src/lib/ai/governance.ts:188] `export async function getGlobalAIPromptTemplates()` -- No return type.

55. [P2] [src/lib/runtime-diagnostics.ts:73] `export function getStagingInfraRecommendations()` -- No return type.

56. [P2] [src/lib/env.ts:75] `export function validateEnv()` -- No return type.

57. [P2] [src/lib/api/client-hooks.ts:286-669] **~40+ exported React hooks** lack explicit return types. While TypeScript can infer these, explicit types prevent accidental API contract changes.

58. [P2] [src/lib/api/sitter-portal-hooks.ts:26-304] **~30+ exported sitter hooks** lack return types.

59. [P2] [src/lib/api/hooks.ts:152-471] **~20+ exported messaging hooks** lack return types.

---

## 5. Implicit Any From JSON.parse

### P1 -- High (security-sensitive or business-logic-driving)

60. [P1] [src/lib/messaging/provider-factory.ts:55] `const config = JSON.parse(messageAccount.providerConfigJson)` -- Provider config parsed without validation. Malformed config = broken messaging.

61. [P1] [src/lib/messaging/provider-credentials.ts:47] `const config = JSON.parse(decrypted)` -- Decrypted credentials parsed without type assertion or validation.

62. [P1] [src/lib/automation-engine.ts:108] `const actionConfig = typeof config === 'string' ? JSON.parse(config || "{}") : config` -- Automation action config parsed without validation.

63. [P1] [src/lib/signup-bootstrap.ts:191] `const state = JSON.parse(raw) as { orgId?: string; userId?: string; sitterId?: string; exp?: number }` -- Has a type assertion but no runtime validation. Malformed state = broken signup.

64. [P1] [src/app/api/messages/webhook/openphone/route.ts:40] `const payload = JSON.parse(rawBody)` -- Incoming webhook payload from OpenPhone parsed without validation. Attacker-controlled input.

65. [P1] [src/lib/realtime/bus.ts:84] `const payload = JSON.parse(message)` -- Redis pub/sub message parsed without validation.

### P2 -- Medium

66. [P2] [src/hooks/useSSE.ts:44,54] `JSON.parse(e.data || '{}')` -- SSE event data parsed without types (x2).

67. [P2] [src/hooks/usePersistedTableState.ts:16] `JSON.parse(raw) as T` -- Generic cast without validation.

68. [P2] [src/lib/bundles/bundle-persistence.ts:26] `JSON.parse(row.value)` -- Bundle config parsed without types.

69. [P2] [src/lib/zones/point-in-polygon.ts:43] `JSON.parse(config)` -- Zone config parsed without types.

70. [P2] [src/lib/pricing-engine.ts:66,69] `JSON.parse(value || "[]")` -- Pricing rule values parsed without validation.

71. [P2] [src/lib/feature-flags.ts:94,157] `JSON.parse(existing.metadata)` -- Feature flag metadata parsed without types.

72. [P2] [src/lib/automations/condition-builder.ts:317,428,478] `JSON.parse(client.tags)`, `JSON.parse(condition.conditionConfig || '{}')` -- Automation conditions parsed without validation.

73. [P2] [src/app/api/form/route.ts:1038] `parsedDateTimes = JSON.parse(dateTimes)` -- Public form input parsed without validation.

74. [P2] [src/lib/tiers/srs-engine.ts:551] `JSON.parse(s.rolling30dBreakdownJson)` -- SRS breakdown parsed without types.

---

## 6. Prisma Type Passthrough

### P0 -- Critical (systemic pattern)

75. [P0] **SYSTEMIC: 426 `(prisma as any)` + 181 `(db as any)` = 607 total Prisma type bypasses across 77+ files.** This is the single largest type safety gap in the codebase. The Prisma client's entire type system is defeated. Causes include:
    - Prisma schema has models (e.g., `OfferEvent`, `AssignmentWindow`, `MessageThread`, `MessageResponseLink`) that the generated client types don't match
    - `getScopedDb()` returns a proxy that TypeScript can't type correctly
    - Quick workaround was `as any` rather than fixing the generated types

76. [P0] [src/app/api/client/me/route.ts:37] `return NextResponse.json({ ...client, name })` -- Spreads full Prisma client record to frontend. Currently mitigated by explicit `select` clause (line 25-29), but the spread pattern is fragile -- adding a field to `select` automatically exposes it.

77. [P1] [src/app/api/sitters/[id]/route.ts:40] `}) as any` -- Sitter record cast to `any` then properties accessed/spread to response. The `include: { user: { select: { id: true } } }` could inadvertently expose user data if the select is broadened.

78. [P1] [src/lib/sitter-helpers.ts:99-113] `limitClientDataForSitter(booking: any): any` -- Function designed to strip sensitive fields from bookings before sending to sitters. Both input and output are `any`, so there's no compile-time guarantee it actually strips anything.

---

## 7. Zod Schema Coverage

### P0 -- Critical (API routes accepting bodies without schema validation)

79. [P0] **Only 33 of ~120+ API route files use Zod validation.** The remaining ~90 routes accept `request.json()` and use it directly or with manual field-by-field checks. This means:
    - No structured validation errors returned to clients
    - No compile-time guarantee that handler logic matches expected input shape
    - Easier to introduce injection or type confusion bugs

**Routes with Zod (33 files) -- these are the GOOD ones:**
- `src/app/api/messages/threads/[id]/workflow/route.ts` (WorkflowActionSchema)
- `src/app/api/messages/threads/[id]/lifecycle/route.ts` (PatchSchema)
- `src/app/api/messages/availability/requests/route.ts` (PostSchema)
- `src/app/api/client/me/route.ts` (UpdateProfileSchema)
- `src/app/api/client/pets/[id]/route.ts` (UpdatePetSchema)
- `src/app/api/client/pets/route.ts` (CreatePetSchema)
- `src/app/api/client/emergency-contacts/route.ts`
- `src/app/api/auth/signup/route.ts`
- `src/app/api/push/subscribe/route.ts`
- `src/app/api/ops/sitters/invite/route.ts`
- `src/app/api/ops/sitters/bulk-import/route.ts`
- `src/app/api/sitter/running-late/route.ts`
- `src/app/api/sitter/callout/route.ts`
- `src/app/api/sitter/availability/bulk/route.ts`
- And ~19 more

**High-priority routes MISSING Zod validation:**

80. [P0] [src/app/api/form/route.ts:334] `const body = await request.json()` -- **Public booking form** (unauthenticated endpoint). Accepts arbitrary JSON from the internet. Has a separate mapper function (`validateAndMapFormPayload`) behind a feature flag, but the default path has no schema validation.

81. [P0] [src/app/api/messages/send/route.ts:21] `const body = await request.json()` -- Message sending, no Zod. Manual checks for `threadId` and `body` fields only.

82. [P0] [src/app/api/auth/change-password/route.ts:22] `const body = await req.json()` -- Password change, no schema validation.

83. [P0] [src/app/api/auth/reset-password/route.ts:17] `const body = await req.json()` -- Password reset, no schema validation.

84. [P0] [src/app/api/auth/forgot-password/route.ts:34] `const body = await req.json()` -- Forgot password, no schema validation.

85. [P1] [src/app/api/settings/business/route.ts:59] `const body = await request.json()` -- Business settings update, no Zod.

86. [P1] [src/app/api/settings/branding/route.ts:76] `const body = await request.json()` -- Branding settings update, no Zod.

87. [P1] [src/app/api/settings/payment-processor/route.ts:95] `const body = await request.json()` -- Payment processor settings, no Zod.

88. [P1] [src/app/api/settings/messaging-provider/route.ts:71] `const body = await request.json()` -- Messaging provider settings, no Zod.

89. [P1] [src/app/api/bookings/[id]/route.ts:286] `const body = (await request.json()) as {...}` -- Booking update uses type assertion but no runtime validation.

90. [P1] [src/app/api/dispatch/force-assign/route.ts:35] `const body = await request.json()` -- Force assignment, no Zod.

91. [P1] [src/app/api/ops/payouts/approve/route.ts:26] `const body = await request.json()` -- Payout approval, no Zod.

92. [P1] [src/app/api/tip/create-payment-intent/route.ts:32] `const body = await request.json()` -- Payment intent creation, no Zod.

93. [P1] [src/app/api/tip/transfer-tip/route.ts:32] `const body = await request.json()` -- Tip transfer, no Zod.

94. [P1] [src/app/api/webhooks/stripe/route.ts] Stripe webhook -- relies on Stripe SDK verification but parsed metadata accessed via `as any` and non-null assertions.

---

## Summary by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| **P0** | 7 issues | Auth/middleware `as any`, systemic Prisma bypass (607 sites), ~90 API routes without Zod, public form endpoint unvalidated |
| **P1** | 33 issues | Event bus untyped, automation engine untyped, SRS/tier engines untyped, non-null assertions, critical JSON.parse sites, Prisma passthrough to frontend |
| **P2** | 26 issues | UI components rendering `any`, missing return types on ~90+ hooks, medium-risk JSON.parse, untyped fetch responses |
| **P3** | 5 issues | Error catch `any`, utility logging, command context |

---

## HANDOFF NOTE TO AGENT 11 (Type Enforcer)

Agent 11 -- here is the prioritized remediation plan:

### Immediate (P0 -- do these first)

1. **Fix NextAuth types.** Create a `types/next-auth.d.ts` module augmentation that extends `Session["user"]` with `{ orgId: string; role: string; sitterId: string | null; clientId: string | null }`. This eliminates ~30 `as any` casts in `auth.ts`, `middleware.ts`, `page.tsx`, and `setup/layout.tsx` in one move.

2. **Fix Prisma generated types.** The 607 `(prisma as any)` / `(db as any)` casts exist because the Prisma client types don't include all 106 models or the scoped DB proxy isn't properly typed. Run `npx prisma generate` and verify the generated client matches the schema. Then create a properly-typed `ScopedDb` type that `getScopedDb()` returns. This is the single highest-ROI fix.

3. **Add Zod schemas to all auth routes** (`change-password`, `reset-password`, `forgot-password`) and the **public form route** (`/api/form`). These accept untrusted input.

### Short-term (P1 -- next sprint)

4. **Type the event bus.** Create a `BookingEventPayload` interface and use it across all `emitBooking*` functions and the `event-queue-bridge.ts` listeners. This propagates type safety through the entire event-driven automation system.

5. **Type the automation executor.** Replace `booking: any` with a proper `BookingWithRelations` type across all 12 function signatures in `automation-executor.ts`.

6. **Add Zod to remaining mutation routes** -- prioritize `/api/messages/send`, `/api/dispatch/force-assign`, `/api/ops/payouts/approve`, `/api/tip/*`, `/api/settings/*`.

7. **Validate all `JSON.parse` calls** in production code with Zod schemas or at minimum type assertions followed by runtime checks on critical fields.

### Medium-term (P2 -- ongoing)

8. **Add explicit return types** to all exported hooks in `src/lib/api/*.ts` -- use a lint rule (`@typescript-eslint/explicit-module-boundary-types`).

9. **Replace `any` in UI components** with proper DTO types. Start with `FinanceTab`, `PaymentsTab`, `SittersPanel`, `RecurringPage`, `Dashboard`.

10. **Create DTO types** for all Prisma-to-frontend boundaries. Every `NextResponse.json()` should use a mapped type, never a raw Prisma spread.

### Config recommendation

Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "noImplicitAny": true  // Already likely set; verify it's not overridden
  }
}
```

Add ESLint rules:
```json
{
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/explicit-module-boundary-types": "warn",
  "@typescript-eslint/no-non-null-assertion": "warn"
}
```

---

*Agent 04 complete. Over to Agent 11.*
