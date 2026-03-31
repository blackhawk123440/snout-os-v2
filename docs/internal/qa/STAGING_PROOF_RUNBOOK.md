# Staging proof runbook — Payroll + Reports / Analytics

Use this **once per staging deploy** to capture proof for both Payroll and Reports/Analytics. Do not mark either COMPLETE until its verifier PASS and deliverables are pasted into the signoff docs.

---

## Prerequisites

- Staging **DATABASE_URL** (Postgres) — required for Payroll verifier
- Staging app **BASE_URL** (e.g. `https://snout-os-web.onrender.com`, no trailing slash)
- **E2E_AUTH_KEY** (same as in staging env for `/api/ops/e2e-login`)
- For Payroll: migration chain resolved and `prisma migrate deploy` already run on staging (see [PAYROLL_STAGING_PROOF_RUNBOOK.md](../PAYROLL_STAGING_PROOF_RUNBOOK.md) if needed)

---

## 1) Deploy current main to staging

Push `main` (or your release branch) and let the pipeline deploy, or trigger a deploy from your dashboard. Wait until the app is up and healthy.

---

## 2) Capture /api/health once

```bash
curl -s "https://<staging-url>/api/health" | jq .
```

**Paste this JSON** into:
- [docs/qa/payroll-final-signoff.md](./payroll-final-signoff.md) — Staging /api/health JSON
- [docs/qa/reports-analytics-final-signoff.md](./reports-analytics-final-signoff.md) — Staging /api/health JSON

(Same health response is used for both.)

---

## 3) Run Payroll verifier

```bash
DATABASE_URL="<staging-db-url>" \
  BASE_URL="https://<staging-url>" \
  E2E_AUTH_KEY="..." \
  pnpm run verify:payroll
```

- If **RESULT: FAIL** → fix issues (migration, API, or data), re-run. Do not mark Payroll complete.
- If **RESULT: PASS** → copy the **full** terminal output and paste it into [docs/qa/payroll-final-signoff.md](./payroll-final-signoff.md) — verify:payroll output (full). Then check the sign-off boxes and mark Payroll **COMPLETE**.

---

## 4) Run Reports / Analytics verifier

```bash
BASE_URL="https://<staging-url>" E2E_AUTH_KEY="..." pnpm tsx scripts/verify-reports-analytics.ts
```

- If the script exits with an error or does not print `PASS: reports-analytics verification` → fix and re-run. Do not mark Reports/Analytics complete.
- If it prints **PASS: reports-analytics verification** → copy the **full** terminal output and paste it into [docs/qa/reports-analytics-final-signoff.md](./reports-analytics-final-signoff.md) — Verifier output (full). Then check the sign-off boxes and mark Reports / Analytics **COMPLETE**.

---

## 5) Deliverables checklist

| Deliverable | Where to paste |
|-------------|----------------|
| Staging `/api/health` JSON | payroll-final-signoff.md + reports-analytics-final-signoff.md |
| Full `verify:payroll` PASS output | payroll-final-signoff.md |
| Full `verify-reports-analytics` PASS output | reports-analytics-final-signoff.md |

Only after both verifiers PASS and all three deliverables are pasted and boxes checked in the respective signoff docs, consider **Payroll** and **Reports / Analytics** COMPLETE.

---

**Locked order:** Payroll staging proof → Reports/Analytics staging proof → then Growth/Tiers implementation (see docs/GROWTH_TIERS_AUDIT.md). Do not move to Calendar audit until after Growth/Tiers implementation (or as per your chosen order). Automations are frozen.
