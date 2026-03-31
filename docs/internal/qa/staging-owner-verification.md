# Staging owner verification — /sitters, /growth, calendar, payroll

**Do not treat /sitters or /growth as fixed until live staging screenshots show the pages loading.** The fixes are in code; staging must run a build that includes them.

---

## 0) Deploy the fixes to staging

1. Ensure the branch you deploy (e.g. `main`) contains:
   - **Sitters**: `src/app/api/sitters/route.ts` — orgId always resolved (context or `"default"`); no "Organization ID missing" response.
   - **Growth**: `src/lib/request-context.ts` — role and orgId resolved from DB when session is missing them; single User fetch.
   - **APIs**: `src/app/api/sitters/srs/route.ts`, `src/app/api/sitter-tiers/route.ts` — use getRequestContext + requireAnyRole.
2. Push and trigger your staging deploy (e.g. Render auto-deploy from `main`). Wait until the deploy finishes.

---

## 1) Confirm the fix is deployed (live commitSha)

```bash
curl -s "https://<STAGING_BASE_URL>/api/health" | jq '{ commitSha, envName, timestamp }'
```

- Record the **live staging commitSha** (e.g. `a1b2c3d`). It must match the commit that contains the changes above.
- If it does not, trigger a new deploy and re-check.

**Optional — confirm new code path via response headers (owner session required):**

- After logging in as owner, open DevTools → Network. Reload `/sitters`. For the request to `/api/sitters`, check the response headers. If the new code is running, you should see `X-Snout-Org-Resolved: 1` and `X-Snout-OrgId: <value>` on a 200 response. If you still get 401 with "Organization ID missing", the running build is old.

---

## 2) Verify as owner

Log in to staging as an **owner** (user with `role = 'owner'` or no sitter/client and treated as owner).

### Hard blockers (must pass)

| Page   | Check |
|--------|--------|
| **/sitters** | Page loads; sitter list or empty state appears. **No** “Couldn’t load sitters — Organization ID missing.” |
| **/growth**  | Page loads; SRS / policy tiers or empty state. **No** “Forbidden.” |

### Shell consistency (same chrome as dashboard)

| Page      | Check |
|-----------|--------|
| **/calendar** | Same owner shell (OwnerAppShell), PageHeader, LayoutWrapper; “Schedule” section; no different product look. |
| **/payroll**  | Same owner shell; “Pay period summary” and “Payroll runs” sections; filter/actions match dashboard style. |

### Screenshots to capture

1. **/sitters** — full page (sidebar + content).
2. **/growth** — full page.
3. **/calendar** — full page (header + schedule).
4. **/payroll** — full page (header + summary + runs).

---

## 3) Trust states (optional check)

- **Dashboard**: If revenue YTD is $0 and open bookings > 0, copy under Revenue should say “No collected payments yet”. If retention is 0% and there are bookings, copy under Retention should say “No repeat clients yet.”
- **Reports**: If revenue (period) is $0 and bookings > 0, copy under Revenue card should say “No collected payments yet in this period.”

---

## 4) Required deliverables

You must provide (the assistant cannot deploy or capture screenshots):

| Deliverable | Description |
|-------------|-------------|
| **Live staging commitSha** | Output of `curl -s "https://<STAGING>/api/health" \| jq .commitSha` after the deploy that includes the sitters/growth fixes. |
| **Fresh screenshot: /sitters** | Full page showing the sitters list or empty state. No "Organization ID missing." |
| **Fresh screenshot: /growth** | Full page showing SRS / policy tiers or empty state. No "Forbidden." |
| **Screenshots: /calendar, /payroll** | Full pages; used to confirm shell consistency. |
| **Note on calendar/payroll** | After the blockers are confirmed fixed: whether /calendar and /payroll need any final consistency cleanup. Current code already uses OwnerAppShell, LayoutWrapper, Section; if they still look like a different app, one more polish pass can be done. |

Only after the live commitSha matches the fix commit and the screenshots show /sitters and /growth loading should the hard blockers be considered resolved.
