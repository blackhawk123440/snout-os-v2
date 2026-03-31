# Settings — Final Sign-off

Settings is **code-complete** but not formally closed until staging proof is done. Do not mark Settings COMPLETE until this signoff is filled and checked.

**Next system after Settings signoff:** Calendar completion. Do not touch Calendar or Automations until then.

---

## 1. Pre-requisites: Apply migration in staging

1. Deploy the branch that includes the Settings implementation to staging.
2. Apply the Settings org-scope migration on the **staging** database:

   ```bash
   # From repo root, with DATABASE_URL pointing at staging Postgres:
   pnpm exec prisma migrate deploy
   ```

   Confirm migration **20260313000000_settings_org_scoped_and_new_models** is applied (check `_prisma_migrations` or deploy logs).

3. If the migration was already applied in a previous deploy, skip to the sanity checks below.

---

## 2. Staging sanity pass (required checks)

Run the following with an **owner or admin** account in staging unless otherwise noted.

### 2.1 Health

- [x] Capture staging `/api/health` response (see section 3 below for where to paste).

  ```bash
  curl -s "https://<STAGING_URL>/api/health" | jq .
  ```

### 2.2 /settings loads for owner/admin

- [x] Log in as **owner** (or admin). Open **/settings**.
- [x] Page loads without error; all sections visible (Business, Services, Pricing, Notifications, Tiers, AI, Integrations, Advanced).

### 2.3 Owner/admin can save (each flow)

For each row, perform the action, click Save (or equivalent), then **refresh the page** and confirm the value is still there.

| Save flow            | Action | Persistence after refresh |
|----------------------|--------|---------------------------|
| **Business**         | Change business name / phone / email / address / timezone, Save. | [x] Yes |
| **Services**         | Add a service (if UI allows) or confirm list loads; edit/delete if available. | [x] Yes |
| **Pricing**          | Add or toggle a pricing rule; delete one. | [x] Yes |
| **Discounts**        | Add or toggle a discount (in Pricing section); delete one. | [x] Yes |
| **Notifications**     | Toggle SMS/email/owner alerts/etc., Save. | [x] Yes |
| **Service areas**     | Add a service area (Advanced section); confirm list loads. | [x] Yes |
| **Rotation**         | Change pool selection strategy or a numeric field in Advanced, Save rotation. | [x] Yes |

### 2.4 Persistence confirmation

- [x] After saving in **at least** Business, Notifications, and Rotation, performed a full page refresh (or reopened /settings). Confirmed saved values were still present.

### 2.5 Sitter/client blocked from settings write routes

- [x] Logged in as **sitter** (or use a sitter session/token). Called a settings **write** endpoint (e.g. `PATCH /api/settings/business` or `POST /api/settings/notifications`) with valid JSON body. **Result:** 403 Forbidden.
- [x] Logged in as **client** (or use a client session/token). Called a settings **write** endpoint. **Result:** 403 Forbidden.

Optional: confirm **GET** /api/settings/* as sitter/client also returns 403 if that is the intended policy.

### 2.6 Org-scoped isolation (optional but recommended)

- [x] Org-scoped isolation validated by writing sentinel `BusinessSettings` and `ServiceConfig` rows for a foreign org in staging DB and confirming they were not visible through owner-org `/api/settings/business` and `/api/settings/services` reads.

---

## 3. Staging /api/health JSON

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

## 4. Save flows tested (summary)

List which save flows were exercised and that persistence was confirmed after refresh:

| Flow           | Tested | Persisted after refresh |
|----------------|--------|--------------------------|
| Business       | [x]    | [x]                      |
| Services       | [x]    | [x]                      |
| Pricing        | [x]    | [x]                      |
| Discounts      | [x]    | [x]                      |
| Notifications  | [x]    | [x]                      |
| Service areas  | [x]    | [x]                      |
| Rotation       | [x]    | [x]                      |

Evidence from staging API sanity run:

- Owner/sitter/client credential logins succeeded (`302` to `/settings`).
- `/settings` page load as owner: `200`, Settings UI visible.
- `/api/settings/business`: `PATCH 200`, `GET 200` (value persisted).
- `/api/settings/services`: `POST 200`, `PATCH 200`, `GET 200` (value persisted).
- `/api/settings/pricing`: `POST 200`, `GET 200` (value persisted).
- `/api/settings/discounts`: `POST 200`, `GET 200` (value persisted).
- `/api/settings/notifications`: `PATCH 200`, `GET 200` (value persisted).
- `/api/settings/service-areas`: `POST 200`, `GET 200` (value persisted).
- `/api/settings/rotation`: `POST 200`, `GET 200` (value persisted).
- Additional org-isolation probe: inserted foreign-org sentinel rows in `BusinessSettings` and `ServiceConfig`, confirmed owner org could not read them, then cleaned up sentinels.

---

## 5. Confirmation: Sitter/client forbidden

- [x] **Sitter** calling a settings write route (`PATCH /api/settings/business`): **403 Forbidden** confirmed.
- [x] **Client** calling a settings write route (`POST /api/settings/notifications`): **403 Forbidden** confirmed.

---

## 6. Sign-off

- [x] Migration **20260313000000_settings_org_scoped_and_new_models** applied in staging.
- [x] Staging /api/health JSON pasted in section 3.
- [x] /settings loads for owner/admin. (Owner confirmed via live session and successful save/read on all required sections.)
- [x] All required save flows tested; persistence after refresh confirmed (section 4).
- [x] Sitter and client blocked from settings write routes (section 5).

**Settings status:** [x] **COMPLETE** (staging proof completed).

---

*After Settings signoff, proceed to **Calendar completion**. Do not touch Calendar or Automations until this signoff is complete.*
