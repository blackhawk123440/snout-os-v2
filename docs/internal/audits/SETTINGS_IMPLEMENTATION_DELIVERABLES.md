# Settings Implementation – Deliverables

Completed as part of the **consolidation + persistence hardening** project. Calendar and Automations were not touched.

---

## 1. Changed files

### Schema and migration
- **prisma/schema.prisma** – Added `orgId` to `Setting`, `ServiceConfig`, `PricingRule`, `Discount`, `BusinessSettings`; added `OrgNotificationSettings` and `OrgServiceArea`; adjusted uniques to be org-scoped where needed.
- **prisma/migrations/20260313000000_settings_org_scoped_and_new_models/migration.sql** – Migration for the above (new tables and columns, indexes, unique constraints).
- **src/lib/tenancy/tenant-models.ts** – Registered `businessSettings`, `serviceConfig`, `pricingRule`, `discount`, `setting`, `orgNotificationSettings`, `orgServiceArea`.

### API routes (org-scoped, owner/admin only)
- **src/app/api/settings/business/route.ts** – GET/PATCH business settings.
- **src/app/api/settings/services/route.ts** – GET/POST services.
- **src/app/api/settings/services/[id]/route.ts** – GET/PATCH/DELETE one service.
- **src/app/api/settings/pricing/route.ts** – GET/POST pricing rules.
- **src/app/api/settings/pricing/[id]/route.ts** – GET/PATCH/DELETE one rule.
- **src/app/api/settings/discounts/route.ts** – GET/POST discounts.
- **src/app/api/settings/discounts/[id]/route.ts** – GET/PATCH/DELETE one discount.
- **src/app/api/settings/notifications/route.ts** – GET/PATCH org notification settings.
- **src/app/api/settings/service-areas/route.ts** – GET/POST service areas.
- **src/app/api/settings/service-areas/[id]/route.ts** – GET/PATCH/DELETE one area.
- **src/app/api/settings/rotation/route.ts** – GET/POST rotation (key-value `Setting` with `orgId`).

### Route consolidation (redirects)
- **src/app/settings/business/page.tsx** – Redirect to `/settings?section=business`.
- **src/app/settings/services/page.tsx** – Redirect to `/settings?section=services`.
- **src/app/settings/pricing/page.tsx** – Redirect to `/settings?section=pricing`.
- **src/app/settings/discounts/page.tsx** – Redirect to `/settings?section=pricing`.
- **src/app/settings/custom-fields/page.tsx** – Redirect to `/settings`.
- **src/app/settings/form-builder/page.tsx** – Redirect to `/settings`.
- **src/app/settings/rotation/page.tsx** – Redirect to `/settings?section=advanced`.
- **src/app/settings/page-legacy/page.tsx** – New route; redirect to `/settings`.

### Canonical settings UI
- **src/app/settings/page.tsx** – Single settings shell with sections (Business, Services, Pricing, Notifications, Tiers, AI, Integrations, Advanced), Suspense for `useSearchParams`, real load/save from `/api/settings/*`, Pricing section includes discounts list, design token fixes (border, Badge variant).

### Other code that needed schema/API alignment
- **src/app/api/ops/command-center/staffing/resolve/route.ts** – `Setting` lookup by key now uses `orgId_key: { orgId, key }`.
- **src/lib/messaging/__tests__/deterministic-replay.test.ts** – Setting upserts use `orgId_key` and `orgId` in create.
- **src/lib/messaging/__tests__/pool-release.test.ts** – Same + deleteMany scoped by `orgId`.
- **src/lib/messaging/__tests__/pool-capacity.test.ts** – Same.

### Tests
- **src/app/api/settings/business/__tests__/route.test.ts** – GET/PATCH, owner vs sitter/client, org-scoped read/upsert.
- **src/app/api/settings/notifications/__tests__/route.test.ts** – GET/PATCH, owner/admin vs sitter, org-scoped.

---

## 2. Migration added

- **20260313000000_settings_org_scoped_and_new_models**
  - `Setting`: add `orgId`, unique `(orgId, key)`.
  - `ServiceConfig`: add `orgId`, unique `(orgId, serviceName)`.
  - `PricingRule`: add `orgId`, index.
  - `Discount`: add `orgId`, unique `(orgId, code)`.
  - `BusinessSettings`: add `orgId`, unique on `orgId`.
  - New tables: `OrgNotificationSettings`, `OrgServiceArea`.

Apply with: `pnpm exec prisma migrate deploy` (or `prisma migrate dev` in a dev environment).

---

## 3. Route redirects / deprecations

| Legacy route                 | Redirect / behavior                          |
|-----------------------------|----------------------------------------------|
| `/settings/business`        | → `/settings?section=business`              |
| `/settings/services`       | → `/settings?section=services`              |
| `/settings/pricing`         | → `/settings?section=pricing`              |
| `/settings/discounts`      | → `/settings?section=pricing`              |
| `/settings/custom-fields`   | → `/settings`                               |
| `/settings/form-builder`    | → `/settings`                               |
| `/settings/rotation`        | → `/settings?section=advanced`              |
| `/settings/page-legacy`     | → `/settings` (new redirect route)          |

**Unchanged (canonical or standalone):**
- `/settings` – canonical control plane.
- `/settings/tiers`, `/settings/tiers/new`, `/settings/tiers/[id]` – tier CRUD (existing).
- `/integrations`, `/ops/ai` – standalone; linked from Settings.

---

## 4. Remaining caveats before marking Settings “complete”

1. **Migration** – Run the new migration on every environment (dev, staging, prod). Existing rows get `orgId = 'default'`. If there are duplicate `Discount.code` values in one org, the unique constraint may require manual deduplication before or during migration.
2. **Tests depending on DB** – `deterministic-replay.test.ts` (and any test that hits real DB with `Setting`) will fail until the migration is applied. The new settings API tests mock Prisma and pass without the migration.
3. **Other failing tests** – Failures in `cross-org-isolation`, `phase-1-5-hardening`, and `phase-4-2-sitter` are outside this Settings work (messaging/context/mocks). They should be fixed separately.
4. **Custom fields / Form builder** – No persistence or UI on the canonical `/settings` yet; those pages redirect to `/settings`. Add later if product requires.
5. **Rotation / number-helpers** – `number-helpers` and `pool-release-job` still use defaults or empty rotation config; they do not read from `Setting` with `orgId` yet. The **API** and **Settings UI** for rotation are org-scoped and persist; runtime consumers can be wired to read by `orgId` in a follow-up.

---

## 5. Commit strategy (as requested)

- **Commit 1:** Settings: canonical routes + org-scoped persistence APIs  
  - Schema, migration, tenant-models, all `/api/settings/*` routes, staffing resolve + messaging test updates for `Setting` org-scope.
- **Commit 2:** Settings: real owner control surface  
  - Redirect pages, canonical `/settings` page (sections, load/save, discounts in Pricing, Suspense, token fixes).
- **Commit 3:** Settings: tests + hardening  
  - `settings/business` and `settings/notifications` API tests, this deliverables doc, any final lint/build fixes.

---

## 6. Verification

- **pnpm lint --fix** – Passed.
- **pnpm build** – Passed.
- **Settings API tests** – `src/app/api/settings/business/__tests__/route.test.ts` and `src/app/api/settings/notifications/__tests__/route.test.ts` – 9 tests passing (owner/admin read/write, sitter/client 403, org-scoped usage).

---

## 7. Staging proof (required before formal close)

Settings is **not formally closed** until staging proof is done. Use:

- **[docs/qa/settings-final-signoff.md](qa/settings-final-signoff.md)** – Apply migration `20260313000000_settings_org_scoped_and_new_models` in staging, run the sanity pass (health, /settings load, save flows, persistence after refresh, sitter/client 403, org isolation), and fill the signoff doc. After signoff, the next system is **Calendar completion**. Do not touch Calendar or Automations until then.
