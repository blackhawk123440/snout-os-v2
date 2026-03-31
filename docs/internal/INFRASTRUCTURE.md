# Snout OS — Infrastructure Documentation

Last updated: 2026-03-29 (Agent 40)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Render Platform                                         │
│                                                          │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────┐  │
│  │ snout-os-web │    │ snout-os-     │    │ snout-os │  │
│  │  (Next.js)   │───▶│ worker        │───▶│ -db (PG) │  │
│  │  UI + API    │    │ (BullMQ)      │    │          │  │
│  └──────┬───────┘    └───────┬───────┘    └──────────┘  │
│         │                    │                           │
│         └────────┬───────────┘                           │
│                  ▼                                        │
│         ┌──────────────┐                                 │
│         │   Redis      │                                 │
│         │   (queues +  │                                 │
│         │    SSE bus)  │                                 │
│         └──────────────┘                                 │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────┐  │
│  │ expire-unpaid  │  │ collect-       │  │ weekly-   │  │
│  │ cron (15 min)  │  │ balances       │  │ recurring │  │
│  │                │  │ cron (daily)   │  │ cron (Sun)│  │
│  └────────────────┘  └────────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────┘

External Services:
  ├── Stripe (payments, Connect payouts, webhooks)
  ├── Twilio (SMS, masked numbers, webhooks)
  ├── OpenPhone (SMS, webhooks)
  ├── Google Calendar API (OAuth, bidirectional sync)
  ├── AWS S3 (file storage: pet photos, visit reports)
  ├── Resend (transactional email)
  ├── OpenAI (AI features: daily delight, sitter matching)
  └── Sentry (error tracking, server + client + edge)
```

---

## Render Configuration (render.yaml)

### Services

| Service | Type | Plan | Purpose |
|---------|------|------|---------|
| `snout-os-web` | web | starter | Next.js app: UI + API routes |
| `snout-os-worker` | worker | starter | BullMQ: automations, calendar sync, payouts, etc. |
| `snout-os-db` | pg | starter | PostgreSQL database |
| `expire-unpaid-bookings` | cron | starter | Every 15 min: expire unpaid bookings |
| `collect-balances` | cron | starter | Daily 8 AM CT: collect advance balances |
| `weekly-recurring-charge` | cron | starter | Sunday 6 AM CT: weekly recurring charges |
| `weekly-recurring-retry` | cron | starter | Sunday 6 PM CT: retry failed weekly charges |

### Audit Findings

| Item | Status | Notes |
|------|--------|-------|
| Health check path | OK | `/api/health` configured on web service (line 60) |
| Health check returns 503 on failure | FIXED | Now returns 503 when DB is down |
| Auto-deploy branch | DEFAULT | Render auto-deploys from connected branch (not explicit in yaml) |
| Worker is separate service | OK | `snout-os-worker` is type `worker`, not `web` |
| DB connection pool | DEFAULT | No explicit pool size in render.yaml or DATABASE_URL. Prisma defaults to `connection_limit=5` for serverless. Consider setting `?connection_limit=10` for the web service. |
| Migration runs before code | OK | `startCommand` runs `prisma migrate deploy` first (line 17) |
| Worker builds Next.js | CONCERN | Worker runs same build command as web (full Next.js build). This is heavy for a worker that only needs `src/worker/index.ts`. Consider a lighter build. |
| Redis URL on web service | MISSING | Redis is on the worker but NOT explicitly in web service env vars. The web service needs Redis for SSE, rate limiting, and queue enqueuing. Ensure REDIS_URL is set in Render dashboard. |
| INTERNAL_API_KEY | SYNC:FALSE | Must be set manually in Render dashboard for all cron services. |

### Gaps Requiring Manual Attention

1. **REDIS_URL not in web service render.yaml** — The web service needs Redis for rate limiting, SSE pub/sub, and queue enqueuing. It's only listed under the worker service. Add `REDIS_URL` to the web service env vars in Render dashboard or render.yaml.

2. **Connection pool size** — Consider appending `?connection_limit=10&pool_timeout=30` to DATABASE_URL for the web service to handle concurrent API requests.

3. **Worker build optimization** — The worker runs `npx next build` which compiles the entire UI. If build times become a problem, consider a dedicated worker build that only compiles `src/worker/`.

---

## Deploy Procedure

### Standard Deploy (auto-deploy)

1. Push to the connected branch (default: `main`)
2. Render detects the push and starts building both `snout-os-web` and `snout-os-worker`
3. **Web service start sequence** (render.yaml line 17):
   ```
   npx prisma migrate deploy && node scripts/verify-schema.js && pnpm run start
   ```
   - `prisma migrate deploy` — applies pending migrations
   - `scripts/verify-schema.js` — verifies schema matches generated client
   - `pnpm run start` — starts Next.js production server
4. Worker starts independently: `pnpm run worker`
5. Health check passes at `/api/health` → service goes live

### Manual Deploy

```bash
# SSH into Render shell or use Render dashboard → Manual Deploy
# The same start sequence runs automatically
```

### Pre-Deploy Checklist

- [ ] All tests pass locally (`pnpm vitest run`)
- [ ] New migrations are committed (`prisma/migrations/`)
- [ ] Prisma client generated (`npx prisma generate`)
- [ ] No `.env` changes needed (check .env.example for new vars)
- [ ] If adding new env vars: set them in Render dashboard BEFORE deploying

---

## Migration Safety

### How Migrations Run

Migrations run as the FIRST step of the web service start command:
```
npx prisma migrate deploy && node scripts/verify-schema.js && pnpm run start
```

This means:
- Migrations apply BEFORE any new code handles requests
- If migration fails, the service does not start
- Render keeps the previous healthy version running until the new one passes health checks
- Zero-downtime: old version serves traffic until new version is healthy

### Failed Migration Recovery

If `prisma migrate deploy` fails on Render:

1. **The service will not start.** Old version continues serving traffic.
2. **Check Render logs** for the specific migration error.
3. **Common causes:**
   - Schema conflict (column already exists, table already exists)
   - Data migration failed (constraint violation on existing data)
   - Timeout (large table migrations)

**Recovery Steps:**

```bash
# Option A: Fix forward (recommended)
# 1. Fix the migration SQL locally
# 2. Test against a copy of production data
# 3. Push the fix — Render will retry

# Option B: Roll back the migration
# 1. Connect to the database directly:
psql $DATABASE_URL

# 2. Check the migration history:
SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 5;

# 3. Mark the failed migration as rolled back:
UPDATE "_prisma_migrations"
SET rolled_back_at = NOW()
WHERE migration_name = '20260329_the_failed_migration';

# 4. Manually revert the SQL changes:
# Run the inverse of whatever the migration did
# (DROP TABLE, ALTER TABLE DROP COLUMN, etc.)

# 5. Push a commit that removes the failed migration file
# Render will redeploy with the clean state
```

**NEVER** delete rows from `_prisma_migrations` — always use `rolled_back_at`.

### Testing Migrations Locally

```bash
# Before pushing a migration to production:

# 1. Reset local DB and apply all migrations
npx prisma migrate reset

# 2. Seed with test data
npx prisma db seed

# 3. Run the new migration against seeded data
npx prisma migrate dev

# 4. Run tests
pnpm vitest run
```

---

## Health Check

**Endpoint:** `GET /api/health`

**Checks performed:**
1. **Database** — `SELECT 1` via Prisma
2. **Redis** — ping via `checkRedisConnection()`
3. **Workers** — count stale queued jobs (>10 min old, excluding cron schedulers)

**Response codes:**
- `200` — all services healthy
- `503` — database is down (critical failure)

**Response shape:**
```json
{
  "status": "ok" | "degraded" | "error",
  "db": "ok" | "error",
  "redis": "ok" | "degraded" | "error",
  "workers": { "status": "ok" | "degraded" | "unknown", "staleJobCount": 0 },
  "version": "abc1234",
  "timestamp": "2026-03-29T..."
}
```

**Render uses this endpoint** to determine service health. If it returns 503,
Render will not route traffic to the new deployment and will keep the previous
version running.

---

## Queue System

### Workers (initialized in src/lib/queue.ts)

| Queue | Purpose | Concurrency | Retry |
|-------|---------|-------------|-------|
| `automations` | Standard notification/automation jobs | 12 | 3 attempts, exponential backoff (3s) |
| `automations.high` | bookingConfirmation, ownerNewBookingAlert | 8 | 3 attempts, exponential backoff (3s) |
| `messages.outbound` | SMS delivery to Twilio/OpenPhone | default | default |
| `messages.thread-activity` | Debounced thread lastMessageAt updates | default | default |
| `calendar-sync` | Google Calendar upsert/delete/sync | default | default |
| `pool-release` | Phone number pool rotation (every 5 min) | default | default |
| `payouts` | Stripe Connect sitter payouts | default | default |
| `finance.reconcile` | Stripe ledger reconciliation | default | default |
| `reminder-scheduler` | Night-before reminder dispatch (every 15 min) | default | default |
| `daily-summary` | Daily summary (9 PM) | default | default |
| `reconciliation` | Pricing drift detection (2 AM) | default | default |

### Dead Letter Handling

Failed jobs (after max retries) are:
1. Logged to Sentry via `captureWorkerError()`
2. Written to EventLog as `automation.dead`
3. Published to SSE ops failures channel
4. Visible in `/ops/automation-failures` admin page

### Idempotency

- BullMQ jobs use `idempotencyKey` as `jobId` to deduplicate
- Stripe webhooks use `StripeWebhookEvent` table (event.id dedup)
- Twilio webhooks use `messageSid` dedup on MessageEvent
- Booking form uses `BookingRequestIdempotency` table

---

## External Service Dependencies

| Service | Required | Fallback When Missing |
|---------|----------|----------------------|
| PostgreSQL | YES | App does not start |
| Redis | In production | Rate limiting disabled, queues don't process, SSE inactive |
| Stripe | For payments | Bookings work, payments fail |
| Twilio | For SMS | Email fallback, in-app messaging only |
| OpenPhone | For OpenPhone SMS | In-app messaging only |
| Resend | For email | Console.log fallback in dev |
| Google Calendar | For calendar sync | Calendar features disabled |
| S3 | For file uploads | Photo upload fails |
| OpenAI | For AI features | Deterministic fallbacks (no AI commentary) |
| Sentry | For error tracking | Errors only in console/logs |

---

## Monitoring

### Sentry

- **Server**: instrumented via `@sentry/nextjs` (10% trace sample rate)
- **Client**: instrumented via `@sentry/nextjs` client config
- **Edge**: 0% trace rate (minimize overhead)
- **Workers**: `captureWorkerError()` in queue failed handlers

### Application Logs

- Structured logging utility exists at `src/lib/logger.ts` but is used in only 1 of 103+ routes
- Most routes use raw `console.error/log/warn`
- **Recommendation**: Migrate to structured logger for production observability

### Real-Time Operations

- `/ops/automation-failures` — failed automation jobs
- `/ops/diagnostics` — system diagnostics
- `/ops/failures` — general failure feed (SSE)
- `/api/health` — infrastructure health
