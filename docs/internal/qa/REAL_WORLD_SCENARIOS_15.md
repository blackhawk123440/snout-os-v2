# Snout OS Real-World Scenarios (15)

This pack defines realistic busy-day UX validation flows across owner, sitter, and client portals.

| Metric | Value |
|---|---|
| Fully real end-to-end scenarios | 15 |
| Scenarios with remaining external/manual proof | 0 |
| Placeholders still remaining | 0 |

---

### Scenario Name
Morning Rush: End-to-End Masked Messaging and Loyalty Flow (Required)

### Roles
client / owner / sitter

### Steps
Step 1: Client creates booking from `/client/bookings/new` for a same-day walk.  
Step 2: Client receives booking confirmation and masked Twilio number in thread context.  
Step 3: Owner receives automated new booking notification in dashboard + automations trail.  
Step 4: Owner assigns sitter from booking detail assignment panel.  
Step 5: Sitter receives assignment notification in sitter views/messages.  
Step 6: Sitter opens booking detail and sees masked number for client messaging.  
Step 7: Client sends message to sitter through masked number thread.  
Step 8: Owner receives system update that assignment-thread communication is active.  
Step 9: Visit appears on sitter calendar/today route.  
Step 10: Visit syncs to Google Calendar.  
Step 11: Conflict detection runs against sitter schedule.  
Step 12: Payment is processed for completed service.  
Step 13: Client loyalty points are awarded.  
Step 14: Owner dashboard reflects points and revenue updates.

### What the Sitter sees
- New assigned visit in `Today` and `Bookings` views.
- Booking detail with client info, service window, and masked message thread.
- Calendar block plus conflict warning badge if overlap exists.

### What the Client sees
- Booking appears in client bookings list with status progression.
- Confirmation state with message thread and masked number.
- Payment success status and loyalty points in client-visible summary.

### What the Owner sees
- New booking card on dashboard and booking queue.
- Assignment confirmation, messaging health state, and automation logs.
- Revenue and loyalty totals updated after completion/payment.

### What each role needs to do
- Client: submit booking, monitor confirmation, message via masked thread.
- Owner: assign sitter, verify automation/message routing, monitor revenue/points.
- Sitter: accept context, execute visit, communicate through masked thread.

### Expected Screens
- Owner dashboard queue and booking card.
- Owner booking detail assignment panel.
- Client booking confirmation and thread.
- Sitter booking detail with masked thread.
- Sitter calendar/today view.
- Google sync evidence view.
- Payment and loyalty display views.

### System Events
- booking created
- automation triggered (owner alert + assignment alert)
- calendar updated (owner/sitter)
- messaging enabled (Twilio masked number thread)
- Google Calendar sync event emitted
- conflict detection executed
- payment processed
- payout pipeline triggered
- loyalty points awarded
- analytics updated (revenue + completion + points)

### Screenshot Checklist
- `client-booking-confirmation.png`
- `masked-number-thread.png`
- `owner-booking-notification.png`
- `sitter-assignment-ui.png`
- `sitter-calendar-view.png`
- `google-calendar-sync.png`
- `payment-success.png`
- `loyalty-points-display.png`
- `owner-revenue-points-dashboard.png`

---

### Scenario Name
Last-Minute Midday Booking with Rapid Assignment

### Roles
client / owner / sitter

### Steps
Step 1: Client books a walk starting within 90 minutes.  
Step 2: Owner dashboard flags as urgent/unassigned.  
Step 3: Owner checks sitter availability panel and assigns nearest sitter.  
Step 4: Sitter receives immediate assignment notification.  
Step 5: Sitter confirms route and sees calendar update.  
Step 6: Client receives assignment confirmation and ETA message.  
Step 7: Visit check-in/check-out completes and report is posted.

### What the Sitter sees
- Urgent assignment banner in sitter dashboard.
- Updated `Today` list with next-stop ordering.

### What the Client sees
- Booking status changes from pending -> confirmed -> in_progress -> completed.
- Message update containing sitter ETA.

### What the Owner sees
- Urgent card cleared from unassigned queue after assignment.
- Visit lifecycle transitions in real time.

### What each role needs to do
- Client: submit request and confirm notes.
- Owner: assign quickly, monitor route fit.
- Sitter: check in/out on time and submit report.

### Expected Screens
- Owner unassigned queue.
- Assignment modal with availability.
- Sitter today route list.
- Client booking detail status timeline.

### System Events
- booking created
- assignment automation triggered
- calendar updated
- messaging enabled
- payout pipeline triggered
- analytics updated

### Screenshot Checklist
- `owner-urgent-booking-queue.png`
- `owner-assign-sitter-modal.png`
- `sitter-assignment-notification.png`
- `sitter-today-route-updated.png`
- `client-booking-status-timeline.png`

---

### Scenario Name
Multi-Visit Afternoon Route Compression

### Roles
owner / sitter / client

### Steps
Step 1: Three clients create overlapping afternoon drop-in bookings.  
Step 2: Owner groups bookings by geography and assigns one sitter to two, another sitter to one.  
Step 3: Conflict detection flags an overlap and owner adjusts one start time.  
Step 4: Sitter calendars refresh and route order updates.  
Step 5: Clients receive revised arrival windows automatically.  
Step 6: All visits complete; reports and payment statuses post.

### What the Sitter sees
- Consolidated day plan with clear sequence.
- Updated time windows after owner adjustments.

### What the Client sees
- Revised ETA window in booking details/messages.
- Completed report and payment state.

### What the Owner sees
- Conflict warning + resolution state in calendar.
- Clean completion stats by end of block.

### What each role needs to do
- Clients: accept timing updates.
- Owner: resolve conflicts and reassign windows.
- Sitters: follow updated sequence and complete reports.

### Expected Screens
- Owner calendar with conflict indicator.
- Owner booking edit panel.
- Sitter calendar route order.
- Client update notification.

### System Events
- bookings created
- conflict detection runs
- automations triggered (schedule updates)
- calendar updated + Google sync
- payments processed
- analytics updated

### Screenshot Checklist
- `owner-calendar-conflict-flag.png`
- `owner-booking-time-adjustment.png`
- `sitter-calendar-route-sequence.png`
- `client-schedule-update-message.png`
- `owner-analytics-completed-visits.png`

---

### Scenario Name
Overnight House-Sitting Handoff

### Roles
client / owner / sitter

### Steps
Step 1: Client books overnight house-sitting with notes and medication instructions.  
Step 2: Owner assigns overnight sitter and confirms access instructions.  
Step 3: Sitter receives assignment and opens detailed care notes.  
Step 4: Calendar shows overnight block in sitter schedule and owner calendar.  
Step 5: Sitter checks in at start window and checks out next day.  
Step 6: End-of-visit report and media uploads are saved; payout chain triggers.

### What the Sitter sees
- Long-duration booking block with instruction notes.
- Check-in/check-out controls spanning overnight window.

### What the Client sees
- Booking block with status and report delivery.
- Confidence updates via message thread.

### What the Owner sees
- Overnight coverage visible and confirmed.
- Completion status + payout/finance state queued.

### What each role needs to do
- Client: provide detailed care instructions.
- Owner: verify sitter fit and finalize assignment.
- Sitter: execute overnight flow and submit report.

### Expected Screens
- House-sitting booking detail.
- Sitter overnight calendar block.
- Daily delight report creation view.

### System Events
- booking created
- assignment automation triggered
- calendar updated + Google sync
- messaging enabled
- payout pipeline triggered
- analytics updated

### Screenshot Checklist
- `client-housesitting-booking-detail.png`
- `owner-housesitting-assignment.png`
- `sitter-overnight-calendar-block.png`
- `sitter-checkin-checkout-overnight.png`
- `visit-report-submission.png`

---

### Scenario Name
Pet Taxi with Pickup/Dropoff Coordination

### Roles
client / owner / sitter

### Steps
Step 1: Client books Pet Taxi with pickup and dropoff addresses.  
Step 2: Owner verifies route and assigns sitter.  
Step 3: Masked messaging thread opens for pickup coordination.  
Step 4: Sitter receives assignment and route details.  
Step 5: Client confirms pickup readiness via thread.  
Step 6: Sitter completes transfer and marks booking complete.

### What the Sitter sees
- Route-specific booking details with two addresses.
- Messaging thread for real-time pickup updates.

### What the Client sees
- Confirmation of pickup window and sitter updates.
- Completion confirmation once dropoff finishes.

### What the Owner sees
- Taxi booking in dashboard with route details.
- Message activity and completion status.

### What each role needs to do
- Client: provide addresses and be ready for pickup.
- Owner: assign and monitor route updates.
- Sitter: execute pickup/dropoff and message status.

### Expected Screens
- Client Pet Taxi booking form.
- Owner route detail card.
- Sitter booking detail with pickup/dropoff fields.

### System Events
- booking created
- automation triggered (assignment + reminders)
- calendar updated
- messaging enabled (masked)
- payment processed
- analytics updated

### Screenshot Checklist
- `client-pet-taxi-form.png`
- `owner-route-booking-card.png`
- `sitter-pickup-dropoff-detail.png`
- `masked-pickup-thread.png`
- `pet-taxi-completion-status.png`

---

### Scenario Name
Client Cancellation and Same-Day Reschedule

### Roles
client / owner / sitter

### Steps
Step 1: Client cancels a confirmed booking from client portal.  
Step 2: Owner receives cancellation automation and sees slot reopen.  
Step 3: Sitter calendar block is removed and schedule refreshes.  
Step 4: Client creates replacement booking for later time.  
Step 5: Owner reassigns sitter and verifies no conflict.

### What the Sitter sees
- Original booking removed/cancelled in schedule.
- New reassigned booking appears with revised time.

### What the Client sees
- Cancellation confirmation and replacement booking status.

### What the Owner sees
- Cancellation event in dashboard.
- Reassignment workflow with updated availability.

### What each role needs to do
- Client: cancel then resubmit.
- Owner: confirm cancellation propagation and reassign.
- Sitter: follow updated schedule.

### Expected Screens
- Client booking cancellation confirmation.
- Owner cancellation event feed.
- Sitter calendar before/after.

### System Events
- booking status changed (cancelled)
- cancellation automation triggered
- calendar updated + sync delete/upsert
- reassignment automation triggered
- analytics updated

### Screenshot Checklist
- `client-cancel-confirmation.png`
- `owner-cancellation-notification.png`
- `sitter-calendar-cancelled-removed.png`
- `client-rebook-success.png`
- `owner-reassignment-complete.png`

---

### Scenario Name
Rain Delay and Time-Window Shift

### Roles
owner / sitter / client

### Steps
Step 1: Weather delay requires owner to shift multiple afternoon visits by 30 minutes.  
Step 2: Owner bulk-edits start windows.  
Step 3: Conflict detection verifies new schedule.  
Step 4: Sitters receive updated schedule notifications.  
Step 5: Clients receive revised window automations.

### What the Sitter sees
- Updated `Today` ordering and shifted times.

### What the Client sees
- Message and booking detail reflecting revised window.

### What the Owner sees
- Bulk update success with no unresolved conflicts.

### What each role needs to do
- Owner: execute bulk shift and verify conflicts.
- Sitter: confirm adjusted run sheet.
- Client: acknowledge revised arrival windows.

### Expected Screens
- Owner calendar bulk-edit action.
- Conflict detector output panel.
- Sitter today updates.

### System Events
- booking updated events
- automations triggered (schedule change notices)
- calendar updated + Google sync
- conflict detection executed
- analytics updated

### Screenshot Checklist
- `owner-bulk-time-shift.png`
- `owner-conflict-check-clean.png`
- `sitter-updated-schedule-notice.png`
- `client-window-change-message.png`

---

### Scenario Name
Emergency No-Show Replacement

### Roles
owner / sitter / client

### Steps
Step 1: Assigned sitter no-shows and owner marks assignment failure.  
Step 2: Owner reassigns backup sitter from availability panel.  
Step 3: Backup sitter gets immediate assignment alert.  
Step 4: Client receives reassurance/update message via masked thread.  
Step 5: Backup sitter completes visit and report.

### What the Sitter sees
- Backup sitter sees urgent assignment + route details.

### What the Client sees
- Transparent reassignment update and revised ETA.

### What the Owner sees
- No-show audit event and successful reassignment state.

### What each role needs to do
- Owner: execute reassignment quickly.
- Backup sitter: accept and execute visit.
- Client: review update and provide access readiness.

### Expected Screens
- Owner incident/reassignment panel.
- Backup sitter assignment notification.
- Client reassurance message.

### System Events
- assignment changed
- automation triggered (reassignment)
- calendar updated
- messaging enabled
- payout pipeline triggered
- analytics updated

### Screenshot Checklist
- `owner-no-show-event.png`
- `owner-backup-assignment.png`
- `sitter-backup-alert.png`
- `client-reassignment-message.png`
- `visit-completed-after-reassignment.png`

---

### Scenario Name
Recurring Client and Loyalty Tier Bump

### Roles
client / owner / sitter

### Steps
Step 1: Returning client books another completed service in same month.  
Step 2: Payment succeeds and loyalty points accrue.  
Step 3: Client points total crosses tier threshold.  
Step 4: Owner dashboard reflects updated points liability and revenue.  
Step 5: Client portal shows new points total and tier state.

### What the Sitter sees
- Standard assigned/completed visit flow.

### What the Client sees
- Loyalty points added and visible in account context.
- Tier/benefit messaging if configured.

### What the Owner sees
- Revenue and loyalty counters move together.

### What each role needs to do
- Client: complete paid booking flow.
- Owner: verify loyalty/revenue counters.
- Sitter: execute service and submit report.

### Expected Screens
- Client loyalty display.
- Owner loyalty/revenue dashboard card.
- Payment success detail.

### System Events
- booking completed
- payment processed
- loyalty points awarded
- payout pipeline triggered
- analytics updated

### Screenshot Checklist
- `client-loyalty-before-after.png`
- `payment-success-receipt.png`
- `owner-loyalty-revenue-card.png`

---

### Scenario Name
High-Volume Messaging Window (Owner Command Center)

### Roles
owner / client / sitter

### Steps
Step 1: Multiple clients send inbound questions during lunch peak.  
Step 2: Owner triages open threads in messaging inbox.  
Step 3: Owner routes assignment-related thread to sitter context.  
Step 4: Masked numbers keep personal numbers hidden across thread participants.  
Step 5: Threads update status and unread counts clear.

### What the Sitter sees
- Relevant assignment thread only, with masked identity.

### What the Client sees
- Timely replies from business number with continuity.

### What the Owner sees
- Prioritized thread list, response outcomes, and route context.

### What each role needs to do
- Owner: triage and respond quickly.
- Sitter: respond in assigned context.
- Client: continue through masked thread.

### Expected Screens
- Owner messaging inbox queue.
- Assignment thread detail with masked participants.
- Sitter messaging tab.

### System Events
- inbound webhook processed
- thread routing applied
- messaging enabled (masked)
- automations triggered (optional canned responses)
- analytics updated (response activity)

### Screenshot Checklist
- `owner-inbox-peak-load.png`
- `thread-masked-participants.png`
- `sitter-thread-assignment-view.png`
- `client-thread-response.png`

---

### Scenario Name
Add-On Service Upsell During Visit

### Roles
sitter / client / owner

### Steps
Step 1: Sitter identifies add-on need (extra walk time).  
Step 2: Sitter messages client through masked thread with approval request.  
Step 3: Client approves add-on.  
Step 4: Owner updates booking quantity/minutes and confirms price delta.  
Step 5: Payment captures updated total and analytics reflect uplift.

### What the Sitter sees
- Thread-based approval record and updated task scope.

### What the Client sees
- Approval prompt and revised total before final capture.

### What the Owner sees
- Booking update panel with recalculated pricing.

### What each role needs to do
- Sitter: request approval with clear context.
- Client: approve/decline promptly.
- Owner: apply update and verify billing.

### Expected Screens
- Sitter add-on message.
- Owner booking pricing adjustment panel.
- Client revised total view.

### System Events
- booking updated
- messaging enabled
- payment processed (updated amount)
- payout pipeline triggered (updated basis)
- analytics updated (AOV/revenue)

### Screenshot Checklist
- `sitter-addon-request-thread.png`
- `client-addon-approval.png`
- `owner-pricing-adjustment.png`
- `payment-updated-total-success.png`

---

### Scenario Name
Split-Coverage Day (Two Sitters, One Client Household)

### Roles
owner / sitter / client

### Steps
Step 1: Client books morning and evening visits for same pets.  
Step 2: Owner assigns morning slot to sitter A and evening slot to sitter B.  
Step 3: Each sitter receives only their assignment windows.  
Step 4: Client sees unified booking timeline with both assigned sitters.  
Step 5: Both visits complete and reports aggregate under client booking history.

### What the Sitter sees
- Only assigned window and related message context.

### What the Client sees
- One coherent day timeline with two sitter touchpoints.

### What the Owner sees
- Split assignment status and completion progress.

### What each role needs to do
- Owner: split assignments correctly.
- Sitters: execute their windows only.
- Client: review combined outcomes.

### Expected Screens
- Owner split-assignment editor.
- Sitter A/B individual schedule views.
- Client unified timeline.

### System Events
- booking/assignment windows created
- automations triggered per assignment
- calendar updated + Google sync
- payout pipeline triggered per completion
- analytics updated

### Screenshot Checklist
- `owner-split-assignment.png`
- `sitter-a-window-view.png`
- `sitter-b-window-view.png`
- `client-unified-day-timeline.png`

---

### Scenario Name
End-of-Day Operations Close (Payroll + Reports + Analytics)

### Roles
owner / sitter

### Steps
Step 1: Final visits complete and reports are submitted.  
Step 2: Transfer records are generated for completed visits.  
Step 3: Owner reviews payroll/transfers view and exceptions.  
Step 4: Owner checks analytics KPIs for bookings, completion, and revenue.

### What the Sitter sees
- Visit completion reflected in transfer/payroll visibility.

### What the Client sees
- (Indirect) Completed visit states and reports available in portal.

### What the Owner sees
- End-of-day finance and KPI confirmation.

### What each role needs to do
- Sitter: finalize reports/check-outs.
- Owner: reconcile transfer status and KPI movement.

### Expected Screens
- Sitter transfer history.
- Owner payroll/transfer dashboard.
- Owner analytics KPIs/trends.

### System Events
- visit completed
- payout pipeline triggered
- payroll visibility updated
- reports stored
- analytics updated

### Screenshot Checklist
- `sitter-transfer-list.png`
- `owner-payroll-status-panel.png`
- `owner-kpi-trends-eod.png`

---

### Scenario Name
Cross-Portal Consistency Check During Peak Ops

### Roles
owner / client / sitter

### Steps
Step 1: Owner confirms booking in owner portal.  
Step 2: Client portal reflects same status and assigned sitter.  
Step 3: Sitter portal shows matching booking details and time window.  
Step 4: Owner edits notes and verifies propagation to all roles.

### What the Sitter sees
- Updated booking notes and timing without stale state.

### What the Client sees
- Matching status/detail to owner edits.

### What the Owner sees
- Single source of truth reflected cross-portal.

### What each role needs to do
- Owner: perform edit + verify propagation.
- Sitter/client: confirm updated details in respective views.

### Expected Screens
- Owner booking detail.
- Client booking detail.
- Sitter booking detail.

### System Events
- booking updated
- calendar updated
- message context updated
- analytics updated (if status changes)

### Screenshot Checklist
- `owner-booking-detail-updated.png`
- `client-booking-detail-updated.png`
- `sitter-booking-detail-updated.png`
- `cross-portal-status-match.png`

---

### Scenario Name
Holiday Surge with After-Hours Pricing

### Roles
client / owner / sitter

### Steps
Step 1: Client books evening holiday drop-in (after-hours flag).  
Step 2: Pricing engine applies holiday/after-hours adjustments.  
Step 3: Owner assigns sitter and confirms adjusted total.  
Step 4: Sitter completes holiday visit and report.  
Step 5: Payment + loyalty + analytics update with surge-adjusted values.

### What the Sitter sees
- Holiday-tagged visit and expected completion flow.

### What the Client sees
- Transparent adjusted pricing and successful payment.

### What the Owner sees
- Revenue impact and margin reflected in analytics.

### What each role needs to do
- Client: confirm adjusted quote.
- Owner: validate assignment and pricing.
- Sitter: execute holiday visit workflow.

### Expected Screens
- Client quote/confirmation with holiday adjustment.
- Owner booking pricing detail.
- Owner analytics revenue delta panel.

### System Events
- booking created
- pricing rules applied
- assignment automation triggered
- calendar updated + Google sync
- payment processed
- loyalty points awarded
- analytics updated

### Screenshot Checklist
- `client-holiday-pricing-confirmation.png`
- `owner-afterhours-pricing-breakdown.png`
- `sitter-holiday-visit-detail.png`
- `payment-holiday-success.png`
- `owner-revenue-delta-holiday.png`

---

### Scenario Name
Google Calendar Drift Repair During Active Day

### Roles
owner / sitter

### Steps
Step 1: Owner notices one visit missing on Google Calendar.  
Step 2: Owner runs calendar repair action from ops flow.  
Step 3: Sync queue upserts missing event.  
Step 4: Sitter and owner verify restored event parity.

### What the Sitter sees
- Restored event appears in connected calendar view.

### What the Client sees
- No visible disruption; booking timeline remains stable.

### What the Owner sees
- Repair run result with success metrics.

### What each role needs to do
- Owner: trigger repair and verify.
- Sitter: confirm external calendar reflects corrected schedule.

### Expected Screens
- Calendar repair controls/results.
- Owner calendar and Google view comparison.

### System Events
- calendar sync repair triggered
- sync queue processed
- calendar updated
- analytics/ops logs updated

### Screenshot Checklist
- `owner-calendar-missing-event.png`
- `ops-calendar-repair-run.png`
- `google-calendar-event-restored.png`
- `sitter-calendar-sync-confirmed.png`

---

### Scenario Name
Client Portal Payment + Points Follow-Through

### Roles
client / owner

### Steps
Step 1: Client opens completed booking in portal and pays outstanding balance.  
Step 2: Payment status changes to paid.  
Step 3: Loyalty points are credited and visible in client account area.  
Step 4: Owner dashboard reflects revenue and points accrual.

### What the Sitter sees
- Completed booking remains unchanged; payout side proceeds from payment/visit completion logic.

### What the Client sees
- Paid badge, receipt evidence, and points delta.

### What the Owner sees
- Revenue increment and loyalty tracking update.

### What each role needs to do
- Client: complete payment.
- Owner: validate finance and loyalty counters.

### Expected Screens
- Client booking payment panel.
- Client loyalty summary.
- Owner revenue/points tiles.

### System Events
- payment processed
- loyalty points awarded
- payout/finance records updated
- analytics updated

### Screenshot Checklist
- `client-payment-panel.png`
- `client-payment-success-receipt.png`
- `client-points-after-payment.png`
- `owner-revenue-points-updated.png`

---

## Stateful Capture Pass Status (Second Pass)

Evidence source: `docs/qa/scenario-screenshots/report.json`

### Per-scenario capture status

- **scenario-01-client-first-booking**: real screenshots captured (2/2), placeholders 0.
- **scenario-02-recurring-bookings**: real screenshots captured (1/1), placeholders 0.
- **scenario-03-owner-assigns-sitter**: real screenshots captured (2/2), placeholders 0.
- **scenario-04-twilio-masked-messaging**: real screenshots captured (12/12), placeholders 0.
- **scenario-05-sitter-start-visit**: real screenshots captured (2/2), placeholders 0.
- **scenario-06-sitter-end-visit**: real screenshots captured (2/2), placeholders 0.
- **scenario-07-client-report-received**: real screenshots captured (2/2), placeholders 0.
- **scenario-08-calendar-conflict-detection**: real screenshots captured (2/2), placeholders 0.
- **scenario-09-payment-processing**: real screenshots captured (2/2), placeholders 0.
- **scenario-10-loyalty-points-awarded**: real screenshots captured (2/2), placeholders 0.
- **scenario-11-owner-revenue-dashboard**: real screenshots captured (3/3), placeholders 0.
- **scenario-12-busy-sitter-day**: real screenshots captured (4/4), placeholders 0.
- **scenario-13-client-reschedule**: real screenshots captured (2/2), placeholders 0.
- **scenario-14-reminder-automation**: real screenshots captured (2/2), placeholders 0.
- **scenario-15-emergency-booking**: real screenshots captured (3/3), placeholders 0.

### Priority scenario outcomes

- **scenario-04-twilio-masked-messaging**: fully real (calendar sync and payment success now captured in-app).
- **scenario-05-sitter-start-visit**: fully real.
- **scenario-06-sitter-end-visit**: fully real.
- **scenario-08-calendar-conflict-detection**: fully real.
- **scenario-09-payment-processing**: fully real (client in-app payment completion proof + owner payment status).
- **scenario-10-loyalty-points-awarded**: fully real (client billing points view + owner view).
- **scenario-12-busy-sitter-day**: fully real.
- **scenario-15-emergency-booking**: fully real.

### Placeholders still remaining

- None. All scenario screenshots are captured as real in-app states.

### Special Twilio scenario proof notes

- Captured in-app proof exists for:
  - booking confirmation
  - owner booking notification
  - owner assignment flow
  - sitter assignment view
  - thread activity views (client, sitter, owner inbox)
  - sitter calendar
  - owner dashboard updated
  - loyalty points display (client billing)
- Newly added in-app proof surfaces used in this pass:
  - booking-level Google Calendar sync proof panel (`status`, external event id, connected calendar/account, last synced at, sync error, open link)
  - client and owner payment completion proof surfaces (paid state, amount, paid at, booking/invoice references)

