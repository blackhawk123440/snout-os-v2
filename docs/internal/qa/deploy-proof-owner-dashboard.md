# Deploy-proof: Owner dashboard (/sitters, /growth, calendar, payroll)

**Mode:** No further code changes unless deployed screenshots show a real bug. You run the steps below and paste back the deliverables.

---

## 1) Deploy

- Push the branch/commit that contains the /sitters and /growth fixes.
- Trigger staging deploy (e.g. Render auto-deploy from `main`). Wait until the deploy finishes.

---

## 2) Confirm live staging build

Run (replace with your staging base URL):

```bash
curl -s "https://<STAGING_BASE_URL>/api/health" | jq '{ commitSha, envName }'
```

**Deliverable:** Record the **exact live staging commitSha** (e.g. `a1b2c3d`).

---

## 3) Verify as owner and capture screenshots

- Log in to staging as an **owner**.
- Visit and capture **full-page screenshots** of:
  - **/sitters**
  - **/growth**
  - **/calendar**
  - **/payroll**

**Required outcomes:**

- **/sitters** — Loads with list or honest empty state; **no** “Organization ID missing.”
- **/growth** — Loads with real content or honest empty state; **no** “Forbidden.”
- **/calendar** and **/payroll** — Use the same owner shell and look consistent enough to ship.

---

## 4) Optional — confirm new code path (DevTools Network)

- With owner session, open DevTools → Network. Reload **/sitters**.
- For the request to **/api/sitters**: response should be **200** with headers:
  - `X-Snout-Org-Resolved: 1`
  - `X-Snout-OrgId: <value>`
- For **/growth**, check **/api/sitters/srs** or **/api/sitter-tiers**: response **200** with header `X-Snout-Org-Resolved: 1`.

Report in your summary whether these headers were present.

---

## 5) Deliver back

Paste/send:

| Item | What to provide |
|------|------------------|
| **Live staging commitSha** | Exact value from step 2 (e.g. `a1b2c3d`). |
| **4 fresh screenshots** | /sitters, /growth, /calendar, /payroll (attach or link). |
| **/calendar cleanup?** | After reviewing the screenshot: does /calendar need any final consistency cleanup? (Yes/No + brief note.) |
| **/payroll cleanup?** | After reviewing the screenshot: does /payroll need any final consistency cleanup? (Yes/No + brief note.) |
| **Headers (optional)** | Whether X-Snout-Org-Resolved: 1 was present on /api/sitters and on /api/sitters/srs or /api/sitter-tiers. |

---

**Note:** The assistant cannot deploy, curl your staging URL, or capture screenshots. You run steps 1–4 and return the deliverables above.
