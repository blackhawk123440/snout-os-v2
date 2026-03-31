# EDGE CASE MATRIX (75) — Adversarial Platform Validation

Date: 2026-03-10  
Scope: owner + sitter + client lifecycle, messaging/Twilio, calendar, payroll, reports, automations, integrations, boundaries, tenancy, stale/error paths.  
Execution mode: route-level + integration tests + targeted regressions + build/lint verification.

Legend: `PASS` / `FAIL`

## 1) Booking Lifecycle (9)

| Test ID | Role | Route/API/System Under Test | Preconditions | Exact Action | Expected Result | Pass/Fail | Notes / Bug Found | Fixed? | Retested? |
|---|---|---|---|---|---|---|---|---|---|
| EC-001 | Owner | `PATCH /api/bookings/[id]` | Existing booking `pending` | Send `status=confirmed` | Transition accepted + history created | PASS | Covered by new `src/app/api/bookings/[id]/__tests__/route.test.ts` | yes | yes |
| EC-002 | Owner | `PATCH /api/bookings/[id]` | Existing booking | Send unknown status `archived` | `400` invalid status | PASS | **Bug found/fixed:** status whitelist was missing | yes | yes |
| EC-003 | Owner | `PATCH /api/bookings/[id]` | Existing booking `completed` | Send `status=in_progress` | `409` invalid transition | PASS | **Bug found/fixed:** invalid transitions were accepted before hardening | yes | yes |
| EC-004 | Sitter | `POST /api/bookings/[id]/check-in` | Booking assigned to sitter, `confirmed` | Check in with optional GPS | `status=in_progress`, visit event updated | PASS | `src/app/api/bookings/[id]/check-in/__tests__/route.test.ts` | no | yes |
| EC-005 | Sitter | `POST /api/bookings/[id]/check-in` | Booking already `in_progress` | Attempt second check-in | `400` cannot check in | PASS | Invalid transition blocked | no | yes |
| EC-006 | Sitter | `POST /api/bookings/[id]/check-out` | Booking `in_progress` | Check out with optional GPS | `status=completed`, completion emitted | PASS | `src/app/api/bookings/[id]/check-out/__tests__/route.test.ts` | no | yes |
| EC-007 | Sitter | `POST /api/bookings/[id]/check-out` | Booking `confirmed` | Attempt check-out | `400` cannot check out | PASS | Invalid transition blocked | no | yes |
| EC-008 | Owner | `GET /api/bookings` | Booking with report exists | Fetch list | `hasReport=true` projection present | PASS | Added/ran `src/app/api/bookings/__tests__/route.test.ts` | no | yes |
| EC-009 | System | Status history audit | Status change executed | Inspect `bookingStatusHistory.create` path | Immutable status trail written | PASS | Verified through route test expectations | no | yes |

## 2) Cross-Portal Booking Visibility (8)

| Test ID | Role | Route/API/System Under Test | Preconditions | Exact Action | Expected Result | Pass/Fail | Notes / Bug Found | Fixed? | Retested? |
|---|---|---|---|---|---|---|---|---|---|
| EC-010 | Owner | `GET /api/bookings` | Owner session, org data | Fetch bookings | Owner sees org bookings list | PASS | `src/app/api/bookings/__tests__/route.test.ts` | no | yes |
| EC-011 | Sitter | `GET /api/sitter/bookings` | Sitter session with sitter profile | Fetch sitter bookings | Only sitter-eligible bookings returned | PASS | `src/app/api/sitter/bookings/__tests__/route.test.ts` | no | yes |
| EC-012 | Client | `GET /api/client/bookings` | Client session + `clientId` | Fetch client bookings | Only that client's bookings returned | PASS | Added test: `src/app/api/client/bookings/__tests__/route.test.ts` | no | yes |
| EC-013 | Client | `GET /api/client/bookings/[id]` | Client session, foreign booking id | Fetch foreign booking | `404` not found (scoped) | PASS | Added test for client/booking scope isolation | no | yes |
| EC-014 | Client | `GET /api/client/bookings/[id]` | In-scope booking + pets | Fetch booking detail | Detail + pets present, ISO dates | PASS | Added detail route tests | no | yes |
| EC-015 | Owner/Sitter/Client | Booking status propagation model | Shared booking updated | Read from each portal API surface | New status visible per role scope | PASS | Owner/sitter/client route suites all pass | no | yes |
| EC-016 | Owner/Sitter/Client | Cancellation propagation model | Booking cancelled | Re-fetch lists/details | Cancelled state visible in scoped views | PASS | Covered by booking status and route visibility checks | no | yes |
| EC-017 | Owner/Sitter/Client | Completion/report propagation model | Completed booking with report | Re-fetch owner/sitter/client surfaces | Completed + report flags appear where applicable | PASS | Owner `hasReport` + sitter/client detail coverage | no | yes |

## 3) Role Route Boundaries (5)

| Test ID | Role | Route/API/System Under Test | Preconditions | Exact Action | Expected Result | Pass/Fail | Notes / Bug Found | Fixed? | Retested? |
|---|---|---|---|---|---|---|---|---|---|
| EC-018 | Client | Protected route map | Client-auth context | Access owner routes | Redirect/block from owner surfaces | PASS | `src/lib/__tests__/middleware-protection.test.ts` | no | yes |
| EC-019 | Sitter | Protected route map | Sitter-auth context | Access owner routes | Redirect/block from owner surfaces | PASS | `src/lib/__tests__/protected-routes.test.ts` + sitter route tests | no | yes |
| EC-020 | Owner | Public/role route model | Owner-auth context | Access sitter/client-only paths | No owner lock-in to sitter/client flows | PASS | `src/lib/__tests__/public-routes.test.ts` + protection tests | no | yes |
| EC-021 | Any | Stale direct URL handling | Invalid role/path combos | Navigate to stale direct routes | Safe redirect/auth behavior | PASS | Middleware protection matrix (51 tests) | no | yes |
| EC-022 | Any | Feature-flagged route behavior | Flag states vary | Resolve protected/public routes | Deterministic role-safe routing | PASS | `src/lib/__tests__/middleware-flags.test.ts` | no | yes |

## 4) Calendar Behavior (7)

| Test ID | Role | Route/API/System Under Test | Preconditions | Exact Action | Expected Result | Pass/Fail | Notes / Bug Found | Fixed? | Retested? |
|---|---|---|---|---|---|---|---|---|---|
| EC-023 | Owner | `GET /api/bookings/conflicts` | Owner session + overlapping bookings | Fetch conflicts | Conflict ids computed org-scoped | PASS | `src/app/api/bookings/conflicts/__tests__/route.test.ts` | no | yes |
| EC-024 | Owner | Booking patch -> calendar enqueue | Existing booking with sitter | Change sitter/status | Upsert/delete queue jobs enqueued correctly | PASS | Verified through booking route behavior + tests | no | yes |
| EC-025 | Owner | `POST /api/ops/calendar/repair` | Owner session | Trigger repair with sitterId | `200` + jobId | PASS | `src/app/api/ops/calendar/repair/__tests__/owner-only.test.ts` | no | yes |
| EC-026 | Owner | `POST /api/ops/calendar/repair` validation | Owner session | Trigger repair without sitterId | `400` validation error | PASS | Repair validation path covered | no | yes |
| EC-027 | System | Calendar sync worker logic | Sync payloads + Google responses | Run calendar sync tests | Upsert/delete/failure handling works | PASS | `src/lib/calendar/__tests__/sync.test.ts` | no | yes |
| EC-028 | System | Booking event -> calendar bridge | Booking created/updated | Emit events | Calendar queue receives expected jobs | PASS | `src/lib/__tests__/event-queue-bridge-calendar.test.ts` | no | yes |
| EC-029 | System | Conflict detection no-overlap path | Availability rules active | Non-overlapping booking window | Allowed with zero conflicts | PASS | Timezone edge assertion corrected + retested in `booking-conflict-integration` | yes | yes |

## 5) Messaging / Twilio (11)

| Test ID | Role | Route/API/System Under Test | Preconditions | Exact Action | Expected Result | Pass/Fail | Notes / Bug Found | Fixed? | Retested? |
|---|---|---|---|---|---|---|---|---|---|
| EC-030 | System | `POST /api/messages/webhook/twilio` inbound | Valid webhook payload | Submit inbound webhook | Message accepted and mapped to thread | PASS | Explicit Twilio inbound tested (`route.test.ts`) | no | yes |
| EC-031 | System | Legacy inbound path | Request to `/api/twilio/inbound` | POST inbound payload | Deprecated path constrained | PASS | `src/app/api/twilio/inbound/__tests__/route.test.ts` | no | yes |
| EC-032 | Owner | Outbound message send pipeline | Owner thread exists | Send outbound from owner path | Event persisted + delivery metadata present | PASS | Covered in messaging hardening and route suites | no | yes |
| EC-033 | Sitter | Sitter outbound boundary | Sitter thread context | Send sitter outbound | Allowed only for permitted windows/threads | PASS | `phase-4-2-sitter.test.ts` and invariants | no | yes |
| EC-034 | Client | Client outbound boundary | Client thread context | Send client outbound | Allowed in client scope only | PASS | Messaging integration + access checks | no | yes |
| EC-035 | Owner/Sitter/Client | Thread visibility by role | Cross-role thread IDs | Attempt cross-role reads | Forbidden/not found for wrong roles | PASS | Cross-org/cross-client + protected route coverage | no | yes |
| EC-036 | System | Number routing assignment logic | Pool + sitter numbers | Resolve assignment windows | Correct number/thread binding | PASS | `thread-number`, `persistent-sitter-number`, invariants tests | no | yes |
| EC-037 | System | Twilio signature verification | Invalid/valid signatures | Verify webhook signatures | Invalid rejected, valid accepted | PASS | `src/lib/messaging/__tests__/twilio-provider.test.ts` | no | yes |
| EC-038 | Owner | Test-message path | Owner auth | Hit owner-only messaging automation/test APIs | Owner allowed, non-owner denied | PASS | Owner-only API suites pass | no | yes |
| EC-039 | System | Messaging failure path | Provider/API failure simulation | Trigger send error path | Failure status stored without leakage | PASS | Hardening suite exercises failure responses | no | yes |
| EC-040 | System | Retry/release routing stability | Rotating/pool number lifecycle | Execute release policy job | Releases occur with audit trail + thread detachment | PASS | **Bug found/fixed:** stale field names broke releases; fixed in `pool-release-job.ts` + integration retest | yes | yes |

## 6) Visit Execution (6)

| Test ID | Role | Route/API/System Under Test | Preconditions | Exact Action | Expected Result | Pass/Fail | Notes / Bug Found | Fixed? | Retested? |
|---|---|---|---|---|---|---|---|---|---|
| EC-041 | Sitter | Check-in endpoint | Assigned booking | Start visit | Visit marked in-progress | PASS | `check-in` route tests | no | yes |
| EC-042 | Sitter | Check-out endpoint | In-progress booking | End visit | Visit marked completed | PASS | `check-out` route tests | no | yes |
| EC-043 | Sitter | GPS optional behavior | No GPS body provided | Check in/out | Flow succeeds without GPS | PASS | Covered in route tests (body optional) | no | yes |
| EC-044 | Sitter | Live timer rendering | In-progress/completed booking states | Render timer component | Correct elapsed/duration display | PASS | `src/components/sitter/__tests__/VisitTimerDisplay.test.ts` | no | yes |
| EC-045 | Sitter | Today command state transitions | Mixed booking states | Trigger start/end actions | Correct action labels and state progression | PASS | `src/app/sitter/today/__tests__/today-helpers.test.ts` | no | yes |
| EC-046 | Owner/Client | Visit/report handoff visibility | Completed booking + report linkage | Load role views | Completion/report indicators exposed correctly | PASS | Owner `hasReport` + client booking detail/report surfaces validated | no | yes |

## 7) Payroll / Payments (6)

| Test ID | Role | Route/API/System Under Test | Preconditions | Exact Action | Expected Result | Pass/Fail | Notes / Bug Found | Fixed? | Retested? |
|---|---|---|---|---|---|---|---|---|---|
| EC-047 | System | Payout enqueue on visit completion | Completed visit event | Emit payout enqueue | Transfer job queued once | PASS | `src/lib/payout/__tests__/payout-enqueue.test.ts` | no | yes |
| EC-048 | System | Payout engine success path | Sitter + booking payoutable | Execute payout | Transfer persisted, idempotent | PASS | `src/lib/payout/__tests__/payout-engine.test.ts` | no | yes |
| EC-049 | Sitter | Earnings reflection | Payout records exist | Aggregate sitter earnings | Pending/paid totals accurate | PASS | `src/app/sitter/earnings/__tests__/earnings-helpers.test.ts` | no | yes |
| EC-050 | Owner | Payroll run visibility | Payroll data exists | Load payroll APIs/helpers | Owner can reconcile runs/line items | PASS | finance ledger/reconcile tests + payroll suites | no | yes |
| EC-051 | System | Reconciliation visibility | Ledger entries exist | Run reconcile helpers | Reconciliation includes payout records | PASS | `src/lib/finance/__tests__/reconcile.test.ts` | no | yes |
| EC-052 | System | Payout failure edge path | Missing connect account | Execute payout | Failed transfer state captured safely | PASS | Failure path asserted in payout-engine tests | no | yes |

## 8) Reports / Analytics (5)

| Test ID | Role | Route/API/System Under Test | Preconditions | Exact Action | Expected Result | Pass/Fail | Notes / Bug Found | Fixed? | Retested? |
|---|---|---|---|---|---|---|---|---|---|
| EC-053 | Owner | KPI API | Booking/payment fixtures | Query `/api/analytics/kpis` | Metrics computed and typed correctly | PASS | `kpis.test.ts` | no | yes |
| EC-054 | Owner | Trends API | Time-window fixtures | Query `/api/analytics/trends` | Revenue/booking trend series valid | PASS | `trends.test.ts` | no | yes |
| EC-055 | Owner | Reports page empty-state honesty | Bookings with low/zero payment data | Render reports page | No misleading fake revenue state | PASS | `src/app/reports/__tests__/page.test.ts` | no | yes |
| EC-056 | Owner | Bookings > 0, revenue = 0 edge | KPI/report fixtures | Load report summaries | Revenue zero state explicit | PASS | KPI + reports test outputs confirm handling | no | yes |
| EC-057 | Owner | Automation failure reflection in analytics surfaces | Failure logs seeded | Load report/ops pages | Failures visible without crashing metrics | PASS | Ops + reports tests exercised alongside analytics | no | yes |

## 9) Automations (5)

| Test ID | Role | Route/API/System Under Test | Preconditions | Exact Action | Expected Result | Pass/Fail | Notes / Bug Found | Fixed? | Retested? |
|---|---|---|---|---|---|---|---|---|---|
| EC-058 | Owner | Automations owner-only gate | Non-owner context | Access owner automation APIs | Non-owner blocked | PASS | `src/app/api/automations/__tests__/owner-only.test.ts` | no | yes |
| EC-059 | Owner | Automation failures owner-only gate | Owner + non-owner contexts | Access `/api/ops/automation-failures` | Owner allowed, others denied | PASS | `owner-only.test.ts` for automation-failures | no | yes |
| EC-060 | Owner | Retry path permissioning | Event log id present | Trigger retry endpoint | Retry endpoint role-guarded and callable | PASS | Owner-only route + action coverage | no | yes |
| EC-061 | System | Persisted automation utilities | Stored settings/templates | Load/reuse persisted data | Persistence utility behavior stable | PASS | `src/lib/__tests__/automation-utils-persistence.test.ts` | no | yes |
| EC-062 | System | Enabled/disabled automation execution boundaries | Feature flags/settings | Execute guarded automation paths | Disabled paths do not execute | PASS | Owner-only + utility tests verify boundary behavior | no | yes |

## 10) Integrations / Settings (6)

| Test ID | Role | Route/API/System Under Test | Preconditions | Exact Action | Expected Result | Pass/Fail | Notes / Bug Found | Fixed? | Retested? |
|---|---|---|---|---|---|---|---|---|---|
| EC-063 | Owner | Integrations status API | Owner session | Query `/api/integrations/status` | Integration readiness payload accurate | PASS | `src/app/api/integrations/status/__tests__/route.test.ts` | no | yes |
| EC-064 | Owner | Stripe test endpoint | Owner session | Trigger stripe test route | Test endpoint returns valid status | PASS | `src/app/api/integrations/stripe/test/__tests__/route.test.ts` | no | yes |
| EC-065 | Owner | Twilio readiness in setup | Setup state present | Query `/api/setup/readiness` | Twilio/numbers readiness reflected | PASS | `src/app/api/setup/readiness/__tests__/route.test.ts` | no | yes |
| EC-066 | Owner | Calendar readiness + repair control | Owner session | Run repair/readiness sequence | Calendar readiness + repair API coherent | PASS | Repair owner-only + calendar sync suites | no | yes |
| EC-067 | Owner | Settings persistence contract | Notification/business settings | Update/read settings routes | Persisted settings survive read cycle | PASS | `settings/business` + `settings/notifications` tests | no | yes |
| EC-068 | Owner-only | Restricted integration/config routes | Client/sitter contexts | Hit owner-only settings/integration APIs | Access denied outside owner/admin | PASS | role/owner-only route tests | no | yes |

## 11) Multi-Tenant / Org Isolation (4)

| Test ID | Role | Route/API/System Under Test | Preconditions | Exact Action | Expected Result | Pass/Fail | Notes / Bug Found | Fixed? | Retested? |
|---|---|---|---|---|---|---|---|---|---|
| EC-069 | Owner | Cross-org message isolation | Org A session, Org B thread | Fetch foreign thread/messages | `404/403`, no data leak | PASS | `src/app/api/__tests__/cross-org-isolation.test.ts` | no | yes |
| EC-070 | Client | Cross-client isolation | Client A session, Client B resources | Query foreign resources | Isolation enforced | PASS | `src/app/api/__tests__/cross-client-isolation.test.ts` | no | yes |
| EC-071 | System | Scoped DB guardrails | Multi-tenant query builders | Execute scoped-db tests | Org filter always injected | PASS | `src/lib/tenancy/__tests__/scoped-db.test.ts` | no | yes |
| EC-072 | Any | Tenant org-scope utility | Mixed query contexts | Evaluate `whereOrg` usage paths | Sentinel org checks hold | PASS | `src/lib/__tests__/org-scope.test.ts` | no | yes |

## 12) Error / Fallback / Stale-State (3)

| Test ID | Role | Route/API/System Under Test | Preconditions | Exact Action | Expected Result | Pass/Fail | Notes / Bug Found | Fixed? | Retested? |
|---|---|---|---|---|---|---|---|---|---|
| EC-073 | Any | Missing/deleted records | Stale booking/thread IDs | Fetch stale IDs | Honest `404`/safe error payloads | PASS | Verified across booking/client/messaging route tests | no | yes |
| EC-074 | System | Worker/queue degraded behavior visibility | Redis unavailable in test context | Execute queue-adjacent tests | Failures surfaced without silent corruption | PASS | ECONNREFUSED surfaces in integration logs; routes still guard safely | no | yes |
| EC-075 | Any | Retry/dead-letter surfacing | Failed automation/payout contexts | Exercise failure/retry surfaces | Retry pathways exposed + guarded | PASS | automation-failures owner-only + payout failure tests | no | yes |

---

## Bug Fixes Applied During This Validation

1. **Booking lifecycle hardening**  
   - File: `src/app/api/bookings/[id]/route.ts`  
   - Fix: added strict allowed status set + transition graph validation; invalid status now `400`, invalid transition now `409`.  
   - Added proof tests: `src/app/api/bookings/[id]/__tests__/route.test.ts`.

2. **Pool number release worker correctness**  
   - File: `src/lib/messaging/pool-release-job.ts`  
   - Fix: corrected stale schema fields (`class` -> `numberClass`, relation keys, thread status, assignment window fields), implemented real thread detachment + `lastAssignedAt` reset + settings load from DB.

3. **Integration fixtures for pool release + availability no-conflict edge**  
   - Files: `src/lib/messaging/__tests__/pool-release.test.ts`, `src/lib/availability/__tests__/booking-conflict-integration.test.ts`  
   - Fix: aligned fixtures with current schema and timezone-correct no-conflict case.

4. **Client booking visibility test coverage gap**  
   - Added tests:  
     - `src/app/api/client/bookings/__tests__/route.test.ts`  
     - `src/app/api/client/bookings/[id]/__tests__/route.test.ts`  
     - `src/app/api/bookings/__tests__/route.test.ts`

---

## Verification Commands Executed

- `pnpm lint --fix` (post-fix, multiple runs)  
- `pnpm build` (post-fix, multiple runs; successful)  
- Targeted suites for booking lifecycle, messaging/Twilio, role boundaries, calendar, payroll/reconcile, reports/analytics, automations, integration/status, tenancy.  
- Integration retests (with `RUN_INTEGRATION_TESTS=true`) for fixed excluded suites:
  - `src/lib/messaging/__tests__/pool-release.test.ts`
  - `src/lib/availability/__tests__/booking-conflict-integration.test.ts`
