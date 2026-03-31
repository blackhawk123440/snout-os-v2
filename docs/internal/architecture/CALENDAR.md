# Calendar Conflict Policy & Sync

## Source of Truth

**Snout OS is the source of truth for bookings and visits.** Google Calendar is a **mirror** for visibility only. We do not allow Google edits to override Snout OS data.

## Conflict types (do not conflate)

| Term | Meaning | Where used |
|------|--------|------------|
| **Calendar conflict** | Same sitter + overlapping time + non-cancelled bookings only. | Calendar page filter; Command Center “schedule conflicts” link; `GET /api/bookings/conflicts`. |
| **Assignment-window conflict** | Overlapping assignment windows (same thread). | Assignments → Conflicts tab; `GET /api/assignments/conflicts`. |
| **Availability conflict** | Sitter outside recurring availability, time-off, or blackout. | Dispatch/force-assign; availability checks; `checkAssignmentAllowed`. |
| **Google busy conflict** | “Respect Google Busy”: blocks from sitter’s Google Calendar. | Availability only; not stored as a booking conflict. |

Keep this distinction explicit in product and docs so owners are not confused.

## Conflict Policy

### Snout OS internal conflicts (same time slot booked twice)

- **Default:** Block booking creation if it conflicts with sitter availability (existing bookings, time-off, or SitterTimeOff).
- **Override:** Admin/owner can optionally allow override with explicit permission when assigning manually.
- **Sitter availability:** When "Respect Google Busy" is enabled for a sitter, their Google Calendar busy blocks are treated as unavailable during availability searches.

### Google Calendar conflicts

- **Sitter's Google Calendar has a conflicting event:**  
  - If "Respect Google Busy" is enabled for that sitter: treat as busy; blocks availability during search.  
  - If disabled (default): ignore; Snout OS bookings are the source of truth.
- **Google event deletion or edits:**  
  - Snout OS does not sync from Google. If a user deletes or edits a mirrored event in Google, the next sync will **re-create** or **repair** the event on Google based on Snout OS data.

### Sync direction

- **One-way:** Snout OS → Google only.
- **No bidirectional sync:** Edits in Google do not flow back into Snout OS.

## Respect Google Busy

- **Setting:** `respectGoogleBusy` (boolean, default `false`) on a sitter.
- **Effect:** When enabled, we pull free/busy for the sitter's Google Calendar within a date range (e.g. next 14 days) and use those blocks to exclude availability during search.
- **Storage:** Busy ranges are computed transiently or stored in minimal blocks; they do not create bookings.

## Repair

- Manual sync repair is available at `/ops/calendar-repair` (owner/admin only).
- Select sitter + date range, then "Repair Sync" to re-push Snout OS bookings to Google and fix drift.

## Backend (Batch 8.1)

### Sync engine (`src/lib/calendar/sync.ts`)

- `upsertEventForBooking(db, bookingId, orgId)` – creates or updates Google event; skips if checksum unchanged.
- `deleteEventForBooking(db, bookingId, sitterId, orgId)` – deletes Google event and mapping on cancel.
- `syncRangeForSitter(db, sitterId, start, end, orgId)` – repairs drift for a date range (recreates if deleted in Google).

### Event identity

- Google events store `privateExtendedProperties`: `snoutBookingId`, `snoutOrgId`, `snoutSitterId`, `snoutSource`.
- Mapping model: `BookingCalendarEvent` (orgId, sitterId, bookingId, googleCalendarEventId, payloadChecksum, lastSyncedAt).

### Queue (`calendar-sync` BullMQ)

- Job types: `upsert`, `delete`, `syncRange`.
- Worker logs: `calendar.sync.succeeded`, `calendar.sync.failed`, `calendar.repair.succeeded`, `calendar.repair.failed`, `calendar.dead` (after 5 retries).

### Triggers

- `booking.created`, `booking.updated`, `booking.assigned`, `sitter.assigned` → enqueue upsert.
- `booking.updated` with `status === 'cancelled'` → enqueue delete.
