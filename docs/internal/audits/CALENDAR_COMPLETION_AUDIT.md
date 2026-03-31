# Calendar Completion Audit

**Purpose:** Audit the calendar system across owner calendar, sitter schedule/calendar linkage, booking assignment consistency, conflict visibility, Google Calendar sync/repair, and day/week/month usability. Define the canonical calendar system and inform Phase 2 implementation.

**Status rubric:**
- **Complete** — Route/API/action/access/wiring present and operational
- **Partial** — Materially functional but has missing pieces or non-trivial gaps
- **Missing** — Feature/module not implemented
- **Broken** — Implemented surface exists but core behavior likely fails
- **Present but not wired end-to-end** — Page/feature exists but does not complete the system loop

**Do not touch Automations.** This audit is pre-implementation; no code changes.

---

## 1) /calendar

| Aspect | Status | Notes |
|--------|--------|--------|
| Route | **Partial** | `src/app/calendar/page.tsx` is the active owner calendar. Loads `/api/bookings` and `/api/sitters` when `NEXT_PUBLIC_ENABLE_CALENDAR_V1=true`. |
| Month view | **Complete** | `CalendarGrid` renders month grid with up to 3 bookings per day, selected-date list, booking drawer, filters (service, status, sitter, paid, etc.). |
| Day / Week view | **Partial** | Day and Week tabs exist and nav/state work; body shows **"Day view coming soon"** / **"Week view coming soon"** (`EmptyState`). Only month is implemented. |
| Filters | **Partial** | Filter bar includes `conflicts` key but **conflict filtering is not applied** in `filteredBookings` logic. |
| Data source | **Partial** | Real APIs used; if flag is off or endpoints fail, calendar shows empty arrays. |
| Legacy/backup | **Present but not wired** | `page-legacy.tsx`, `page-old-backup.tsx` contain richer conflict/month-agenda behavior not in active route. |

**Verdict:** **Partial** — One canonical owner route; month works; day/week are placeholders; conflict filter not wired.

---

## 2) Owner scheduling UX

| Aspect | Status | Notes |
|--------|--------|--------|
| New booking | **Complete** | "New Booking" → `/bookings/new`; form submits to `/api/form`. |
| Quick actions from calendar | **Partial** | Booking drawer + command launcher + Resonance suggestions (when `NEXT_PUBLIC_ENABLE_RESONANCE_V1`); jump today / prev/next period. |
| Assign sitter from calendar | **Present but not wired** | No direct "assign sitter" from calendar event; assignment flows live in Command Center and Assignments. |
| Today / Upcoming summary | **Complete** | Sidebar shows today count and upcoming list; click opens drawer. |

**Verdict:** **Partial** — Scheduling entry and summary exist; deep assign-from-calendar not in calendar UI.

---

## 3) Sitter schedule / calendar linkage

| Aspect | Status | Notes |
|--------|--------|--------|
| Sitter calendar route | **Partial** | `src/app/sitter/calendar/page.tsx` loads `/api/sitter/calendar`; shows list of upcoming bookings with Week/List toggle. |
| Week vs List | **Partial** | Toggle exists; **both render the same list** (no week grid). |
| Check-in / Check-out | **Partial** | Handlers call `/api/bookings/:id/check-in` and `check-out`; **buttons not rendered** in current card layout (state exists, no CTAs in card actions). |
| Daily Delight modal | **Present but not wired** | `DailyDelightModal` + `delightBooking` state; no trigger in card actions. |
| "Best route" card | **Present but not wired** | "Soon: the best route for your day" with `FeatureStatusPill`; placeholder. |
| Sitter today | **Complete** | `/sitter/today` is the strongest schedule UX: sections, check-in/out, SSE refresh, offline cache. |
| Link calendar ↔ booking | **Complete** | Sitter calendar links to `/sitter/bookings/:id` and inbox via `threadId`. |

**Verdict:** **Partial** — One sitter schedule surface (`/sitter/calendar`) and strong today view; week view and some CTAs not wired.

---

## 4) Conflict detection visibility

| Aspect | Status | Notes |
|--------|--------|--------|
| Assignment-window conflicts | **Complete** | `GET /api/assignments/conflicts` returns overlapping assignment windows (same thread). Owner-only. Used by `/assignments` (windows vs conflicts tab). |
| Sitter scheduling conflicts | **Partial** | Real conflict checks (bookings, block-off, Google busy, availability) live in `checkAssignmentAllowed` / `validateSitterAssignment` used by dispatch/force-assign; **no dedicated "calendar conflict" API** for owner calendar. |
| Owner calendar conflict display | **Broken** | Owner calendar has `conflicts` filter key but **does not filter by conflict**; legacy calendar had conflict warnings not in active page. |
| Command Center staffing | **Complete** | Command Center shows overlap/unassigned/coverage_gap and assign/rollback/snooze. |

**Verdict:** **Partial** — Assignment conflicts API and Command Center visibility work; owner calendar conflict filtering/warnings not wired; no unified conflict API for "sitter double-book" style.

---

## 5) Booking assignment vs calendar consistency

| Aspect | Status | Notes |
|--------|--------|--------|
| Assign → calendar sync | **Complete** | `forceAssignSitter` (dispatch-control) enqueues delete for previous sitter and upsert for new; accept route enqueues upsert. |
| Create booking → sync | **Complete** | Form route and event-queue-bridge: `booking.created` / `booking.assigned` / `sitter.assigned` → enqueue upsert. |
| Cancel → delete event | **Complete** | `booking.updated` with `status === 'cancelled'` → enqueue delete. |
| Reassign → delete old | **Complete** | Force-assign enqueues delete for previous sitter. |
| PATCH booking (status/sitterId) | **Partial** | `PATCH /api/bookings/[id]` updates status/sitterId but **does not emit booking events or enqueue calendar sync/delete**; calendar can drift. |
| Rollback (staffing resolve) | **Partial** | Rollback restores `sitterId`/dispatchStatus; **no calendar delete/upsert enqueued** for restored or removed sitter. |
| Other mutation points | **Partial** | Offers expire, staffing resolve assign path, etc.; not all paths emit or enqueue calendar. |

**Verdict:** **Partial** — Core assign/create/cancel/reassign paths enqueue sync; generic PATCH and rollback do not; consistency can drift.

---

## 6) Google Calendar sync surfaces

| Aspect | Status | Notes |
|--------|--------|--------|
| Sync engine | **Complete** | `src/lib/calendar/sync.ts`: `upsertEventForBooking`, `deleteEventForBooking`, `syncRangeForSitter`, `getGoogleBusyRanges`. One-way Snout → Google. |
| OAuth start/callback | **Complete** | `/api/integrations/google/start` (sitterId in state), `/api/integrations/google/callback`; stores tokens on Sitter. |
| RBAC / tenancy | **Partial** | Start/callback: sitter can only connect own; owner/admin any. Callback updates sitter by `id` only — **no orgId check**; sitter must be in same org by convention. |
| Toggle sync | **Complete** | `POST /api/sitters/[id]/calendar/toggle` (enabled boolean); owner/admin or sitter self. |
| Integrations status | **Complete** | `GET /api/integrations/status` returns `calendar.ready`, `connectedSitters`, `lastSyncAt`. |
| Legacy sync module | **Present but not wired** | `src/lib/calendar-sync.ts` has `syncBookingToGoogle` and stub `syncFromGoogle`; **not used** by queue or event bridge (canonical path is `calendar/sync.ts`). |

**Verdict:** **Partial** — Sync and repair surfaces complete; callback should enforce org scope for sitter update; legacy module is dead code.

---

## 7) Calendar repair flows

| Aspect | Status | Notes |
|--------|--------|--------|
| Repair API | **Complete** | `POST /api/ops/calendar/repair` (owner/admin, org-scoped); body: sitterId, optional start/end; enqueues `syncRange`. |
| Repair UI | **Complete** | `/ops/calendar-repair`: sitter select, date range, "Repair Sync"; shows jobId and range. |
| Command Center fix | **Complete** | Attention fix action can trigger repair for calendar_repair items. |
| Worker execution | **Complete** | Calendar worker runs `syncRangeForSitter`; logs `calendar.repair.succeeded` / failed. |

**Verdict:** **Complete** — One repair model: enqueue syncRange via API or Command Center; worker executes; RBAC and org-scoping in place.

---

## 8) Day / week / month modes

| Aspect | Status | Notes |
|--------|--------|--------|
| Owner calendar | **Partial** | Month implemented; day and week show "coming soon" empty state. View preference persisted in `localStorage` (`calendar-view`). |
| Sitter calendar | **Partial** | Week/List toggle; only list view implemented (no week grid). |
| Sitter today | **Complete** | Day-focused timeline with sections and actions. |

**Verdict:** **Partial** — Month (owner) and list/today (sitter) usable; owner day/week and sitter week grid missing.

---

## 9) Calendar-related APIs

| API | Status | Notes |
|-----|--------|--------|
| `GET /api/bookings` | **Complete** | Owner list; used by owner calendar. |
| `GET /api/sitters` | **Complete** | Owner list; used by calendar filters. |
| `GET /api/sitter/calendar` | **Complete** | Sitter’s upcoming bookings; RBAC sitter-only. |
| `GET /api/sitters/[id]/calendar` | **Complete** | Calendar status + upcoming for a sitter; owner/admin or sitter self. |
| `POST /api/sitters/[id]/calendar/toggle` | **Complete** | Enable/disable sync; owner/admin or sitter self. |
| `GET /api/assignments/conflicts` | **Complete** | Overlapping assignment windows; owner-only. |
| `POST /api/ops/calendar/repair` | **Complete** | Enqueue syncRange; owner/admin. |
| `GET /api/integrations/status` | **Complete** | Includes calendar readiness. |
| Google OAuth | **Complete** | Start + callback; token storage on Sitter. |
| Booking PATCH | **Partial** | No calendar event emission or enqueue. |
| Conflict API (sitter double-book) | **Missing** | No dedicated API returning "sitter X has overlapping Snout bookings in range" for calendar UI. |

**Verdict:** **Partial** — Core read/repair/OAuth exist; booking PATCH and unified conflict API gaps.

---

## 10) Queue / worker / sync dependencies

| Aspect | Status | Notes |
|--------|--------|--------|
| Calendar queue | **Complete** | `calendar-sync` BullMQ; job types: upsert, delete, syncRange; retries and dead-letter logging. |
| Worker | **Complete** | `initializeCalendarWorker()` in `calendar-queue.ts`; calls sync.ts; logs to EventLog and ops failures channel. |
| Bootstrap | **Complete** | `initializeQueues()` in `queue.ts` calls `initializeCalendarWorker()`. |
| Event bridge | **Complete** | `event-queue-bridge`: booking.created/updated/assigned, sitter.assigned → calendar enqueue; cancel → delete. |
| Worker deploy parity | **Broken** | `render.yaml` defines **web + db only**; no worker service. If worker is not run, calendar jobs enqueue but **never execute**. |
| Retry semantics | **Partial** | Sync.ts returns `{ action: 'skipped', error }` / `{ deleted: false, error }` instead of throwing on many failures; BullMQ retries/dead-letter not triggered for those. |
| Periodic reconciliation | **Missing** | No cron-style calendar sync; only event-driven + manual repair. |

**Verdict:** **Partial** — Queue and worker logic complete; deploy parity and throw-vs-return behavior need hardening; no scheduled repair.

---

## 11) Access control / tenancy

| Aspect | Status | Notes |
|--------|--------|--------|
| Owner calendar route | **Complete** | `/calendar` protected; owner nav; uses scoped booking/sitter APIs. |
| Sitter calendar route | **Complete** | `/sitter/calendar` and `/sitter/today` are sitter routes; APIs require sitter role / sitterId. |
| Repair API | **Complete** | `requireOwnerOrAdmin`; org-scoped db and sitter lookup. |
| Integrations status | **Complete** | Owner/admin only; orgId for Twilio/calendar/ai. |
| Google callback | **Partial** | Sitter update by `id` only; no explicit `where: { id: sitterId, orgId: ctx.orgId }` on update. |
| Dispatch/force-assign | **Partial** | Uses `prisma.booking.findUnique({ where: { id: bookingId } })` — **no orgId** in where; cross-org mutation possible if ID known. |

**Verdict:** **Partial** — Most routes and repair are correct; Google callback and dispatch booking lookup should enforce org.

---

## 12) Staging proof status

| Aspect | Status | Notes |
|--------|--------|--------|
| Calendar-specific signoff | **Missing** | No `docs/qa/calendar-final-signoff.md`. |
| Calendar verifier script | **Missing** | No `verify-calendar*.ts` or `verify:calendar` in package.json. |
| Staging runbook | **Missing** | STAGING_PROOF_RUNBOOK covers Payroll + Reports; calendar not included. |
| Indirect evidence | **Partial** | Command Center verifier and owner-v2 signoff include calendar_repair actions; integrations signoff records `calendar.ready: false`. |
| E2E calendar | **Partial** | `tests/e2e/calendar-interaction.spec.ts` exists; not in smoke pack; smoke-ops includes `/ops/calendar-repair` visibility. |

**Verdict:** **Partial** — Proof exists only indirectly; no dedicated calendar signoff or verifier.

---

## Canonical calendar system (target shape)

- **One owner calendar control surface**  
  Single route: `/calendar`. Month view implemented; day and week to be added. Filters (including conflicts when wired) and booking drawer are the main interaction. No duplicate owner calendar routes.

- **One sitter schedule surface**  
  Sitter-facing schedule: `/sitter/calendar` (list/week) and `/sitter/today` (day command center). Single schedule concept: same data from `/api/sitter/calendar` and today APIs; no competing sitter calendar routes.

- **One sync/repair model**  
  One-way Snout → Google. Single queue `calendar-sync` (upsert, delete, syncRange). Single repair entry: `POST /api/ops/calendar/repair` and Command Center fix action. Canonical sync logic in `src/lib/calendar/sync.ts` only; deprecate/remove `src/lib/calendar-sync.ts`.

- **One conflict model**  
  Assignment-window conflicts: `GET /api/assignments/conflicts` (overlap within thread). Extend or add a single place for “sitter scheduling conflicts” (double-book, Google busy, block-off) so owner calendar and Command Center can show one consistent picture.

- **One assignment/calendar consistency model**  
  All booking mutations that change sitter or status must emit events or enqueue calendar sync/delete so that Booking ↔ BookingCalendarEvent stay in sync. Single set of rules: create/assign → upsert; cancel/reassign → delete (old sitter) and upsert (new sitter); PATCH/rollback must trigger same enqueue logic.

- **Clear links booking ↔ calendar**  
  Owner calendar: event click → booking drawer/detail; New Booking from calendar. Sitter calendar/today: event → `/sitter/bookings/:id`. Repair and status APIs expose lastSyncedAt and readiness; integrations status shows calendar state. No duplicate or ambiguous “calendar” entrypoints.

---

## Summary table

| # | Area | Verdict |
|---|------|--------|
| 1 | /calendar | Partial |
| 2 | Owner scheduling UX | Partial |
| 3 | Sitter schedule/calendar linkage | Partial |
| 4 | Conflict detection visibility | Partial |
| 5 | Booking assignment vs calendar consistency | Partial |
| 6 | Google Calendar sync surfaces | Partial |
| 7 | Calendar repair flows | Complete |
| 8 | Day/week/month modes | Partial |
| 9 | Calendar-related APIs | Partial |
| 10 | Queue/worker/sync dependencies | Partial |
| 11 | Access control / tenancy | Partial |
| 12 | Staging proof status | Partial |

---

## Phase 2 — Implementation plan

Do not implement until approved. Grouped by:

### 1) Owner calendar route / UI

- **Canonical route:** `/calendar` only; remove or redirect any duplicate owner calendar routes.
- **Day view:** Implement day view (single-day grid or timeline) using same booking data and filters; remove "coming soon" for day.
- **Week view:** Implement week view (e.g. 7-day grid with time slots); remove "coming soon" for week.
- **Conflict filter:** Wire `filterValues.conflicts` into owner calendar data or conflict API so "show conflicts" filters or highlights conflicting bookings.
- **Optional:** Surface conflict badges or links from calendar events to Command Center / assignments when conflicts exist.
- **Feature flag:** Document or harden `NEXT_PUBLIC_ENABLE_CALENDAR_V1` so calendar does not silently show empty when off; consider defaulting on when bookings exist.

### 2) Booking / calendar data consistency

- **PATCH /api/bookings/[id]:** On status or sitterId change, emit booking.updated (or equivalent) and enqueue calendar sync (upsert for new sitter, delete for removed sitter) so calendar stays in sync.
- **Staffing rollback:** In `resolve` route rollback path, after restoring previous sitterId, enqueue calendar delete for the “current” sitter (who was assigned and is now rolled back) and upsert for the restored sitter.
- **Other mutation points:** Audit offers/expire, any other booking status/sitter changes; ensure each enqueues calendar sync/delete per canonical rules.
- **Single rule:** Any mutation that changes booking.sitterId or booking.status (e.g. to cancelled) must trigger the same event/enqueue logic as force-assign and event-queue-bridge.

### 3) Conflict detection + visibility

- **Unified conflict source:** Either extend `GET /api/assignments/conflicts` or add a dedicated endpoint (e.g. `GET /api/calendar/conflicts` or under assignments) that returns both assignment-window overlaps and sitter scheduling conflicts (double-book, block-off, Google busy) for a date range.
- **Owner calendar:** Consume conflict API in `/calendar` so conflict filter and/or badges work; ensure conflict list is scoped to org and date range.
- **Command Center:** Continue using existing staffing attention; ensure conflict data source is consistent with calendar so operators see one story.

### 4) Google sync / repair control flow

- **Tenancy in callback:** In Google OAuth callback, verify sitter belongs to caller’s org (e.g. `where: { id: sitterId, orgId }`) before updating; reject or redirect if not.
- **Dispatch/force-assign tenancy:** In `dispatch-control.ts` and resolve route, scope booking lookup by orgId (e.g. `getScopedDb(ctx).booking.findUnique` or add orgId to where) so cross-org mutation is impossible.
- **Sync failure behavior:** In `src/lib/calendar/sync.ts`, on Google API errors (other than 404 where appropriate), throw so the worker records a failed job and BullMQ retries; reserve return-object for intentional skips (e.g. no sitter, sync disabled).
- **Legacy module:** Remove or deprecate `src/lib/calendar-sync.ts`; ensure no imports remain; document canonical path as `src/lib/calendar/sync.ts`.
- **Optional:** Add a scheduled job (e.g. daily) to enqueue syncRange for connected sitters for next N days to self-heal drift.

### 5) Verifier / proof

- **Calendar signoff doc:** Add `docs/qa/calendar-final-signoff.md` with placeholders for health JSON, owner calendar load, sitter calendar load, repair run, and (optional) OAuth + sync check.
- **Calendar verifier script:** Add `scripts/verify-calendar.ts` (or similar): health, owner calendar 200, sitter calendar 200 (as sitter), repair POST 200, optional checks for integrations status calendar slice; output PASS/FAIL.
- **Staging runbook:** Extend `docs/qa/STAGING_PROOF_RUNBOOK.md` (or add calendar section) with steps to run calendar verifier and paste results into calendar signoff.
- **Smoke:** Consider adding calendar route(s) to smoke if not already; ensure repair page and calendar load are covered.

---

## Short summary (for approval)

- **Canonical calendar route:** Owner: `/calendar` (single control surface). Sitter: `/sitter/calendar` and `/sitter/today` (single schedule surface). Repair: `POST /api/ops/calendar/repair` and `/ops/calendar-repair` UI.

- **Biggest production risks:**  
  1) **Worker not deployed** — render.yaml has no worker service; calendar jobs may never run.  
  2) **Booking PATCH and rollback** not enqueueing sync → calendar drift.  
  3) **Dispatch/force-assign** booking lookup by id only → cross-org mutation possible.  
  4) **Sync return vs throw** — many Google failures don’t trigger retries/dead-letter.  
  5) **Owner calendar** shows day/week tabs but no implementation → user confusion.

- **What is real vs placeholder:**  
  **Real:** Month view, booking list and drawer, filters (except conflict), sitter calendar list, sitter today, repair API/UI, calendar queue/worker, event bridge for create/assign/cancel, OAuth and toggle, integrations status.  
  **Placeholder:** Owner day/week views, sitter week grid, “best route” and some sitter calendar CTAs, conflict filter on owner calendar, calendar accounts page (calls non-existent `/api/calendar/accounts`), legacy calendar-sync module.

- **Implementation order (recommended):**  
  1) **Consistency + tenancy** — PATCH/rollback enqueue; org-scope dispatch and Google callback (reduces drift and cross-org risk).  
  2) **Sync robustness** — throw on sync failures where appropriate; optional worker deploy parity in render/docs.  
  3) **Owner calendar** — day/week views; wire conflict filter (and conflict API if added).  
  4) **Conflict API + visibility** — unified conflict endpoint; wire calendar and Command Center.  
  5) **Cleanup** — remove/deprecate legacy calendar-sync; optional scheduled repair.  
  6) **Verifier + signoff** — script, signoff doc, runbook update; then run staging proof.

---

*Phase 2 implementation should start only after approval. Do not touch Automations.*
