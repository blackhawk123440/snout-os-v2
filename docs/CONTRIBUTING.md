# Contributing to Snout OS

## Development Setup

```bash
npm install
cp .env.example .env
# Edit .env with DATABASE_URL, NEXTAUTH_SECRET, etc.
npm run db:push
npm run dev
```

## Running Tests

- **Core tests:** `npm run test:core` — Unit and integration tests (excludes slow/quarantined tests)
- **All tests:** `npm run test` — Full suite including quarantined tests
- **Type check:** `npm run typecheck`
- **Lint:** `npm run lint`
- **Build:** `npm run build`

## PR Checks

Before opening a PR, ensure:

- `npm run lint` passes
- `npm run typecheck` passes
- `npm run test:core` passes (zero failures)
- `npm run build` succeeds

## Quarantined Tests

The following tests are excluded from `test:core` due to slowness or flakiness:

- `**/srs-engine.test.ts` — SRS engine (heavy)
- `**/pool-capacity.test.ts` — Pool capacity (slow)
- `**/one-thread-per-client.test.ts` — One thread per client (slow)

Run them manually with `npm run test` when needed.

## Workers

Background workers process automation jobs (booking alerts, reminders, etc.) via BullMQ.

```bash
REDIS_URL=redis://localhost:6379 npm run worker
```

Requires Redis. Production: run as a separate process (e.g. Render Background Worker).

## Database

- Schema: `prisma/schema.prisma`
- Push schema: `npm run db:push`
- Seed: `npm run db:seed`
- Studio: `npm run db:studio`
