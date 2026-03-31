# Smoke Tests

Local and CI smoke and a11y test harness for Snout OS.

## Quick Start (Local)

```bash
cp .env.smoke.example .env.smoke
pnpm test:ui:smoke
```

This single command (same in CI):
1. Starts Postgres via Docker (port 5433)
2. Resets DB (migrate + seed)
3. Builds Next.js
4. Starts Next.js with smoke env
5. Runs Playwright smoke tests
6. Shuts down cleanly

**Prerequisites:** Docker Desktop (running), Node 20+, pnpm

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm test:ui:smoke` | **One command** – full harness locally, Playwright smoke only in CI |
| `pnpm test:e2e:a11y` | **One command** – same harness, runs a11y axe-core suite instead |
| `pnpm test:ui:smoke:local` | Full harness (alias when running test:ui:smoke locally) |
| `pnpm db:smoke:up` | Start Postgres container |
| `pnpm db:smoke:down` | Stop and remove container |
| `pnpm db:smoke:reset` | Down -v, up, migrate, seed |

Both `test:ui:smoke` and `test:e2e:a11y` use the same harness:
- **Local:** `tsx scripts/smoke.ts` (default) or `tsx scripts/smoke.ts --a11y`
- **CI:** Playwright runs directly (workflow starts server); pass `--a11y` for a11y job

## Environment

Copy `.env.smoke.example` to `.env.smoke`:

```bash
cp .env.smoke.example .env.smoke
```

The smoke env uses:
- `DATABASE_URL` → `postgresql://postgres:postgres@localhost:5433/snout_smoke`
- `SMOKE=true` → relaxes Stripe/S3 checks in verify-runtime (test-only)
- `ENABLE_E2E_LOGIN=true` → allows E2E auth for Playwright

No real Stripe, Twilio, or Google credentials required.

## CI

CI uses its own Postgres service and starts the app with `pnpm start`. It runs `pnpm test:ui:smoke` or `pnpm test:e2e:a11y` with `reuseExistingServer: true`. Production runtime checks remain strict; only smoke/e2e mode relaxes optional integration checks.
