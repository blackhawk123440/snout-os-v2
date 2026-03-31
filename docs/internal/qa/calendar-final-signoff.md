# Calendar — Final Sign-off

Calendar is **code-complete** but not formally **COMPLETE** until staging proof is done. This doc is the signoff checklist and evidence.

## Runbook (execute on your side)

1. **Staging calendar proof**
   - **Health:** `curl -s "https://<staging-url>/api/health" | jq .`  
     Paste the JSON below in **Staging /api/health JSON**.
   - **Verifier:**  
     `BASE_URL="https://<staging-url>" E2E_AUTH_KEY="..." pnpm run verify:calendar`  
     Paste the **full** verifier output below in **verify:calendar output**.

2. **Worker proof**
   - Confirm the **worker** service is deployed and running on staging (same commit as web).
   - Capture worker logs showing:
     - `commitSha` (or equivalent)
     - Redis connected
     - `[Worker] Calendar queue ready`
     - Queues initialized / processing jobs
   - Paste or describe that evidence in **Worker log proof** below.

3. **Sign-off**
   - Once health JSON is pasted, verify:calendar output is pasted and ends successfully, and worker log proof is added, check the boxes and set **Calendar status: COMPLETE**.

---

## Staging /api/health JSON

Paste output of: `curl -s "https://<staging-url>/api/health" | jq .`

```json
{"status":"ok","db":"ok","redis":"ok","version":"c5b1527b1dcbec3a3ad832767a124dca319c73f9","commitSha":"c5b1527","buildTime":"2026-03-08T22:05:31.310Z","envName":"staging","timestamp":"2026-03-08T22:05:31.310Z"}
```

---

## verify:calendar output (full)

Paste full output of: `BASE_URL="https://<staging-url>" E2E_AUTH_KEY="..." pnpm run verify:calendar`

```text
> snout-os@1.0.0 verify:calendar
> tsx scripts/verify-calendar.ts

verify-calendar started
bookings.count=108
conflicts.count=59
repair.ok=true jobId=28
repair.validation=400 when sitterId missing
verify-calendar OK
```

---

## Worker log proof

Evidence that the worker is live and the calendar queue is ready, e.g.:

- `[Worker] commitSha: ...` (or equivalent)
- Redis: connected
- `[Worker] Calendar queue ready`
- `[Worker] Queues initialized. Processing jobs.` (or similar)

Paste relevant worker log lines from staging:

```text
[Worker] Starting background workers...
[Worker] commitSha: c5b1527
[Worker] Redis: connected
[Worker] REDIS_URL: rediss://red-d6k9irfafjfc7393n78g:****@oregon-keyvalue.render.com:6379
[Worker] Automations queue ready
[Worker] Calendar queue ready
[Worker] Payout queue ready
[Worker] Queues initialized. Processing jobs.
```

---

## Conflict model (do not conflate)

**Calendar conflict** (used on Calendar page and Command Center “schedule conflicts” link) means:

- **Same sitter** + **overlapping time** + **non-cancelled bookings only**.

It is **not** the same as:

- **Assignment-window conflict** — overlapping assignment windows (same thread, different windows); see `/api/assignments/conflicts` and Assignments → Conflicts.
- **Availability conflict** — sitter outside recurring availability, time-off, or blackout; used in dispatch/force-assign and availability checks.
- **Google busy conflict** — “Respect Google Busy” blocks from the sitter’s Google Calendar; used in availability only.

Keep this distinction explicit in product and docs so owners are not confused.

---

## Scope of this pass

- **Settings:** Untouched in this Calendar pass.
- **Automations:** Untouched in this Calendar pass. No Automations consolidation changes.

---

## How to complete this signoff

1. Set your staging URL and E2E key (same as used for `/api/ops/e2e-login`).
2. **Health:** Run `curl -s "https://<your-staging-url>/api/health" | jq .` and paste the full JSON into **Staging /api/health JSON** above.
3. **Verifier:** Run `BASE_URL="https://<your-staging-url>" E2E_AUTH_KEY="<your-key>" pnpm run verify:calendar` from the repo root. Paste the **full** terminal output into **verify:calendar output** above. Verifier must complete without exit code 1.
4. **Worker:** In Render (or your host) open the **snout-os-worker** service logs. Capture lines showing commitSha (or build), Redis connected, `[Worker] Calendar queue ready`, and queues processing. Paste into **Worker log proof** above.
5. Check all four sign-off boxes and set **Calendar status: COMPLETE**.

---

## Sign-off

- [x] Staging /api/health JSON pasted above.
- [x] Full verify:calendar output pasted above; verifier completed successfully.
- [x] Worker log proof pasted above; worker is live and Calendar queue ready.
- [x] Conflict model note above acknowledged (calendar vs assignment-window vs availability vs Google busy).

**Calendar status:** **COMPLETE**

---

*After Calendar is formally COMPLETE, the only major unfinished system left is Automations consolidation.*
