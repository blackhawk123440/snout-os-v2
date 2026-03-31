# Payroll staging proof runbook

Execute this sequence **exactly** on staging. Do **not** move to Reports/Analytics until all steps pass and deliverables are captured.

---

## Prerequisites

- Staging **DATABASE_URL** (Postgres)
- Staging app **BASE_URL** (e.g. `https://snout-os-staging.onrender.com`)
- **E2E_AUTH_KEY** (same as used by staging for `/api/ops/e2e-login`)
- Decide whether failed migration `20260305000000_add_ai_governance` **did not apply** (use rolled-back) or **already applied** (use applied). See [MIGRATION_REPAIR.md](./MIGRATION_REPAIR.md).

---

## Option A: Run the script (recommended)

```bash
# If the AI governance migration did NOT apply to the DB:
RESOLVE_AI_GOVERNANCE=rolled-back \
  DATABASE_URL="<staging-db-url>" \
  BASE_URL="https://<staging-url>" \
  E2E_AUTH_KEY="..." \
  ./scripts/payroll-staging-proof.sh
```

Or if the migration **did** apply (or you fixed the DB manually):

```bash
RESOLVE_AI_GOVERNANCE=applied \
  DATABASE_URL="<staging-db-url>" \
  BASE_URL="https://<staging-url>" \
  E2E_AUTH_KEY="..." \
  ./scripts/payroll-staging-proof.sh
```

The script will:

1. Resolve the failed migration (if `RESOLVE_AI_GOVERNANCE` is set), then run `pnpm prisma migrate deploy`.
2. Remind that schema proof is done by the verifier.
3. GET staging `/api/health` and print the JSON.
4. Run `verify:payroll` with DATABASE_URL, BASE_URL, E2E_AUTH_KEY.
5. Remind you of the three deliverables.

If any step fails, fix immediately and re-run. **RESULT: FAIL** from the verifier means do not mark Payroll complete.

---

## Option B: Run steps manually

### 1) Repair staging migration chain

Use [MIGRATION_REPAIR.md](./MIGRATION_REPAIR.md). Resolve the failed migration correctly:

```bash
export DATABASE_URL="<staging-db-url>"

# Either (migration did NOT apply):
pnpm prisma migrate resolve --rolled-back 20260305000000_add_ai_governance

# Or (migration DID apply / DB already has schema):
pnpm prisma migrate resolve --applied 20260305000000_add_ai_governance

pnpm prisma migrate deploy
```

### 2) Confirm staging schema proof

- **PayrollRun.orgId** and **PayrollLineItem.payoutTransferId** are confirmed when the verifier runs (it queries these columns; if missing, it fails).
- If you want to check before the full verifier, run a one-off query against staging (e.g. Prisma Studio or `psql`) and confirm both columns exist. If either is missing, fix migration state and re-run step 1.

### 3) Capture /api/health proof

```bash
curl -s "https://<staging-url>/api/health" | jq .
```

Paste the **full JSON** somewhere permanent (e.g. runbook, PR, or proof doc).

### 4) Run deterministic payroll verifier on staging

**Required command:**

```bash
DATABASE_URL="<staging-db-url>" \
  BASE_URL="https://<staging-url>" \
  E2E_AUTH_KEY="..." \
  pnpm run verify:payroll
```

The verifier must prove:

- PayoutTransfer exists
- LedgerEntry exists
- PayrollLineItem exists with payoutTransferId
- PayrollRun exists with orgId
- Owner `/api/payroll` includes the run
- Sitter transfers/earnings reflect the same payout
- Reconciliation API is reachable and sees payout-linked ledger state

If any part fails → **RESULT: FAIL** → fix immediately and re-run. Do not mark Payroll complete until **RESULT: PASS**.

### 5) Deliverables required before Payroll is marked COMPLETE

| Deliverable | Where to capture |
|-------------|------------------|
| Staging `/api/health` JSON | Full response from step 3 (or script step 3). Paste and keep. |
| Full `verify:payroll` PASS output | Full terminal output from step 4 showing all checks and `RESULT: PASS`. |
| Short confirmation | Use [PAYROLL_COMPLETION_SUMMARY.md](./PAYROLL_COMPLETION_SUMMARY.md): owner payroll, sitter earnings, and reconciliation alignment (single source: PayoutTransfer, Booking, LedgerEntry, PayrollRun/PayrollLineItem). |

Only after all three deliverables are done, mark **Payroll COMPLETE**. Then and only then move to Reports/Analytics.
