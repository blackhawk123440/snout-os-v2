# Automations — Final Sign-off

Automations is **code-complete**. This doc is the staging signoff checklist and evidence. When all required evidence is in place and checks pass, set **Automations status: COMPLETE**.

---

## Required evidence

1. Staging `/api/health` JSON  
2. Worker proof: commitSha, Redis connected, Automations queue ready  
3. Owner control surface: `/automations` loads, cards render, enable/disable persists  
4. Test message: `POST /api/automations/test-message` works  
5. Failure surface: `/ops/automation-failures` loads, retry endpoint works  

---

## 1) Staging /api/health JSON

Output of: `curl -s "https://snout-os-staging.onrender.com/api/health" | jq .`

```json
{"status":"ok","db":"ok","redis":"ok","version":"757509be598e5ad31f94657875d5296aa75a2058","commitSha":"757509b","buildTime":"2026-03-08T23:19:26.212Z","envName":"staging","timestamp":"2026-03-08T23:19:26.212Z"}
```

- [x] Health JSON captured (staging commitSha: `757509b`, redis: ok).

---

## 2) Worker proof

Evidence that the worker is live on staging:

- **commitSha** (matches app or worker build)
- **Redis connected**
- **Automations queue ready**
- Queues processing (e.g. “Queues initialized. Processing jobs.”)

**How to capture:** Render (or host) → worker service → Logs. Paste relevant lines below.

**Example (staging):**
```text
[Worker] Starting background workers...
[Worker] commitSha: 757509b
[Worker] Redis: connected
[Worker] Automations queue ready
[Worker] Calendar queue ready
[Worker] Payout queue ready
[Worker] Queues initialized. Processing jobs.
```

**Paste staging worker log lines here:** _(Proof-only: cannot access Render logs; operator must paste from Render → worker service → Logs.)_

```text
[Operator: paste worker log lines showing commitSha, Redis connected, Automations queue ready]
```

- [ ] Worker log proof pasted above; commitSha, Redis connected, Automations queue ready confirmed.

---

## 3) Owner control surface verification

- **/automations loads** — Owner can open the Automations page (owner shell, no 403).
- **Automation cards render** — List shows automation types (e.g. six cards) with name, description, Enabled/Disabled, “Edit & test message”.
- **Enable/disable persists** — Toggle one automation on/off, refresh page; state persists.

**Notes:** _(Proof-only: requires owner session on staging; operator verifies and notes below.)_

```text
[Operator: e.g. "Verified 2026-03-08: /automations loads, 6 cards, toggled bookingConfirmation off, refresh — state persisted."]
```

- [ ] `/automations` loads as owner.
- [ ] Automation cards render (list of types with cards).
- [ ] Enable/disable toggle persists after refresh.

---

## 4) Test message verification

- **POST /api/automations/test-message** — As owner (session or auth header), send a test message; expect success.

**Example (with session cookie or Bearer token):**
```bash
curl -X POST "https://snout-os-staging.onrender.com/api/automations/test-message" \
  -H "Content-Type: application/json" \
  -d '{"template":"Test from signoff","phoneNumber":"+15551234567"}' \
  --cookie "next-auth.session-token=..."
# Expect 200 and { "success": true } or similar
```

**Notes:** _(Operator: as owner, POST with template + phoneNumber; note response.)_

```text
[Operator: e.g. "POST returned 200, { \"success\": true }."]
```

- [ ] `POST /api/automations/test-message` returns success (200) for owner.

---

## 5) Failure surface verification

- **/ops/automation-failures loads** — Owner can open the Automation Failures page (list of failure events).
- **Retry endpoint works** — `POST /api/ops/automation-failures/[eventLogId]/retry` is reachable and queues a retry (or returns expected error if invalid).

**Retry API:** `POST /api/ops/automation-failures/:eventLogId/retry` (owner/admin only, body optional `{ "jobId": "..." }`).

**Notes:** _(Operator: open page; if failures exist, POST .../retry for one eventLogId.)_

```text
[Operator: e.g. "Page loads; POST /api/ops/automation-failures/<id>/retry returned 200, job queued."]
```

- [ ] `/ops/automation-failures` loads as owner.
- [ ] Retry endpoint works (e.g. POST to a failure event id returns 200 or expected error).

---

## Proof-only evidence summary

| # | Evidence | Proof-only result | Operator action |
|---|----------|-------------------|------------------|
| 1 | Health JSON | Verified: status ok, db ok, redis ok, commitSha 757509b | None |
| 2 | Worker log | Not available (no Render API auth) | Paste from Render → worker logs |
| 3 | /automations UI | Not available (401 without session) | Verify on staging, fill notes |
| 4 | Test message | Not available (auth required) | POST as owner, note result |
| 5 | Failures + retry | Not available (auth required) | Open page; test retry if events exist |

To **mark COMPLETE**: operator pastes §2 worker proof, confirms §3–5 on staging, checks all boxes, then sets **Automations status: COMPLETE** below.

---

## Sign-off

- [x] 1) Staging /api/health JSON pasted above.
- [ ] 2) Worker log proof pasted; commitSha, Redis connected, Automations queue ready.
- [ ] 3) Owner control surface: /automations loads, cards render, enable/disable persists.
- [ ] 4) POST /api/automations/test-message works for owner.
- [ ] 5) /ops/automation-failures loads and retry endpoint works.

When all checkboxes above are checked (operator verification complete), set:

**Automations status:** **COMPLETE**

**Current status:** PENDING — operator must paste worker proof (§2) and verify §3–5 on staging, then check all boxes and set **Automations status: COMPLETE** above.

---

## Runbook (quick reference)

| # | Check | Command / action |
|---|--------|-------------------|
| 1 | Health | `curl -s "https://snout-os-staging.onrender.com/api/health" \| jq .` |
| 2 | Worker | Render → worker service → Logs; paste lines with commitSha, Redis, Automations queue ready |
| 3 | UI | Log in as owner → open /automations → confirm cards → toggle one → refresh → confirm persists |
| 4 | Test message | As owner: POST /api/automations/test-message with template + phoneNumber |
| 5 | Failures | As owner: open /ops/automation-failures; optionally POST .../retry for an event id |

Staging base URL: `https://snout-os-staging.onrender.com`
