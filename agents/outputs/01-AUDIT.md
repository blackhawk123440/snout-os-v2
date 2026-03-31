# 01-AUDIT.md
# Agent 01 (Cartographer) -- Master Bug & Gap List
# Generated: 2026-03-29
# Scanned: 313 API routes, 105 pages, 50+ lib modules, 16 component directories

---

## 1. UNHANDLED PROMISE REJECTIONS (Missing try/catch)

[01] [SEVERITY: P0] [src/app/api/messages/threads/[id]/route.ts:27] `ensureThreadHasMessageNumber()` and all subsequent Prisma calls (lines 29-148) execute outside any try/catch. DB failure or thread lookup error crashes the route with an unhandled 500.

[02] [SEVERITY: P0] [src/app/api/messages/threads/[id]/messages/route.ts:94] GET handler: Prisma calls `db.messageThread.findUnique()` (line 95) and `Promise.all()` with `db.messageEvent.count/findMany` (lines 145-153) execute outside any try/catch. DB error = unhandled crash.

[03] [SEVERITY: P1] [src/app/api/push/preferences/route.ts:16] GET handler: `prisma.userNotificationPreferences.findUnique()` has no try/catch. If `UserNotificationPreferences` model is missing from migration or DB connection fails, route crashes silently.

[04] [SEVERITY: P1] [src/app/api/dispatch/attention/route.ts:44] Both `booking.findMany()` queries (lines 44 and 66) use `(prisma as any)` without orgId in the WHERE clause. In SaaS mode, this leaks bookings across tenants. Currently masked by Personal Mode but will be a data leak if SaaS mode is enabled.

[05] [SEVERITY: P1] [src/app/api/dispatch/attention/route.ts:44] The `manualRequiredBookings` query has no orgId scope (line 44-64). Same for `unassignedAutoBookings` (line 66-91). Both should filter by orgId from the session.

---

## 2. MISSING RESPONSE RETURNS

[06] [SEVERITY: P1] [src/app/api/messages/threads/[id]/route.ts:27] If `ensureThreadHasMessageNumber()` throws, no Response is returned. The function call is awaited but not wrapped in try/catch, so an exception propagates with no controlled error response.

[07] [SEVERITY: P1] [src/app/api/messages/threads/[id]/messages/route.ts:95] If `db.messageThread.findUnique()` throws (line 95), no error Response is returned. The outer function has no try/catch wrapping the DB call.

---

## 3. DEAD CODE

[08] [SEVERITY: P3] [src/lib/pricing-engine.ts:265] 49 lines of commented-out pricing rule engine (lines 265-313). Entire fee/discount/multiplier processing pipeline disabled with comment "Disabled code (PricingRule model not available)". Needs decision: implement or delete.

[09] [SEVERITY: P3] [src/lib/messaging/proactive-thread-creation.ts:93] 43 lines of commented-out booking-based thread creation logic (lines 93-136). Assignment window creation and number assignment logic disabled with comment "Booking model not in API schema".

[10] [SEVERITY: P3] [src/lib/rates.ts:119] 16 lines of commented-out rate fetching from DB (lines 119-134). Returns empty array with comment "Rate model doesn't exist in messaging dashboard schema".

[11] [SEVERITY: P3] [src/lib/automation-engine.ts:155] `applyFee` action handler is a TODO stub (line 155). `applyDiscount` action handler is a TODO stub (line 161). These automation actions silently no-op.

[12] [SEVERITY: P3] [src/lib/messaging/client-classification.ts:77] `isRecurringClient()` returns `false` always (line 77, 7 lines of commented-out code). TODO: "Implement when recurrence system is added". Recurring schedule system exists now.

[13] [SEVERITY: P3] [src/lib/messaging/client-classification.ts:115] `hasWeeklyPlan()` returns `false` always (line 115). TODO: "Implement weekly plan check when weekly plan system is added". Weekly recurring charge system exists now.

---

## 4. DUPLICATE LOGIC

[14] [SEVERITY: P2] [src/app/api/sitter/[id]/bookings/[bookingId]/accept/route.ts:287] `updateMetricsWindow()` function duplicated in 3 locations with near-identical logic:
  - `src/app/api/sitter/[id]/bookings/[bookingId]/accept/route.ts:287` (85 lines)
  - `src/app/api/sitter/[id]/bookings/[bookingId]/decline/route.ts:177` (85 lines)
  - `src/app/api/offers/expire/route.ts:293` (variant as `updateMetricsWindowForExpired`, 78 lines)
  - `src/lib/tiers/tier-engine-twilio.ts:311` (another variant)
  Should be extracted to a shared `src/lib/tiers/metrics-window.ts` utility.

[15] [SEVERITY: P2] [src/app/api/cron/weekly-recurring-charge/route.ts:133] Stripe client instantiated inline with `new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' })` in 10+ locations instead of importing the shared `stripe` singleton from `src/lib/stripe.ts`:
  - `src/app/api/cron/weekly-recurring-charge/route.ts:133`
  - `src/app/api/cron/weekly-recurring-charge/route.ts:178`
  - `src/app/api/cron/collect-balances/route.ts:73`
  - `src/app/api/bookings/[id]/cancel/route.ts:98`
  - `src/app/api/form/route.ts:689`
  - `src/app/api/webhooks/stripe/route.ts:39`
  - `src/app/api/webhooks/stripe/route.ts:202`
  - `src/app/api/webhooks/stripe/route.ts:422`
  - `src/lib/payout/sitter-payout.ts:82`
  All should use `import { stripe } from '@/lib/stripe'`.

---

## 5. HARDCODED VALUES

[16] [SEVERITY: P1] [src/app/api/webhooks/stripe/route.ts:39] Stripe initialized with fallback `'sk_dummy'` as the secret key. If `STRIPE_SECRET_KEY` is unset, this passes a fake key to Stripe instead of failing fast, potentially causing confusing downstream errors.

[17] [SEVERITY: P2] [src/app/api/cron/collect-balances/route.ts:75] `http://localhost:3000` used as fallback for `NEXT_PUBLIC_APP_URL` in 20+ production code paths. While env var is set in production, if it ever unsets, payment links, password reset links, sitter invites, and webhook URLs would point to localhost. Locations include:
  - `src/lib/notifications/triggers.ts:141,312,357`
  - `src/lib/invoicing/payment-reminder.ts:59`
  - `src/lib/automation-executor.ts:235`
  - `src/lib/automation-owner-notify.ts:22`
  - `src/app/api/cron/collect-balances/route.ts:75`
  - `src/app/api/cron/weekly-recurring-charge/route.ts:134`
  - `src/app/api/auth/forgot-password/route.ts:73`
  - `src/app/api/form/route.ts:720`
  - `src/app/api/clients/route.ts:169`
  - `src/app/api/client/bundles/route.ts:156`
  - `src/app/api/ops/sitters/invite/route.ts:106`
  - `src/app/api/ops/sitters/bulk-import/route.ts:91`
  Should fail loudly if `NEXT_PUBLIC_APP_URL` is unset in production.

[18] [SEVERITY: P2] [src/lib/stripe.ts:4] Stripe API version hardcoded as `"2023-10-16"` across all inline instantiations. Should be a single constant imported from `src/lib/stripe.ts`.

[19] [SEVERITY: P3] [src/app/api/form/route.ts:46] `"http://localhost:3000"` is hardcoded in the CORS allowed origins list alongside production origins. Safe but should be env-conditional to avoid accepting local-origin requests in production.

---

## 6. MISSING LOADING STATES

[20] [SEVERITY: P2] [src/app/automations/[id]/page.tsx:107] Automation detail page fetch (`fetchBlock`) shows loading skeleton but has no intermediate loading state when `saving` or `testing` -- the save button has no visual feedback beyond the boolean flag.

---

## 7. MISSING ERROR STATES

[21] [SEVERITY: P1] [src/app/automations/page.tsx:62] `fetchAutomations()` catches errors with `console.error` only (line 71). If the API returns non-OK status or network fails, the page shows an empty list with no error UI. User sees "0 automations" instead of an error.

[22] [SEVERITY: P1] [src/app/automations/page.tsx:77] `fetchStats()` catches errors with `console.error` only (line 85). Stats display stale defaults `{ totalEnabled: 0, runsToday: 0, failuresToday: 0 }` with no error indication.

[23] [SEVERITY: P1] [src/app/automations/[id]/page.tsx:107] `fetchBlock()` catches errors with `console.error` only (line 117). If API fails, the page shows empty/default form fields with no error state. Same for `handleSave` (line 146) -- save failure is silent.

[24] [SEVERITY: P2] [src/app/dashboard/page.tsx:1] Dashboard delegates to enterprise page but the `useQuery` calls for board data, stats, and attention items in the daily board do not display inline error banners when individual API calls fail -- only full-page error.

---

## 8. MISSING EMPTY STATES

[25] [SEVERITY: P2] [src/app/automations/page.tsx:130] When automations list is empty (not loading, not error), page shows the filter/search UI with no results and no empty state message. Should show "No automations configured" with action to create.

[26] [SEVERITY: P2] [src/app/sitter/earnings/page.tsx:1] Sitter earnings page lacks empty state when `completedJobs` is empty and `earningsData` shows all zeros. Shows data tables with no rows and no "No earnings yet" message.

---

## 9. CONSOLE LOGS LEFT IN PRODUCTION CODE

[27] [SEVERITY: P3] [src/hooks/useCommandPalette.ts:110] 4 `console.log('[Command Telemetry]', ...)` calls (lines 110, 120, 138, 152) logging every command palette interaction in production.

[28] [SEVERITY: P3] [src/commands/audit.ts:64] `console.log('[Command Audit]', ...)` logs command audit data on every invocation.

[29] [SEVERITY: P3] [src/commands/commands.tsx:539] `console.log` with emoji "Registered N commands" runs on every command registration.

[30] [SEVERITY: P3] [src/components/CommandProvider.tsx:24] `console.log` with emoji "Command registry initialized" runs on mount.

[31] [SEVERITY: P3] [src/components/messaging/ConversationView.tsx:112] `console.log('[ConversationView] Fetching thread from:', endpoint)` logs every thread fetch.

[32] [SEVERITY: P3] [src/components/messaging/ConversationView.tsx:180] `console.log('[ConversationView] Sending message to:', endpoint, payload)` logs every message send with full payload.

[33] [SEVERITY: P3] [src/components/messaging/ConversationList.tsx:71] `console.log('[ConversationList] Fetching threads from:', endpoint)` logs every thread list fetch.

[34] [SEVERITY: P3] [src/components/command/CommandPalette.tsx:140] 2 `console.log('[Command Telemetry]', ...)` calls (lines 140, 150).

[35] [SEVERITY: P3] [src/app/ui-kit/page.tsx:302] `console.log('Sort:', col, dir)` in the UI kit demo page onSort handler.

[36] [SEVERITY: P3] [src/worker/reconciliation-worker.ts:24] `console.log("[Reconciliation Worker] Starting...")` and result logging (lines 24, 29). Worker logs are appropriate but should use a structured logger.

[37] [SEVERITY: P3] [src/worker/index.ts:17] 4 `console.log("[Worker]...")` lines (17-20) for startup info. Should use structured logger.

---

## 10. COMMENTED-OUT CODE BLOCKS (>3 lines)

[38] [SEVERITY: P3] [src/lib/pricing-engine.ts:265] 49 lines of commented-out pricing rule engine. Decision needed: implement PricingRule model or delete dead code.

[39] [SEVERITY: P3] [src/lib/messaging/proactive-thread-creation.ts:93] 43 lines of commented-out booking-based assignment window logic.

[40] [SEVERITY: P3] [src/lib/rates.ts:119] 16 lines of commented-out rate fetching. Dead since Rate model was removed.

[41] [SEVERITY: P3] [src/lib/messaging/pool-routing.ts:169] 9 lines of commented-out pool routing logic.

[42] [SEVERITY: P3] [src/lib/messaging/providers/twilio.ts:146] 7 lines of commented-out error handling in Twilio provider.

[43] [SEVERITY: P3] [src/lib/messaging/providers/twilio.ts:180] 5 lines of commented-out media attachment logic in Twilio provider.

[44] [SEVERITY: P3] [src/lib/event-queue-bridge.ts:76] 6 lines of commented-out queue bridge logic.

[45] [SEVERITY: P3] [src/lib/automation-engine.ts:179] 6 lines of commented-out automation condition evaluation.

[46] [SEVERITY: P3] [src/middleware.ts:148] 4 lines of commented-out middleware logic.

[47] [SEVERITY: P3] [src/app/api/form/route.ts:1015] 4 lines of commented-out form submission code.

[48] [SEVERITY: P3] [src/app/api/form/route.ts:1023] 4 lines of commented-out form submission code.

[49] [SEVERITY: P3] [src/lib/bookings/booking-status-helper.ts:32] 5 lines of commented-out status helper.

[50] [SEVERITY: P3] [src/lib/api/jwt.ts:36] 5 lines of commented-out JWT logic.

[51] [SEVERITY: P3] [src/lib/messaging/client-classification.ts:77] 7 lines of commented-out recurring client check.

[52] [SEVERITY: P3] [src/lib/messaging/owner-inbox-routing.ts:118] 4 lines of commented-out inbox routing.

[53] [SEVERITY: P3] [src/lib/messaging/proactive-thread-creation.ts:55] 8 lines of commented-out thread creation.

[54] [SEVERITY: P3] [src/lib/queue.ts:51] 4 lines of commented-out queue logic.

[55] [SEVERITY: P3] [src/app/login/page.tsx:53] 4 lines of commented-out login page code.

[56] [SEVERITY: P3] [src/lib/phone-utils.ts:16] 5 lines of commented-out phone formatting.

[57] [SEVERITY: P3] [src/app/api/health/route.ts:47] 5 lines of commented-out health check code.

[58] [SEVERITY: P3] [src/app/api/ops/bookings/[id]/mark-paid/route.ts:46] 4 lines of commented-out mark-paid logic.

---

## BONUS: SECURITY / DATA INTEGRITY ISSUES

[59] [SEVERITY: P0] [src/app/api/dispatch/attention/route.ts:44] TENANT ISOLATION BREACH: `booking.findMany()` and `offerEvent.findMany()` queries use raw `prisma` cast as `(prisma as any)` without orgId in WHERE clause. The orgId is resolved at line 32 but only used for the `offerEvent` query (line 106), not for the two booking queries (lines 44 and 66). This means ALL bookings across ALL orgs with `dispatchStatus: 'manual_required'` or `sitterId: null, status: 'pending'` are returned, regardless of org.

[60] [SEVERITY: P0] [src/app/api/cron/expire-unpaid/route.ts:16] TENANT ISOLATION: `booking.findMany()` at line 16 and `booking.update()` at line 26 use raw `(prisma as any)` without orgId WHERE clause. Cross-org query is intentional for cron BUT the `bookingStatusHistory.create()` at line 31 includes orgId from the booking, so this is correct. However, the raw prisma usage bypasses scoped DB safety -- should use `getScopedDb` per-booking like `collect-balances` does.

[61] [SEVERITY: P1] [src/app/api/tip/sitter-info/route.ts:35] `prisma.sitter.findUnique()` at line 35 and `prisma.sitter.findMany()` at line 48 query ALL sitters across ALL orgs. Public endpoint leaks sitter names across tenant boundaries via the name-alias lookup.

[62] [SEVERITY: P1] [src/app/api/tip/transfer-tip/route.ts:68] `prisma.sitterStripeAccount.findFirst()` at line 68 and `prisma.sitter.findMany()` at line 80 query ALL sitters/accounts across ALL orgs without orgId scope. Public endpoint. Could allow transfers to wrong org's sitters.

---

## SUMMARY

| Severity | Count |
|----------|-------|
| P0 (crashes/data corruption) | 4 |
| P1 (silent user flow breaks) | 10 |
| P2 (experience degradation) | 8 |
| P3 (code quality) | 40 |
| **Total** | **62** |

---

## HANDOFF NOTE TO AGENT 08 (EXTERMINATOR)

Priority triage:

**Fix immediately (P0):**
1. Items 01-02: Add try/catch to `messages/threads/[id]/route.ts` GET and `messages/threads/[id]/messages/route.ts` GET. These are the core messaging routes used constantly.
2. Items 59, 04-05: Add orgId to booking queries in `dispatch/attention/route.ts`. This is a tenant isolation breach.

**Fix next (P1):**
3. Items 61-62: Add orgId scope to tip routes (`sitter-info` and `transfer-tip`). Cross-tenant data leak on public endpoints.
4. Items 06-07: These are the same routes as 01-02, fixing try/catch also fixes the missing response returns.
5. Items 21-23: Add error state UI to automations pages. Currently fetch failures are invisible to users.
6. Item 16: Change `'sk_dummy'` fallback in Stripe webhook handler to throw if key is missing.
7. Item 03: Add try/catch to push/preferences GET handler.

**Fix soon (P2):**
8. Item 14: Extract `updateMetricsWindow` to shared utility (4 copies).
9. Item 15: Replace inline Stripe instantiation with shared singleton (10+ copies).
10. Item 17: Make `NEXT_PUBLIC_APP_URL` required in production (throw if missing).

**Cleanup (P3):**
11. Items 38-58: Delete or restore commented-out code blocks. 21 blocks totaling 200+ commented lines.
12. Items 27-37: Remove production console.logs from frontend components or route through structured logger.
13. Items 08-13: Delete dead code stubs or implement the TODOs.

All file paths are relative to repo root: `/Users/leahhudson/Desktop/final form/snout-os/`
