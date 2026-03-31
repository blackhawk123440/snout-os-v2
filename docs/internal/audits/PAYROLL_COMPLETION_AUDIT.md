# Payroll Completion Audit

**Date:** 2026-03-03  
**Scope:** Payroll end-to-end across owner + sitter + Stripe Connect + ledger + reconciliation.  
**Goal:** Make payroll fully complete; definition of done: owner payroll UI real (not placeholder), sitter earnings/payout views match owner payroll state, Stripe Connect payout lifecycle visible and correct, pending/paid/failed/next payout date working, commission tracking correct, ledger + reconciliation tied to payroll and payout events, staging proof.

**Status rubric:**
- **Complete:** Route/API/data/visibility/wiring all present and correct.
- **Partial:** Materially functional but missing pieces or non-trivial gaps.
- **Missing:** Feature/module not implemented.
- **Broken:** Implemented surface exists but core behavior fails (e.g. 404, throws).
- **Present but not wired end-to-end:** Page/feature exists but does not complete the system loop.

---

## 1) Audit by area

| Area | Status | What works | What is missing / broken |
|------|--------|------------|---------------------------|
| **/payroll** (owner) | **Broken** | Rich UI: filters, pay period table, approve modal, export CSV, stat cards. | No API routes exist: `GET /api/payroll`, `GET /api/payroll/[id]`, `POST /api/payroll/[id]/approve`, `GET /api/payroll/export` all 404. Page will fail on load/actions. |
| **/sitter/earnings** | **Partial** | Real UI: totals, this/last month, pending/paid 30d, transfers table, completed jobs; `/api/sitter/earnings`, `/api/sitter/transfers`, `/api/sitter/completed-jobs` exist and return data. | Next payout date is heuristic (last paid + 7 days), not Stripe payout schedule; time-range tabs (today/week/month) are mostly cosmetic; no link from earnings to owner payroll “period” concept. |
| **/ops/payouts** | **Complete** | List PayoutTransfer with sitter name, filters (status, sitterId), refresh; `GET /api/ops/payouts` uses scoped DB and returns transfers. | — |
| **Stripe Connect setup/status** | **Partial** | Create Connect account + account link (`POST /api/sitter/stripe/connect`), status (`GET /api/sitter/stripe/status`); `account.updated` webhook updates `payoutsEnabled`/`chargesEnabled`/`onboardingStatus` in `SitterStripeAccount`. | Status API returns DB-only (no live Stripe fetch); if webhook is missed, status can be stale; no explicit “refresh from Stripe” for ops. |
| **Payout engine** | **Complete** | `calculatePayoutForBooking(totalPrice, commissionPct)`, `executePayout()`: idempotent by booking, creates Stripe transfer, creates `PayoutTransfer`, writes ledger, logs events. | — |
| **Payout transfer persistence** | **Complete** | `PayoutTransfer` created in `executePayout` (paid/failed); ops and sitter APIs read from it. | — |
| **Ledger entries** | **Complete** | `upsertLedgerEntry` called from payout-engine on success and failure; `LedgerEntry` has `entryType`/`source`/`stripeId`/booking/sitter; reconciliation consumes ledger. | Charge/refund ledger writes live in stripe-webhook-persist; payout path is wired. |
| **Reconciliation ties** | **Complete** | `reconcile.ts` compares `LedgerEntry` vs `StripeCharge`/`StripeRefund`/`PayoutTransfer`; includes payouts; `/api/ops/finance/reconcile`, `/api/ops/finance/reconcile/runs`; reconcile-queue worker; ops reconciliation UI. | — |
| **Commission logic** | **Partial** | `Sitter.commissionPercentage` (default 80) used in payout-engine and `/api/sitter/earnings`; per-booking payout uses it. | Owner payroll does not use it (payroll API missing); no single source of truth for “payroll period commission” vs “per-transfer commission” in UI. |
| **Next payout estimation logic** | **Partial** | `earnings-helpers.ts`: `calculateTransferSummary()` derives next payout as last paid date + 7 days; sitter earnings page shows “Next payout” from this. | Not tied to Stripe Connect payout schedule (e.g. weekly/monthly); no API from Stripe for “next payout date” for connected accounts. |
| **Role visibility/permissions** | **Partial** | `/payroll` is protected (protected-routes); `/api/sitter/earnings` and `/api/sitter/transfers` require sitter; `/api/ops/payouts` requires owner/admin. | No `/api/payroll*` routes to gate; owner payroll page is reachable but APIs 404. |
| **Worker path for payout jobs** | **Present but not wired end-to-end** | `visit.completed` → event-queue-bridge → `enqueuePayoutForBooking`; `emitVisitCompleted` called from `POST /api/bookings/[id]/check-out`; `initializePayoutWorker()` in `queue.ts`; worker started via `worker/index.ts` → `startWorkers()` → `initializeQueues()`. | Payout worker runs only when the separate worker process runs (`src/worker/index.ts`). If only Next.js runs (e.g. single dyno), payouts are never processed; no in-process fallback. |

### Additional findings

- **Payroll service (`src/lib/payroll/payroll-service.ts`):** Marked as “not available in messaging dashboard schema”: `computePayrollForPeriod` returns `[]`, `createPayrollRun` / `getPayrollRunDetails` / `approvePayrollRun` all throw. So owner payroll has no backend even though Prisma has `PayrollRun` / `PayrollLineItem` / `PayrollAdjustment`.
- **PayrollRun model:** No `orgId` on `PayrollRun` in schema; multi-tenant payroll would require adding org scope and filtering.
- **Sitter/owner payroll alignment:** Owner payroll UI expects “pay periods” and “approve”; sitter sees per-booking transfers and heuristic “next payout.” There is no shared “pay period” or “batch” concept linking the two yet.
- **Event flow:** Check-out → `emitVisitCompleted(booking, {})` → `visit.completed` → enqueue payout; bridge is initialized via `ensureEventQueueBridge()` in check-out route. So trigger path is correct when worker is running.

---

## 2) Canonical payroll model (target)

Single conceptual model that ties owner view, sitter view, and Stripe/ledger:

1. **Bookings (source of truth for earnings)**  
   Completed bookings with `totalPrice`, `sitterId`, `endAt`. Commission from `Sitter.commissionPercentage` (or tier override).  
   **Net sitter amount** = `totalPrice * (commissionPercentage / 100)` (with optional fees/adjustments).

2. **Payout transfers (Stripe Connect execution)**  
   One `PayoutTransfer` per booking (or per batch if we add batching): `bookingId`, `sitterId`, `amount` (cents), `currency`, `status` (pending | paid | failed), `stripeTransferId`, `lastError`.  
   Created by payout worker after `visit.completed`; idempotent by (orgId, sitterId, bookingId).

3. **Ledger (audit trail)**  
   `LedgerEntry` per payout (and charge/refund): `entryType: "payout"`, `source: "stripe"`, `stripeId`, `sitterId`, `bookingId`, `amountCents`, `status`, `occurredAt`.  
   Written by payout-engine on success/failure; used by reconciliation.

4. **Payroll runs (owner-facing periods)**  
   Optional aggregation layer: `PayrollRun` = pay period (e.g. biweekly) with status draft → pending → approved → paid.  
   `PayrollLineItem` per sitter per run: `totalEarnings`, `commissionAmount`, `netAmount`, `bookingCount` derived from bookings (and optionally from `PayoutTransfer` for “what was actually sent”).  
   Owner UI shows runs; sitter UI shows transfers + earnings totals. Linking: “This period’s payouts” = transfers with `createdAt` in run’s date range (or run stores transfer IDs if we want strict 1-run ↔ N-transfers).

5. **Next payout (sitter)**  
   Either: (a) heuristic: last `PayoutTransfer` with status paid, + 7 days (current), or (b) Stripe Connect “next payout” when available (API/product dependent).  
   Canonical model: “next payout date” is a **display hint** (heuristic or Stripe), not a stored entity; pending amount = sum of transfers not yet paid for completed bookings.

6. **Commission**  
   Single source: `Sitter.commissionPercentage` (default 80). Used for: (1) payout-engine per transfer, (2) earnings API totals, (3) payroll run line items when payroll is implemented. No separate “payroll commission” table required for MVP.

7. **Reconciliation**  
   Ledger entries (type payout) vs `PayoutTransfer` (and Stripe if we sync transfer status). Already implemented in `reconcile.ts` and ops UI.

---

## 3) Biggest risks

1. **Owner payroll is broken in production**  
   `/payroll` calls four API routes that do not exist. Every load and every action (view details, approve, export) fails. This is the highest user-facing risk.

2. **Worker not running**  
   If the app is deployed without running `worker/index.ts` (e.g. Next.js only), no payout jobs run. Completed visits never create transfers; sitter “pending” stays empty and “next payout” never advances. Risk: deployment/ops must run worker process and Redis.

3. **PayrollRun not org-scoped**  
   Schema has no `orgId` on `PayrollRun`. Multi-tenant orgs would see mixed data unless we add `orgId` and scope all payroll APIs and UI.

4. **Stripe Connect status stale**  
   Status is DB-cached; if `account.updated` webhook is missed or delayed, “payouts enabled” can be wrong; sitter may think they’re set up when Stripe has disabled payouts. Mitigation: optional “Refresh status” that calls Stripe and updates DB.

5. **Two “payroll” concepts**  
   Owner thinks in “pay periods” and “approve”; sitter thinks in “earnings” and “transfers.” Without a shared period or batch concept, owner approval does not currently gate or align with actual Stripe transfers (which are per-booking today). Risk: confusion or duplicate work if we add approval without tying it to transfer batches.

---

## 4) Exact implementation plan

**Phase 2 (after Phase 1 approval)** — implement in this order:

1. **Add orgId to PayrollRun (and related)**  
   Migration: add `orgId` to `PayrollRun` (default `"default"`), index; ensure `PayrollLineItem`/`PayrollAdjustment` access via run only. Update Prisma schema and any existing references.

2. **Implement owner payroll API**  
   - `GET /api/payroll` — list “pay periods” for org: either from `PayrollRun` (if any) or derive from date range + bookings/transfers. Return array of periods with: `id` (run id or synthetic), `sitterId`, `sitterName`, `startDate`, `endDate`, `status`, `totalEarnings`, `commissionAmount`, `fees`, `netPayout`, `bookingCount`, `createdAt`, `approvedAt`, `paidAt`, `approvedBy`.  
   - `GET /api/payroll/[id]` — period detail + list of booking-level lines (bookingId, date, service, totalPrice, commissionPercentage, commissionAmount, status).  
   - `POST /api/payroll/[id]/approve` — set run status to approved, set `approvedBy`/`approvedAt` (and require owner/admin).  
   - `GET /api/payroll/export` — CSV export for selected period/filters (same shape as list).  
   Use `getScopedDb(ctx)` and `requireAnyRole(ctx, ['owner','admin'])`; ensure all reads/writes are org-scoped.

3. **Wire payroll service to real data**  
   Re-enable `computePayrollForPeriod` using `Booking` (completed, in range, with sitter) and `Sitter.commissionPercentage`; implement or re-enable `createPayrollRun` / `getPayrollRunDetails` / `approvePayrollRun` against `PayrollRun`/`PayrollLineItem` with `orgId`. Remove “messaging dashboard schema” throws and empty array.

4. **Optional: Tie pay period to transfers**  
   When showing “paid” or “next payout,” owner payroll can show “Transfers in this period” (e.g. `PayoutTransfer` with `createdAt` in period). Sitter earnings already show transfers; ensure period boundaries (if we show them) align with same date logic (e.g. UTC day or org TZ).

5. **Next payout (sitter)**  
   Keep current heuristic (last paid + 7 days); document. If Stripe exposes “next payout” for connected accounts later, add optional refresh and show “From Stripe” when available.

6. **Stripe Connect status refresh (optional)**  
   Add `POST /api/sitter/stripe/status/refresh` or query param to `GET` that calls Stripe `accounts.retrieve`, updates `SitterStripeAccount`, returns updated status. Reduces risk of stale DB.

7. **Worker and staging proof**  
   - Document that payout worker must run (e.g. `node dist/worker/index.js` or equivalent) with same `REDIS_URL` as app.  
   - Staging: run worker; complete a visit via check-out; confirm `PayoutTransfer` created and (if Stripe Connect configured) transfer succeeds; confirm owner `/ops/payouts` and sitter `/sitter/earnings` show the transfer; run reconciliation for that day and confirm no payout mismatches.

8. **No unrelated feature work**  
   Limit changes to payroll, payouts, ledger, reconciliation, and worker path as above.

---

## 5) Summary table (quick reference)

| Area | Status |
|------|--------|
| /payroll | Broken |
| /sitter/earnings | Partial |
| /ops/payouts | Complete |
| Stripe Connect setup/status | Partial |
| Payout engine | Complete |
| Payout transfer persistence | Complete |
| Ledger entries | Complete |
| Reconciliation ties | Complete |
| Commission logic | Partial |
| Next payout estimation | Partial |
| Role visibility/permissions | Partial |
| Worker path for payout jobs | Present but not wired end-to-end |

Phase 1 (this audit) stops here. No code or config changes; implementation follows in Phase 2 after approval.

---

## 6) Phase 2 Implementation (Completed)

### 6.1 Data model
- **PayrollRun** now has **orgId** (required, default `"default"`) and org-scoped indexes. Migration: `20260310000000_payroll_run_org_scoping`.
- `tenant-models` includes `payrollRun`.

### 6.2 Owner Payroll API
- **GET /api/payroll** — Lists payroll runs for the org. Ensures runs from PayoutTransfer (weekly periods), then returns `[{ id, startDate, endDate, sitterCount, totalPayout, status }]`.
- **GET /api/payroll/[id]** — Run detail: `run` + `sitters[]` (sitterId, sitterName, bookingCount, earnings, commission, payoutAmount, stripeAccount) + `bookings[]` (bookingId, bookingDate, service, totalPrice, commissionPercentage, commissionAmount, status). Source: Booking + Sitter + PayoutTransfer.
- **POST /api/payroll/[id]/approve** — Owner/admin only; run must be `pending`. Sets `status=approved`, `approvedAt`, `approvedBy`.
- **GET /api/payroll/export** — CSV: sitter name, earnings, commission, payout amount, stripe account, booking count. Query `runId` optional (default: latest run).

### 6.3 Owner Payroll Page
- Summary: Current Pay Period, Total Sitters, Total Payout, Status; Pending / Approved / Total Paid.
- Table: Pay Period, Sitters, Total Payout, Status, Actions (View, Approve, Export).
- View modal: run total + sitters table (Sitter, Bookings, Earnings, Commission, Payout, Stripe) + booking breakdown + Export this period.
- Approval modal: confirm period and total payout, then Approve.

### 6.4 Align Owner + Sitter
- **Single source:** Booking → commission → PayoutTransfer → LedgerEntry. Owner payroll runs are derived from PayoutTransfer (weekly); run detail and sitter rows come from the same PayoutTransfer + Booking + Sitter data. Sitter earnings page uses `/api/sitter/earnings` (Booking) and `/api/sitter/transfers` (PayoutTransfer). No second system.

### 6.4a Safer architecture: persisted runs (not virtual)
- **PayrollRun** and **PayrollLineItem** are now created when a **PayoutTransfer** is created (in the payout worker after `executePayout`), not lazily on GET. So runs exist as soon as there are transfers; locked periods, approval history, and audit trails are possible.
- **PayrollLineItem** has optional **payoutTransferId** (unique) linking to the transfer. One line per transfer; run totals are updated when line items are added.
- **Backfill:** When listing payroll, `backfillPayrollRunsFromTransfers` still runs so legacy transfers without a line item get a run + line. New transfers get run + line from the worker.

### 6.5 Worker verification (critical)
- **Process:** `src/worker/index.ts` → `startWorkers()` → `initializeQueues()` → `initializePayoutWorker()` from `src/lib/payout/payout-queue.ts`.
- **Deploy:** The payout worker must run as a **separate process** (e.g. Render worker service, or `node dist/worker/index.js`). Same Redis as the app (`REDIS_URL`). If only the Next.js app runs, payout jobs are never processed.
- **Flow:** Sitter check-out → `POST /api/bookings/[id]/check-out` → `emitVisitCompleted` → `visit.completed` → event-queue-bridge → `enqueuePayoutForBooking` → BullMQ job → payout worker → `executePayout` (Stripe transfer + PayoutTransfer + LedgerEntry).

### 6.6 Staging proof (required)
Verifier must confirm:

1. **Booking complete** — Sitter checks out a completed visit (check-out API).
2. **Payout transfer created** — A `PayoutTransfer` row exists for that booking (same source as sitter/owner).
3. **Sitter earnings updated** — `/sitter/earnings` shows the transfer and pending/paid amounts.
4. **Owner payroll shows entry** — `/payroll` lists a run for that week; run detail shows the sitter and payout.
5. **Reconciliation shows ledger** — `/ops/finance/reconciliation` for that date range shows no payout mismatch (ledger entry matches PayoutTransfer).

If this loop passes, payroll is production-ready.

---

## 7) Payroll NOT complete until these deliverables exist

Payroll is **not** marked complete until:

1. **Migration proof (staging)**  
   - Repair failed migration chain (see [MIGRATION_REPAIR.md](./MIGRATION_REPAIR.md)), then `prisma migrate deploy` in staging.  
   - Confirm **PayrollRun.orgId** and **PayrollLineItem.payoutTransferId** exist (verifier or schema check).

2. **Staging `/api/health` JSON**  
   - GET staging base URL + `/api/health` returns 200 and JSON (`status`, `db`, `redis`, `version`/`commitSha`, `envName`, `timestamp`).  
   - Capture and keep as proof.

3. **Full `verify-payroll` PASS output**  
   - Run: `DATABASE_URL=... [BASE_URL=... E2E_AUTH_KEY=...] pnpm run verify:payroll`.  
   - Script is **deterministic**: it seeds or uses a completed booking, triggers payout (executePayout + persistPayrollRunFromTransfer), then verifies PayoutTransfer → LedgerEntry → PayrollLineItem (payoutTransferId) → PayrollRun (orgId). With BASE_URL + E2E_AUTH_KEY it also checks owner `/api/payroll`, sitter transfers, and reconciliation API.  
   - **RESULT: PASS** required. No PASS just because there is no payout data.

4. **Short summary**  
   - [PAYROLL_COMPLETION_SUMMARY.md](./PAYROLL_COMPLETION_SUMMARY.md): owner payroll page + sitter earnings + reconciliation alignment (single source: PayoutTransfer, Booking, LedgerEntry, PayrollRun/PayrollLineItem).

See [PAYROLL_MIGRATION_PROOF.md](./PAYROLL_MIGRATION_PROOF.md) for the exact checklist and commands.
