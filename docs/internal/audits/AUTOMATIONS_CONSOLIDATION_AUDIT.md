# Automations Consolidation Audit

**Goal:** One owner automations control plane, one failure/debug surface, one trigger model, one worker path, one retry/dead-letter model. No building blindly—this audit defines current state, canonical decisions, and implementation order.

---

## 1. Route inventory

### 1.1 Owner-facing pages

| Route | Purpose | API dependencies | Backing |
|-------|--------|------------------|--------|
| **/automation** | Enterprise rebuild: toggle-based automation settings (bookingConfirmation, nightBeforeReminder, paymentReminder, sitterAssignment, postVisitThankYou, ownerNewBookingAlert). Templates + test message. | `GET/PATCH /api/settings` (body key `automation`), `POST /api/automation/test-message` | **Broken:** No top-level `/api/settings` route in repo; no `/api/automation/*` route. `/api/settings/notifications` etc. exist but not a single GET/PATCH `/api/settings` that returns/accepts `automation`. Test-message endpoint does not exist. |
| **/automations** | "Automations Control Center" list: list automations, stats, filter by trigger/status. Links to `/automations/[id]` (builder) and `/automations/new`. | `GET /api/automations`, `GET /api/automations/stats`, `GET /api/automations/[id]`, `DELETE /api/automations/[id]` | **Missing:** No `/api/automations` route tree exists in `src/app/api`. All calls 404. |
| **/automations/[id]** | Builder/detail: trigger + conditions + actions; save; uses trigger-registry, action-registry, condition-builder, template-system. | `GET/PATCH /api/automations/[id]`, `POST /api/automations` (create) | **Missing.** Same as above. |
| **/automation-center** | Alternative list: templates gallery, create from template, list automations, logs, enable/disable, "Run". | `GET /api/automations`, `GET /api/automations/templates`, `POST /api/automations/templates`, `GET /api/automations/logs`, `GET/PATCH/DELETE /api/automations/[id]`, `POST /api/automations/[id]/run` | **Missing.** No `/api/automations/*` routes. |
| **/automation-center/[id]** | Edit automation (conditions, actions). | Same as above. | **Missing.** |
| **/automation-center/new** | Create new automation (from template or blank). | `POST /api/automations` | **Missing.** |
| **/ops/automation-failures** | Failures / Dead / Success tabs; retry button per failure. SSE for live updates. | `GET /api/ops/automation-failures?tab=fail|dead|success`, `POST /api/ops/automation-failures/[eventLogId]/retry` | **Implemented.** Org-scoped, owner/admin only. |
| **/settings/automations/ledger** | Automation run ledger (audit). | `GET /api/automations/ledger?*` | **Missing.** No `/api/automations/ledger` route. |

### 1.2 Navigation / shell

- **OwnerAppShell:** "Automations" → `/automations`; "Automation Failures" → `/ops/automation-failures`. Active match: `/automations` or `/automation`.
- **AppShell** (shared): includes `/automation` in owner-visible items.
- **navigation.ts:** Duplicate entries: one "Automations" → `/automations`, one → `/automation`.
- **Command center:** Fix action for `automation_failure` links to `/ops/automation-failures?eventId=...`; "View failures" → `/ops/automation-failures`.
- **Diagnostics, dashboard, analytics, reports:** Link to `/ops/automation-failures`.

---

## 2. Automation APIs (existing)

| API | Purpose | Status |
|-----|--------|--------|
| **GET /api/ops/automation-failures** | List EventLog items: tab=fail (automation.failed), dead (automation.dead), success (automation.run.*). Org-scoped. | ✅ Exists. |
| **POST /api/ops/automation-failures/[eventLogId]/retry** | Re-enqueue job from event metadata (automationType, recipient, context). Idempotency check against automation.run.* success. | ✅ Exists. |
| **GET /api/analytics/trends/automation-failures** | Daily counts of automation.failed + automation.dead for charts. | ✅ Exists. |
| **Command center attention/fix** | POST to retry by actionEntityId (eventLogId); also enqueueAutomation for automation_failure type. | ✅ Wired. |

---

## 3. Automation APIs (missing / called by UI)

All under `/api/automations` or `/api/automation`; **none** of these route files exist in `src/app/api`:

- `GET /api/automations` — list
- `GET /api/automations/stats` — totalEnabled, runsToday, failuresToday
- `GET /api/automations/templates` — template gallery (optional category)
- `POST /api/automations/templates` — create from template
- `GET /api/automations/ledger` — run ledger (settings/automations/ledger page)
- `GET /api/automations/[id]` — get one
- `PATCH /api/automations/[id]` — update
- `DELETE /api/automations/[id]` — delete
- `POST /api/automations` — create
- `POST /api/automations/[id]/run` — manual run
- `GET /api/automations/logs?automationId=...` — logs for one automation
- `GET /api/settings` — global settings (including `automation` key) — **no single route**; only `/api/settings/notifications`, `/api/settings/business`, etc.
- `PATCH /api/settings` — update settings (including `automation`) — **no single route**
- `POST /api/automation/test-message` — send test SMS — **does not exist**

---

## 4. Worker and queue paths

| Component | Location | Role |
|-----------|----------|------|
| **Queue** | `src/lib/automation-queue.ts` | Queue name: `"automations"`. `enqueueAutomation(automationType, recipient, context, idempotencyKey?)`. Job name: `automation:{type}:{recipient}`. |
| **Worker** | Same file | `createAutomationWorker()` → processes job with `executeAutomationForRecipient(automationType, recipient, context)` from `automation-executor.ts`. Concurrency 5. |
| **Initialization** | `src/lib/queue.ts` → `initializeQueues()` | Calls `initializeAutomationWorker()` (and reminder scheduler, calendar). No separate "Automation queue ready" log; worker logs on completed/failed. |
| **Dead letter** | Same file | After 3 failed attempts, logs `automation.dead` to EventLog (with metadata for retry), publishes to ops failures channel. |
| **Retries** | BullMQ defaultJobOptions | attempts: 3, exponential backoff 2s. |

**Single worker path:** All automation execution goes through `automations` queue → `automation-executor` → EventLog (automation.run.*, automation.failed, automation.dead). No other automation worker path in this codebase.

---

## 5. Trigger model (current)

Triggers are **event-driven + scheduled**; there is no single “trigger registry” backing a CRUD API. Actual enqueue sites:

| Source | Event / trigger | Enqueued automations |
|--------|------------------|----------------------|
| **event-queue-bridge** | booking.status.changed → confirmed | bookingConfirmation (client, owner) |
| **event-queue-bridge** | visit.completed | postVisitThankYou (client, sitter); payout for sitter |
| **booking-events** | booking.created | ownerNewBookingAlert (client, owner) |
| **reminder-scheduler-queue** | reminder-tick per org (tomorrow’s bookings) | nightBeforeReminder (client, sitter) |
| **Stripe webhook** | payment_intent.succeeded (etc.) | payment-related automation |
| **form/booking create** | (Phase 3.3: no direct automation; event bridge / booking-events handle it) | Via event emitter + bridge |

**Trigger registry** (`src/lib/automations/trigger-registry.ts`): Rich list of trigger definitions (booking.created, booking.updated, booking.statusChanged, booking.assigned, payment.succeeded, etc.) used by **/automations builder UI only**. Not wired to any API or worker—only to the missing `/api/automations` CRUD. So: **one conceptual trigger set** (event names + scheduler), **one actual execution path** (queue → executor), but **two UX surfaces** (settings-style toggles on /automation vs builder-style on /automations/automation-center) and **no single source of truth** for “is this automation on/off” that the worker respects.

---

## 6. Template and settings persistence

| Surface | Intended store | Actual behavior |
|---------|----------------|----------------|
| **/automation page** | GET/PATCH `/api/settings` with `automation` key (nested: bookingConfirmation, nightBeforeReminder, etc.) | No `/api/settings` GET/PATCH in app. So load/save fail or hit a proxy that is not in this repo. |
| **Executor** | `automation-utils.ts`: `getAutomationSettings()` → returns `{}`. `getMessageTemplate()` → returns `null`. `shouldSendToRecipient()` → uses `isAutomationEnabled()` which reads from that empty object. | **All automations are effectively disabled** in executor: `shouldSendToRecipient` is false for every type, so every run is “skipped (disabled in settings)”. |
| **automation-settings-helpers** | Checksum/normalize helpers exist but are not used by any existing API. | No persistence path for automation toggles/templates that the worker reads. |
| **automation-center / automations** | Would use Automation model (or similar) via `/api/automations` | No API, no persistence. |

**Conclusion:** There is **no canonical persistence** for owner automation settings/templates that the worker uses. The only thing that works end-to-end is: **enqueue → worker runs → executor skips (disabled) or runs (if we had settings) → EventLog; failures visible on /ops/automation-failures; retry works.**

---

## 7. Retry and dead-letter model

| Aspect | Implementation |
|--------|----------------|
| **Failure logging** | Worker catch: `logAutomationRun(automationType, "failed", { orgId, bookingId, error, metadata })` → EventLog `automation.failed` with metadata (jobId, recipient, context) for retry. |
| **Dead letter** | After 3 attempts: `logEventFromLogger("automation.dead", ...)` with same metadata; publish to `channels.opsFailures(orgId)`. |
| **Retry** | POST `/api/ops/automation-failures/[eventLogId]/retry`: reads event metadata, enqueueAutomation(automationType, recipient, context, idempotencyKey). Idempotency: if automation.run.* success with same jobId exists, returns 409. |
| **Command center** | Fix action for automation_failure calls same retry API. |

**Single retry/dead-letter model:** EventLog (automation.failed, automation.dead) + ops retry API. No other retry path.

---

## 8. Summary table

| Area | Current state |
|------|----------------|
| **Owner control plane** | Fragmented: /automation (settings-style, broken API), /automations (builder list, no API), /automation-center (builder + templates, no API). |
| **Failure/debug surface** | Single: /ops/automation-failures + GET/POST retry API. Works. |
| **Trigger model** | One real model (events + reminder scheduler → enqueueAutomation). Builder trigger-registry is UI-only, not backed by API. |
| **Worker path** | One: automations queue → automation-executor. |
| **Retry/dead-letter** | One: EventLog automation.failed / automation.dead; retry via ops API; idempotency in retry. |
| **Template/settings persistence** | None that the worker uses. getAutomationSettings() returns {}. |

---

## 9. Canonical route decision

- **Single owner automations control plane (UI):** **/automations** as the canonical route.
  - Rationale: Name matches “Automations” in nav; supports list + detail + builder pattern; can host both “toggle by type” and “builder” in one place (tabs or sections). Prefer one route tree over three.
- **Canonical API prefix:** **/api/automations** (plural) for list, get, create, update, delete, stats, logs, ledger, templates, run. Implement under `src/app/api/automations/`.
- **Settings-backed toggles/templates:** Either (a) persist under existing org-scoped settings (e.g. extend a settings API with an `automation` key and have executor read it), or (b) back “automation types” by records in an Automation (or equivalent) model and have executor query that. One source of truth for “enabled + template per type” that the worker uses.
- **Failure surface:** Keep **/ops/automation-failures** and **/api/ops/automation-failures** as the single failure/debug surface. No duplicate “automation failures” under /automations.
- **Test message:** Implement **POST /api/automations/test-message** (or /api/automation/test-message) under the chosen API tree so the single control plane can send test messages.

---

## 10. Deprecated routes (after consolidation)

- **/automation** — Deprecate and redirect to canonical **/automations** (or a dedicated “Settings” tab/section under /automations). Remove or stub **POST /api/automation/test-message** in favor of **/api/automations/test-message** (or equivalent under canonical API).
- **/automation-center** — Deprecate; redirect to **/automations**. Merge “templates” and “create from template” into /automations (e.g. /automations/new?template=...).
- **/automation-center/[id]** — Redirect to **/automations/[id]**.
- **/automation-center/new** — Redirect to **/automations/new**.
- **Duplicate nav item** “Automations” → /automation in navigation.ts — Remove; single entry to /automations.

**Keep:** /ops/automation-failures, /api/ops/automation-failures, /api/ops/automation-failures/[eventLogId]/retry, /api/analytics/trends/automation-failures.

---

## 11. Biggest production risks

1. **Executor always “disabled”:** `getAutomationSettings()` returns `{}`, so `shouldSendToRecipient()` is always false. No automation type runs for recipients; only “skipped” results. Production behavior is “automations off” until a real persistence layer is wired and executor reads it.
2. **UI calling non-existent APIs:** /automations and /automation-center every fetch 404. Users see broken list, broken create/edit, broken run, broken ledger. Only /ops/automation-failures is reliable.
3. **/automation page:** Save and test-message call /api/settings and /api/automation/test-message; both missing or incomplete. Owners may believe they configured automations but nothing is persisted or used by the worker.
4. **Two “control plane” UIs:** /automation (toggles/templates) vs /automations (builder). Confusion and duplicate maintenance; no single place to “turn on” an automation that the worker respects.
5. **Worker not logging “Automation queue ready”:** Unlike calendar queue, automation worker does not emit a clear “ready” line in logs; harder to prove worker is alive for automations in staging.

---

## 12. Implementation order

1. **Persistence and executor (source of truth)**  
   - Define where automation on/off and per-type templates live (e.g. Setting.automation JSON or Automation table).  
   - Implement read path used by `automation-utils.ts` (getAutomationSettings, getMessageTemplate) so executor actually runs when enabled.  
   - Optionally: add checksum/validation (automation-settings-helpers) on save.

2. **Canonical API: /api/automations**  
   - Implement GET /api/automations (list), GET /api/automations/stats, GET/PATCH/DELETE /api/automations/[id], POST /api/automations (create).  
   - Back by same persistence as (1) or by Automation model if you introduce one.  
   - Add GET /api/automations/ledger (and optionally logs, templates, run) as needed for the single control plane.

3. **Canonical UI: /automations**  
   - Single control plane: list, detail, builder, “settings” (toggles/templates) as tabs or sections.  
   - Use only /api/automations/* and the chosen settings API.  
   - Add POST /api/automations/test-message (or /api/automation/test-message) and wire “Test message” in UI.

4. **Deprecate /automation and /automation-center**  
   - Redirects to /automations (and /automations/[id], /automations/new).  
   - Remove duplicate nav entry; single “Automations” → /automations.  
   - Remove or stub old /api/settings automation key and /api/automation/test-message once new API is in place.

5. **Failure surface and worker**  
   - Keep /ops/automation-failures as-is.  
   - Add a single “Automation queue ready” (or “Automations queue ready”) log line in worker startup (e.g. in queue.ts after initializeAutomationWorker()) for staging proof.

6. **Docs and runbooks**  
   - Document canonical route (/automations), single API prefix (/api/automations), single failure surface (/ops/automation-failures).  
   - Document trigger model (events + scheduler → enqueue; one worker path; one retry/dead-letter model).

---

## 13. Out of scope for this audit

- Changing the set of automation types (ownerNewBookingAlert, bookingConfirmation, nightBeforeReminder, etc.) or the executor switch.  
- Changing the event-emitter / event-queue-bridge contract.  
- Calendar or payout queues.  
- Settings/notifications or other non-automation settings routes.

---

*Next step: Stop and wait for approval of this audit, then proceed with implementation in the order above.*
