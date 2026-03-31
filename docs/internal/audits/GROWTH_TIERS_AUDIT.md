# Growth / Tiers Completion Audit

**Status:** Partial — two tier systems exist (config tiers vs SRS); config tier CRUD is stubbed; SRS is implemented but not fully surfaced.  
**Source of truth:** SYSTEM_COMPLETION_REMAINING.md (P2: "Expand Growth/Tiers module from placeholder to operational workflow").  
**Automations:** Frozen; no automation work in this audit.

---

## Locked product model (do not blur)

- **SRS / reliability tier** is the **canonical performance tier**. It is computed and stored in SitterTierSnapshot (foundation → reliant → trusted → preferred). UI and data model must treat it as the single "performance tier" concept.
- **Config tiers** (SitterTier + SitterTierHistory) are the **canonical policy/entitlement tiers**. They define permissions, commission, point targets, and progression rules. UI and data model must keep them distinct from SRS; do not merge or blur the two concepts.

---

## Implementation order (locked)

1. Payroll staging proof (health + verify:payroll PASS + signoff).
2. Reports / Analytics staging proof (health + verify-reports-analytics PASS + signoff).
3. **Then** Growth / Tiers implementation (per this audit and the rules below).

Do not start Growth/Tiers implementation until 1 and 2 are done. Do not move to Calendar audit until after Growth/Tiers implementation (or as per your chosen order after proof).

---

## Implementation rules (when we return to Growth/Tiers)

1. **`/growth`** becomes an owner operational surface, not a placeholder.
2. **`/settings/tiers`** becomes real CRUD (backend + new/edit pages).
3. **`/sitter/performance`** becomes real and uses `GET /api/sitter/me/srs`.
4. **Broken assumptions** in tier history/dashboard must be fixed:
   - No `whereOrg` on SitterTierHistory unless the schema supports it (SitterTierHistory has no orgId today).
   - No `assignedAt` / `tierName` assumptions unless the schema supports them; use `periodStart`/`createdAt` and `tier.name` from relation only.
   - Use real relations/fields only in queries and responses.
5. If needed, add `orgId` to SitterTier and SitterTierHistory and migrate properly; then scope all tier CRUD and history by org.

---

## 1. Audit

### 1.1 `/growth`

- **Location:** `src/app/growth/page.tsx`
- **Behavior:** Renders `OwnerModulePlaceholderPage` with title "Growth / Tiers", subtitle about performance/progression/tier governance, CTA "Open tier settings" → `/settings/tiers`, and a checklist linking to `/settings/tiers` and `/sitters`.
- **Gaps:** No real data. No cohort movement, no trend charts, no promotion/review workflows. Purely a placeholder with links.

### 1.2 `/settings/tiers`

- **Location:** `src/app/settings/tiers/page.tsx`
- **Behavior:** Full UI: list tiers (name, point target, min completion/response, priority, house sits/24hr badges, benefits), "Calculate Tiers" button, "Create Tier" → `/settings/tiers/new`, "Edit" → `/settings/tiers/[id]`, "Delete" → `DELETE /api/sitter-tiers/[id]`.
- **API usage:**
  - `GET /api/sitter-tiers` — implemented; returns `{ tiers: [] }` (stub). No persistence.
  - `DELETE /api/sitter-tiers/[id]` — **no route exists** (404).
  - `POST /api/sitter-tiers/calculate` — **no route exists** (404).
- **Missing pages:** No `src/app/settings/tiers/new/page.tsx` or `src/app/settings/tiers/[id]/page.tsx`. "Create Tier" and "Edit" link to 404s.
- **Shell:** Uses `AppShell`, not `OwnerAppShell` (inconsistent with other owner-heavy pages).

### 1.3 Sitter performance route(s)

- **Owner view:** Sitter detail (enterprise) uses `/api/sitters/[id]/dashboard` (includes `tierSummary`). Tabs use:
  - `TierSummaryCard` → `GET /api/sitters/[id]/tier/summary`
  - `TierTab` → `GET /api/sitters/[id]/tier/details`
  - `OwnerSRSCard` / `SitterGrowthTab` → `GET /api/sitters/srs`, `GET /api/sitters/[id]/srs`
- **Sitter view:** `src/app/sitter/performance/page.tsx` — placeholder only: static "Badges" (On Time, Client Favorite, Top Sitter), "Rating summary (coming soon)", "AI suggestions" with `FeatureStatusPill`. No calls to `/api/sitter/me/srs` or tier/summary; not wired to real data.

### 1.4 Reliability score (SRS)

- **Engine:** `src/lib/tiers/srs-engine.ts` — `calculateSRS`, `calculateRolling26WeekScore`; breakdown (responsiveness, acceptance, completion, timeliness, accuracy, engagement, conduct); tier recommendation `foundation` | `reliant` | `trusted` | `preferred`; provisional/atRisk flags.
- **Persistence:** `SitterTierSnapshot` (orgId, sitterId, asOfDate, rolling30dScore, rolling30dBreakdownJson, rolling26wScore, rolling26wBreakdownJson, tier, provisional, visits30d, offers30d, atRisk, atRiskReason). No `orgId` on config `SitterTier`; SRS is org-scoped.
- **APIs:**
  - `GET /api/sitters/[id]/srs` — owner; returns snapshot + current SRS + rolling26w + compensation.
  - `GET /api/sitters/srs` — owner; list of sitters with latest SRS snapshot.
  - `GET /api/sitter/me/srs` — sitter; own SRS + tier perks.
- **Ops:** `POST /api/ops/srs/run-snapshot`, `POST /api/ops/srs/run-weekly-eval` (via `srs-queue`). Not part of automations runbook (frozen).

### 1.5 Tier progression logic

- **Two systems:**
  1. **Config tiers (SitterTier):** Name, pointTarget, minCompletionRate, minResponseRate, priorityLevel, canTakeHouseSits, canTakeTwentyFourHourCare, isDefault, benefits, plus canonical permissions (canJoinPools, canAutoAssign, canOvernight, etc.), commissionSplit, badgeColor/badgeStyle, description, progressionRequirements. `Sitter.currentTierId` → `SitterTier`. `SitterTierHistory` links sitter to tier with periodStart, periodEnd, points, completionRate, responseRate, changedBy, reason, metadata. **No orgId on SitterTier or SitterTierHistory** — config is global; history is per-sitter.
  2. **SRS tiers (SitterTierSnapshot):** Computed tier (foundation/reliant/trusted/preferred), rolling scores, atRisk. Org-scoped; daily snapshots.
- **Progression:** No single "tier progression" pipeline that (a) evaluates SRS + config rules and (b) writes SitterTierHistory or updates Sitter.currentTierId. "Calculate Tiers" in UI has no backend. SRS engine recommends tier but does not assign config tier.

### 1.6 Owner visibility into sitter growth/performance

- **Dashboard API:** Returns `tierSummary` from `SitterTierHistory` + `SitterMetricsWindow` (with `whereOrg(ctx.orgId, { sitterId })`). **Bug:** `SitterTierHistory` has no `orgId`; `whereOrg` adds `orgId` to the where clause and will cause Prisma to filter on a non-existent column (or fail). Scope must be via sitter.orgId (e.g. sitter where orgId, then history for that sitter).
- **Tier tab / Tier summary:** Use `tier/summary` and `tier/details`. **Bugs:** Both use `orderBy: { assignedAt: 'desc' }` on `SitterTierHistory`, but the schema has `periodStart`, `periodEnd`, `createdAt` — no `assignedAt`. Also reference `latestHistory.tierName` and `latestHistory.assignedAt` in response; schema has no `tierName` (only relation `tier`). These routes will throw or return wrong data.
- **Growth tab / SRS cards:** Use `/api/sitters/srs` and `/api/sitters/[id]/srs`; SRS and snapshots are org-scoped and correctly implemented.

### 1.7 Data model and persistence

- **SitterTier:** Global config (no orgId). Used by settings/tiers UI; backend is stub so nothing is persisted.
- **SitterTierHistory:** sitterId, tierId, periodStart, periodEnd, points, completionRate, responseRate, changedBy, reason, metadata, createdAt. No orgId, no assignedAt, no tierName.
- **SitterTierSnapshot:** orgId, sitterId, asOfDate, rolling scores, tier (foundation/reliant/trusted/preferred), provisional, atRisk, etc. Persisted by SRS snapshot job.
- **SitterMetricsWindow:** orgId, sitterId, windowType (daily | weekly_7d | monthly_30d), response/offer metrics. Used by tier/summary and tier/details; must be populated by a separate pipeline (not audited here).
- **Sitter.currentTierId:** Optional FK to SitterTier. Not consistently set by any automation (automations frozen).

### 1.8 Links between sitter surface and owner surface

- **Owner → sitter:** Sitter list/detail; dashboard with tierSummary; Tier tab (tier/summary, tier/details); Growth tab (SRS list + per-sitter SRS). Tier/Details APIs are broken (assignedAt/tierName). SRS APIs work.
- **Sitter → self:** `/sitter/performance` is placeholder; does not call `/api/sitter/me/srs` or show real tier/SRS. No link from sitter app to owner-facing growth/tiers pages (correct).

---

## 2. Canonical growth/tier model

- **Single source of tier display for "reliability" / performance:** Use **SRS** (SitterTierSnapshot + engine) as the canonical reliability tier: foundation → reliant → trusted → preferred. Owner and sitter UIs should show this tier and rolling scores from SRS APIs; no second "config" tier for the same concept.
- **Config tiers (SitterTier) as policy/entitlements:** Keep SitterTier for org-level (or global) **policy**: name, point targets, min rates, permissions (house sits, 24hr, pools, etc.), commission split, badge. Optionally scope by org (add orgId to SitterTier and SitterTierHistory) so each org has its own tier definitions. "Tier progression" in the sense of "promotion/demotion" should:
  - Either drive from SRS (e.g. SRS tier recommendation → update Sitter.currentTierId to a matching SitterTier and append SitterTierHistory), or
  - Be explicitly owner-driven (owner assigns tier; history is audit only).
- **One place for "current performance tier":** SitterTierSnapshot.tier (SRS). One place for "current policy tier": Sitter.currentTierId (SitterTier). Growth/tier UIs should show both where relevant: "Reliability: Trusted (SRS)" and "Policy tier: Silver (entitlements)".
- **History:** SitterTierHistory for **config tier** changes (who, when, reason). SitterTierSnapshot for **SRS** history (daily snapshots). Do not overload SitterTierHistory with SRS tier; keep SRS in snapshots only.

---

## 3. Implementation plan

1. **Fix tier/summary and tier/details**
   - Use `periodStart` or `createdAt` instead of `assignedAt` for ordering.
   - Remove reliance on `tierName` on history; use `tier.name` from relation. Return `periodStart` (or `createdAt`) as the effective "assigned at" in JSON.
   - Scope owner queries by org via Sitter: e.g. resolve sitter by id and orgId first; then query SitterTierHistory by sitterId only (SitterTier has no orgId; if tiers become org-scoped later, add orgId to SitterTier and filter).

2. **Fix dashboard tierSummary**
   - Do not use `whereOrg(ctx.orgId, { sitterId })` on SitterTierHistory (no orgId). Load sitter with whereOrg(ctx.orgId, { id: sitterId }); then query SitterTierHistory by sitterId only. Optionally filter SitterTier by orgId once that column exists.

3. **Implement settings/tiers backend (no automations)**
   - Add org scope to tier config: add `orgId` to `SitterTier` (migration); default "default" for existing rows if needed.
   - `GET /api/sitter-tiers`: return tiers for session orgId (from DB), not stub.
   - `POST /api/sitter-tiers`: create tier (body: name, pointTarget, minCompletionRate, etc.).
   - `GET /api/sitter-tiers/[id]`: get one tier (org-scoped).
   - `PATCH /api/sitter-tiers/[id]`: update tier.
   - `DELETE /api/sitter-tiers/[id]`: delete tier (and/or soft-delete).
   - `POST /api/sitter-tiers/calculate`: optional — either (a) "recalculate SRS and write snapshots only" (no SitterTierHistory writes) or (b) "evaluate SRS vs config rules and update Sitter.currentTierId + SitterTierHistory". For (b), define rules (e.g. map SRS tier to a SitterTier by name; or use point thresholds). Document choice; do not start automation scheduling.

4. **Settings tier pages**
   - Add `src/app/settings/tiers/new/page.tsx` (create tier form) and `src/app/settings/tiers/[id]/page.tsx` (edit tier form). Use OwnerAppShell (or agreed owner shell) for consistency.

5. **Growth page**
   - Replace placeholder with a minimal operational view: e.g. list of sitters with current SRS tier and snapshot date; link to sitter detail Tier/Growth tabs and to /settings/tiers. Optionally add cohort table (count by tier, week-over-week). No automation triggers on this page.

6. **Sitter performance page**
   - Wire to real data: call `GET /api/sitter/me/srs`; show current SRS tier, rolling score, atRisk if any, and link to tier perks (getTierPerks). Remove or replace static "Badges" and "Rating summary (coming soon)" with real SRS breakdown or "coming soon" with a single CTA. Keep AI suggestions behind feature flag if desired.

7. **Schema cleanup (optional, non-blocking)**
   - Add `orgId` to SitterTier and SitterTierHistory if tiers are org-scoped. Add migration and backfill (e.g. "default" org). Update all tier CRUD and history queries to scope by orgId.

8. **Do not (per rules)**
   - Mark Growth/Tiers COMPLETE until staging proof exists (if applicable).
   - Re-open automations (SRS snapshot/weekly eval scheduling, or tier-calculation cron).

---

## 4. Stop and wait

This audit and implementation plan are complete. No further work on Growth/Tiers implementation until you approve or adjust the plan. Automations remain frozen.
