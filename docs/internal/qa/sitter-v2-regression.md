# Sitter V2 Mobile Regression Checklist

Use this checklist for final freeze validation of Sitter V2:
- Today command center
- Booking ops hub
- Inbox quick templates
- Earnings payout clarity

Run on mobile viewport first (`390x844`), then sanity check desktop.

## 1) Today: next up + sections + cancelled toggle

- [ ] Open `/sitter/today` with active bookings.
- [ ] Verify `Next up` hero appears only when there is an in-progress or upcoming visit.
- [ ] Verify hero contains: time window, service, pets, client, status chip, and primary action.
- [ ] Verify list sections render with compact header and count:
  - `In progress`
  - `Up next`
  - `Later today`
  - `Completed today`
- [ ] Verify sorting rules:
  - in-progress is always pinned at top section
  - upcoming visits sorted by scheduled start ascending
  - completed visits at bottom
- [ ] Verify cancelled bookings are hidden by default.
- [ ] Tap `Show cancelled` and verify URL includes `?showCancelled=1`.
- [ ] Refresh page with `?showCancelled=1` and verify cancelled visibility persists.
- [ ] Tap `Hide cancelled` and verify query param is removed.

## 2) Visit execution: start/end, timer, checklist lock

- [ ] On `/sitter/today`, start a pending visit and confirm immediate card state update.
- [ ] On `/sitter/bookings/[id]`, verify `End visit` requires confirmation modal on mobile.
- [ ] Confirm modal copy is accurate and actionable.
- [ ] While in progress, verify timer shows `In progress — HH:MM:SS`.
- [ ] Verify `Started at HH:MM AM/PM` renders when check-in exists.
- [ ] End visit and verify status moves to completed with duration label when check-in/out exist.
- [ ] Checklist rows use large touch targets and show inline timestamps once checked.
- [ ] Verify uncheck is allowed only within five minutes.
- [ ] Verify locked checklist items cannot be unchecked and display locked affordance.
- [ ] If offline, queue check-in/check-out and verify state reconciles after replay.

**Visit execution proof — live sitter visit timer (signoff notes):**

- Timer appears on `/sitter/today` (Next up hero + visit cards).
- Timer appears on `/sitter/bookings/[id]` (booking section under time range).
- In-progress state uses `checkedInAt` as source of truth; shows "Visit in progress", "Started at {time}", "Elapsed: HH:MM:SS" (live).
- Completed state uses `checkedInAt` + `checkedOutAt`; shows "Visit complete", "Started at {time}", "Ended at {time}", "Duration: X min" (or "Xh Ym" if ≥ 60 min).
- Refresh resumes the timer correctly (elapsed derived from `checkedInAt` and current time; no ad-hoc local state).

## 3) Booking detail ops hub: map/call/message + notes + emergency

- [ ] Open `/sitter/bookings/[id]` from Today and from Calendar.
- [ ] Verify address card supports maps launch when address is present.
- [ ] Verify `Message client` opens sitter inbox with correct thread context.
- [ ] Verify `Call client` renders only when phone is present and uses `tel:`.
- [ ] Verify notes module shows booking/client notes when present and does not crash if missing.
- [ ] Verify emergency contact card renders only when emergency contact exists.
- [ ] Verify primary action bar reflects current visit state (start/end/report).

## 4) Reports: submit + sent confirmation + 15-minute edit

- [ ] Submit report from `/sitter/reports/new?bookingId=...`.
- [ ] Verify `Sent to client` confirmation reliably appears.
- [ ] Verify `Edit (15 min)` navigates to `/sitter/reports/edit/[id]`.
- [ ] Verify reports are editable within 15 minutes (`canEdit=true`).
- [ ] Verify reports are not editable after 15 minutes (`canEdit=false` and save disabled).
- [ ] Verify PATCH is rejected when edit window has expired.
- [ ] Verify missing/unauthorized report ID redirects safely to `/sitter/reports` with toast.

## 5) Inbox: unread badges + templates + offline queue

- [ ] Open `/sitter/inbox` on mobile.
- [ ] Verify thread list sorts by newest `lastActivityAt`.
- [ ] Verify unread badge renders only when unread count > 0.
- [ ] Verify unread badge count caps at `99+`.
- [ ] Verify mobile quick template buttons send correctly when a thread is selected.
- [ ] Verify template actions are disabled while send is pending.
- [ ] Verify templates do not send when no thread is selected.
- [ ] Go offline and send template; verify message is queued.
- [ ] Restore network and verify queued message replays and appears in thread.

## 6) Earnings: pending vs paid + next payout estimate

- [ ] Open `/sitter/earnings`.
- [ ] Verify `Pending` equals sum of transfers where status is not `paid`.
- [ ] Verify `Paid (30d)` equals sum of paid transfers in the last 30 days.
- [ ] Verify `Total earnings` and `Average per visit` remain visible and unchanged.
- [ ] If paid history exists, verify `Next payout` displays estimated date (`lastPaidAt + 7 days`).
- [ ] If no paid history exists, verify fallback copy for next payout is shown.

## 7) Freeze gate

- [ ] `pnpm lint --fix` passes.
- [ ] `pnpm build` passes.
- [ ] Targeted sitter tests pass:
  - `src/app/sitter/today/__tests__/today-helpers.test.ts`
  - `src/app/sitter/bookings/[id]/__tests__/booking-detail-helpers.test.ts`
  - `src/app/api/sitter/bookings/[id]/__tests__/checklist-route.test.ts`
  - `src/app/sitter/inbox/__tests__/template-actions.test.ts`
  - `src/app/sitter/earnings/__tests__/earnings-helpers.test.ts`
