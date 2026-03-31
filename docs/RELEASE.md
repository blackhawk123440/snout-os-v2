# Release Guide

How to deploy a new version, run migrations, rollback, and handle worker rollouts.

## Deploying a New Version

1. **Pre-deploy**
   - Run `pnpm run check-env --prod` to validate production env vars
   - Run `pnpm run typecheck` and `pnpm run test:core`
   - Ensure CI is green (lint, typecheck, test:core, build, e2e:smoke)

2. **Database migrations**
   - Run migrations **before** deploying new code (see below)

3. **Deploy**
   - Deploy **worker first**, then web (see Worker rollout notes)
   - Or: deploy both together if worker is backward-compatible with current queue schema

4. **Post-deploy**
   - Hit `/api/health` and verify `status: ok`, `db: ok`, `redis: ok`
   - Spot-check critical flows (login, booking, messaging)

## Running Prisma Migrations Safely

1. **Create migration** (local/dev):
   ```bash
   pnpm prisma migrate dev --name descriptive_name
   ```

2. **Apply in production**:
   ```bash
   pnpm prisma migrate deploy
   ```
   Run this **before** deploying new app code that depends on the new schema.

3. **Zero-downtime tips**
   - Prefer additive changes (new columns with defaults, new tables)
   - Avoid dropping columns in the same deploy as code that stops using them
   - For breaking changes: deploy migration → deploy code in two steps

## Rollback

1. **Revert code** to previous deployment
2. **Database**: If the new migration is backward-incompatible, you may need to run a down migration. Document rollback migrations for risky changes.
3. **Worker**: Restart worker process to pick up reverted code
4. **Verify**: `/api/health` and smoke flows

## Worker Rollout Notes

- **Deploy worker first** when:
  - New job types are added
  - Job payload shape changes
  - Worker must understand new queue messages before web enqueues them

- **Deploy web first** when:
  - Web adds new UI/API only
  - Worker logic unchanged

- **Deploy together** when:
  - Changes are backward-compatible
  - No new job types or payload changes

- **Worker process**: `npm run worker` or `tsx src/worker/index.ts`
- Ensure `REDIS_URL` is set in production
