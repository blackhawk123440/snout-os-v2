# Feature Completion Gate

The Feature Gate makes "implemented" measurable. It enforces that every canonical feature has:

- **Routes** — page files exist under `src/app/`
- **APIs** — route handlers exist under `src/app/api/` (where applicable)
- **Tests** — snapshot tests exist in playwright specs

## Source of Truth

- **`src/lib/feature-matrix.ts`** — canonical feature set per portal (owner, sitter, client)
- **`scripts/feature-audit.ts`** — validates routes, APIs, and tests exist

## Running the Audit

```bash
pnpm run feature:audit
```

Runs in CI as part of `build-and-test`. Must pass for the build to succeed.

## Adding a New Feature

1. Add an entry to `FEATURE_MATRIX` in `src/lib/feature-matrix.ts`:
   - `portal`: owner | sitter | client
   - `slug`: e.g. `owner.bookings`
   - `routes`: page paths that must exist
   - `apis`: API paths (optional; omit if proxied)
   - `tests.snapshot`: snapshot name substring to find in specs
   - `status`: live | beta | coming_soon
   - `definitionOfDone`: human-readable DoD

2. Create the route files and snapshot test.

3. Run `pnpm run feature:audit` to verify.

## Status Semantics

- **live** — feature is required; audit fails if routes/tests missing
- **beta** — same as live for audit
- **coming_soon** — audit does not fail if incomplete

## Relation to Operational Completeness

The gate proves **surface-complete** (UI + API contract + tests exist). It does *not* prove **operationally complete** (DB writes, webhooks, permissions, E2E flows). See the main product roadmap for operational completion phases.
