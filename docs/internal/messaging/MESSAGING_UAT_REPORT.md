# Messaging UAT Report (Real Twilio Validation)

Date: 2026-03-14  
Branch: `qa/full-real-twilio-messaging-validation`  
Environment: `https://snout-os-staging.onrender.com` (staging)  
Raw evidence: `docs/qa/messaging-uat-results.json`

## Executive Outcome

Result: **blocked** for production rollout.

Reason: staging is not currently configured with Twilio provider credentials, numbers, or webhook installation, so real Twilio end-to-end validation could not be completed under the required rules.

## Exact Env / Setup Used

- Base URL: `https://snout-os-staging.onrender.com`
- Auth path: `POST /api/ops/e2e-login` (owner/client/sitter sessions)
- Test data scope: e2e fixture users + bookings labeled `messaging-UAT` in names/notes/emails
- Runtime health:
  - `GET /api/health` => `status=ok`, `db=ok`, `redis=ok`, `envName=staging`
- Twilio readiness checks:
  - `GET /api/setup/provider/status` => `connected=false`
  - `POST /api/setup/provider/test` => `"No credentials found. Please save credentials first."`
  - `GET /api/setup/webhooks/status` => `status=not_configured`
  - `POST /api/setup/numbers/sync` => `"Connect Twilio first."`
- Pool health endpoint:
  - `GET /api/messages/pool-health` returned `404` in this staging deployment

## Scenario-by-Scenario Results

| ID | Scenario | Pass/Fail | Key Observations |
|---|---|---|---|
| S1 | website form -> intake -> availability -> M&G -> approval -> service | **Fail** | `/api/form` rejected booking: `Public booking is disabled in SaaS mode until org binding is configured`. |
| S2 | client portal booking flow | **Fail** | Booking created; immediate `bookingId` thread lookup was empty in this environment. |
| S3 | same sitter rebook | **Fail** | Booking created; immediate `bookingId` thread lookup was empty in this environment. |
| S4 | different sitter rebook / rotating sitter | **Fail** | Booking created; immediate `bookingId` thread lookup was empty in this environment; reassignment lifecycle could not be validated. |
| S5 | M&G scheduled with one approval missing | **Fail** | No thread found, workflow actions not exercisable. |
| S6 | post-service grace + expiry reroute | **Fail** | Depends on S2 thread artifact; unavailable. |
| S7 | masking integrity test | **Fail** | No thread artifact available; masking could not be validated in live flow. |
| S8 | anti-poaching soft detection | **Fail** | No thread artifact available; anti-poaching flag path not testable. |
| S9 | booking automation chain | **Fail** | Booking status path works, but no thread lifecycle/timeline path to validate messaging automations. |
| S10 | SaaS multi-tenant isolation | **Fail** | No second-org e2e owner session available from probe accounts. |

## Masking Verification Summary

- Direct verification of masked lane behavior in real Twilio flows: **not achieved**.
- Blocking dependency: thread creation/routing + Twilio provider readiness absent in staging.
- Critical assertions still unverified in this run:
  - client never sees sitter real number in normal flow
  - sitter never sees client real number in normal flow
  - no raw direct-send fallback in normal Twilio flow

## Booking/Thread Lifecycle Contract Note

- Current runtime behavior treats lifecycle sync on booking create as best-effort (non-blocking), not a hard booking transaction guarantee.
- In this environment, booking creation did not guarantee immediate booking-linked thread visibility via `bookingId` filter.
- Messaging touchpoints can still create/reuse a thread lane, but that lane may not be booking-linked without successful lifecycle sync.

## Automation Verification Summary

- Messaging automations tied to thread lifecycle were **not verifiable** due missing thread artifacts.
- Booking CRUD/status endpoints were reachable and functional, but did not produce corresponding messaging thread visibility in owner thread listing for tested bookings.

## Multi-Tenant Isolation Summary

- Required `>=2 org` live validation not completed.
- e2e login probe for alternate owner accounts did not yield a second org session.
- Isolation status: **unverified / blocked by fixture availability**.

## Defects / Gaps Found

| Severity | Area | Defect / Gap | Recommended Fix |
|---|---|---|---|
| **Blocker** | Twilio provider | Staging has no provider credentials (`provider/status connected=false`). | Configure Twilio Account SID/Auth Token in staging org credential store. |
| **Blocker** | Numbers / webhooks | No Twilio numbers synced, webhook status not configured. | Sync incoming numbers and install webhooks (`/api/setup/numbers/sync`, `/api/setup/webhooks/install`). |
| **Blocker** | Messaging lifecycle visibility | Bookings created in UAT did not surface as owner-visible booking-linked threads for `bookingId` lookups. | Harden lifecycle sync path or update scenario contract to treat booking-linked thread creation as non-guaranteed until messaging touchpoint + successful sync. |
| High | UAT scenario coverage | Website form path blocked in SaaS mode due org binding requirement. | Enable org-bound public form in UAT tenant or provide dedicated form-bound UAT org. |
| Medium | Multi-tenant validation | Second-org owner fixture unavailable for e2e login. | Seed explicit `messaging-UAT-org2` owner/client/sitter fixtures and publish test credentials. |

## Screenshots / Logs

- Structured execution log: `docs/qa/messaging-uat-results.json`
- API readiness evidence embedded in the same JSON (`readiness` section with provider/webhook/sync outcomes).

## Production Rollout Recommendation

Recommendation: **blocked**

Required before re-running this UAT:

1. Connect real Twilio credentials in staging org.
2. Sync real Twilio numbers and verify webhook installation.
3. Confirm worker + messaging thread lifecycle creation for new bookings.
4. Enable a form-bound UAT org for website booking scenario.
5. Seed second-org UAT fixtures for multi-tenant isolation scenario.

