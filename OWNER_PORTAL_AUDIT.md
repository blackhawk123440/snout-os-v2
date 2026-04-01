# Owner Portal Audit

Date: 2026-03-31
Scope: owner-facing product surfaces in `snout-os-v2`

## Verdict

Current status: improved but not elite.

The owner portal now has a better SaaS spine:
- dashboard is clearer
- setup is more guided
- settings are more productized
- messaging is framed more intelligently
- booking entry is stronger
- bookings management is more productized
- client management is more polished
- money is now framed as billing instead of a vague internal finance area

But the owner portal is not yet fully elite SaaS because deeper business and management pages still feel like internal enterprise tools more than refined commercial product surfaces.

## Pages Reviewed In This Audit Pass

Reviewed directly:
- `src/app/dashboard/page.tsx`
- `src/app/setup/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/messaging/page.tsx`
- `src/app/bookings/new/page.tsx`
- `src/app/bookings/page.enterprise.tsx`
- `src/app/clients/page.enterprise.tsx`
- `src/app/money/page.tsx`
- `src/app/automations/page.tsx`
- `src/app/import/page.tsx`
- `src/app/numbers/page.tsx`
- `src/app/command-center/page.tsx`
- `src/app/analytics/page.tsx`

## What Is Strong

### 1. Product framing is much better at the top layer
- `Dashboard`
- `Setup`
- `Settings`
- `Messaging`

These no longer feel like pure ops consoles. They are closer to sellable SaaS.

### 2. Navigation hierarchy is more sensible
- Core settings and owner shell have been simplified.
- Support/internal tools are less dominant than before.

### 3. Booking creation is no longer a dead-end wrapper
- The owner booking entry now has real context and launch guidance instead of just exposing the iframe.

### 4. Core management pages are materially better than before
- `Bookings` now opens as a bookings workspace instead of only a dispatch table.
- `Clients` now has relationship-management framing instead of only directory utility energy.
- `Money` is now presented to the owner as `Billing`, which is a much better commercial product surface.

### 5. Support-heavy pages are moving in the right direction
- `Automations` now frames itself around business outcomes and customer communication reliability.
- `Import` now does a better job of reassuring owners that migration is guided, reviewable, and safe before changes are written.
- `Waitlist` now reads more like live demand management and less like overflow inventory.
- Deeper billing tabs now better explain collections and finance follow-through.
- `Numbers` is more clearly framed as a support tool instead of a normal owner destination.

## Findings

### Medium: owner management pages are improved, but still not elite end to end
Evidence:
- `src/app/bookings/page.enterprise.tsx`
- `src/app/clients/page.enterprise.tsx`
- `src/app/money/page.tsx`

Issue:
- These pages are much better framed than before, but the underlying workflows are still table-heavy.
- The first impression is more premium now, yet the deeper interaction model still leans admin-operational instead of fully refined SaaS.
- This means the owner portal is stronger, but still not at the level of best-in-class product software.

Impact:
- A new paying operator is more likely to feel like they bought an internal management system than a refined software product.

### Medium: automations page is improved, but deeper workflow design still leans operator-heavy
Evidence:
- `src/app/automations/page.tsx`

Issue:
- The top layer is much better than before and is now framed around outcomes.
- But the deeper interaction model is still management-first, with limited workflow coaching around what should be enabled for a launch-ready business.

Impact:
- Makes the product feel more operator-heavy than elite-SaaS-friendly.

### Medium: import page is improved, but still not fully premium
Evidence:
- `src/app/import/page.tsx`

Issue:
- The migration flow is more reassuring than before.
- But the experience still relies on a fairly utilitarian preview/import interaction and could go further on data-quality coaching, rollback confidence, and post-import success guidance.

Impact:
- Migration is a trust-heavy moment; current UX is acceptable, not elite.

### Low: numbers page is intentionally support-heavy, but still not elegant enough for true elite polish
Evidence:
- `src/app/numbers/page.tsx`

Issue:
- The page now correctly signals that it is a support tool.
- That is the right product decision.
- But the underlying interaction model still contains a lot of raw operational UX and alert-based handling that keeps it below elite quality.

Impact:
- If exposed too prominently, it lowers the overall commercial polish of the owner experience.

### Low: redirect pages are not the problem, but they indicate unresolved IA
Evidence:
- `src/app/analytics/page.tsx`
- `src/app/command-center/page.tsx`

Issue:
- Redirects are acceptable, but they show that the information architecture is still in transition.
- The experience is not yet fully cohesive or fully consolidated.

Impact:
- Minor, but worth resolving before a final launch-quality declaration.

## Owner Portal Score

Current owner portal score: `7.7/10`

Breakdown:
- Core dashboard/setup/settings/product spine: `7.8/10`
- Core management surfaces: `7.4/10`
- Deep support/ops/enterprise surfaces: `6.4/10`

## What Still Needs To Happen For Elite Owner Portal Status

### Priority 1
- Continue refining `Bookings` beyond top-layer framing into a more premium interaction model
- Continue refining `Clients` beyond directory utility into a stronger relationship workflow
- Keep pushing `Billing` tab content toward a cleaner, more cohesive finance product experience

### Priority 2
- Continue refining `Automations` into a more guided business-outcomes workflow
- Continue upgrading `Import` into a fuller trust-first migration experience
- Improve `Waitlist` follow-through and conversion workflow depth
- Clean up alert-heavy specialist flows like `Numbers`

### Priority 3
- Push clearly internal pages farther behind support/internal framing
- Resolve remaining IA inconsistencies and redirects
- Do a deeper pass on unreviewed owner pages: finance, payroll, bundles, templates, reports, growth, schedule-grid, assignments, exceptions, waitlist, admin

## Bottom Line

The owner portal is not yet elite SaaS.

It is now significantly better and much closer.
The biggest owner-facing commercial surfaces have moved in the right direction.
But it still needs a serious pass on deeper workflows and support-heavy pages before I would call it truly premium, cohesive, and launch-signoff ready.
