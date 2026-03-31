# Snapshot Update Policy

Visual regression snapshots are used to catch unintended UI changes. This document describes when and how to update them.

## When to Update Snapshots

Update snapshots when you have **intentionally** changed the UI:

- Design system updates (colors, spacing, typography)
- New features that add or modify visible elements
- Layout or component refactors
- Copy or label changes

**Do not** update snapshots to "fix" a failing test without understanding why it failed. Investigate first.

## How to Update Snapshots

### Owner Portal

```bash
pnpm exec playwright test tests/e2e/owner-snapshots.spec.ts --project=owner-desktop --update-snapshots
```

### Sitter Portal

```bash
pnpm exec playwright test tests/e2e/sitter-snapshots.spec.ts --project=sitter-desktop --update-snapshots
```

### Client Portal

```bash
pnpm exec playwright test tests/e2e/client-snapshots.spec.ts --project=client-mobile --update-snapshots
```

### All Snapshots

```bash
pnpm exec playwright test tests/e2e/owner-snapshots.spec.ts tests/e2e/sitter-snapshots.spec.ts tests/e2e/client-snapshots.spec.ts --update-snapshots
```

## CI Behavior

- **CI does NOT use `--update-snapshots`**. Snapshots are compared against committed baselines.
- If a snapshot diff exceeds `maxDiffPixels`, the test fails.
- Commit updated snapshot files (`tests/e2e/*-snapshots.spec.ts-snapshots/`) when you intentionally change the UI.

## Reducing Flakiness

- Tests use frozen time (`FROZEN_DATE`) and mocked API responses where applicable.
- Use `maxDiffPixels` to tolerate minor rendering differences (fonts, subpixel).
- Avoid tests that depend on dynamic content (e.g., "Starts in 5 min") without freezing time.
