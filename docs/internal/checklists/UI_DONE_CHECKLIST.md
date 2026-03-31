# UI Done Checklist

System-wide checklist for UI consistency and polish. Use for QA and handoff.

## Shells

- [x] Single canonical shell (AppShell only; OwnerShell removed)
- [ ] Shell is role-aware via nav config (owner vs sitter)
- [ ] Global search bar in topbar (stubbed)
- [ ] Command palette (Cmd+K) wired and stubbed
- [ ] Theme toggle (dark/light) in topbar
- [ ] Density selector (Compact/Comfortable/Spacious) in topbar

## Tables

- [ ] AppTable used consistently across list pages
- [ ] Column picker on AppTable (visibility toggle)
- [ ] Bulk actions row (Assign / Message / Export) in table header
- [ ] data-density affects row height and padding
- [ ] Dark mode: table borders, pills, hover states

## Drawers

- [ ] AppDrawer used for detail views
- [ ] Framer Motion open/close transitions
- [ ] data-density affects drawer padding
- [ ] Dark mode: drawer background, borders

## States

- [ ] Loading: AppSkeletonList or table loading state
- [ ] Empty: AppEmptyState with illustration
- [ ] Error: AppErrorState with retry
- [ ] Dark mode: empty/error illustrations don't invert badly

## Charts

- [ ] AppChartCard used everywhere (no ad hoc chart wrappers)
- [ ] AppChartCard: title, subtitle, timeframe selector
- [ ] Placeholder skeleton, empty, error states
- [ ] Dark mode: chart placeholder backgrounds

## Filter Bar

- [ ] AppFilterBar on list pages
- [ ] Saved Views dropdown (All / Today / This week / My sitters etc.)
- [ ] data-density affects filter bar padding
- [ ] Dark mode: filter inputs, borders

## Dark / Light Mode

- [ ] Pills (AppStatusPill) readable in both modes
- [ ] Empty state illustrations don't invert badly
- [ ] Chart placeholders have appropriate contrast
- [ ] All surfaces use CSS variables (no hardcoded colors)

## Density

- [ ] data-density="compact" | "comfortable" | "spacious" on html
- [ ] AppTable row height responds to density
- [ ] AppCard padding responds to density
- [ ] AppFilterBar padding responds to density
- [ ] AppDrawer padding responds to density

## Keyboard Nav

- [ ] Cmd+K opens command palette
- [ ] Escape closes palette, drawer, modal
- [ ] Tab order logical in forms

## Snapshots

- [ ] owner-snapshots.spec.ts green
- [ ] Date frozen via addInitScript (no "Starts in 5 min" flake)
- [ ] Network mocked for owner pages (stable counts/rows)
- [ ] Timezone + locale fixed (UTC, en-US)

## Owner Routes (all equally finished)

- [ ] /command-center
- [ ] /bookings
- [ ] /calendar
- [ ] /dispatch
- [ ] /clients
- [ ] /sitters (bookings/sitters)
- [ ] /messages
- [ ] /automations (automation)
- [ ] /finance
- [ ] /analytics
- [ ] /integrations
- [ ] /settings
