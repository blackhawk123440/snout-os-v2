# System Completion Audit

Last updated: 2026-03-06

## Summary

- Total complete: 14
- Total partial: 35
- Total missing: 2
- Total broken: 6
- Total present but not wired end-to-end: 10

Status rubric used:
- `Complete`: route/API/action/access/mobile/wiring all present
- `Partial`: materially functional but has missing pieces or non-trivial gaps
- `Missing`: feature/module not implemented
- `Broken`: implemented surface exists but core behavior likely fails
- `Present but not wired end-to-end`: page/feature exists but does not complete the system loop

## Audit Table

| Area | Module / Feature | Routes / APIs | Status | What works | What is missing / broken | System dependencies | Priority to fix |
|---|---|---|---|---|---|---|---|
| Owner | Dashboard / Overview | `/dashboard`, `/`, `/owner-dashboard`; `/api/ops/metrics`, `/api/ops/command-center/attention` | Partial | Real KPI + queue snapshot and quick actions | Routing intent split (`/` -> command center, login -> dashboard) creates product ambiguity | Auth role redirects, ops metrics API | P2 |
| Owner | Bookings | `/bookings`, `/bookings/[id]`, `/bookings/new`; `/api/bookings*`, `/api/sitters`, `/api/form` | Complete | List/detail/new + status/sitter actions and event view | No critical blocker found in owner booking loop | Booking APIs, sitter APIs, ops actions | P3 |
| Owner | Calendar | `/calendar`; `/api/calendar*`/calendar feeds | Partial | Month grid, day cards, quick links to booking actions | Day/week called out as coming soon; feature flag path can degrade to sparse experience | Booking data, sitter schedule model | P2 |
| Owner | Clients | `/clients`, `/clients/[id]`; `/api/clients*` | Complete | List/detail, metrics/history, linked actions | No major gap found | Booking/payment/report linkage | P3 |
| Owner | Sitters | `/sitters`, `/sitters/[id]`; `/api/sitters*` | Partial | Functional list/detail with ops links | Detail completeness varies and depends on dashboard API quality | Sitter dashboard API, payouts, assignments | P2 |
| Owner | Sitter Profile (direct module) | `/sitters/profile` | Present but not wired end-to-end | Reachable shell exists | Explicit placeholder, no live sitter control surface | Sitters module, command center | P2 |
| Owner | Messaging hub | `/messaging`, `/messages?tab=*` | Partial | IA entrypoint exists and links to all messaging sub-surfaces | `/messaging/*` subroutes are mostly placeholders; core still concentrated in `/messages` | Messaging API stack, twilio setup | P1 |
| Owner | Numbers | `/numbers`; `/api/numbers*`, setup sync APIs | Partial | Inventory table and most actions are wired | "Release from Twilio" is explicit TODO/not implemented | Twilio provider, assignments, threads | P1 |
| Owner | Assignments | `/assignments`; `/api/assignments/windows*` | Partial | Assignment window CRUD present | Conflicts path expected by UI is not fully backed in current local routes | Messaging routing rules, sitter threads | P1 |
| Owner | Twilio Setup | `/twilio-setup`, `/messages?tab=setup`; `/api/setup/*`, `/api/ops/twilio-setup-diagnostics` | Partial | Connect/test/install/readiness/Test SMS workflows present | Setup/install path appears to target webhook stack with schema drift (high risk) | Messaging webhook, number sync, twilio credentials | P0 |
| Owner | Automations | `/automation`, `/automations`, `/automation-center*`; `/api/automations*`, `/api/settings` | Partial | Multiple UI surfaces and controls exist | Surface fragmentation + dependency on endpoints not consistently local; hard to guarantee single production path | Worker queues, settings API | P1 |
| Owner | Growth / Tiers | `/growth`, `/settings/tiers` | Present but not wired end-to-end | Route exists and links to tiers | `/growth` is placeholder only | Sitter performance data, tier engine | P2 |
| Owner | Payroll | `/payroll`; `/api/payroll*` (called by UI) | Present but not wired end-to-end | Rich UI shell exists | API backing uncertain/incomplete in current app routes; high E2E uncertainty | Stripe Connect transfers, ledger | P1 |
| Owner | Reports / Analytics | `/reports`, `/analytics` | Present but not wired end-to-end | Module routes exist | `/reports` placeholder; analytics appears scaffold-level | Finance metrics, bookings trends, retention data | P1 |
| Owner | Settings | `/settings*`; `/api/settings` | Partial | Settings UX and tabs exist | API contract centralization/proxy dependence leaves uncertainty on full persistence coverage | Auth, org-scoped settings, integrations | P2 |
| Owner | Integrations | `/integrations`; `/api/integrations*` | Partial | Strong UI coverage for provider setup/testing | Endpoint wiring appears mixed/proxy dependent; E2E certainty not full | Twilio, Stripe, calendar, AI | P1 |
| Owner | Ops / Diagnostics | `/ops/diagnostics`, `/ops/*`; `/api/ops/*` | Complete | Diagnostics index + actionable ops pages are connected | No major blocker found in route graph | Command center, event logs, queues | P3 |
| Owner | Finance / Payments / Reconciliation | `/finance`, `/payments`, `/ops/finance/reconciliation`; `/api/payments`, `/api/ops/finance/*` | Partial | Payments and reconciliation paths are substantial | `/finance` still includes stub transaction path and placeholder detail | Stripe charges, ledger, reconcile jobs | P1 |
| Owner | Command Center | `/command-center`; `/api/ops/command-center/*`, `/api/ops/stats` | Partial | Closed-loop attention actions and verifier coverage exist (staging PASS evidence) | Remaining placeholders in page (map/AI) and still dependent on stable worker infra | EventLog, staffing resolver, ops retry endpoints, verifier | P1 |
| Sitter | Home / Today | `/sitter`, `/sitter/today`; `/api/sitter/today`, `/api/realtime/sitter/today` | Partial | Visit execution surface + optimistic updates + SSE refresh | Shell unread badge contract mismatch, and some state assumptions brittle | Check-in/out APIs, reports, messaging threads | P1 |
| Sitter | Bookings list | `/sitter/bookings`; `/api/sitter/bookings` | Complete | Loading/empty/error/data states, tested auth edge cases | No critical blocker found | Booking scope API, auth context | P3 |
| Sitter | Booking detail | `/sitter/bookings/[id]`; `/api/sitter/bookings/[id]`, checklist/check-in/out APIs | Partial | Timer/checklist/start-end-report CTA flow is strong | Checklist mutability not fully status-guarded server-side | Booking state machine, report creation | P1 |
| Sitter | Inbox | `/sitter/inbox`; `/api/sitter/threads*` | Broken | UI surface exists and template buttons are present | API/schema contract drift likely causes runtime failures; sitter-owner-client message model mismatch | MessageEvent model, thread model, realtime | P0 |
| Sitter | Schedule / Calendar | `/sitter/calendar`; `/api/sitter/calendar` | Present but not wired end-to-end | Calendar route loads bookings and links to actions | Mode toggles and delight flow not fully wired (dead-end behavior) | Booking feed, report creation | P2 |
| Sitter | Reports list/new/edit | `/sitter/reports*`; `/api/bookings/[id]/daily-delight`, `/api/sitter/reports/[id]` | Present but not wired end-to-end | New/edit report flow works with edit window | Reports list page not actually listing reports; partial loop visibility | Report model, client reports surfaces | P1 |
| Sitter | Earnings | `/sitter/earnings`; `/api/sitter/earnings`, transfers/completed-jobs APIs | Partial | Earnings totals and payout-related data render | Time-range tabs are mostly cosmetic; some breakdowns are stubs | Payout transfer pipeline, completed bookings | P2 |
| Sitter | Profile | `/sitter/profile`; `/api/sitter/me`, stripe status/connect, delete/export | Partial | Core profile and payout setup signals exist | UX and mutation maturity uneven; heavy alert-based control flow | Availability, stripe connect, account APIs | P2 |
| Sitter | Availability | `/sitter/availability`; `/api/sitter/availability*` | Partial | Availability/block-off core actions present | Overrides/rules UX depth limited vs API capability | Assignment eligibility, schedule | P2 |
| Sitter | Payout setup | `/sitter/profile` stripe card + `/api/sitter/stripe/*` | Partial | Connect + status checks exist | Remediation and payout troubleshooting loop limited | Stripe Connect, payouts worker | P2 |
| Sitter | Tier / performance | `/sitter/performance`, legacy APIs | Present but not wired end-to-end | APIs/components exist in legacy paths | Canonical route is largely placeholder and not connected to full metrics flow | SRS/tier logic, sitter dashboard APIs | P1 |
| Sitter | Check-in / check-out / report loop | Today/detail/report APIs | Partial | Core loop exists, includes offline support | Daily-delight API may return success even if report write fails | EventLog, report persistence, queue side-effects | P0 |
| Sitter | Quick templates | `/sitter/inbox` template actions | Partial | Template actions and tests exist | Depends on broken inbox backend path | Messaging APIs, offline replay | P1 |
| Sitter | Checklist / timer | `/sitter/bookings/[id]`, checklist API | Partial | Timer/checklist lock window logic implemented | Server-side status gate not strict enough | Booking status correctness | P2 |
| Client | Home | `/client/home`; `/api/client/home` | Partial | At-a-glance and latest report/feed modules are real | No robust realtime path; dependent on upstream report consistency | Reports/bookings/payments data | P2 |
| Client | Bookings | `/client/bookings*`; `/api/client/bookings*`, `/api/form` for creation | Partial | Booking read loop works and reflects status changes | Booking create path is not truly client-native and may not bind identity cleanly | Public form mapper, booking APIs | P1 |
| Client | Pets | `/client/pets*`; `/api/client/pets*` | Partial | Pets read paths work | Add/edit flows missing in portal despite UX expectations | Client profile, pet CRUD | P2 |
| Client | Messages | `/client/messages*`; `/api/client/messages*`, cross-role messaging APIs | Broken | Client-side message read/send exists | Cross-role messaging integrity and authorization are inconsistent; sitter side likely incompatible | MessageEvent/thread models, twilio/webhook, role enforcement | P0 |
| Client | Billing | `/client/billing`; `/api/client/billing`, stripe webhook | Partial | Billing summary and history are wired to DB/stripe artifacts | Primarily read-only and dependent on webhook fidelity | Stripe webhook, booking payment state | P2 |
| Client | Profile | `/client/profile`; `/api/client/me` | Partial | Profile visibility and account actions are present | Profile edit depth limited | Export/delete, auth session | P2 |
| Client | Reports | `/client/reports*`; `/api/client/reports*` | Complete | End-to-end report visibility from sitter submissions | No major blocker identified | Report creation path, client report APIs | P3 |
| Client | Export / delete account | `/client/settings/export`, profile actions; `/api/client/export`, `/api/client/delete-account` | Complete | Export and soft-delete paths implemented with tests | No major blocker identified | Auth, scoped data export | P3 |
| Client | Loyalty | Billing/home loyalty display | Present but not wired end-to-end | Loyalty data can render when records exist | No clear accrual/update pipeline in app path | Rewards engine, billing events | P1 |
| Client | Latest report module | Home module via `/api/client/home` | Complete | Latest report card is connected to report model | No major blocker identified | Report pipeline, booking linkage | P3 |
| Client | At-a-glance modules | Home/sidebar widgets; `/api/client/home`, `/api/client/billing` | Partial | Useful summary components are present | Partial fallback behavior and not fully resilient to mixed API failures | Multiple client APIs | P2 |
| Client | FAB / mobile nav | `ClientBottomNav`, FAB to `/bookings/new` | Partial | Mobile navigation exists and is coherent | FAB destination is owner-oriented flow, not dedicated client flow | Booking intake path | P1 |
| Shared infra | Auth / role access | Middleware + auth/rbac libs + role checks | Partial | Strong baseline and broad coverage | Some routes still rely on looser checks; e2e bypass route requires strict env discipline | Session, middleware, request context | P1 |
| Shared infra | Tenancy / org isolation | scoped-db libs + tests + scripts | Partial | Good architecture and tests exist | Raw prisma usage still present in high-risk areas | DB access patterns, org keys | P0 |
| Shared infra | Messaging / Twilio masking | `/api/twilio/inbound`, `/api/messages/webhook/twilio`, setup routes | Broken | Components of masking stack exist | Competing/stale webhook paths with schema drift likely break inbound processing | Message models, number mapping, twilio setup | P0 |
| Shared infra | Numbers inventory engine | setup/sync + number models | Partial | Number sync and inventory concepts exist | Field-name drift risks silent classification errors | Twilio sync, assignments, messaging | P1 |
| Shared infra | Assignments/routing engine | dynamic number routing libs + windows APIs | Partial | Deterministic routing logic exists | Not uniformly enforced validations and API completeness | Thread ownership, sitter availability | P1 |
| Shared infra | Calendar sync / repair | calendar libs + repair ops pages/APIs | Partial | Repair workflows exist and are operator-facing | Queue/worker dependence can break loop silently | Worker queue, event logs | P1 |
| Shared infra | Automations / queues / workers | queue libs, worker entrypoint, automation queue | Partial | Queue architecture substantial | Reliability tied to worker deploy parity; init paths fragmented | Redis, worker service, ops retries | P0 |
| Shared infra | Stripe payments | `/api/webhooks/stripe`, payment/ledger persistence | Partial | Payment webhook and charge persistence exist | Org-scope/consistency gaps in parts of persistence | Stripe metadata, ledger, booking ids | P1 |
| Shared infra | Stripe Connect payouts | payout engine/queue + ops payout routes | Partial | Connect + payout handling exists | Dependent on worker uptime and consistent transfer recovery | Worker deploy, event logs, finance ops | P1 |
| Shared infra | Ledger / reconciliation | finance libs + `/api/ops/finance/*` | Partial | Reconcile flows and exports exist | Remaining schema/scope assumptions and uneven model completeness | Payments, refunds, stripe transfers | P1 |
| Shared infra | AI governance + features | AI governance libs + `/ops/ai` | Partial | Governance rails and controls exist | Feature breadth limited, and dependency consistency mixed | AI providers, settings, observability | P2 |
| Shared infra | Offline / PWA | service worker + offline libs + sitter flows | Partial | Offline sitter flow is real and documented | Conflict model simplistic; not broad cross-role coverage | Local queue replay, API idempotency | P2 |
| Shared infra | Realtime / SSE | `/api/realtime/*`, bus libs | Partial | SSE endpoints and auth/rate-limits exist | Redis fallback can mask production fanout problems | Redis, bus, subscriber patterns | P1 |
| Shared infra | EventLog / observability | event logger libs + EventLog usage | Partial | Event logs are widely used in ops flows | Inconsistent taxonomy and partial coverage in some paths | Ops auditability, verifier assertions | P1 |
| Shared infra | Rate limiting / security | rate-limit lib + protected routes + webhook signatures | Partial | Broad baseline security controls | Secret hygiene and some permissive API exposure remain | Env secrets, middleware, API guards | P0 |
| Shared infra | Health checks | `/api/health`, startup verification | Partial | Health endpoint and startup checks are robust for DB/Redis/env | Does not fully attest worker processing parity | Startup checks, queue health | P1 |
| Shared infra | Smoke tests | `scripts/smoke.ts`, e2e smoke suite | Partial | CI-safe no-db and full harness modes exist | Coverage is still selective; infra-dependent failures can bypass product reality | CI env, local server availability | P2 |
| Shared infra | A11y tests | `tests/e2e/a11y-smoke.spec.ts` | Partial | Baseline coverage exists | Not comprehensive across all major routes | Playwright harness | P3 |
| Shared infra | Staging verifier / command-center verifier | `scripts/verify-command-center.ts`, QA docs | Complete | Deterministic verifier with staging PASS evidence | Scope is command-center centric, not whole product | Seed/reset routes, ops APIs | P3 |
| Shared infra | Migrations / startup checks | `prisma migrate deploy` start path + verify-runtime | Partial | Runtime startup checks are strict and helpful | CI still uses `db push --accept-data-loss`, policy mismatch | DB migration workflow, CI discipline | P0 |
| Shared infra | Seed/reset fixtures | `/api/ops/command-center/seed-fixtures`, `/reset-fixtures` + tests | Complete | Non-prod guarded and tested; verifier-friendly | Must keep env guards strict | E2E auth key, runtime env detection | P3 |
| Shared infra | Deployment / worker deploy parity | `render.yaml`, worker docs | Broken | Desired pattern is documented | Deployed blueprint lacks guaranteed worker parity with web | Render service config, release process | P0 |

## Verification Basis Used

- **Code inspection:** Route/page/API implementations across `src/app`, `src/lib`, `prisma/schema.prisma`
- **Automated tests in repo:** unit + integration + e2e smoke and a11y specs
- **Deterministic verifier evidence:** command-center verifier + QA docs (`owner-v2-*` signoff docs)
- **Operational docs:** deployment/migration/ops docs in `docs/`

This audit intentionally marks many systems as `Partial` when end-to-end proof is incomplete, even if page/UI exists.

## Critical blockers before production

1. Messaging/Twilio inbound path inconsistency (`/api/twilio/inbound` vs `/api/messages/webhook/twilio`) with schema drift risk.
2. Sitter inbox API/model mismatch likely causing runtime failures and cross-role messaging breakage.
3. Worker deployment parity not guaranteed by deployment blueprint; queue-dependent features can silently fail.
4. Tenancy enforcement not uniform due remaining raw prisma usage in sensitive paths.
5. CI migration strategy diverges from production-safe migration strategy.
6. Security hygiene issues (sensitive token handling and permissive messaging API surfaces) need hardening.

## Features present but not wired end-to-end

- Owner Growth/Tiers (`/growth`) is placeholder only.
- Owner Reports (`/reports`) is placeholder; analytics surface is not full business reporting.
- Owner Payroll UI present but backend certainty incomplete in local route set.
- Owner Messaging subroutes (`/messaging/*`) are mostly launcher placeholders.
- Sitter performance route is placeholder while deeper tier/perf logic lives elsewhere.
- Sitter reports list route does not list real reports despite create/edit being implemented.
- Client loyalty is displayed but accrual/update loop is unclear.
- Client booking FAB/CTA routes into owner-style booking intake flow.
- Calendar advanced modes exist in UI but not fully operationalized.
- Health checks do not guarantee worker processing correctness.

## Pages that exist but are misleadingly incomplete

- `/growth`
- `/reports`
- `/sitters/profile`
- `/messaging/inbox`
- `/messaging/sitters`
- `/messaging/numbers`
- `/messaging/assignments`
- `/finance` (stub transactions/detail placeholders remain)
- `/sitter/performance`
- `/sitter/reports` (empty-state shell not fully wired listing)

