# Growth / Tiers — Final Sign-off

Growth / Tiers staging sanity is complete and passing after applying pending org-scope migrations to the live staging database.

---

## Staging /api/health JSON

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "version": "04a23a51e76bc910b26e94616e46143db8065fa0",
  "commitSha": "04a23a5",
  "buildTime": "2026-03-07T15:51:33.063Z",
  "envName": "staging",
  "timestamp": "2026-03-07T15:51:33.063Z"
}
```

---

## Sanity checks run

### Route/page access

- Owner session:
  - `/growth` -> `200`
  - `/settings/tiers` -> `200`
  - `/sitter/performance` -> `200`
- Admin access verification:
  - Confirmed by temporarily promoting owner role to `admin` in staging DB, re-authenticating, and re-checking:
    - `/growth` -> `200`
    - `/settings/tiers` -> `200`
    - `/sitter/performance` -> `200`

### Tier persistence checks

- `POST /api/sitter-tiers` -> `201`
- `GET /api/sitter-tiers` -> `200`
- Persistence confirmed: newly created tier appears after refresh/read (`persisted: true`).

## Migration state notes

- Root cause during first pass: staging service DB had not yet applied:
  - `20260310000000_payroll_run_org_scoping`
  - `20260311000000_payroll_line_item_payout_transfer_id`
  - `20260312000000_org_scope_sitter_tiers`
- Applied migrations directly against the live staging Postgres host and reran checks.
- Post-migration rerun is fully passing for Growth/Tiers sanity.

---

## Sign-off

- [x] Staging `/growth` owner/admin access verified.
- [x] Staging `/settings/tiers` owner/admin access verified.
- [x] Staging `/sitter/performance` owner/admin access verified.
- [x] Tier persistence verified (`POST 201`, `GET 200`, persisted on read/refresh).
- [x] Migration gap reconciled and sanity rerun clean.

**Growth / Tiers status:** **COMPLETE**.

---

*Automations remain untouched.*
