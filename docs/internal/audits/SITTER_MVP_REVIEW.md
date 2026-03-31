# Sitter MVP – Review Package

## 1) Smoke Test Checklist

### A) Login + Routing
- **Hit /login → sign in as sitter** → Redirects to `/sitter/today` (login page `getRedirectForRole`)
- **Visit /calendar or owner routes as sitter** → Redirects to `/sitter/today` (middleware `isSitterRestrictedRoute` + redirect for page routes)
- **Fail modes addressed:**
  - No infinite loop: `/sitter/*` is allowed, `/login` is public, owner routes redirect to `/sitter/today`
  - Sitter lands on `/sitter/today` after login (role-based redirect)

### B) Today Page
- Loads without crashing when no bookings (empty state)
- "Try again" when API fails (`loadError` state + Button)
- **View details** → `/sitter/bookings/[id]`
- **Open chat** → `/sitter/inbox?thread=...` (or `/sitter/inbox` if no thread)

### C) Daily Delight Modal
- Click ✨ → modal opens
- 404/403/500 → friendly fallback text + toast, UI stable (`buildStubDelight` + `isStubDraft`)

### D) Check-in/out
- Check in → status `in_progress`, persists on refresh (DB update)
- Check out → status `completed`, persists
- Status guards: can't check-in completed; can't check-out before check-in

---

## 2) Backend Invariants

### A) Tenant Safety
- All sitter APIs use `whereOrg(ctx.orgId, { ... })` – booking/sitter must belong to org
- Fake/other-org booking ID → `findFirst` returns null → **404**

### B) Role Safety
- Sitter endpoints: `requireRole(ctx, 'sitter')` → owner gets **403**
- Owner endpoints: sitter hits restricted route → **redirect** (pages) or **403** (API)

### C) Status Transitions
- Check-in: only `pending` or `confirmed` → 400 otherwise
- Check-out: only `in_progress` → 400 otherwise

---

## 3) Premium UI Wins

1. **Sticky "Today" header** with date + "You have X visits"
2. **Pet avatars** (initials) + pet names on booking cards
3. **Address snippet** (truncated with title tooltip)
4. **Status pill** with clear colors (pending=amber, confirmed=blue, in_progress=purple, completed=green)
5. **Daily Delight Tone dropdown** (Warm / Playful / Professional) – passed to API
6. **Empty state**: "No visits today. Enjoy the quiet—check Calendar for upcoming."

---

## 4) Sitter Availability (MVP)

- **Toggle** on Profile: "Available for new bookings" (uses `Sitter.availabilityEnabled`)
- **Block-off days** list: add date, remove. Uses `SitterTimeOff` with `type: 'block'`, `approvedByUserId: ctx.userId`
- **Migration**: `prisma/migrations/20260227000000_add_sitter_availability_enabled/migration.sql`

---

## 5) File Contents for Review

### src/app/sitter/layout.tsx

```tsx
import type { Metadata } from "next";
import { SitterAppShell } from "@/components/layout/SitterAppShell";

export const metadata: Metadata = {
  title: "Sitter Dashboard - Snout OS",
  description: "Mobile-friendly dashboard for pet care sitters",
};

export default function SitterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SitterAppShell>{children}</SitterAppShell>;
}
```

### src/app/api/sitter/today/route.ts

(Full file – key change: `toIso` for date serialization, `whereOrg` + `requireAnyRole`)

### src/app/api/bookings/[id]/check-in/route.ts

(Full file – `requireRole('sitter')`, `whereOrg` + `sitterId`, status guard `pending`|`confirmed`)

### src/app/api/bookings/[id]/check-out/route.ts

(Full file – `requireRole('sitter')`, status guard `in_progress` only)

---

## Migration Required

Run before using availability features:

```bash
npx prisma migrate deploy
# or for dev:
npx prisma migrate dev
```

Migration adds `availabilityEnabled` to `Sitter` table.
