# System Completion Remaining Work

## P0 - Critical (block production)

### Shared Infrastructure
- Unify Twilio inbound to one canonical webhook path and schema contract; remove stale path usage and validate setup installer target.
- Fix sitter inbox backend/model drift so sitter-owner-client messaging is one consistent `MessageEvent` pipeline.
- Guarantee web/worker deploy parity (same release SHA) in deployment config and runtime checks.
- Enforce migration discipline in CI to match production (`migrate deploy` path, remove unsafe `db push` fallback for merge gating).
- Remove remaining high-risk raw Prisma access in tenancy-sensitive flows; enforce scoped DB consistently.
- Lock down messaging thread APIs and SSE thread streams with stricter role + membership checks (not just org-level).

### Owner
- Convert placeholder messaging subroutes (`/messaging/inbox|sitters|numbers|assignments`) into true live views or collapse them into one canonical route.
- Complete Numbers “Release from Twilio” action end-to-end.

### Sitter
- Repair `/api/sitter/threads*` and UI hook contract so inbox can load/send reliably.
- Eliminate silent success path in Daily Delight/report creation API when persistence fails.

### Client
- Replace `/bookings/new` dependency with a true client-native booking create flow that binds to authenticated client identity.

## P1 - High (major system integrity / operator trust)

### Owner
- Consolidate automations surfaces (`/automation`, `/automations`, `/automation-center`) to one canonical route and API contract.
- Complete Assignments conflict detection path and ensure UI references only implemented APIs.
- Move remaining owner-heavy pages (`/numbers`, `/assignments`, `/automations`, `/payroll`) fully to OwnerAppShell/layout standards.
- Finish `/finance` non-stub ledger/transaction detail implementation.
- Implement true Reports/Analytics owner module beyond placeholder level.

### Sitter
- Fully wire sitter reports index page to real data and include submission/edit history.
- Ensure checklist API enforces booking state server-side, not only in UI.
- Wire sitter performance route to real tier/performance data (or deprecate cleanly).

### Client
- Add client pet management create/edit workflow to match portal expectations.
- Resolve messaging E2E integrity with sitter and owner once shared pipeline is unified.
- Replace loyalty display-only behavior with explicit accrual/update source or remove misleading UI.

### Shared Infrastructure
- Strengthen health endpoint to include worker processing readiness signal.
- Tighten EventLog taxonomy consistency across ops and messaging actions.
- Validate and harden number-class/provider field consistency across setup/sync/runtime paths.

## P2 - Medium (completeness, UX quality, resilience)

### Owner
- Resolve dashboard home routing ambiguity (`/dashboard` vs `/command-center` as true default).
- Deepen calendar day/week behavior to match UI controls.
- Expand Growth/Tiers module from placeholder to operational workflow.

### Sitter
- Improve earnings filters so tabs are data-backed, not cosmetic.
- Improve availability UI to expose overrides/rules capabilities already present in API.
- Clean dead-end controls (unused notification affordances, unreachable calendar delight trigger).

### Client
- Improve at-a-glance module resilience when one API fails.
- Add clearer profile editing capabilities or remove implied edit affordances.

### Shared Infrastructure
- Expand no-db smoke and a11y coverage for more high-risk routes.
- Improve offline conflict handling strategy and observability around replay collisions.

## P3 - Low (polish / optimization)

### Cross-role
- Normalize shell consistency and copy across owner/sitter/client for clearer state semantics.
- Expand analytics narratives and drill-down consistency once core data paths are stabilized.

