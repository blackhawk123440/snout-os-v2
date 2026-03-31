# Migration chain repair

If `prisma migrate deploy` fails with a **failed migration** (e.g. `P3009`), the migration history is broken and new migrations will not apply until it is fixed. Staging and production can drift; payroll and other schema updates may then fail.

## When you see this

```
Error: P3009
migrate found failed migrations in the target database, new migrations will not be applied.
The `20260305000000_add_ai_governance` migration started at ... failed
```

## Fix: resolve the failed migration

You must tell Prisma whether the failed migration **is** or **is not** applied in the database.

### Option A: Migration did not apply (DB is clean for that migration)

If the migration failed before completing (e.g. error mid-run), mark it as rolled back so Prisma can re-apply it (or you can fix the migration and re-run):

```bash
pnpm prisma migrate resolve --rolled-back 20260305000000_add_ai_governance
```

Then:

```bash
pnpm prisma migrate deploy
```

### Option B: Migration partially or fully applied (DB state matches migration)

If the migration actually completed (or you fixed the DB manually), mark it as applied so Prisma stops treating it as failed:

```bash
pnpm prisma migrate resolve --applied 20260305000000_add_ai_governance
```

Then run deploy again to apply any **later** migrations:

```bash
pnpm prisma migrate deploy
```

## How to choose

- **Rolled-back**: Use when the failed migration did not change the DB (or you reverted those changes) and you want to re-run it or skip it.
- **Applied**: Use when the DB already has the schema from that migration and you only need to unblock the history.

## After repair

Ensure payroll-related migrations run so schema and code stay in sync:

- `20260310000000_payroll_run_org_scoping` — adds `orgId` to `PayrollRun`
- `20260311000000_payroll_line_item_payout_transfer_id` — adds `payoutTransferId` to `PayrollLineItem`

Run `pnpm prisma migrate deploy` again after resolving the failed migration.
