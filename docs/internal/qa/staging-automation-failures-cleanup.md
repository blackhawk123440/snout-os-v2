# Staging: Clean stale automation failures

If Reports or Dashboard show a high automation failure count (e.g. 60) from old fixture or test data, clean them so metrics reflect reality.

## One-time cleanup (owner session required)

1. Log in to staging as an **owner**.
2. Call the cleanup API (browser console, curl with session cookie, or a one-off script):

```bash
# With a valid session cookie for staging (replace COOKIE and BASE_URL)
curl -X POST "https://<staging-base-url>/api/ops/automation-failures/cleanup?olderThanDays=90" \
  -H "Cookie: <session-cookie>"
```

Or from the browser while logged in as owner:

```js
fetch('/api/ops/automation-failures/cleanup?olderThanDays=90', { method: 'POST', credentials: 'include' })
  .then(r => r.json())
  .then(console.log);
```

3. Response example: `{ "deleted": 60, "olderThanDays": 90, "cutoff": "..." }`.
4. Reload Reports and Dashboard; automation failure count should reflect only recent failures.

## Optional: cleanup script (with E2E auth)

If you use E2E login for staging, you can run a script that logs in and calls the cleanup endpoint. The endpoint is **owner-only**; the session must have role `owner` (or `admin`).
