# Staging Migration Baseline Repair (One-Time)

Staging had schema drift (for example, `Booking.orgId` missing) because migration history was not aligned with an already-populated database.

This was repaired once by:

1. Synchronizing staging schema to current Prisma schema.
2. Marking historical migrations as applied.
3. Switching runtime startup to `prisma migrate deploy && next start`.

## Allowed Recovery Path

- **Staging only:** one-time baseline repair may use controlled `prisma db push` when `migrate deploy` is blocked by `P3005`.
- **After baseline:** use `prisma migrate deploy` only.

## Forbidden in Production

- Never run `prisma db push` in production.
- Production schema changes must go through committed Prisma migrations + `prisma migrate deploy`.

## Standard Deploy Contract

- Build: `prisma generate && next build`
- Start: `prisma migrate deploy && next start`

If startup detects missing required columns, it now fails fast with explicit `migrate deploy` guidance.
