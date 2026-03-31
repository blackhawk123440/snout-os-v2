# Payroll completion summary

Short summary of **owner payroll**, **sitter earnings**, and **reconciliation** alignment so Payroll can be marked complete once migration proof and verifier PASS are in place.

---

## Single source of truth

All three surfaces read from the same data:

- **PayoutTransfer** (one row per payout; created when the payout worker runs after a sitter check-out)
- **Booking** (completed visits; `totalPrice`, `sitterId`, `endAt`)
- **LedgerEntry** (one per payout success/failure for audit)
- **PayrollRun** + **PayrollLineItem** (persisted when a PayoutTransfer is created; link via `payoutTransferId`)

There is **no second system**: owner payroll, sitter earnings, and finance reconciliation all use this chain.

---

## Owner payroll (`/payroll`)

- **List:** `GET /api/payroll` returns payroll **runs** (weekly periods) for the org. Runs are either created when a transfer is created (worker) or backfilled when listing (legacy transfers).
- **Detail:** `GET /api/payroll/[id]` returns the run plus **sitters** (earnings, commission, payout amount, Stripe status) and **bookings** for that period. Data is derived from the same PayoutTransfer + Booking + Sitter source.
- **Approve:** `POST /api/payroll/[id]/approve` sets run status to `approved` (owner/admin only).
- **Export:** `GET /api/payroll/export?runId=...` returns CSV (sitter name, earnings, commission, payout amount, stripe account, booking count).

The owner sees **pay period → total payout → sitters → booking breakdown** and can approve runs and export CSV. All of this is backed by PayoutTransfer and PayrollRun/PayrollLineItem.

---

## Sitter earnings (`/sitter/earnings`)

- **Earnings summary:** `GET /api/sitter/earnings` uses **Booking** (completed, sitter-scoped) and `Sitter.commissionPercentage` for totals (gross, this month, last month, average per visit).
- **Transfers:** `GET /api/sitter/transfers` returns **PayoutTransfer** rows for the current sitter (same table that backs owner payroll and reconciliation).
- **Pending / paid / next payout:** Computed from those transfers (e.g. pending sum, paid in last 30 days, next payout date heuristic).

So the sitter’s “earnings” and “payouts” are the same **PayoutTransfer** (and booking) data that appear in the owner payroll run and in the ledger.

---

## Reconciliation (`/ops/finance/reconciliation`)

- **Reconcile job:** Compares **LedgerEntry** (charges, refunds, payouts) to persisted Stripe/payout data (e.g. **StripeCharge**, **StripeRefund**, **PayoutTransfer**).
- **Payouts:** Each successful (or failed) payout writes a **LedgerEntry** with `entryType: "payout"`. Reconciliation includes these; any mismatch (missing or amount diff) is reported.

So the same payout that creates a **PayoutTransfer** and a **PayrollRun**/PayrollLineItem also creates a **LedgerEntry**; reconciliation “sees” that ledger entry and ties it to the transfer.

---

## Alignment in one sentence

**Owner payroll runs, sitter earnings/transfers, and finance reconciliation all read from PayoutTransfer, Booking, LedgerEntry, and PayrollRun/PayrollLineItem — one chain, no duplicate payroll system.**

---

## Before marking Payroll complete

1. **Migration proof:** Repair any failed migration, run `prisma migrate deploy` in staging, and confirm **PayrollRun.orgId** and **PayrollLineItem.payoutTransferId** exist (see [PAYROLL_MIGRATION_PROOF.md](./PAYROLL_MIGRATION_PROOF.md)).
2. **Staging `/api/health`:** Capture JSON from `GET /api/health` on staging.
3. **Verifier:** Run `verify:payroll` against staging (DB required; BASE_URL + E2E_AUTH_KEY optional for API checks) and get **RESULT: PASS**.
4. **Summary:** This document serves as the short summary of owner payroll + sitter earnings + reconciliation alignment.

After these are done, Payroll can be marked **complete**.
