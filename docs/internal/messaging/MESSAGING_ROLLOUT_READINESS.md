# Messaging Rollout Readiness

Date: 2026-03-14  
Branch: `qa/messaging-rollout-readiness`

## Status

Messaging is **almost ready** for production rollout with masked-only communication as the default for normal client/sitter messaging.

## What Is Ready

- Masked-thread enforcement is fail-closed for automation conversational sends when thread mapping is missing.
- Production/flagged direct-send blocking exists for legacy `sms-templates` client/sitter paths.
- Sitter-facing no-direct-call UX is enforced for normal client communication surfaces.
- Centralized redaction boundary is applied at EventLog writes (`log-event` and `event-logger`).
- Lifecycle policy surfaces are in place:
  - company lane lifecycle
  - service lane activation + expiry reroute
  - anti-poaching flags
  - owner timeline
  - Twilio webhook lifecycle updates

## Booking/Thread Lifecycle Contract

- **Intended product behavior:** Booking creation triggers automatic thread creation/linking via `syncConversationLifecycleWithBookingWorkflow` (best-effort, non-blocking). So a thread linked to the booking is created at booking-create time when the sync succeeds.
- **Implementation:** `POST /api/client/bookings` calls `syncConversationLifecycleWithBookingWorkflow` in a try/catch; on throw the booking still returns 200 but no thread is created. `GET /api/messages/threads?bookingId=X` returns threads with that `bookingId`.
- **When sync can fail:** (1) Staging DB missing `MessageThread.clientApprovedAt` / `sitterApprovedAt` (run migration `20260314030000_messaging_conversation_foundation` or apply equivalent ALTER TABLE). (2) No front_desk `MessageNumber` for the org (run `POST /api/setup/numbers/sync` as owner first). (3) Client resolution failure (clientId or phone required).
- **Proof commands:** Create booking then fetch threads by bookingId. See `scripts/run-booking-thread-proof.ts`. Exact curl-style: `POST /api/client/bookings` (as client), then `GET /api/messages/threads?bookingId=<id>` (as owner); expect `items.length >= 1` when sync succeeds.
- **Staging fix if threads?bookingId= is empty:** Ensure migration `20260314030000_messaging_conversation_foundation` has been applied (or run `ALTER TABLE "MessageThread" ADD COLUMN IF NOT EXISTS "clientApprovedAt" TIMESTAMP(3); ALTER TABLE "MessageThread" ADD COLUMN IF NOT EXISTS "sitterApprovedAt" TIMESTAMP(3);`). Then run `POST /api/setup/numbers/sync` so the org has a front_desk number. Re-run `npx tsx scripts/run-booking-thread-proof.ts`.

## Remaining Raw-Number Exceptions

| Path | Current behavior | Classification | Notes |
|---|---|---|---|
| `src/app/sitter/bookings/[id]/page.tsx` support `tel:` links | Direct support call action | Allowed operational exception | Explicitly marked support exception in UI. |
| `src/app/sitter/bookings/[id]/page.tsx` emergency contact `tel:` | Direct emergency call action | Allowed operational exception | Explicitly marked emergency exception in UI. |
| `src/app/bookings/[id]/page.enterprise.tsx` client call | Owner/admin direct call | Allowed operational exception | Explicit helper text added; keep for operational recovery/escalation. |
| `src/components/calendar/BookingDrawer.tsx` client phone `tel:` | Owner/admin direct call | Allowed operational exception | Explicit title marker added. |
| `src/app/sitters/[id]/page.enterprise.tsx` sitter call | Owner/admin direct call | Allowed operational exception | Button labeled as ops exception. |
| `src/lib/automation-executor.ts` owner/sitter direct sends | Direct `sendMessage` for non-thread operational notifications | Should be migrated to masked thread flow | Not part of normal client/sitter conversation lane, but should converge over time. |
| `src/app/api/setup/test-sms/route.ts` test sms endpoint | Explicit raw send for test tooling | Allowed operational exception | Keep non-user-facing and restricted to admin/test context. |

## Centralized Redaction Hardening

- Added `src/lib/privacy/redact-metadata.ts` with recursive redaction for phone-like fields and phone-like text values.
- `src/lib/log-event.ts` now redacts metadata before persistence to `EventLog`.
- `src/lib/event-logger.ts` now redacts metadata for both automation and generic event writes.
- `src/lib/event-emitter.ts` now redacts top-level summary phone fields emitted in context (`clientPhone`, `phone`).

## Integration/Policy Guard Added

- `src/lib/__tests__/automation-masked-only-policy.integration.test.ts`
  - Asserts client automation path does not fall back to raw `sendMessage()` when masked thread sending fails under masked-only enforcement.

## Rollout Checklist Validation

| Capability | Validation status | Evidence |
|---|---|---|
| Company lane flow | Pass | Lifecycle orchestration tests in messaging service/e2e suites. |
| Service lane activation | Pass | Approval + activation tests in lifecycle e2e coverage. |
| Service lane expiry + reroute | Pass | Reroute reconciliation tests and Twilio reroute behavior tests. |
| Anti-poaching flags | Pass | Anti-poaching unit tests and timeline event wiring. |
| Owner timeline | Pass | Timeline route + owner inbox timeline surface/tests. |
| Masked-only enforcement | Pass | Guardrail tests for thread sender + sms templates + integration policy guard. |
| Sitter no-direct-call UX | Pass | Direct client call controls removed from sitter day/detail flows. |
| Twilio webhook lifecycle updates | Pass | Webhook lifecycle/reconcile behavior present and covered by existing tests. |

## Launch Checklist (Source Of Truth)

Use this document as the go-live checklist. Mark each item during rollout sign-off:

- [x] Company lane flow validated
- [x] Service lane activation validated
- [x] Service lane expiry + reroute validated
- [x] Anti-poaching flags validated
- [x] Owner timeline validated
- [x] Masked-only enforcement validated
- [x] Sitter no-direct-call UX validated
- [x] Twilio webhook lifecycle updates validated
- [ ] Pilot metrics reviewed and accepted by product + operations

## Real-World Pilot Tracker

Track the pilot in daily/shift slices. This is where final product refinements should come from.

| Metric | Day 1 | Day 2 | Day 3 | Notes / Actions |
|---|---:|---:|---:|---|
| Accepted conversations |  |  |  |  |
| Reroutes |  |  |  |  |
| Owner overrides |  |  |  |  |
| Anti-poaching flags |  |  |  |  |
| Sitter complaints/confusion |  |  |  |  |
| Client confusion about lane expiry |  |  |  |  |
| Message delivery failures |  |  |  |  |

### Pilot Exit Criteria

- Conversation acceptance remains stable or improves.
- Reroutes are explainable and policy-consistent.
- Owner overrides trend down after first-day stabilization.
- Sitter/client confusion items are documented and translated into UX/copy fixes.
- Delivery failure rate stays within expected provider baseline.

## What Is Intentionally Allowed

- Emergency and support call actions in sitter operational detail surfaces.
- Owner/admin direct-call controls in enterprise operational panels for recovery/escalation.
- Explicit test SMS endpoint for integration verification.

## Post-Launch Monitoring

- Event volume and failure rates for:
  - `message.failed`
  - `automation.failed`
  - `messaging.lane.rerouted`
  - `messaging.lifecycle.notice.sent`
- Number pool pressure:
  - `availableCompany`
  - `availableService`
  - `shouldProvision`
- Reroute anomalies:
  - spikes in expired-lane reroutes
  - repeated reroute notices for same thread
- Policy drift:
  - any new raw-number metadata in `EventLog` payloads

## Rollback / Disable Levers

- `ENFORCE_MASKED_ONLY_MESSAGING=true` should remain enabled in production.
- If masked routing degrades:
  - pause specific automation types in automation settings (recipient-level toggles),
  - keep owner/admin operational exceptions active for continuity,
  - temporarily disable non-critical lifecycle notices while preserving core lane routing.
- If pool exhaustion occurs:
  - provision numbers immediately,
  - route to company lane fallback while maintaining thread continuity.

