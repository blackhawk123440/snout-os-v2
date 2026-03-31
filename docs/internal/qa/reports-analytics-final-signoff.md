# Reports / Analytics — Final Sign-off

Reports / Analytics is **code-complete** but not closed until staging proof exists.

## Runbook (execute on your side)

**Preferred:** Use the combined sequence in **[STAGING_PROOF_RUNBOOK.md](./STAGING_PROOF_RUNBOOK.md)** (deploy once, then run Payroll verifier, then Reports/Analytics verifier; paste health + both outputs).

**Reports/Analytics only:**

### 1) Deploy current main to staging

Deploy the branch that includes Reports / Analytics (canonical KPIs, trend APIs, real /reports and /analytics pages, tests, and verifier). For example:

- Push `main` and let your pipeline deploy (e.g. Render auto-deploy), or
- Manually trigger a deploy to staging from your dashboard.

### 2) Run the verifier

From your machine (with staging up and `E2E_AUTH_KEY` set in staging env):

```bash
BASE_URL="https://<staging-url>" E2E_AUTH_KEY="<your-e2e-key>" pnpm tsx scripts/verify-reports-analytics.ts
```

Replace `<staging-url>` with your staging host (no trailing slash) and `<your-e2e-key>` with the same key configured in staging for `/api/ops/e2e-login`.

### 3) Capture proof

- **GET** `https://<staging-url>/api/health` and copy the response JSON.
- Copy the **full** verifier stdout (from the script run above).

### 4) Paste below and save

Paste the health JSON and verifier output into the sections below. If the verifier printed `PASS: reports-analytics verification`, then mark **Reports / Analytics COMPLETE** at the bottom.

---

## Staging /api/health JSON

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "version": "f9ea194a2b71ee346f4f61290e7cdf6e499741a9",
  "commitSha": "f9ea194",
  "buildTime": "2026-03-07T15:12:01.458Z",
  "envName": "staging",
  "timestamp": "2026-03-07T15:12:01.458Z"
}
```

---

## Verifier output (full)

```text
verify-reports-analytics
health.ok commitSha=f9ea194
kpis.ok range=30d revenue.value=0
trend.ok /api/analytics/trends/revenue daily.length=0
trend.ok /api/analytics/trends/bookings daily.length=3
trend.ok /api/analytics/trends/payout-volume daily.length=0
trend.ok /api/analytics/trends/automation-failures daily.length=2
auth.sitter_blocked=ok
auth.client_blocked=ok
PASS: reports-analytics verification
```

---

## Sign-off

- [x] Staging health JSON pasted above.
- [x] Verifier output pasted above.
- [x] Verifier ended with: `PASS: reports-analytics verification`.

**Reports / Analytics status:** **COMPLETE**.

---

*After sign-off, next: Growth/Tiers implementation (then Calendar, Integrations, Settings, placeholder cleanup). See docs/GROWTH_TIERS_AUDIT.md and docs/qa/STAGING_PROOF_RUNBOOK.md. **Automations are frozen.***
