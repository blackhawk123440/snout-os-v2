# Staging Role Test Accounts

Use `POST /api/ops/command-center/seed-fixtures` as an owner/admin in staging to ensure these accounts exist:

- owner: `owner@example.com` / `e2e-test-password`
- sitter: `sitter@example.com` / `e2e-test-password`
- client: `client@example.com` / `e2e-test-password`

If `ENABLE_E2E_AUTH=true` (or `ENABLE_E2E_LOGIN=true`) and `E2E_AUTH_KEY` is configured, you can also use:

- `POST /api/ops/e2e-login` with header `x-e2e-key: <E2E_AUTH_KEY>`
- body example: `{ "role": "sitter" }` or `{ "role": "client" }`

Fixture endpoints (staging only, owner/admin or valid `x-e2e-key`):

- `POST /api/ops/command-center/seed-fixtures` (rate-limited to 2/min)
- `POST /api/ops/command-center/reset-fixtures` (rate-limited to 2/min)

## Deterministic Command Center Verification

Run the end-to-end verifier:

```bash
BASE_URL=https://snout-os-staging.onrender.com E2E_AUTH_KEY=<your-key> pnpm tsx scripts/verify-command-center.ts
```

The runner will:

- print `/api/health` identity (`commitSha`, `envName`, `redis`)
- seed command center fixtures
- verify ordering evidence (`first10Ids`) and counts by type/severity
- perform snooze + handled actions and assert persistence
- assert sitter/client cannot access owner command center API/page

## Migration Policy Note

See `docs/ops/staging-migration-baseline-repair.md` for the one-time staging baseline repair and the strict rule: **never use `prisma db push` in production**.
