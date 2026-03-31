# 07-OBSERVABILITY-AUDIT.md
# Agent 07 (The Observability Auditor) -- Snout OS
# Generated: 2026-03-29

---

## Executive Summary

Snout OS has foundational observability pieces -- a structured logger, an EventLog persistence layer, queue job record tracking, a health endpoint, and Sentry integration. However, critical gaps exist in **request tracing continuity**, **alerting for production incidents**, **webhook idempotency**, and **business metric derivability**. The system can tell you *what happened* after manual investigation but cannot proactively tell you *something is wrong* at 2am.

---

## 1. LOGGING COVERAGE

### What Exists
- **Structured logger** at `src/lib/logger.ts`: JSON-context `log.info/warn/error` with `requestId`, `orgId`, `userId`, `route`, `durationMs` fields.
- **Event persistence layer** at `src/lib/log-event.ts`: `logEvent()` writes to `EventLog` model in Postgres. Fire-and-forget, never throws.
- **Messaging-specific logging helpers** at `src/lib/messaging/logging-helpers.ts`: PII-redacting webhook log formatter, phone number masking.
- **logEvent is widely adopted**: imported in 50+ API route files for critical actions (payments, bookings, webhooks, exports, etc.).

### Findings

**[01] [SEVERITY: P2] [src/lib/logger.ts:*] Structured logger exists but is virtually unused**
The `log` utility from `src/lib/logger.ts` is imported in exactly 1 API route file (`src/app/api/upload/report-media/route.ts`). Meanwhile, 103 API route files use raw `console.log/error/warn` with 218+ total occurrences, and 88 lib files use raw console with 265+ occurrences. The structured logger is dead code in practice. Logging is overwhelmingly ad-hoc unstructured strings like `console.error('[Stripe Webhook] Error:', error)`.

**[02] [SEVERITY: P2] [src/lib/log-event.ts:36-44] EventLog model has no correlationId column**
The `logEvent()` function accepts a `correlationId` parameter (line 19: "preserved for call-site compatibility") but **never persists it**. The `EventLog` Prisma model (`prisma/schema.prisma:1273-1288`) has no `correlationId` field. Any call site passing `correlationId` to `logEvent` is silently discarding it. This makes cross-system trace correlation impossible via EventLog.

**[03] [SEVERITY: P3] [src/lib/messaging/logging-helpers.ts:102-128] safeLog has a recursive bug**
`safeLog` calls itself recursively for nested objects (line 116: `redacted[key] = safeLog('log', value)`) but `safeLog` returns `void`, so it assigns `undefined` to nested object keys. The immediate next line overwrites this with a JSON parse fallback, but the recursion is wasted work and the function signature is incorrect for the intended use.

---

## 2. REQUEST TRACING

### What Exists
- **correlationId generation** at `src/lib/correlation-id.ts`: Extracts from `x-correlation-id` / `x-request-id` headers, falls back to `randomUUID()`.
- **RequestContext includes correlationId** at `src/lib/request-context.ts:61`: Every authenticated request gets a `correlationId`.
- **Queue jobs preserve correlationId**: `src/lib/queue-observability.ts` extracts from job data and persists to `QueueJobRecord.correlationId`.

### Findings

**[04] [SEVERITY: P1] [src/lib/request-context.ts:61 -> src/lib/log-event.ts:36] correlationId is generated but rarely propagated end-to-end**
The full booking creation flow: API call (`/api/form/route.ts`) -> `emitBookingCreated()` -> automation queue -> notification triggers -> SMS/email send. Tracing this:
- `/api/form/route.ts`: calls `getPublicOrgContext()` which generates a `correlationId` -- but the route never passes it to `logEvent()`, `emitBookingCreated()`, or `enqueueCalendarSync()`.
- `src/lib/notifications/triggers.ts`: Zero occurrences of `correlationId` in the entire file. All 21+ notification trigger functions log failures with `console.error` only.
- `src/lib/event-emitter.ts`: No correlationId propagation to event handlers.
- Only 1 API route (`/api/ops/calendar/repair/route.ts`) actually passes `ctx.correlationId` to `logEvent()`.
- The booking update routes (`/api/bookings/[id]/route.ts`, check-in, check-out) DO propagate correlationId to emit functions. But the initial creation path does not.

**Result**: You cannot trace a single booking from form submission through to the DB write, queue job, and notification send. The correlationId exists at the request boundary and inside QueueJobRecords, but the bridge between them (EventLog, notification triggers, event emitter) drops it entirely.

---

## 3. QUEUE JOB VISIBILITY

### What Exists
- **QueueJobRecord model** (`prisma/schema.prisma:1306`): Full lifecycle tracking (QUEUED -> RUNNING -> SUCCEEDED/FAILED/DEAD_LETTERED) with retryCount, lastError, providerErrorCode, correlationId, payloadJson.
- **`attachQueueWorkerInstrumentation()`** (`src/lib/queue-observability.ts:198-215`): Auto-attaches active/completed/failed listeners to workers, recording state transitions.
- **Ops failures page** (`/ops/failures`): UI showing failed/dead-lettered QueueJobRecords with filters for status, subsystem, resourceType, correlationId, date range.
- **Automation failures page** (`/ops/automation-failures`): Separate UI for failed automations from EventLog.
- **Health endpoint stale job check** (`/api/health/route.ts:62-69`): Counts QUEUED jobs older than 10 minutes (excluding cron schedules) to detect worker stalls.
- **`getWorkerStatus()`** (`src/lib/health-checks.ts:62`): Returns waiting/active/completed/failed counts for all 5 queue types (automations, automations.high, reminders, daily-summary, reconciliation).
- **Real-time failure SSE** (`/api/realtime/ops/failures/route.ts`): Pushes queue failure events to owner dashboard.

### Findings

**[05] [SEVERITY: P2] [src/lib/health-checks.ts:139] Worker health is inferred, not confirmed**
`getWorkerStatus()` returns `hasWorkers: true` based solely on whether Redis/BullMQ queues are reachable. This does NOT confirm workers are actually processing jobs. If the worker process crashes but Redis is up, this returns a false positive. The health endpoint's stale job check (`/api/health`) partially addresses this (10-minute threshold), but there is no worker heartbeat mechanism.

**[06] [SEVERITY: P2] [src/lib/health-checks.ts:62-162] getWorkerStatus creates new connections on every call**
Each call to `getWorkerStatus()` creates a new IORedis connection and 5 new BullMQ Queue instances, queries them, then closes them all. This is expensive and could cause connection churn under load. It is not called from the health endpoint (which uses the stale-job-count approach instead), but if any future code calls it frequently, it will cause problems.

**[07] [SEVERITY: P3] [src/app/api/health/route.ts:52-58] Health endpoint excludes cron job names but list may drift**
The `CRON_SCHEDULE_JOB_NAMES` hardcoded list must stay in sync with actual cron job names across `src/lib/queue.ts`, `src/lib/reminder-scheduler-queue.ts`, `src/lib/calendar-queue.ts`, and `src/lib/pool-release-queue.ts`. Any new cron job not added here will cause false "degraded" status.

---

## 4. WEBHOOK RECEIPT LOGGING

### What Exists
- **Twilio webhook** (`/api/messages/webhook/twilio/route.ts`): Logs multiple event types via `logEvent()` (invalid signature, org unresolved, number not found, opt-in/out, inbound received). Has duplicate detection via `messageSid` lookup in `messageEvent`.
- **OpenPhone webhook** (`/api/messages/webhook/openphone/route.ts`): Logs inbound received and invalid signature. Has duplicate detection via `messageSid` lookup.
- **Stripe webhook** (`/api/webhooks/stripe/route.ts`): Logs payment events via `logEvent()` (payment.completed, payment.failed, tip.transferred, tip.transfer_failed, payout.transfer_failed, etc.). Verifies webhook signature.

### Findings

**[08] [SEVERITY: P1] [FIXED] [src/app/api/webhooks/stripe/route.ts:*] Stripe webhook has no event-level idempotency guard**
Stripe can (and does) deliver the same webhook event multiple times. The Twilio webhook deduplicates via `messageSid` lookup, but the Stripe webhook has **zero deduplication logic**. There is no check for `event.id` having been processed before. If `payment_intent.succeeded` fires twice:
- `persistPaymentSucceeded` may create duplicate charge records
- `onBookingConfirmed` may fire twice, sending duplicate confirmation messages
- `enqueueAutomation` may queue duplicate automation jobs
- `notifySitterPaymentReceived` may send duplicate SMS to sitter
The `transfer_id` metadata check on tip transfers (line 162) is a partial guard for tip-specific double-transfer, but the broader payment flow has no protection.

**[09] [SEVERITY: P2] [src/app/api/webhooks/stripe/route.ts:*] Stripe webhook does not log raw event type or event.id**
The Stripe webhook handler logs downstream actions (payment.completed, tip.transferred) but does NOT log the raw Stripe event receipt itself (event.id, event.type, timestamp). If you need to audit "did we receive Stripe event evt_xxx?" there is no record. Twilio webhook similarly does not log the raw body -- only derived events.

**[10] [SEVERITY: P2] [src/app/api/messages/webhook/openphone/route.ts:100] OpenPhone webhook silently swallows org resolution failures**
Lines 86-100: If the `messageAccount` lookup fails, the catch block is empty (`catch {}`), and fallback is `orgId = 'default'`. If the org resolution logic throws an unexpected error, the webhook silently continues with `orgId = 'default'`, potentially routing messages to the wrong org with no log entry about the error.

---

## 5. HEALTH CHECKS

### What Exists
- **`/api/health` endpoint** (`src/app/api/health/route.ts`): Checks DB (SELECT 1), Redis (PING), and worker liveness (stale QUEUED jobs). Returns structured JSON with `status`, `db`, `redis`, `workers`, `version`, `commitSha`, `buildTime`, `envName`, `runtimeDiagnostics`. Supports HEAD for lightweight pings.

### Findings

**[11] [SEVERITY: P1] [src/app/api/health/route.ts:*] Health endpoint does not check external service reachability**
The health endpoint checks DB and Redis, but does NOT check:
- **Stripe API** reachability (payment processing)
- **Twilio/OpenPhone API** reachability (messaging)
- **Resend API** reachability (email delivery)
- **Google Calendar API** reachability (calendar sync)
- **AWS S3** reachability (file storage)

If Twilio goes down, the health endpoint still returns `status: "ok"`. The only way to discover external service failures is when an operation fails and logs an error. For a system where messaging is the primary customer interaction channel, this is a significant blind spot.

**[12] [SEVERITY: P2] [src/app/api/health/route.ts:27] Health endpoint always returns 200**
Even when `status: "error"` (DB is down), the HTTP response is 200 OK with the error in the JSON body. External monitoring tools (Render health checks, uptime monitors) that check HTTP status codes will never trigger alerts. This should return 503 when status is "error".

---

## 6. ERROR ALERTING

### What Exists
- **Sentry integration**: Server (`sentry.server.config.ts`), edge (`sentry.edge.config.ts`), and client (`instrumentation-client.ts`). Also worker-specific (`worker-sentry.ts`).
- **Client error boundary** (`global-error.tsx`): Captures unhandled React errors to Sentry.
- **Worker error capture** (`worker-sentry.ts`): `captureWorkerError()` with tags for jobName, orgId, bookingId, correlationId. Used in `automation-queue.ts` and `calendar-queue.ts`.
- **In-app alert system** (`src/lib/messaging/alert-helpers.ts`): Persists operational alerts to EventLog with deduplication (24h window). Ops diagnostics page links to failure views.
- **Real-time SSE** for ops failures: Pushes queue failures and EventLog failure events to owner dashboard.
- **Owner SMS notification** (`src/lib/automation-owner-notify.ts`): Sends SMS to `OWNER_PERSONAL_PHONE` for every automation execution.

### Findings

**[13] [SEVERITY: P0] [*] No external alerting for P0 errors at 2am**
If the database goes down, the worker crashes, or Stripe webhooks start failing at 2am:
- **Sentry** will capture errors IF the DSN is configured, but there is no evidence of Sentry alerting rules (PagerDuty, Slack, email integration). Sentry without alert rules is a log viewer, not an alerting system.
- **The owner SMS notification** (`automation-owner-notify.ts`) only fires for successful automations, not for system errors.
- **The in-app alert system** (`alert-helpers.ts`) writes to EventLog, but there is no push notification, email, or SMS triggered by alert creation. Alerts sit in the database until someone opens the ops diagnostics page.
- **SSE streams** only work if someone has the ops dashboard open in a browser tab.
- **The health endpoint** returns 200 even when DB is down, so external monitors would not trigger.

**Net effect**: A P0 production outage will sit silently until someone manually checks Sentry or the ops dashboard the next morning.

**[14] [SEVERITY: P2] [src/sentry.server.config.ts:9] Sentry tracesSampleRate is 10% in production**
Only 10% of server transactions are traced. For a low-traffic early-stage SaaS, this means most production errors lack trace context. Combined with no Sentry alerting rules, debugging production issues requires correlating sparse traces with unstructured console.error logs.

**[15] [SEVERITY: P2] [src/sentry.edge.config.ts:*] Edge Sentry has no tracesSampleRate set**
The edge config (`sentry.edge.config.ts`) does not set `tracesSampleRate` at all, meaning 0% of edge function transactions are traced. Middleware-level errors (auth, rate limiting, role routing) have no performance trace data.

**[16] [SEVERITY: P2] [src/lib/worker-sentry.ts:12-16] Worker Sentry has no tracesSampleRate or integrations**
The worker process Sentry init is minimal: just `dsn` and `environment`. No `tracesSampleRate`, no `beforeSend`, no performance monitoring. Worker errors are captured via explicit `captureWorkerError()` calls, but only 2 files use it (`automation-queue.ts`, `calendar-queue.ts`). Other queue processors (reminders, pool release, SRS, outbound messages) do NOT call `captureWorkerError` on failure.

---

## 7. BUSINESS EVENT TRACKING

### What Exists
- **EventLog model**: Records booking.created, payment.completed, payment.failed, message.sent, automation.run, etc. with timestamps.
- **Analytics KPI endpoint** (`/api/analytics/kpis`): Real-time DB queries for revenue (today/week/month), booking counts, completed/cancelled counts with trend percentages.
- **Analytics trend endpoints**: Booking trends, revenue trends, payout volume, message volume, automation failures -- all from real DB data.
- **BookingStatusHistory model**: Records status transitions with timestamps, changedBy, and reason.

### Findings

**[17] [SEVERITY: P2] [*] "How many bookings were created today?" -- Answerable but not surfaced operationally**
The data exists in the Booking table (`createdAt >= today`). The KPI endpoint provides it. But there is no daily summary email, no Slack notification, no dashboard push. The owner must actively open the analytics page.

**[18] [SEVERITY: P1] [*] "What % of notifications successfully delivered?" -- Not answerable**
Notification triggers (`src/lib/notifications/triggers.ts`) are fire-and-forget. They:
- Log failures to `console.error` (21 different failure log lines)
- Do NOT record success/failure to EventLog consistently
- Do NOT track delivery rates
- The `messageEvent.deliveryStatus` field tracks SMS delivery for Twilio (via webhook status callbacks), but there is no aggregate view of notification delivery success rate across all channels (SMS + email + push + in-app).
- Email delivery (`sendEmail` via Resend) has no delivery tracking.
- Push notification delivery (`push-dispatch.ts`) logs errors to console but has no success tracking.

**[19] [SEVERITY: P2] [*] "Average time from booking created to booking confirmed?" -- Derivable but not computed**
`BookingStatusHistory` records transitions with timestamps. The data to compute `AVG(confirmed_at - created_at)` exists in principle. However:
- No API endpoint computes this metric.
- No dashboard displays it.
- The computation would require joining BookingStatusHistory (fromStatus='pending', toStatus='confirmed') with the Booking table. It is a multi-step SQL query that has never been written.

---

## Summary Table

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 01 | P2 | `src/lib/logger.ts` | Structured logger exists but used in 1 of 103+ API routes |
| 02 | P2 | `src/lib/log-event.ts:19,36` | EventLog silently discards correlationId (no DB column) |
| 03 | P3 | `src/lib/messaging/logging-helpers.ts:116` | safeLog recursive bug (returns void, assigns undefined) |
| 04 | P1 | `request-context.ts` -> `log-event.ts` | correlationId generated but dropped across booking flow |
| 05 | P2 | `src/lib/health-checks.ts:139` | Worker health inferred from Redis, not actual processing |
| 06 | P2 | `src/lib/health-checks.ts:62` | getWorkerStatus creates new Redis connections per call |
| 07 | P3 | `src/app/api/health/route.ts:52` | Cron job name exclusion list may drift from actual job names |
| 08 | P1 | `src/app/api/webhooks/stripe/route.ts` | No Stripe event-level idempotency (duplicate processing risk) |
| 09 | P2 | `src/app/api/webhooks/stripe/route.ts` | Raw Stripe event.id not logged for audit trail |
| 10 | P2 | `src/app/api/messages/webhook/openphone/route.ts:100` | Org resolution failures silently swallowed |
| 11 | P1 | `src/app/api/health/route.ts` | No external service health checks (Stripe, Twilio, etc.) |
| 12 | P2 | `src/app/api/health/route.ts:27` | Always returns HTTP 200 even when status is "error" |
| 13 | P0 | `*` | No external alerting mechanism for production incidents |
| 14 | P2 | `src/sentry.server.config.ts:9` | 10% trace sample rate loses 90% of production context |
| 15 | P2 | `src/sentry.edge.config.ts` | Edge Sentry has 0% trace rate (no tracesSampleRate set) |
| 16 | P2 | `src/lib/worker-sentry.ts:12` | Worker Sentry minimal; most queue processors skip captureWorkerError |
| 17 | P2 | `*` | Booking creation count exists but not pushed proactively |
| 18 | P1 | `src/lib/notifications/triggers.ts` | Notification delivery success rate not tracked |
| 19 | P2 | `*` | Booking-to-confirmation time derivable but not computed |

**Severity distribution**: 1x P0, 4x P1, 12x P2, 2x P3

---

## HANDOFF NOTE TO AGENT 08

### Observability gaps that block safe execution:

1. **No production alerting (P0)**: If you deploy code that breaks payments, messaging, or booking creation, nobody will know until a customer complains or someone manually checks Sentry/ops dashboard the next day. Before any risky deployment, Sentry alerting rules (email at minimum, Slack/PagerDuty preferred) must be configured, and the health endpoint must return non-200 status codes for error states so Render health checks can trigger.

2. **Stripe webhook idempotency gap (P1)**: Any retry or duplicate delivery of `payment_intent.succeeded` can trigger duplicate booking confirmations, duplicate automation jobs, and duplicate SMS notifications. If Agent 08 is touching payment or booking flows, this is a live data corruption risk.

3. **Broken request tracing (P1)**: You cannot trace a booking from form submission through to notification delivery. If a customer reports "I submitted a booking but never got a confirmation," there is no single correlationId to search for. Debugging requires manual cross-referencing of timestamps across EventLog, QueueJobRecord, MessageEvent, and console logs.

4. **Notification delivery blind spot (P1)**: There is no way to know what percentage of SMS, email, or push notifications actually reached the recipient. If a messaging provider silently starts failing, the only signal is customer complaints.

5. **Health endpoint false positives (P2)**: The health endpoint returns HTTP 200 even when DB is down. External monitoring tools (Render, uptime monitors) will not trigger alerts. Combined with #1, this means the system can be fully down with all monitors showing green.

**Bottom line**: The system has good *internal* instrumentation for individual subsystems (queue jobs, event logs, webhook processing) but lacks the *connective tissue* (correlationId propagation, delivery tracking) and *external alerting* (Sentry rules, proper health check HTTP codes) needed to operate safely in production. Any changes to critical paths (payments, notifications, booking creation) carry higher risk than necessary because failures will not be detected promptly.
