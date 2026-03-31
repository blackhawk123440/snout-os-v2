# Role Route Boundary Audit

**Hard product boundary:** Clients and sitters must never be routed into owner dashboard flows.

**Owner-only (forbidden for client/sitter):** `/dashboard`, `/command-center`, `/bookings` (owner), `/calendar` (owner), `/clients`, `/sitters`, `/payments`, `/finance`, `/ops/*`, and any owner-only management page.

---

## A) Client routes audit

| Route / surface | Current link/action | Incorrect destination? | Correct destination |
|-----------------|---------------------|------------------------|----------------------|
| `/client/home` | "Book a visit" link | `href="/bookings/new"` | `/client/bookings/new` |
| `/client/home` | "Book a visit" empty state CTA | `router.push('/bookings/new')` | `/client/bookings/new` |
| `/client/bookings` | Empty state "Book a visit" | `router.push('/bookings/new')` | `/client/bookings/new` |
| `/client/bookings/[id]` | — | None | — |
| `/client/messages` | Thread open | `router.push(\`/client/messages/${t.id}\`)` | OK (client-owned) |
| `/client/billing` | "View bookings" | `window.location.assign('/client/bookings')` | OK (client-owned) |
| `/client/reports` | "View bookings" | `router.push('/client/bookings')` | OK (client-owned) |

**Client findings:**
- **3 violations:** Client "Book a visit" / CTA sent users to owner `/bookings/new` (owner booking form and shell). Correct behavior: client-owned booking form at `/client/bookings/new` only.
- **Middleware:** Previously allowed client on `/bookings/new` via `pathname !== '/bookings/new'` and `isClientRoute('/bookings/new')`; both removed so client is redirected to client booking flow only.

---

## B) Sitter routes audit

| Route / surface | Current link/action | Incorrect destination? | Correct destination |
|-----------------|---------------------|------------------------|----------------------|
| `/sitter/today` | Booking card / actions | `router.push(\`/sitter/bookings/${id}\`)`, `/sitter/calendar`, `/sitter/bookings` | OK (sitter-owned) |
| `/sitter/calendar` | Event click | `router.push(\`/sitter/bookings/${id}\`)`, `/sitter/inbox` | OK (sitter-owned) |
| `/sitter/bookings` | Row click, "Today" CTA | `router.push(\`/sitter/bookings/${b.id}\`)`, `/sitter/today` | OK (sitter-owned) |
| `/sitter/bookings/[id]` | Back, reports, inbox, pets | `/sitter/bookings`, `/sitter/reports/*`, `/sitter/inbox`, `/sitter/pets/*` | OK (sitter-owned) |
| `/sitter/inbox` | When `!isSitter` | `router.push('/messages')` (owner messaging) | Role-based: owner → `/messaging`, client → `/client/home`, else `/login` |
| `/sitter/dashboard` | When `!isSitter` | `router.push('/messages')` (owner messaging) | Same as above |
| `/sitter/reports` | New report link | `/sitter/reports/new` | OK (sitter-owned) |
| `/sitter/earnings` | — | — | OK |
| `/sitter/profile` | Nav items | `item.href` (sitter routes) | OK |
| `/sitter/jobs` | Card, "Open Calendar" | `/sitter/bookings/${id}`, `/sitter/calendar` | OK (sitter-owned) |
| `/sitter-dashboard` (legacy) | Redirect | `/sitter/today` | OK (sitter-owned) |

**Sitter findings:**
- **2 violations:** Sitter inbox and sitter dashboard redirect non-sitter users to `/messages` (owner messaging hub). Correct behavior: role-based redirect (owner → `/messaging`, client → `/client/home`, else `/login`).
- All other sitter links already stay within sitter route space (`/sitter/*`). No sitter page linked to owner `/calendar` or owner `/bookings`.

---

## C) Owner-only route list (reference)

Routes that must never be reached by client or sitter (middleware + hardening):

- `/`, `` (root)
- `/dashboard`
- `/command-center`
- `/bookings`, `/bookings/new`, `/bookings/[id]` (owner)
- `/calendar`
- `/clients`, `/clients/[id]`
- `/sitters`, `/sitters/[id]`
- `/messaging`, `/messaging/*`
- `/messages` (owner messaging tab page)
- `/payments`, `/finance`
- `/reports` (owner), `/growth`, `/payroll`
- `/integrations`, `/settings`, `/automations`, `/automations/[id]`
- `/ops/*`
- `/numbers`, `/assignments`, `/twilio-setup`

---

## Fixes applied

1. **Client**
   - All "Book a visit" and related CTAs now point to `/client/bookings/new`.
   - New page: `/client/bookings/new` (client layout, same form submission to `/api/form`, redirect to `/client/bookings` or `/client/bookings/[id]`).
   - `client-routes.ts`: Removed `/bookings/new` from allowed client routes so client cannot use owner booking form.
   - Middleware: Client requesting `/bookings` or `/bookings/new` is redirected to `/client/bookings/new` or `/client/bookings`.

2. **Sitter**
   - Sitter inbox and sitter dashboard: when user is not a sitter, redirect by role (owner → `/messaging`, client → `/client/home`, else `/login`) instead of always `/messages`.

3. **Hardening**
   - Middleware: Client never allowed on `/bookings` or `/bookings/new`; redirect to `/client/bookings/new` or `/client/bookings`.
   - Sitter restrictions already include `/bookings` (non-sitter) via `isSitterRestrictedRoute`; sitters stay on `/sitter/*` only.

---

## Verification

- No client page links to owner `/bookings`, `/dashboard`, `/calendar`, or other owner-only pages.
- No sitter page links to owner `/calendar`, `/bookings`, or `/messages`; non-sitter redirect from sitter pages is role-based.
- `pnpm lint --fix` and `pnpm build` pass after fixes.
