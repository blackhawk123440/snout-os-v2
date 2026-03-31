# UI Constitution

Wave 1: Structural Elite UI Enforcement. This document is the UI law for Snout OS.

## Design Principles

- **Enterprise-grade**: HubSpot/Datadog/Salesforce vibe. Data-dense, consistent, restrained.
- **No cute visuals**: No bright colors, playful animations, or decorative gradients.
- **Token-driven**: All spacing, colors, typography, and motion use CSS variables and Tailwind tokens.

---

## Spacing Scale

Use the spacing scale from `--spacing-0` through `--spacing-12` (or Tailwind equivalents: `p-0`, `p-1`, … `p-12`).

| Token | Value | Use |
|-------|-------|-----|
| spacing-0 | 0 | No gap |
| spacing-1 | 0.25rem (4px) | Tight inline gaps |
| spacing-2 | 0.5rem (8px) | Icon-text, small gaps |
| spacing-3 | 0.75rem (12px) | List item padding |
| spacing-4 | 1rem (16px) | Card padding, section gaps |
| spacing-5 | 1.25rem (20px) | Medium section gaps |
| spacing-6 | 1.5rem (24px) | Page header margin, large gaps |
| spacing-8 | 2rem (32px) | Major section separation |
| spacing-10 | 2.5rem (40px) | Page gutters (lg) |
| spacing-12 | 3rem (48px) | Maximum section separation |

---

## Typography Scale

- **Body**: `text-[var(--color-text-primary)]`, `text-sm` or `text-base`
- **Headings**: `font-semibold`, `tracking-tight`
  - H1: `text-xl sm:text-2xl`
  - H2: `text-base`
  - H3: `text-sm`
- **Links**: `text-[var(--color-accent-primary)]`, `hover:underline`
- **Disabled**: `text-[var(--color-text-tertiary)]`, `opacity-60`

---

## Semantic Colors

| Role | Variable | Use |
|------|----------|-----|
| Surface primary | `--color-surface-primary` | Main content background |
| Surface secondary | `--color-surface-secondary` | Cards, elevated panels |
| Surface tertiary | `--color-surface-tertiary` | Hover states |
| Text primary | `--color-text-primary` | Body, headings |
| Text secondary | `--color-text-secondary` | Labels, metadata |
| Text tertiary | `--color-text-tertiary` | Placeholders, disabled |
| Border default | `--color-border-default` | Dividers, card borders |
| Border muted | `--color-border-muted` | Subtle borders |
| Accent primary | `--color-accent-primary` | CTAs, links, focus ring |

---

## Layout Rules

1. **LayoutWrapper**: Wrap all page content. Variants: `default` (max-w-5xl), `wide` (max-w-7xl), `narrow` (max-w-3xl).
2. **PageHeader**: Every major page has a PageHeader with `title`, optional `subtitle`, optional `actions`, optional `breadcrumbs`.
3. **Section**: Use Section for logical blocks with optional `title`, `description`, `right` (actions).
4. **Gutters**: `px-4 sm:px-6 lg:px-8` for horizontal rhythm.
5. **Vertical rhythm**: `space-y-6` between major sections.

---

## Empty State Rules

- Use `EmptyState` component. Props: `title`, `description?`, `primaryAction?`, `secondaryAction?`, `icon?`.
- Copy must be enterprise tone: short, direct, actionable. No playful language.
- Icon optional; if used, use simple Lucide monochrome.

---

## Loading State Rules

- Use `TableSkeleton`, `CardSkeleton`, or `PageSkeleton` from `loading-state.tsx`.
- No ad-hoc spinners. Replace with skeletons on: owner dashboard, sitter today, client home/reports, messages thread, bookings list.
- Skeleton animation: minimal or none. Respect `prefers-reduced-motion`.

---

## Toast Copy Rules

- Use `toastSuccess`, `toastError`, `toastInfo` from `@/lib/toast`.
- Copy: short, direct, actionable. Examples:
  - "Message sent"
  - "Check-in recorded"
  - "Export started"
  - "Connection failed. Retry?"

---

## Status Chips

- Use `StatusChip` with variants: `neutral`, `success`, `warning`, `danger`, `info`.
- `AppStatusPill` delegates to `StatusChip`. Use `getStatusPill(status)` for label/variant mapping.
- Subtle background + border + text. Not loud.

---

## Accessibility Baseline

- Focus outlines visible and consistent (`focus-visible:ring-2`).
- Modals trap focus (shadcn handles; verify).
- Icon-only buttons have `aria-label`.
- Status chips have readable contrast (WCAG AA).

---

## Micro-interactions

- Framer Motion: only for subtle opacity fades or button press (max 2px translate).
- No bounce. No springy cartoon effects.
- Respect `prefers-reduced-motion`.
