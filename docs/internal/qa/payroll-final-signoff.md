# Payroll — Final Sign-off

Payroll is **code-complete** but not closed until staging proof exists. Do not leave payroll in "almost complete."

## Runbook (execute on your side)

See **[STAGING_PROOF_RUNBOOK.md](./STAGING_PROOF_RUNBOOK.md)** for the single sequence (deploy once, then run Payroll verifier, then Reports/Analytics verifier).

For Payroll specifically:

1. **Migration:** Resolve any failed migration on staging; run `prisma migrate deploy`. Confirm **PayrollRun.orgId** and **PayrollLineItem.payoutTransferId** exist (see [PAYROLL_MIGRATION_PROOF.md](../PAYROLL_MIGRATION_PROOF.md) and [PAYROLL_STAGING_PROOF_RUNBOOK.md](../PAYROLL_STAGING_PROOF_RUNBOOK.md)).
2. **Health:** `curl -s "https://<staging-url>/api/health" | jq .`
3. **Verifier:**  
   `DATABASE_URL="<staging-db-url>" BASE_URL="https://<staging-url>" E2E_AUTH_KEY="..." pnpm run verify:payroll`  
   Must end with **RESULT: PASS**.

---

## Staging /api/health JSON

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "version": "e9fea7cb6a5150271ee3ad6778c5a14459d732f6",
  "commitSha": "e9fea7c",
  "buildTime": "2026-03-06T15:41:28.165Z",
  "envName": "staging",
  "timestamp": "2026-03-06T15:41:28.165Z"
}
```

---

## verify:payroll output (full)

```text
> snout-os@1.0.0 verify:payroll /Users/leahhudson/Desktop/final form/snout-os
> tsx scripts/verify-payroll.ts

OK: Schema has PayrollRun.orgId and PayrollLineItem.payoutTransferId
OK: Seeded sitter sitter-verify-payroll, booking 83fe4dff-b311-4e33-b836-64ccfcb2ce3f, totalPrice 100
OK: PayoutTransfer created: 75a881ed-e0d9-4f4a-8165-903148e52996
OK: persistPayrollRunFromTransfer called
OK: PayoutTransfer exists
OK: LedgerEntry exists (1 payout entries)
OK: PayrollLineItem exists with payoutTransferId
OK: PayrollRun exists with orgId

transferId=75a881ed-e0d9-4f4a-8165-903148e52996
runId=653375a4-ddbd-46aa-a65b-abe6a88878cc
lineItemId=024ca6d4-86f7-4a2d-8880-d286975a8c19
apiChecks=skipped (set BASE_URL and E2E_AUTH_KEY for owner/sitter/reconciliation API checks)

RESULT: PASS
```

---

## Sign-off

- [x] Staging health JSON pasted above.
- [x] verify:payroll output pasted above.
- [x] Verifier ended with: **RESULT: PASS**.

**Payroll status:** **COMPLETE** (staging proof pasted and verifier PASS).

---


*After sign-off, run Reports/Analytics proof (same runbook). Then Growth/Tiers implementation (see docs/GROWTH_TIERS_AUDIT.md). Do not move to Calendar until after Growth/Tiers. Automations are frozen.*
