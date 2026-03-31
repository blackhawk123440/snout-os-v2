# Snout OS — Gap Status (Updated March 2026)

Previous audit: af2d0169f2d1a3467abe6c079a4ec1d4ed652a57
Updated: March 31, 2026

All previously identified gaps have been resolved. This document now serves as a
status reference and tracks remaining enhancements (non-blocking).

---

# Resolved Gaps

## 1.1 Recurring Availability Engine — RESOLVED

**Implementation:** `src/lib/availability/engine.ts` (465 lines)
- RRULE-style recurring rules via `expandRecurringRules()` — weekly patterns with daysOfWeek + startTime/endTime, timezone-aware
- Override system via `applyOverrides()` — date-specific add/subtract windows
- Deterministic conflict detection via `checkConflict()` — 5 conflict types: booking_conflict, travel_buffer, blackout, google_busy, outside_availability
- Full merge logic via `getAvailabilityWindows()` — combines rules + overrides + existing bookings + time-off + optional Google busy
- Travel buffer enforcement between bookings
- Used by sitter-matcher.ts for smart dispatch

**Models:** SitterAvailabilityRule, SitterAvailabilityOverride, SitterTimeOff

---

## 1.2 Calendar Bidirectional Sync — RESOLVED

**Implementation:**
- Snout -> Google: `src/lib/calendar/sync.ts` — upsertEventForBooking(), deleteEventForBooking(), syncRangeForSitter() with payload checksum idempotency
- Google -> Snout: `src/lib/calendar/bidirectional-adapter.ts` — processInboundReconcileJob() with deduplication, conflict logging, availability override creation
- Polling: `src/lib/calendar-queue.ts` — BullMQ repeatable job `calendar:inboundPoll` every 15 minutes, finds all sitters with calendarSyncEnabled=true, fetches changes, enqueues reconcile jobs
- Worker: Registered in `initializeQueues()` via `initializeCalendarWorker()` + `scheduleInboundCalendarSync()`
- Feature flag: Gated behind `ENABLE_GOOGLE_BIDIRECTIONAL_SYNC`

**Policy:** Inbound Google changes create availability blackouts. Deleted Google events are logged to EventLog for owner review. Bookings are NOT auto-cancelled from Google deletions.

---

## 2.1 Stripe Connect Payouts — RESOLVED

**Implementation:**
- `src/lib/stripe-connect.ts` — createConnectAccount(), createTransferToConnectedAccount(), getAccountStatus()
- `src/lib/payout/sitter-payout.ts` — processSitterPayout() with commission calculation, transfer execution, PayoutTransfer + SitterEarning + LedgerEntry recording
- `src/lib/payout/payout-engine.ts` — calculatePayoutForBooking(), executePayout() with approval mode support
- Sitter onboarding: `POST /api/sitter/stripe/connect` — creates Express account + onboarding link
- Mock mode via STRIPE_MOCK_TRANSFER for development
- Triggered from booking check-out and payment webhooks
- Handles pending payouts for sitters without connected Stripe accounts

**Models:** SitterStripeAccount, PayoutTransfer, SitterEarning, LedgerEntry

---

## 2.2 Ledger Reconciliation — RESOLVED

**Implementation:**
- Ledger: `src/lib/finance/ledger.ts` — upsertLedgerEntry() with idempotency via stripeId, called from 18+ files
- Reconciliation: `src/lib/finance/reconcile.ts` — reconcileOrgRange() compares LedgerEntry vs StripeCharge/StripeRefund/PayoutTransfer, returns mismatches
- Queue: `src/lib/finance/reconcile-queue.ts` — BullMQ `finance.reconcile` queue with worker that records ReconciliationRun results
- Pricing drift: `src/worker/reconciliation-worker.ts` — processPricingReconciliation() via BullMQ repeatable job at 2 AM daily
- Registered: Both workers initialized in `initializeQueues()`

**Models:** LedgerEntry, ReconciliationRun, StripeCharge, StripeRefund

---

## 3. AI Governance — RESOLVED

**Implementation:**
- `src/lib/ai/governed-call.ts` — governedAICall() wraps all AI calls with budget enforcement + usage logging
- `src/lib/ai/governance.ts` — assertAIAllowed() checks OrgAISettings.enabled + monthly budget, recordAIUsage() logs to AIUsageLog, getPromptTemplate() resolves org-specific or global templates
- Cost tracking: Per-token pricing for gpt-4o-mini, gpt-4o, gpt-4-turbo, gpt-3.5-turbo
- Budget enforcement: Monthly budget caps with hard stop option
- Used by: report-assist AI feature

**Models:** OrgAISettings, AIPromptTemplate, AIUsageLog

---

## 4. Automation Worker — RESOLVED

**Implementation:** `src/worker/automation-worker.ts`
- Explicitly states: "No setInterval or global scanning"
- All reminder/summary work triggered by BullMQ repeatable jobs
- processDailySummaryForOrg(orgId) — per-org, queue-driven
- Reminder scheduling in separate reminder-scheduler-queue.ts (org-scoped)
- Horizontally scalable via BullMQ concurrency

---

## 5. GDPR Export/Delete — RESOLVED

**Implementation:**
- Export: `src/lib/export-client-data.ts` (236 lines) — comprehensive bundle: profile, pets, bookings, reports, messages (with thread hierarchy), payments (charges + refunds up to 500/200)
- Delete: `src/app/api/client/delete-account/route.ts` — soft delete on Client + User, preserves audit trail (bookings/messages/pets intact for owner), prevents re-login
- Export API: `GET /api/client/export` with audit logging
- Delete API: `POST /api/client/delete-account` with idempotency check

---

## 6. Client Portal QA — RESOLVED

All client portal pages audited and fixed:
- Session clientId enforced via requireClientContext()
- Cross-client isolation via orgId + clientId scoping
- All API routes return 404 (not 403) for missing resources
- Role casing normalized in normalizeRole()

---

## 7. Design System Enforcement — RESOLVED (Manual)

All portals (Client, Sitter, Owner, Admin) audited against 10-point checklist:
- Zero hardcoded Tailwind colors — all semantic tokens
- Zero emoji icons in UI chrome — all Lucide React
- Zero browser confirm() dialogs — all Modal component
- All touch targets min-h-[44px]
- All data fetching via TanStack Query
- All pages have skeleton loading, error states with retry, empty states
- Dark mode compatible across all themes

CI lint guard for primitives: not implemented (manual enforcement via code review).

---

# Remaining Enhancements (Non-Blocking)

These are improvements that enhance the product but do not block commercial launch:

## Instant Payouts
- Current: Standard ACH payouts (2-3 business days)
- Enhancement: Stripe Instant Payouts for sitters (requires Stripe eligibility)
- Difficulty: MEDIUM
- Priority: LOW — standard payouts are sufficient for launch

## Transfer Arrival Verification
- Current: Transfers created and recorded; no verification of arrival
- Enhancement: Periodic job to check Stripe transfer status and update PayoutTransfer.status
- Difficulty: EASY
- Priority: LOW — Stripe handles delivery; verification is operational polish

## Additional AI Features
- Current: Report-assist uses governed AI calls
- Enhancement: Dynamic pricing suggestions, sentiment analysis, predictive alerts
- All would use the existing governedAICall() wrapper with budget enforcement
- Difficulty: HARD per feature
- Priority: LOW — governance layer is ready; features are product roadmap items

## Admin Portal: Impersonation
- Current: Admin can view org details read-only
- Enhancement: "View as owner" mode with session flag impersonating: { orgId, userId }
- Difficulty: MEDIUM
- Priority: LOW — support debugging can use direct DB queries for now

## Automated Data Purge
- Current: Soft delete preserves all data
- Enhancement: Scheduled job to hard-delete soft-deleted records after retention period (e.g., 90 days)
- Difficulty: EASY
- Priority: LOW — soft delete is compliant; purge is operational hygiene

---

# Definition of Operationally Complete — MET

All four original criteria are satisfied:

1. Recurring availability engine exists — YES (engine.ts, 465 lines, 5 conflict types)
2. No global worker scanning risk — YES (automation-worker.ts is fully queue-driven)
3. Client data export exists — YES (export-client-data.ts, comprehensive GDPR bundle)
4. Stripe Connect payouts exist — YES (stripe-connect.ts + sitter-payout.ts + payout-engine.ts)

**Platform is operationally complete for commercial launch.**
