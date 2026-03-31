# Settings Completion Audit

Status: **Partial / fragmented**. The settings surface has multiple owner-facing pages, but most non-tier settings pages are not wired to implemented API routes in the current `src/app/api` tree. Canonical org-scoped settings persistence is inconsistent by domain.

Automations are frozen (not part of this completion pass).
Calendar is excluded from implementation in this phase, but calendar-related settings linkage is audited below.

---

## Scope audited

Owner-facing settings routes and related APIs/persistence:

- Pricing
- Services
- Service areas
- Company/org info
- Notification settings
- Tier settings
- AI settings
- Messaging/Twilio settings that live in or are linked from settings
- Calendar/integration settings that live in or are linked from settings
- Org-scoped settings persistence
- Role access and tenancy enforcement
- Settings navigation and fragmentation

---

## 1) Pricing

**Status:** Present but not wired end-to-end

- **Route(s):** `/settings/pricing`, `/pricing` (feature-matrix alias)
- **API(s):** UI calls `/api/pricing-rules` and `/api/pricing-rules/[id]`
- **Persistence model:** `PricingRule` model exists in Prisma (`prisma/schema.prisma`)
- **Who can edit:** Intended owner/admin; protected route rules include `/api/pricing-rules`
- **What actually works:**
  - Pricing settings page renders list/toggle/delete UI and links to create/edit.
- **What is broken/missing:**
  - No implemented route handlers found under `src/app/api/pricing-rules`.
  - Linked routes `/settings/pricing/new` and `/settings/pricing/[id]` are not present.
  - End-to-end CRUD is not functional from current app-router backend.
- **Org-scope correctness:**
  - `PricingRule` model has no `orgId`; not org-scoped at persistence layer.

---

## 2) Services

**Status:** Present but not wired end-to-end

- **Route(s):** `/settings/services`
- **API(s):** UI calls `/api/service-configs` and `/api/service-configs/[id]`
- **Persistence model:** `ServiceConfig` model exists in Prisma
- **Who can edit:** Intended owner/admin; protected route rules include `/api/service-configs`
- **What actually works:**
  - Services settings page renders list/delete/edit affordances.
- **What is broken/missing:**
  - No implemented route handlers found under `src/app/api/service-configs`.
  - No create/edit route pages under `/settings/services/*`.
  - CRUD is not wired end-to-end.
- **Org-scope correctness:**
  - `ServiceConfig` has no `orgId`; global table semantics are incompatible with multi-tenant settings.

---

## 3) Service Areas

**Status:** Missing

- **Route(s):** None found under `/settings/*` for service areas.
- **API(s):** No dedicated service-area settings APIs found.
- **Persistence model:** No canonical service-area settings model identified in current owner settings stack.
- **Who can edit:** Not applicable (surface missing).
- **What actually works:** N/A.
- **What is broken/missing:**
  - No owner settings control plane for coverage zones, ZIPs, radius, or geofence policy.
  - No explicit route/API/persistence contract for service-area administration.
- **Org-scope correctness:** Not established; no canonical implementation.

---

## 4) Company / Org Info

**Status:** Present but not wired end-to-end

- **Route(s):** `/settings/business`, `/settings` (general tab)
- **API(s):**
  - `/settings/business` calls `/api/business-settings`
  - `/settings` calls `/api/settings`
- **Persistence model:**
  - `BusinessSettings` model exists
  - `Org` model exists
- **Who can edit:** Intended owner/admin via protected settings routes
- **What actually works:**
  - UI exists for business name/phone/email/address and timezone.
- **What is broken/missing:**
  - No implemented `/api/business-settings` route in current app-router API tree.
  - No implemented `/api/settings` route in current app-router API tree.
  - `/settings` and `/settings/business` duplicate overlapping company fields with unclear source-of-truth.
- **Org-scope correctness:**
  - `BusinessSettings` model has no `orgId`; not tenant-safe as canonical owner settings storage.
  - `Org` exists but is not clearly used as authoritative write target for company settings.

---

## 5) Notification Settings

**Status:** Partial (UI-only in settings, backend uncertain)

- **Route(s):** `/settings` (automation/general toggles in tabs), `/settings/page-legacy` (legacy tabbed surface)
- **API(s):** `/api/settings` (expected by both current and legacy settings pages)
- **Persistence model:** Not explicit in audited local API routes (no implemented `/api/settings` route found)
- **Who can edit:** Intended owner/admin
- **What actually works:**
  - UI toggles for SMS/email and owner/sitter alerts are present.
- **What is broken/missing:**
  - No current app-router implementation of `/api/settings` to verify persistence contract.
  - Notification settings are mixed into generic automation/settings payloads, not a canonical notifications domain model.
  - Dedicated owner notifications center is marked `coming_soon` in feature matrix.
- **Org-scope correctness:**
  - Cannot verify in current API implementation because route handler is absent from local app-router tree.

---

## 6) Tier Settings

**Status:** Complete (for policy tiers)

- **Route(s):** `/settings/tiers`, `/settings/tiers/new`, `/settings/tiers/[id]`
- **API(s):** `/api/sitter-tiers`, `/api/sitter-tiers/[id]`
- **Persistence model:** `SitterTier`, `SitterTierHistory` (org-scoped in current schema), related sitter relations
- **Who can edit:** owner/admin only (`getRequestContext` + `requireAnyRole`)
- **What actually works:**
  - Real CRUD for policy tiers.
  - Validations, default-tier semantics, assignment safety checks before delete.
  - UI and API are aligned with current schema.
- **What is broken/missing:**
  - No major blocker in this domain from current audit scope.
- **Org-scope correctness:**
  - Enforced via `whereOrg(ctx.orgId, ...)` in routes.
  - Schema now includes org-scoped tier uniqueness and indexes.

---

## 7) AI Settings

**Status:** Partial (operational but fragmented from settings control plane)

- **Route(s):** `/ops/ai` (owner-facing), no dedicated `/settings/ai` route
- **API(s):** `/api/ops/ai/settings`, `/api/ops/ai/usage`, `/api/ops/ai/templates*`
- **Persistence model:** `OrgAISettings`, `AIPromptTemplate`, `AIUsageLog`
- **Who can edit:** owner/admin only (request context + RBAC)
- **What actually works:**
  - Enable/disable, budget, hard-stop controls.
  - Usage visibility and prompt-template management.
- **What is broken/missing:**
  - AI settings are not integrated into canonical `/settings` IA.
  - Operates as ops module instead of settings section.
- **Org-scope correctness:**
  - Correct: scoped DB usage and org-unique settings row.

---

## 8) Messaging/Twilio settings if live in Settings

**Status:** Partial / fragmented

- **Route(s):**
  - `/settings` integrations tab links messaging setup
  - canonical operational setup currently in `/integrations` and `/messaging/twilio-setup`
- **API(s):**
  - Twilio operational APIs exist under `/api/setup/*`
  - Settings pages reference generic `/api/settings` fields for owner phone config
- **Persistence model:** `ProviderCredential` (org-unique), `MessageNumber`, assignment/thread models
- **Who can edit:** owner/admin intended
- **What actually works:**
  - Real Twilio setup/test/install flows exist outside settings.
  - Settings page surfaces CTA to messaging setup.
- **What is broken/missing:**
  - Twilio is not managed as a complete settings section in `/settings`.
  - Legacy Twilio/OpenPhone fields in settings payload are not backed by visible local `/api/settings` app-router route.
- **Org-scope correctness:**
  - Twilio credential persistence is org-scoped in model.
  - Settings-surface phone config tenancy cannot be fully verified without canonical `/api/settings` route in app-router.

---

## 9) Calendar/integration-related settings if live in Settings

**Status:** Missing from settings (delegated/fragmented)

- **Route(s):**
  - No dedicated calendar settings section under `/settings`
  - Related controls live in `/integrations`, `/ops/calendar-repair`, sitter/calendar surfaces
- **API(s):** Calendar/integration APIs are outside `/settings` (`/api/integrations/google/*`, calendar APIs)
- **Persistence model:** sitter calendar token/sync fields, `BookingCalendarEvent`
- **Who can edit:** split across owner/sitter/admin depending endpoint
- **What actually works:**
  - Calendar integration readiness/setup exists via integrations and calendar modules.
- **What is broken/missing:**
  - No canonical settings section for owner calendar policy/integration options.
  - Fragmented discoverability from settings IA.
- **Org-scope correctness:**
  - Mixed by endpoint; settings-level governance surface is absent.

---

## 10) General org-scoped settings persistence

**Status:** Broken / inconsistent

- **Route(s):** `/settings*`, `/ops/ai`, `/settings/tiers`
- **API(s):** Mixed (`/api/sitter-tiers*`, `/api/ops/ai/settings`, expected-but-missing `/api/settings*`)
- **Persistence model:**
  - Proper org scope: `SitterTier`, `SitterTierHistory`, `OrgAISettings`, `ProviderCredential`
  - Missing org scope for key settings tables: `BusinessSettings`, `ServiceConfig`, `PricingRule`, `Discount`
- **Who can edit:** Intended owner/admin
- **What actually works:**
  - Some domains are properly org-scoped (tiers, AI, Twilio credentials).
- **What is broken/missing:**
  - Settings domains are split across models with uneven tenancy design.
  - Core settings APIs for business/services/pricing/discounts/form/custom fields are absent in local app-router API tree.
- **Org-scope correctness:**
  - Not correct overall; requires consolidation around explicit org-scoped canonical models.

---

## 11) Role access / tenancy enforcement

**Status:** Partial

- **Route(s):** `/settings*` protected in route guards
- **API(s):**
  - Existing implemented APIs (`/api/sitter-tiers*`, `/api/ops/ai/settings`) enforce owner/admin + org scope.
  - Many expected settings APIs are missing, so enforcement is undefined for those domains.
- **Persistence model:** Mixed org-scoped and non-org-scoped settings models
- **Who can edit:** Intended owner/admin
- **What actually works:**
  - Global protection rules classify settings and many settings APIs as protected.
  - Existing real settings-like APIs have explicit RBAC checks.
- **What is broken/missing:**
  - Protected route declarations reference APIs that are not locally implemented, creating false confidence.
  - Tenancy guarantees are only as strong as implemented endpoints; many are currently absent.
- **Org-scope correctness:**
  - Correct in implemented domains; incomplete/invalid in missing domains and non-org-scoped tables.

---

## 12) Settings navigation / page fragmentation

**Status:** Broken / misleadingly fragmented

- **Route(s):**
  - `/settings` (tabbed shell)
  - `/settings/page-legacy` (legacy variant still present)
  - `/settings/business`, `/settings/services`, `/settings/pricing`, `/settings/custom-fields`, `/settings/form-builder`, `/settings/discounts`, `/settings/rotation`, `/settings/tiers*`
  - `/ops/ai` for AI settings
  - `/integrations` for integrations controls
- **API(s):** Mixed and inconsistent; many expected `/api/settings*`-style routes missing locally
- **Persistence model:** Fragmented across business/pricing/service/tier/AI/integration models
- **Who can edit:** Intended owner/admin
- **What actually works:**
  - Tiers and AI/integrations have usable operational surfaces.
- **What is broken/missing:**
  - Duplicate settings top-level surfaces (`/settings` and `/settings/page-legacy`).
  - Multiple settings subpages link to `new`/`edit` routes that do not exist (except tiers).
  - Canonical owner settings control plane not enforced by navigation contract.
- **Org-scope correctness:** Varies by domain; not coherent end-to-end.

---

## Canonical Settings Model (target architecture)

### Primary route

- **Canonical settings control plane route:** `/settings`

### Canonical section IA under `/settings`

- **Business** (company/org profile, legal profile, address/timezone)
- **Services** (service catalog and service areas)
- **Pricing** (base rates, pricing rules, discounts)
- **Notifications** (owner/sitter/client communication preferences and delivery channels)
- **Tiers** (policy tiers only; SRS remains separate in growth/performance)
- **AI** (governance + usage + model controls surfaced from ops APIs)
- **Integrations links** (readiness and deep links to `/integrations`)
- **Advanced / org config** (org metadata, feature flags, operational defaults)

### Which routes remain vs redirect

- **Remain (canonical):**
  - `/settings`
  - `/settings/tiers`, `/settings/tiers/new`, `/settings/tiers/[id]` (already real)
- **Remain as specialized but linked from `/settings`:**
  - `/integrations` (canonical integrations control center)
  - `/ops/ai` (until AI settings UI is embedded into `/settings/ai`)
- **Deprecate/redirect to `/settings` sections:**
  - `/settings/page-legacy`
  - `/settings/business`
  - `/settings/services`
  - `/settings/pricing`
  - `/settings/custom-fields`
  - `/settings/form-builder`
  - `/settings/discounts`
  - `/settings/rotation`

### Canonical config model(s)

- Introduce explicit org-scoped settings aggregate (or modular org-scoped tables) as source of truth:
  - `OrgSettingsBusiness`
  - `OrgSettingsServices` (+ `OrgServiceArea`)
  - `OrgSettingsPricing`
  - `OrgSettingsNotifications`
  - `OrgSettingsAdvanced`
- Keep domain-specific operational models where appropriate:
  - `SitterTier*` for tiers
  - `OrgAISettings` for AI governance
  - `ProviderCredential` + integrations models for provider setup

### Org-scoped persistence rules

- Every canonical settings table must include `orgId` and indexes.
- Every settings API must require owner/admin and enforce `orgId` filters on all reads/writes.
- Eliminate global (`@unique` without org dimension) constraints for tenant-owned settings entities.

---

## Implementation Plan (no code yet)

### 1) Route consolidation

- Define `/settings` as owner settings shell with sectioned navigation.
- Migrate content from fragmented settings subpages into section modules under canonical shell.
- Add redirects from deprecated settings routes to `/settings?section=...`.
- Keep `/integrations` and `/ops/ai` linked until section-native pages are shipped.

### 2) Persistence/API gaps

- Implement missing app-router APIs currently referenced by settings pages:
  - `/api/settings` (or sectioned equivalents)
  - `/api/settings/business`
  - `/api/settings/services`
  - `/api/settings/service-areas`
  - `/api/settings/pricing`
  - `/api/settings/discounts`
  - `/api/settings/notifications`
  - `/api/settings/advanced`
- Reconcile/replace unimplemented legacy endpoints (`/api/business-settings`, `/api/service-configs`, `/api/pricing-rules`, `/api/form-fields`, `/api/custom-fields`, `/api/discounts`, `/api/settings/rotation`) with canonical section APIs.
- Add org-scoped schema/migrations for non-org-scoped settings tables.

### 3) Access/tenancy hardening

- Standardize all settings APIs on `getRequestContext` + `requireAnyRole(['owner','admin'])`.
- Enforce tenant scope in all queries (`whereOrg`/scoped DB) and remove global writes.
- Add tests for cross-org isolation for each settings section API.

### 4) UI completion

- Build one coherent owner settings control plane at `/settings` with:
  - Business
  - Services + Service Areas
  - Pricing + Discounts
  - Notifications
  - Tiers
  - AI
  - Integrations links
  - Advanced
- Remove placeholder/404 links by only exposing implemented actions/routes.
- Ensure each section has clear status, save flows, and error handling.

### 5) Verification/proof

- Add unit/integration tests for each settings section API:
  - auth (owner/admin allowed, sitter/client denied)
  - tenant isolation
  - persistence round-trip
- Add page-level tests for `/settings` section rendering and save flows.
- Run:
  - `pnpm lint --fix`
  - `pnpm build`
  - targeted settings API tests
- Produce staging sanity checklist for settings after implementation.

---

## Completion verdict (current)

- **Tier settings:** complete and real.
- **AI settings:** real but not integrated into canonical `/settings` IA.
- **Most other settings domains:** currently **present but not wired end-to-end** due missing local app-router API implementations and fragmented route architecture.

