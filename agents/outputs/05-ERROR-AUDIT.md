# 05-ERROR-AUDIT.md
# Agent 05 (Error Boundary Auditor) -- Complete Error Handling Audit
# Generated: 2026-03-29

---

## Summary

- **313 API route files** audited under `src/app/api/`
- **10 BullMQ workers** (automation, automation-high, daily-summary, reconciliation, reminder-scheduler, messaging-outbound, calendar-sync, pool-release, payouts, finance-reconcile)
- **2 webhook handlers** (Stripe, Twilio) + 1 deprecated (OpenPhone incoming)
- **79 Promise.all usages** found, 4 Promise.allSettled usages found
- **0 React ErrorBoundary components** -- none exist anywhere
- **0 Next.js error.tsx files** -- none exist anywhere
- **1 file** handles PrismaClientKnownRequestError (form/route.ts only)

Total findings: 23

---

## Findings

### 1. Missing React Error Boundaries

## [01] [SEVERITY: P0] [FIXED] [src/app/ -- ALL PORTALS] [No React ErrorBoundary components exist anywhere in the application]

There are zero `ErrorBoundary` components and zero Next.js `error.tsx` files in the entire codebase. The owner portal has 21 pages, sitter portal has 16 pages, client portal has 16 pages -- a single unhandled React error in ANY component crashes the entire portal to a white screen.

This is the single highest-priority error handling gap. Next.js App Router supports `error.tsx` boundary files at every route segment level. None are implemented.

**Impact:** Any runtime JS error (null reference, undefined property access, bad API response shape) takes down the entire portal for that user.

---

### 2. Automation Executor Silent Failures (Agent 00 Flagged)

## [02] [SEVERITY: P0] [FIXED] [src/lib/automation-queue.ts:140-158] [Automation worker treats { success: false } as job success -- silent data loss]

The automation worker at line 140 calls `executeAutomationForRecipient()` which returns `AutomationResult`. When the result is `{ success: false, error: "..." }`, the worker:
1. Does NOT check `result.success`
2. Logs the run as `"success"` (line 143)
3. Returns the result (BullMQ marks job as completed)
4. Never retries

The executor has **26 code paths** that return `{ success: false }` covering: booking not found, phone not found, unsupported recipient, template missing, send failures, etc. Every one is silently swallowed.

**Impact:** Client never receives booking confirmation, sitter never gets assignment notification, owner never gets new booking alert -- and the system reports all automations as successful.

**Fix:** After line 140, check `if (!result.success) throw new Error(result.error || "Automation returned success: false")` so BullMQ retries and eventually dead-letters.

---

### 3. Automation Executor Catch-All Converts Throws to Returns

## [03] [SEVERITY: P1] [FIXED] [src/lib/automation-executor.ts:144-151] [Handler catch converts thrown errors to { success: false } return -- double-silencing with #02]

The top-level switch in `executeAutomationForRecipient` wraps all handler calls in try/catch and converts ANY thrown error to `{ success: false }`. Combined with finding #02, this means even hard errors (DB down, network failure) that SHOULD trigger retries are silenced.

**Impact:** Transient errors that would succeed on retry are permanently lost.

---

### 4. Automation High-Priority Queue Missing Dead-Letter Handling

## [04] [SEVERITY: P1] [FIXED] [src/lib/automation-queue.ts:257-259] [automationHighWorker "failed" handler only logs to console -- no dead-letter, no Sentry, no SSE notification]

The default-priority automation worker (line 213-245) has comprehensive error handling on `"failed"`:
- Captures to Sentry
- Writes `automation.dead` EventLog entry after max attempts
- Publishes to SSE ops failures channel

The high-priority worker (line 257-259) does NONE of this -- just `console.error`. High-priority automations (bookingConfirmation, ownerNewBookingAlert) that fail all retries vanish silently.

**Impact:** The most important automations have the worst failure visibility.

---

### 5. Missing try/catch on API Routes

## [05] [SEVERITY: P1] [src/app/api/auth/logout/route.ts:10-13] [No try/catch on logout route]

The `POST` handler calls `await signOut({ redirect: false })` without any error handling. If NextAuth's signOut throws (session store unavailable, Redis down), the user gets an unhandled 500 with no proper error response.

**Impact:** User sees cryptic error instead of graceful fallback.

---

### 6. Webhook Error Handling -- Twilio Returns 200 on Failure

## [06] [SEVERITY: P1] [FIXED] [src/app/api/messages/webhook/twilio/route.ts:299-302] [Twilio webhook catch returns twimlOk() (200) on unhandled errors]

The outer catch block at line 299 returns `twimlOk()` (HTTP 200 with empty TwiML) on any unhandled error. This tells Twilio "message processed successfully" even when it wasn't. Twilio will not retry. The inbound message is permanently lost.

**Impact:** Client messages silently disappear during transient failures (DB connection reset, Redis timeout).

**Note:** Returning 200 on Twilio webhooks is intentional to prevent retry storms, but it should at minimum log to Sentry and create an AppErrorLog record so the lost message can be detected.

---

### 7. Webhook Error Handling -- OpenPhone Returns 200 on Failure

## [07] [SEVERITY: P1] [FIXED] [src/app/api/messages/webhook/openphone/route.ts:239-242] [OpenPhone webhook catch returns jsonOk() (200) on unhandled errors]

Same pattern as Twilio: outer catch returns 200, OpenPhone marks delivery as complete, message permanently lost.

Additionally, line 100 has a bare `catch {}` that silently swallows org resolution failures. If the MessageAccount lookup throws (not just returns null), the error is hidden and the webhook falls through to using `orgId = 'default'` which may be wrong.

---

### 8. Stripe Webhook -- onBookingConfirmed Failure Doesn't Fail the Webhook

## [08] [SEVERITY: P1] [FIXED] [src/app/api/webhooks/stripe/route.ts:106-108] [onBookingConfirmed error caught and swallowed -- booking stuck in inconsistent state]

When `payment_intent.succeeded` fires and `onBookingConfirmed()` throws at line 82, the error is caught at line 106-108 and only logged. The webhook returns 200. However:
- The booking status update at line 91-92 never executes
- The booking remains in its pre-payment status
- The payment was collected but the booking was never confirmed
- No retry mechanism exists

**Impact:** Client pays, booking shows as unconfirmed, sitter never notified.

---

### 9. Cron Route -- expire-unpaid Has No Per-Booking Error Isolation

## [09] [SEVERITY: P1] [FIXED] [src/app/api/cron/expire-unpaid/route.ts:25-49] [Single booking failure in loop crashes entire cron run]

The for-loop at line 25 iterates over expired bookings and performs update + history create + logEvent for each. If any individual booking operation fails (e.g., bookingStatusHistory.create fails because the model has a required field that's missing), the entire cron run crashes and no subsequent bookings are processed.

Compare with `collect-balances/route.ts` which correctly wraps each booking in its own try/catch.

**Impact:** One bad booking record blocks expiry of all remaining bookings.

---

### 10. Promise.all Without Error Isolation in Critical Paths

## [10] [SEVERITY: P2] [src/lib/messaging/send.ts:255] [Promise.all for routing + phone lookup + provider init -- one rejection cancels all]

```typescript
const [routingResult, toE164, provider] = await Promise.all([...])
```

If the routing lookup fails, the phone normalization result is discarded even if it succeeded. These are independent operations where partial results could allow a fallback path.

## [11] [SEVERITY: P2] [src/lib/availability/engine.ts:332] [Promise.all for rules + overrides + bookings + timeOffs + googleBusy]

Five parallel DB queries where a Google Calendar API failure (external service) cancels all availability results. Should be Promise.allSettled so DB-sourced rules still work when Google is down.

## [12] [SEVERITY: P2] [src/lib/health-checks.ts:87-112] [Nested Promise.all for queue stats -- one dead queue crashes health endpoint]

The health check uses nested `Promise.all` for 5 queue stat lookups. If any queue's Redis connection is broken, the entire health endpoint returns 500 instead of reporting which queues are healthy vs unhealthy.

## [13] [SEVERITY: P2] [src/app/api/integrations/status/route.ts:127] [Promise.all for stripe + twilio + calendar + ai status checks]

Four external service checks in `Promise.all`. One service timeout (e.g., Stripe API slow) causes the entire integration status page to fail with 500 instead of showing partial results.

---

### 11. Prisma Error Handling -- Generic 500 Instead of 409

## [14] [SEVERITY: P2] [src/app/api/clients/route.ts:131-182] [Client creation has TOCTOU race -- duplicate phone returns 500 instead of 409]

The route checks for duplicate phone via `findFirst` (line 132) then creates in a transaction (line 143). Two concurrent requests can both pass the check, one succeeds, the other gets a P2002 unique constraint violation caught by the generic catch block at line 178 which returns 500 instead of 409.

## [15] [SEVERITY: P2] [src/app/api/auth/signup/route.ts:74-88] [Signup bootstrap catches all errors as 500 -- duplicate email should be 409]

The signup route has no P2002 handling. If `bootstrapOrgAndOwner` throws a unique constraint violation (duplicate email), the response is a generic "Signup failed" 500.

## [16] [SEVERITY: P2] [src/app/api -- SYSTEMIC] [Only 3 route files handle P2002 out of 313 total]

Only `form/route.ts`, `sitter-tiers/route.ts`, and `sitter-tiers/[id]/route.ts` handle `PrismaClientKnownRequestError` with code P2002. Every other route that creates or updates records with unique constraints returns 500 on constraint violations.

---

### 12. Command Palette Mock Implementations

## [17] [SEVERITY: P2] [src/commands/commands.tsx:174-190, 211-227, 251-267, 288-304] [4 booking commands use setTimeout mocks instead of real API calls]

The following command palette commands fake success with `setTimeout(resolve, 500)`:
- `booking.send-confirmation` (line 178)
- `booking.collect-payment` (line 215)
- `booking.assign-sitter` (line 255)
- `booking.trigger-automation` (line 292)

These appear to work from the user's perspective (show success toast) but perform no actual action.

## [18] [SEVERITY: P2] [src/commands/booking-commands.tsx:41, 77, 117] [3 more booking commands use setTimeout mocks]

Additional mock commands in the booking-specific command file.

---

### 13. Empty Catch Blocks in API Routes

## [19] [SEVERITY: P2] [src/app/api/numbers/[id]/release-from-twilio/route.ts:154,195,225] [3 empty catch blocks in destructive Twilio number release operation]

Releasing a phone number from Twilio is an irreversible, destructive action. Three operations in this flow silently swallow errors with `catch {}`. If the DB update after Twilio release fails, the number is released from Twilio but still shows as "active" in the system.

## [20] [SEVERITY: P3] [src/app/api/ops/recurring-schedules/[id]/approve/route.ts:47,76] [Client notification on approve/deny silently swallowed]

When a recurring schedule is approved or denied, the client SMS notification is wrapped in `try {} catch {}`. The client never learns their schedule was approved or denied. Should at minimum log the failure.

---

### 14. Payout Worker -- persistPayrollRunFromTransfer Failure Silently Swallowed

## [21] [SEVERITY: P1] [src/lib/payout/payout-queue.ts:123-131] [Payout succeeds (money transferred) but payroll record creation failure is caught and only logged]

After `executePayout` succeeds (Stripe transfer created, money moved), the `persistPayrollRunFromTransfer` call at line 123 is wrapped in `.catch()` that only logs. If this fails:
- Money was transferred to the sitter
- No payroll record exists
- Financial reconciliation will show missing records
- No mechanism to re-create the payroll record

**Impact:** Silent financial data loss.

---

### 15. SSE/Realtime Routes -- No Stream Error Recovery

## [22] [SEVERITY: P3] [src/app/api/realtime/messages/threads/[id]/route.ts] [SSE stream has no reconnection guidance for clients on error]

The SSE endpoints don't send error events to connected clients when the Redis subscription fails. The client connection just hangs with no data. Should send an SSE error event with retry directive.

---

### 16. .catch(() => {}) Pattern Across Critical Operations

## [23] [SEVERITY: P2] [SYSTEMIC -- 40+ occurrences in src/app/api/] [Widespread .catch(() => {}) on logEvent, publish, and notification calls]

While `.catch(() => {})` is acceptable for truly optional fire-and-forget operations (SSE publish, analytics logging), it is also used on operations that affect correctness:
- `syncConversationLifecycleWithBookingWorkflow().catch(() => {})` in booking routes
- `notifyOwnerNewBooking().catch(() => {})` in cron routes
- `emitClientLifecycleNoticeIfNeeded().catch(() => {})` in check-out

Some of these are intentionally non-blocking. But the pattern makes it impossible to distinguish "intentionally fire-and-forget" from "we forgot to handle this error."

**Recommendation:** Replace bare `.catch(() => {})` with `.catch((e) => console.error('[context] non-critical op failed:', e))` at minimum, or use a named helper like `void logNonCriticalFailure(promise, 'context')`.

---

## Priority Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **P0**   | 2     | [FIXED] No React error boundaries (9 error.tsx files added); [FIXED] automation silent failures |
| **P1**   | 7     | [FIXED] High-queue dead-letter gap; [FIXED] webhook 200-on-error; [FIXED] Stripe inconsistency; [FIXED] cron no isolation; payout data loss; logout no try/catch |
| **P2**   | 12    | Promise.all without isolation; Prisma 500-not-409; command palette mocks; empty catches; systemic .catch(() => {}) |
| **P3**   | 2     | SSE no reconnection; recurring notification swallowed |

---

## HANDOFF NOTE to Agent 12 (Error Handler)

Agent 12 -- here is what you need to fix, in priority order:

### Must Fix (P0)
1. **Create error.tsx boundary files** at minimum at: `src/app/error.tsx` (root), `src/app/sitter/error.tsx`, `src/app/client/error.tsx`, and `src/app/(owner)/error.tsx` (or equivalent owner layout group). These should render a user-friendly "Something went wrong" UI with a retry button, and report the error to Sentry via `captureException()`.

2. **Fix automation worker silent success** in `src/lib/automation-queue.ts`. After the `executeAutomationForRecipient()` call (line 140), add: `if (!result.success) throw new Error(result.error || 'Automation returned success=false')`. This makes BullMQ retry the job, and after 3 attempts it hits the dead-letter handler.

3. **Remove the catch-all in automation-executor.ts** (lines 144-151) or change it to re-throw transient errors (DB connection, network) while only returning `{ success: false }` for permanent failures (booking not found, unsupported type).

### Should Fix (P1)
4. **Copy dead-letter handling** from the default automation worker's `"failed"` handler (lines 213-245) to the high-priority worker (lines 257-259). Same Sentry capture, EventLog write, and SSE publish.

5. **Webhook error handling:** In Twilio webhook catch (line 299) and OpenPhone webhook catch (line 239), add Sentry `captureException()` and create an `AppErrorLog` record before returning 200. Consider returning 500 for non-transient errors so Twilio retries.

6. **Stripe webhook onBookingConfirmed:** At line 106-108, either re-throw the error (so Stripe retries the webhook), or implement a compensation path that creates a background job to retry the confirmation.

7. **Wrap expire-unpaid cron loop** in per-booking try/catch (match the pattern in collect-balances).

8. **Add try/catch to logout route** (trivial fix).

9. **Payout payroll record:** Change the `.catch()` on `persistPayrollRunFromTransfer` to throw (so BullMQ retries the job) or enqueue a separate compensation job.

### Good to Fix (P2)
10. **Handle P2002** in client creation and signup routes -- catch `PrismaClientKnownRequestError` with code P2002 and return 409.

11. **Replace command palette mocks** with real API calls or clearly mark them as disabled/coming-soon in the UI.

12. **Convert critical Promise.all** to Promise.allSettled in: availability engine (Google Calendar fallback), health checks, integration status.

13. **Add logging to empty catch blocks** in number release and recurring schedule routes.

### Files to Touch
- `src/lib/automation-queue.ts` -- findings #02, #04
- `src/lib/automation-executor.ts` -- finding #03
- `src/app/error.tsx` (new) -- finding #01
- `src/app/sitter/error.tsx` (new) -- finding #01
- `src/app/client/error.tsx` (new) -- finding #01
- `src/app/api/auth/logout/route.ts` -- finding #05
- `src/app/api/messages/webhook/twilio/route.ts` -- finding #06
- `src/app/api/messages/webhook/openphone/route.ts` -- finding #07
- `src/app/api/webhooks/stripe/route.ts` -- finding #08
- `src/app/api/cron/expire-unpaid/route.ts` -- finding #09
- `src/lib/messaging/send.ts` -- finding #10
- `src/lib/availability/engine.ts` -- finding #11
- `src/lib/health-checks.ts` -- finding #12
- `src/app/api/integrations/status/route.ts` -- finding #13
- `src/app/api/clients/route.ts` -- finding #14
- `src/app/api/auth/signup/route.ts` -- finding #15
- `src/commands/commands.tsx` -- finding #17
- `src/commands/booking-commands.tsx` -- finding #18
- `src/app/api/numbers/[id]/release-from-twilio/route.ts` -- finding #19
- `src/app/api/ops/recurring-schedules/[id]/approve/route.ts` -- finding #20
- `src/lib/payout/payout-queue.ts` -- finding #21
