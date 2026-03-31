# Load-Test Gates

This project includes a reproducible load-test gate harness in `scripts/load/run-gates.ts`.

## Modes

- `mock` (default): staging-safe synthetic mode. No production writes, no auth dependencies.
- `live`: real HTTP/queue calls to `LOAD_TEST_BASE_URL` and `REDIS_URL`.

Set mode with:

```bash
LOAD_TEST_MODE=live npm run load:full
```

## Scripts

- `npm run load:smoke`
- `npm run load:bookings`
- `npm run load:messages`
- `npm run load:reads`
- `npm run load:queues`
- `npm run load:full`

## Required Env (live mode)

- `LOAD_TEST_BASE_URL` (default: `http://localhost:3000`)
- `REDIS_URL` (for queue gates)
- Optional auth/session cookies:
  - `LOAD_TEST_OWNER_COOKIE`
  - `LOAD_TEST_SITTER_COOKIE`
  - `LOAD_TEST_CLIENT_COOKIE`
- Optional thread for messaging:
  - `LOAD_TEST_THREAD_ID`

## Staging Public Booking Unblock

To exercise `/api/form` in `LOAD_TEST_MODE=live` without weakening production SaaS guardrails:

- `ENABLE_PUBLIC_BOOKING_STAGING=true`
- `PUBLIC_BOOKING_STAGING_ORG_BINDINGS=snout-os-staging.onrender.com=default`

Notes:

- `ENABLE_PUBLIC_BOOKING_STAGING` is only honored when runtime is `staging`.
- `PUBLIC_BOOKING_STAGING_ORG_BINDINGS` uses `host=orgId` pairs (comma-separated for multiple hosts).
- Runtime proof visibility: `GET /api/ops/runtime-proof` now reports `publicBookingStaging` status (`enabled/configured/orgId/reason`).

## Artifacts

Each run writes:

- `artifacts/load-tests/<run-id>/summary.json`
- `artifacts/load-tests/<run-id>/benchmark-report.md`
- per-gate JSON files

Latest pointers are also written to:

- `artifacts/load-tests/latest/summary.json`
- `artifacts/load-tests/latest/benchmark-report.md`

## Gate Thresholds

Thresholds are defined in `scripts/load/thresholds.ts` and include:

- p50/p95/p99 latency
- error rate
- duplicate creation rate for idempotent create flows
- queue drain rate
- dead-letter and retry caps

