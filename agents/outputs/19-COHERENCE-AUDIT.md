# Agent 19 -- Cross-Portal Coherence Audit

Generated: 2026-03-29

---

## 1. Booking Status Vocabulary

### Comparison Table

| Status Value    | Owner Label (getStatusPill) | Owner Component                    | Sitter Label (status-colors.ts) | Sitter Component         | Client Label (status-colors.ts) | Client Component                        |
|-----------------|-----------------------------|------------------------------------|----------------------------------|--------------------------|---------------------------------|-----------------------------------------|
| `pending`       | "Pending"                   | `StatusChip` via `getStatusPill`   | "Pending"                        | inline `<span>` with `statusBadgeClass` | "Pending" (list) / via `AppStatusPill` (detail) | `statusDotClass` + `statusLabel` (list), `AppStatusPill` (detail) |
| `confirmed`     | "Confirmed"                 | `StatusChip` via `getStatusPill`   | "Upcoming" (status-colors.ts)    | inline `<span>` with `statusBadgeClass` | "Upcoming" (list/home) / "Confirmed" (detail via AppStatusPill) | mixed |
| `in_progress`   | "In Progress"               | `StatusChip` via `getStatusPill`   | "In progress"                    | inline `<span>` with `statusBadgeClass` | "In progress"              | `statusDotClass` + `statusLabel` (list), `AppStatusPill` (detail) |
| `completed`     | "Completed"                 | `StatusChip` via `getStatusPill`   | "Completed"                      | inline `<span>` with `statusBadgeClass` | "Completed"                | same |
| `cancelled`     | "Cancelled"                 | `StatusChip` via `getStatusPill`   | "Cancelled"                      | inline `<span>` with `statusBadgeClass` | "Cancelled"                | same |

### Sitter Today Page Override

The sitter `/sitter/today/page.tsx` has its own local `statusPillLabel()` function (line 86-98) that overrides the shared labels:
- `confirmed` -> "Upcoming" (matches `statusLabel()` from `status-colors.ts`)
- `pending` -> "Upcoming" (differs from every other portal -- both owner and client show "Pending")
- `in_progress` -> "Visit in progress" (differs from all others which show "In progress")
- `completed` -> "Visit complete" (differs from all others which show "Completed")

### Key Findings

**[INCONSISTENT] "confirmed" label differs between Owner and Sitter/Client**
- Owner portal (`getStatusPill`): "Confirmed"
- Sitter portal (`statusLabel`): "Upcoming"
- Client portal (`statusLabel` on list/home): "Upcoming"
- Client portal (`AppStatusPill` on detail page): "Confirmed" (because `AppStatusPill` uses `getStatusPill`, which returns "Confirmed")
- **Impact**: A confirmed booking shows as "Confirmed" in the owner portal and client detail, but "Upcoming" in the client list, client home, and sitter portal. The client sees BOTH labels depending on which page they are on.
- **Fix**: Agent 08 should unify. Either `statusLabel()` in `status-colors.ts` should return "Confirmed" (matching owner), or `getStatusPill()` should return "Upcoming" (matching client/sitter). Recommend aligning `statusLabel()` to return "Confirmed" since the owner portal is the source of truth, and "Upcoming" is ambiguous (it could mean pending or confirmed).

**[INCONSISTENT] "pending" label differs on sitter today page**
- Owner: "Pending"
- Sitter bookings page: "Pending" (via `statusLabel`)
- Sitter today page: "Upcoming" (via local `statusPillLabel`)
- Client: "Pending"
- **Impact**: A pending booking shows as "Upcoming" on the sitter today page, making it indistinguishable from confirmed bookings. Sitter cannot tell which bookings need confirmation.
- **Fix**: Agent 21 should remove the local `statusPillLabel` override in `/sitter/today/page.tsx` and use the shared `statusLabel()` or adopt `BookingStatusBadge`.

**[INCONSISTENT] "in_progress" capitalization and wording varies**
- Owner (`getStatusPill`): "In Progress" (capital P)
- Owner (`BookingStatusBadge`): "In progress" (lowercase p)
- Sitter bookings page (`statusLabel`): "In progress"
- Sitter today page (`statusPillLabel`): "Visit in progress"
- Client (`statusLabel`): "In progress"
- Client detail (`AppStatusPill` via `getStatusPill`): "In Progress" (capital P)
- **Impact**: Minor visual inconsistency, but "Visit in progress" on sitter today page adds context that does not match other portals.
- **Fix**: Agent 08 should standardize. `getStatusPill` should match `BookingStatusBadge` casing ("In progress").

**[INCONSISTENT] "completed" label on sitter today page**
- All portals: "Completed"
- Sitter today page: "Visit complete"
- **Fix**: Agent 21 should align sitter today page to use shared vocabulary.

---

## 2. BookingStatusBadge Consistency

### Component Inventory

There are **four** different status rendering mechanisms in the codebase:

1. **`BookingStatusBadge`** (`src/components/owner/BookingStatusBadge.tsx`) -- new canonical component for owner portal
   - Uses `StatusChip` with its own `STATUS_MAP`
   - Handles: pending, pending_payment, confirmed, in_progress, completed, cancelled, expired, no_show

2. **`getStatusPill()`** (`src/components/app/getStatusPill.ts`) -- legacy function used by owner enterprise bookings page and `AppStatusPill`
   - Maps same statuses but with different labels (e.g., confirmed -> "Confirmed" vs status-colors.ts -> "Upcoming")
   - Also handles payment, dispatch, and generic statuses

3. **`AppStatusPill`** (`src/components/app/AppStatCard.tsx`) -- wrapper around `getStatusPill()`
   - Used by client booking detail page (`/client/bookings/[id]`)

4. **`statusLabel()` / `statusBadgeClass()` / `statusDotClass()`** (`src/lib/status-colors.ts`) -- shared utility
   - Used by sitter bookings page, sitter today page, client bookings list, client home page
   - Different labels from `getStatusPill` for `confirmed` ("Upcoming" vs "Confirmed")

### Label Discrepancies Between Components

| Status       | BookingStatusBadge | getStatusPill | statusLabel (status-colors.ts) |
|-------------|-------------------|---------------|-------------------------------|
| pending     | "Pending"         | "Pending"     | "Pending"                     |
| confirmed   | "Confirmed"       | "Confirmed"   | **"Upcoming"**                |
| in_progress | "In progress"     | **"In Progress"** | "In progress"              |
| completed   | "Completed"       | "Completed"   | "Completed"                   |
| cancelled   | "Cancelled"       | "Cancelled"   | "Cancelled"                   |
| expired     | "Expired"         | (falls through to formatted) | (falls through) |
| no_show     | "No show"         | (falls through) | (falls through)             |
| pending_payment | "Awaiting payment" | (falls through) | (falls through)        |

**[INCONSISTENT] Two competing "canonical" status systems with different labels**
- `BookingStatusBadge` and `getStatusPill` disagree on casing for `in_progress`
- `statusLabel` disagrees on `confirmed` ("Upcoming" vs "Confirmed")
- Neither `getStatusPill` nor `statusLabel` handle `expired`, `no_show`, or `pending_payment` -- only `BookingStatusBadge` does
- **Fix**: Agent 08 should consolidate to ONE canonical source. `BookingStatusBadge.STATUS_MAP` should be the single source of truth. `getStatusPill` and `statusLabel` should either delegate to it or be replaced.

**[CONSISTENT] Color semantics are broadly aligned**
- All systems use warning/amber for pending, info/blue for confirmed, success/green for completed, danger/red for cancelled.
- Exception: `status-colors.ts` uses purple for `in_progress` while `BookingStatusBadge` uses info (blue). This is a deliberate design choice for the shared calendar/dashboard vs the badge component.

---

## 3. Availability Grid -> Booking Conflict Chain

### Chain Trace

1. **Grid Save**: `AvailabilityGrid.tsx` calls `useBulkReplaceAvailability()` which POSTs to `/api/sitter/availability/bulk`
2. **Bulk Route**: `POST /api/sitter/availability/bulk/route.ts` writes to `SitterAvailabilityRule` model (deletes all existing rules, creates new ones)
3. **Engine Read**: `src/lib/availability/engine.ts` -> `getAvailabilityWindows()` reads `SitterAvailabilityRule` at line 226: `db.sitterAvailabilityRule.findMany({ where: { orgId, sitterId, active: true } })`
4. **Conflict Check**: `src/lib/availability/booking-conflict.ts` -> `validateSitterAssignment()` calls `checkConflict()` from the engine, which reads `SitterAvailabilityRule`, `SitterAvailabilityOverride`, existing bookings, `SitterTimeOff`, and optionally Google busy blocks
5. **Smart Assign**: `GET /api/ops/bookings/[id]/smart-assign/route.ts` calls `rankSittersForBooking()` from `src/lib/matching/sitter-matcher.ts`

### Gaps Found

**[INCONSISTENT] Smart-assign does NOT use the availability engine for scoring**

The `sitter-matcher.ts` `scoreAvailability()` function (line 91-109) only checks for **booking conflicts** (overlapping bookings). It does NOT:
- Read `SitterAvailabilityRule` (the grid data)
- Read `SitterAvailabilityOverride`
- Read `SitterTimeOff`
- Check Google Calendar busy blocks
- Use the availability engine at all

This means a sitter could mark themselves unavailable on Monday mornings via the grid, but `smart-assign` would still suggest them for Monday morning bookings because it only checks for existing booking overlaps.

**Fix**: Agent 08 should replace the `scoreAvailability()` function in `sitter-matcher.ts` to use `checkConflict()` from `src/lib/availability/engine.ts` instead of the simple booking-overlap query. This is a critical logic gap.

**[CONSISTENT] Bulk route -> Engine read path is complete**

The bulk route correctly writes `SitterAvailabilityRule` records, and the engine correctly reads them. The `checkConflict()` function in the engine properly:
- Expands recurring rules into date-specific windows
- Applies overrides (blackout/additions)
- Subtracts existing bookings
- Subtracts time-off periods
- Optionally subtracts Google Calendar busy blocks
- Checks travel buffer between adjacent bookings

**[CONSISTENT] booking-conflict.ts correctly delegates to engine**

`validateSitterAssignment()` is a thin wrapper around `checkConflict()`, and `checkAssignmentAllowed()` adds force-override with audit logging. This chain is solid.

**[INCONSISTENT] Bulk route uses callback-based $transaction**

Line 41 of `src/app/api/sitter/availability/bulk/route.ts` uses `prisma.$transaction(async (tx) => {...})` which is the callback-based form. CLAUDE.md explicitly states: "Never use $transaction callback form -- use array form (see known bugs #3)". The comment in the code acknowledges this but claims the scoped proxy doesn't support it.

**Fix**: Agent 08 should refactor to array-based transaction or verify this specific route is immune to the `_engineConfig` bug.

---

## 4. Messaging Provider Adaptation

### What `canSendSms(orgId)` Returns

In `src/lib/messaging/availability.ts`, `isMessagingAvailable(orgId)`:
- Returns `true` when `messagingProvider` is `"twilio"` or `"openphone"`
- Returns `false` when `messagingProvider` is `"none"`
- Defaults to `true` when no config row exists (backward compatibility)

`messagingProvider` in `OrgIntegrationConfig` controls: `"none" | "twilio" | "openphone"`

### Portal-by-Portal Analysis

**Owner Portal (/messaging)**

**[INCONSISTENT] Owner messaging page does NOT check messagingProvider**

`src/app/messaging/page.tsx` unconditionally renders `InboxView` and `SittersPanel`. There is no check for `messagingProvider`. When `messagingProvider="none"`:
- The inbox will attempt to load threads that may rely on SMS-based messaging
- The Twilio/OpenPhone setup sub-pages redirect to settings, which is correct
- But the main `/messaging` page shows Inbox and Sitters tabs regardless of provider state

Per CLAUDE.md: "When a provider is not configured: Its setup panels are hidden, Its monitoring panels are hidden, Its number management panels are hidden."

**Fix**: Agent 20 should add provider-awareness to `/messaging/page.tsx` -- when `messagingProvider="none"`, show an in-app-only inbox or a message explaining that SMS is not configured.

**Sitter Portal (/sitter/inbox)**

**[CONSISTENT] Sitter inbox gracefully handles no provider**

The sitter inbox (`src/app/sitter/inbox/page.tsx`) works with in-app messaging threads. It fetches threads via `useSitterThreads()` and renders messages. When no SMS provider is configured:
- Threads still exist as in-app message objects
- The UI shows "No active assignments" empty state when no threads exist
- The compose area is gated by `isWindowActive` (assignment window), not by provider
- No Twilio/OpenPhone-specific UI is shown

This works correctly because the sitter inbox is designed around the `MessageThread` model, which is provider-agnostic.

**Client Portal (/client/messages)**

**[CONSISTENT] Client messages page gracefully handles no provider**

`src/app/client/messages/page.tsx` fetches threads via `useClientMessages()` and renders them. When no threads exist (which would be the case if messaging is in-app only):
- Shows "No messages yet" empty state with helpful copy
- Provides "Book a visit" CTA
- No provider-specific UI is shown

This degrades gracefully.

**Notification Triggers**

**[CONSISTENT] All notification triggers check `canSendSms()` before sending**

Every trigger in `src/lib/notifications/triggers.ts` calls the local `canSendSms()` helper (which delegates to `isMessagingAvailable()`) before attempting SMS delivery. When `messagingProvider="none"`, SMS is skipped and the trigger falls back to email and/or in-app notification. This is verified across all 15+ trigger call sites.

---

## 5. Notification Timing (Client Portal Real-Time Updates)

### Client Booking Detail Page (`/client/bookings/[id]`)

**[CONSISTENT] Uses SSE for real-time updates**

Line 54: `useSSE('/api/realtime/client/bookings', () => refetchRef.current(), true);`

- Subscribes to `channels.clientBooking(orgId, clientId)` via the SSE endpoint at `/api/realtime/client/bookings`
- Any booking status change (visit started, completed, sitter changed, report posted) triggers a refetch
- This means when the owner confirms a booking, the client detail page updates in real-time if the server publishes to the channel

### Client Bookings List Page (`/client/bookings`)

**[INCONSISTENT] No SSE, no polling, no refetchInterval**

`useClientBookings()` in `client-hooks.ts` (line 302-310) has no `refetchInterval` option set. The bookings list page:
- Fetches on mount only
- Has a manual "ClientRefreshButton" for pull-to-refresh
- Does NOT use SSE
- Does NOT poll

When the owner confirms a booking, the client bookings list will NOT update until the user:
1. Manually refreshes (pull button), or
2. Navigates away and back, or
3. Reloads the page

**Fix**: Agent 22 should add `refetchInterval: 60000` (or similar) to `useClientBookings()`, or wire up SSE on the bookings list page to match the detail page pattern.

### Client Home Page (`/client/home`)

**[CONSISTENT] Uses polling via refetchInterval**

`useClientHome()` in `client-hooks.ts` (line 286-292) has `refetchInterval: 45000` (45 seconds). The home page automatically refreshes every 45 seconds, so booking status changes will appear within ~45 seconds.

This is adequate for the home page dashboard context but is NOT real-time.

---

## Summary of All Findings

### Inconsistencies (Requiring Fixes)

| # | Finding | Severity | Fix Owner |
|---|---------|----------|-----------|
| 1 | [FIXED] `confirmed` status — unified to "Confirmed" everywhere (was "Upcoming" in client list/sitter) | P2 | Agent 08 |
| 2 | [FIXED] Sitter today page local override removed, now uses shared `statusLabel` | P2 | Agent 08 |
| 3 | [FIXED] `getStatusPill` casing normalized to "In progress" (was "In Progress") | P3 | Agent 08 |
| 4 | [FIXED] Status systems consolidated: `statusLabel`, `getStatusPill`, `BookingStatusBadge` now all agree on labels | P2 | Agent 08 |
| 5 | [FIXED] Smart-assign now uses full availability engine (`checkConflict`) — checks rules, overrides, bookings, time-off. Unavailable sitters ranked last with reason, still selectable for override. | **P1** | Agent 08 |
| 6 | [FIXED] Bulk availability route converted to array-based `$transaction` | P2 | Agent 08 |
| 7 | [FIXED] Owner `/messaging` now conditionally hides Sitters tab + shows info banner when `messagingProvider="none"` | P2 | Agent 08 |
| 8 | [FIXED] Client bookings list now polls every 30s (`refetchInterval: 30000`) | P2 | Agent 08 |

### Consistencies (Working Correctly)

| # | Finding |
|---|---------|
| 1 | Color semantics (warning=pending, info/blue=confirmed, success=completed, danger=cancelled) are aligned across all portals |
| 2 | Availability engine correctly reads SitterAvailabilityRule, overrides, time-off, bookings, and Google busy |
| 3 | `booking-conflict.ts` -> `validateSitterAssignment()` properly delegates to engine |
| 4 | All notification triggers check `canSendSms()` before SMS delivery |
| 5 | Sitter inbox works gracefully when no messaging provider is configured |
| 6 | Client messages page degrades gracefully with no provider |
| 7 | Client booking detail page uses SSE for real-time updates |
| 8 | Client home page polls every 45 seconds for fresh data |
| 9 | Bulk availability route -> engine read path is complete (grid data does get persisted and read) |

---

## Priority Fix Recommendations

### P1 -- Must Fix Before Next Release
- **Smart-assign availability gap** (Finding #5): Sitters will be suggested for bookings during times they marked as unavailable. This directly undermines the availability grid feature and will cause scheduling errors.

### P2 -- Fix in Next Sprint
- **Status vocabulary consolidation** (Findings #1-4): Unify to one source of truth. Recommended approach: make `BookingStatusBadge.STATUS_MAP` the canonical map, export it, and have all other consumers reference it.
- **Owner messaging provider adaptation** (Finding #7): Add provider check to `/messaging` page.
- **Client bookings list freshness** (Finding #8): Add polling or SSE.
- **Bulk route transaction pattern** (Finding #6): Verify or refactor.

### P3 -- Polish
- **Casing normalization** (Finding #3): "In Progress" vs "In progress" -- trivial fix in `getStatusPill`.
