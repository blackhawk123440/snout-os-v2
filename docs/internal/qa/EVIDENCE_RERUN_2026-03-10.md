# Evidence-Backed Rerun (2026-03-10)

This document records only directly executed evidence from this rerun.

## A) Core Test Commands

### 1) Lint

Command:

`pnpm lint --fix`

Terminal output:

```text
> snout-os@1.0.0 lint /Users/leahhudson/Desktop/final form/snout-os
> eslint . --fix --fix
```

Result: PASS (exit code 0)

### 2) Build

Command:

`pnpm build`

Terminal output (key lines):

```text
> snout-os@1.0.0 build /Users/leahhudson/Desktop/final form/snout-os
> cross-env NODE_OPTIONS=--max-old-space-size=4096 prisma generate && cross-env NODE_OPTIONS=--max-old-space-size=4096 next build
...
✓ Compiled successfully in 25.4s
...
✓ Generating static pages (222/222)
...
Route (app) ...
...
```

Full output source captured at:

`/Users/leahhudson/.cursor/projects/Users-leahhudson-Desktop-final-form/agent-tools/5fa353d5-f37a-4afc-af5c-83bb1b71dbfb.txt`

Result: PASS (exit code 0)

### 3) Targeted high-priority suites (booking lifecycle)

Command:

`pnpm vitest run "src/app/api/bookings/[id]/__tests__/route.test.ts" "src/app/api/bookings/[id]/check-in/__tests__/route.test.ts" "src/app/api/bookings/[id]/check-out/__tests__/route.test.ts" "src/app/api/bookings/conflicts/__tests__/route.test.ts" "src/app/api/bookings/__tests__/route.test.ts"`

Output:

```text
Test Files  5 passed (5)
Tests  20 passed (20)
```

Result: PASS (exit code 0)

### 4) Targeted high-priority suites (Twilio/messaging)

Command:

`pnpm vitest run "src/app/api/messages/webhook/twilio/__tests__/route.test.ts" "src/app/api/twilio/inbound/__tests__/route.test.ts" "src/app/api/messages/__tests__/phase-1-5-hardening.test.ts" "src/app/api/messages/__tests__/phase-4-2-sitter.test.ts" "src/lib/messaging/__tests__/twilio-provider.test.ts" "src/lib/messaging/__tests__/invariants.test.ts"`

Output:

```text
Test Files  6 passed (6)
Tests  46 passed (46)
```

Result: PASS (exit code 0)

### 5) Targeted high-priority suites (role boundaries + isolation)

Command:

`pnpm vitest run "src/lib/__tests__/middleware-protection.test.ts" "src/lib/__tests__/protected-routes.test.ts" "src/lib/__tests__/public-routes.test.ts" "src/app/api/__tests__/cross-org-isolation.test.ts" "src/app/api/__tests__/cross-client-isolation.test.ts" "src/lib/tenancy/__tests__/scoped-db.test.ts"`

Output:

```text
Test Files  6 passed (6)
Tests  111 passed (111)
```

Result: PASS (exit code 0)

### 6) Targeted high-priority suites (calendar/payroll/analytics/integration)

Command:

`RUN_INTEGRATION_TESTS=true pnpm vitest run --config vitest.config.ts "src/lib/calendar/__tests__/sync.test.ts" "src/app/api/ops/calendar/repair/__tests__/owner-only.test.ts" "src/lib/messaging/__tests__/pool-release.test.ts" "src/lib/payout/__tests__/payout-engine.test.ts" "src/lib/finance/__tests__/reconcile.test.ts" "src/app/api/analytics/kpis/__tests__/kpis.test.ts" "src/app/api/analytics/trends/__tests__/trends.test.ts"`

Output:

```text
Test Files  7 passed (7)
Tests  48 passed (48)
```

Result: PASS (exit code 0)

---

## B) Core Staging Proof

### 1) `/api/health`

Command:

`curl -i "https://snout-os-staging.onrender.com/api/health"`

Output:

```text
HTTP/2 200
...
{"status":"ok","db":"ok","redis":"ok","version":"6635bdeae6623b1c2e973a384a28f6026ce56d4e","commitSha":"6635bde","buildTime":"2026-03-10T02:53:33.622Z","envName":"staging","timestamp":"2026-03-10T02:53:33.622Z"}
```

Result: VERIFIED

### 2) Owner dashboard core routes + automations (UI screenshots)

Command:

`E2E_AUTH_KEY="test-e2e-key-change-in-production" SITTER_BOOKING_ID="8f48c06f-abf0-4bbc-bcd8-fce7542ea01c" node "scripts/staging-ui-proof.mjs"`

Output lines:

```text
[ui-proof] owner /dashboard -> VERIFIED finalUrl=https://snout-os-staging.onrender.com/dashboard ...
[ui-proof] owner /bookings -> VERIFIED finalUrl=https://snout-os-staging.onrender.com/bookings ...
[ui-proof] owner /calendar -> VERIFIED finalUrl=https://snout-os-staging.onrender.com/calendar ...
[ui-proof] owner /automations -> VERIFIED finalUrl=https://snout-os-staging.onrender.com/automations ...
```

Screenshots:

- `artifacts/ui-proof/owner-dashboard.png`
- `artifacts/ui-proof/owner-bookings.png`
- `artifacts/ui-proof/owner-calendar.png`
- `artifacts/ui-proof/owner-automations.png`

Result: VERIFIED

### 3) Client booking flow (UI screenshots)

Same command as above.

Output lines:

```text
[ui-proof] client /client/home -> VERIFIED finalUrl=https://snout-os-staging.onrender.com/client/home ...
[ui-proof] client /client/bookings -> VERIFIED finalUrl=https://snout-os-staging.onrender.com/client/bookings ...
[ui-proof] client /client/bookings/new -> VERIFIED finalUrl=https://snout-os-staging.onrender.com/client/bookings/new ...
```

Screenshots:

- `artifacts/ui-proof/client-home.png`
- `artifacts/ui-proof/client-bookings.png`
- `artifacts/ui-proof/client-bookings-new.png`

Result: VERIFIED

### 4) Sitter visit execution (API proof + UI screenshots)

Seed data command:

`curl -i -X POST "https://snout-os-staging.onrender.com/api/ops/command-center/seed-fixtures" -H "content-type: application/json" -H "x-e2e-key: test-e2e-key-change-in-production" --data '{}'`

Sitter bookings retrieval command:

`curl -s -c "/tmp/sitter-e2e.cookie" -X POST "https://snout-os-staging.onrender.com/api/ops/e2e-login" -H "content-type: application/json" -H "x-e2e-key: test-e2e-key-change-in-production" --data '{"role":"sitter"}' && curl -s -b "/tmp/sitter-e2e.cookie" "https://snout-os-staging.onrender.com/api/sitter/bookings"`

Check-in/check-out command:

`curl -i -b "/tmp/sitter-e2e.cookie" -X POST "https://snout-os-staging.onrender.com/api/bookings/8f48c06f-abf0-4bbc-bcd8-fce7542ea01c/check-in" -H "content-type: application/json" --data '{"lat":33.75,"lng":-84.39}' && curl -i -b "/tmp/sitter-e2e.cookie" -X POST "https://snout-os-staging.onrender.com/api/bookings/8f48c06f-abf0-4bbc-bcd8-fce7542ea01c/check-out" -H "content-type: application/json" --data '{"lat":33.75,"lng":-84.39}'`

Output lines:

```text
{"ok":true,"status":"in_progress"}
...
{"ok":true,"status":"completed"}
```

UI screenshots:

- `artifacts/ui-proof/sitter-today.png`
- `artifacts/ui-proof/sitter-bookings.png`
- `artifacts/ui-proof/sitter-booking-detail.png`

Result: VERIFIED

### 5) Calendar verification

Command:

`BASE_URL="https://snout-os-staging.onrender.com" E2E_AUTH_KEY="test-e2e-key-change-in-production" pnpm run verify:calendar`

Output:

```text
verify-calendar started
bookings.count=108
conflicts.count=59
repair.ok=true jobId=29
repair.validation=400 when sitterId missing
verify-calendar OK
```

Result: VERIFIED

---

## C) Matrix Discipline for This Rerun

Only cases with direct command/output/screenshot evidence above are marked verified in this rerun subset.

- Verified rerun subset: lint/build + core targeted suites + staging health + owner routes + client booking flow + sitter execution + automations page + calendar verification.
- Any matrix case not directly linked to one of the commands/screenshots in this doc is **UNVERIFIED in this rerun**.
