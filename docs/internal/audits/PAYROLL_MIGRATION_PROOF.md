# Payroll migration proof (required before Payroll complete)

Before marking Payroll **complete**, do the following in **staging**.

## 1) Repair the failed migration chain

If `prisma migrate deploy` has ever failed (e.g. P3009 for `20260305000000_add_ai_governance`), fix it first.

See **[MIGRATION_REPAIR.md](./MIGRATION_REPAIR.md)** for:

- `pnpm prisma migrate resolve --rolled-back 20260305000000_add_ai_governance` (if the migration did not apply)
- `pnpm prisma migrate resolve --applied 20260305000000_add_ai_governance` (if the DB already has that migration’s schema)

Then run:

```bash
pnpm prisma migrate deploy
```

so all pending migrations (including payroll) are applied.

## 2) Confirm migrations applied

After deploy, the DB must have:

- **PayrollRun.orgId** (migration `20260310000000_payroll_run_org_scoping`)
- **PayrollLineItem.payoutTransferId** (migration `20260311000000_payroll_line_item_payout_transfer_id`)

You can confirm by:

1. **Staging `/api/health`**  
   GET your staging base URL + `/api/health`. You should get **200** and JSON with at least:
   - `status`, `db`, `redis`, `version` / `commitSha`, `envName`, `timestamp`

   Example (replace with your staging URL):

   ```bash
   curl -s https://your-staging-app.onrender.com/api/health | jq .
   ```

   Save or paste the JSON as proof (e.g. in a runbook or PR description).

2. **Verifier**  
   Run the payroll verifier against the staging DB (and optionally staging API). It will **FAIL** if the schema is missing columns:

   ```bash
   DATABASE_URL="your-staging-database-url" pnpm run verify:payroll
   ```

   If migrations are not applied, Prisma will error when selecting `PayrollRun.orgId` or `PayrollLineItem.payoutTransferId`. A **RESULT: PASS** from the verifier implies both columns exist and the full payout → ledger → payroll chain works.

## 3) Proof deliverables

Before marking Payroll complete, you should have:

| Deliverable | How to get it |
|-------------|----------------|
| Staging `/api/health` JSON | `curl -s https://<staging>/api/health \| jq .` |
| PayrollRun.orgId confirmed | Verifier passes (it queries runs with `orgId`) |
| PayrollLineItem.payoutTransferId confirmed | Verifier passes (it queries line items with `payoutTransferId`) |
| Full `verify-payroll` PASS output | `DATABASE_URL=... [BASE_URL=... E2E_AUTH_KEY=...] pnpm run verify:payroll` |

Optional for stronger proof: run the verifier with **BASE_URL** and **E2E_AUTH_KEY** so it also checks owner `/api/payroll`, sitter transfers, and reconciliation API.
