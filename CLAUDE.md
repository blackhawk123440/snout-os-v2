# CLAUDE.md — Snout OS Master Context
# Read this file completely before writing a single line of code.
# This is the canonical truth for every agent, every session, every decision.

---

## WHAT IS SNOUT OS

Snout OS is a multi-tenant SaaS platform for ALL types of pet care businesses —
in-home sitting, dog walking, boarding, grooming, daycare, training, and any
combination. It competes directly with Time To Pet, Gingr, and PetExec and is
designed to surpass all of them.

It is built and operated by Carson, who also co-owns Snout — an actual pet care
business that uses this platform. Leah (co-owner of Snout) and active sitters
are the first beta users.

The mission: become the infrastructure layer that ANY pet care business cannot
operate without. Stripe for pet care. Every booking, client relationship,
sitter payout, and communication flowing through Snout OS.

**Target businesses:**
- Independent in-home sitters and dog walkers (1099 model)
- Small pet care companies with employed/contracted staff
- Boarding facilities
- Grooming shops
- Daycare operations
- Any combination of the above (multi-service businesses)

---

## DEPLOYMENT

- **Platform:** Render (web service + worker service + PostgreSQL + Redis)
- **URL pattern:** Production at configured NEXTAUTH_URL
- **Worker:** Separate Render service running `src/worker/index.ts`
- **Database:** PostgreSQL via Render managed DB
- **Cache/Queue:** Redis via REDIS_URL
- **File storage:** AWS S3 (S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)
- **Error tracking:** Sentry (@sentry/nextjs)
- **Email:** Resend (RESEND_API_KEY)

---

## TECH STACK

```
Framework:     Next.js 15 (App Router)
Language:      TypeScript 5
Database ORM:  Prisma 5 → PostgreSQL
Auth:          NextAuth v5 beta (@auth/prisma-adapter)
Queue:         BullMQ 4 + IORedis 5
Payments:      Stripe 14 + Stripe Connect (sitter payouts)
Messaging:     Twilio 5 / OpenPhone (pluggable provider)
Calendar:      Google Calendar API (googleapis 128)
AI:            OpenAI (via @langchain/openai + governed-call wrapper)
Push:          Web Push (web-push + VAPID)
Storage:       AWS S3 (@aws-sdk/client-s3)
UI:            React 18 + Tailwind CSS 3 + Framer Motion 12
Icons:         Lucide React (ONLY — no Font Awesome, no inline SVG)
Data Fetching: TanStack Query v5
Testing:       Vitest 4 (unit) + Playwright 1.51 (E2E) + visual regression
PWA:           Serwist (@serwist/next)
Monitoring:    Sentry (server + edge + client)
```

---

## OPERATING MODES

### Personal Mode (`NEXT_PUBLIC_PERSONAL_MODE=true`)
Single-org deployment. All requests locked to `PERSONAL_ORG_ID`.
Used for Snout (Carson's own business). Currently active deployment mode.
`getPublicOrgContext()` is available for public booking form.

### SaaS Mode (`NEXT_PUBLIC_PERSONAL_MODE=false`)
Multi-tenant. OrgId comes from authenticated session.
`getPublicOrgContext()` throws — public booking requires org binding config.

---

## CANONICAL AUTH PATTERN

**Every protected API route must start with this exact pattern:**

```typescript
import { getRequestContext } from "@/lib/request-context"

export async function GET(request: Request) {
  try {
    const { orgId, role, userId, sitterId, clientId } = await getRequestContext()
    // orgId is ALWAYS the tenant scope — every DB query must include it
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
```

**RequestContext shape:**
```typescript
interface RequestContext {
  orgId: string           // Tenant ID — MANDATORY in every DB query
  role: "owner" | "admin" | "sitter" | "client" | "public"
  userId: string | null   // User ID from session
  sitterId: string | null // Set when role=sitter
  clientId: string | null // Set when role=client
  correlationId?: string  // Request tracing ID
}
```

**Role enforcement patterns:**
```typescript
// Owner-only route
if (role !== "owner" && role !== "admin") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// Sitter-only route
if (role !== "sitter") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// IDOR protection — ALWAYS scope by orgId, NEVER trust ID params alone
const booking = await prisma.booking.findUnique({
  where: { id: params.id, orgId } // orgId scope is mandatory
})
if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 })
// Return 404 not 403 — never confirm resource existence to unauthorized users
```

---

## CANONICAL MESSAGE SEND

**Never send a message any other way. Always use this:**

```typescript
import { sendThreadMessage } from "@/lib/messaging/send"

await sendThreadMessage({
  orgId,
  threadId,
  actor: { role: "owner", userId },
  body: "Your message here",
  idempotencyKey: `booking-confirmation-${bookingId}`, // optional, prevents duplicate sends
})
```

**Three-channel notification fallback (for automation triggers):**
```typescript
import { canSendSms } from "@/lib/messaging/availability"

async function notifyClient(clientId: string, orgId: string, body: string, emailFallback: () => Promise<void>) {
  const canSms = await canSendSms(orgId)
  if (canSms) {
    // Find or create thread, then send
    const thread = await findOrCreateClientThread(orgId, clientId)
    await sendThreadMessage({ orgId, threadId: thread.id, actor: { role: "system" }, body })
    return
  }
  await emailFallback()
}
```

**Canonical webhook:** `POST /api/messages/webhook/twilio`
**Schema:** `MessageThread` / `MessageEvent` / `MessageNumber` / `MessageParticipant`
**Messaging provider layer:** `src/lib/messaging/provider-factory.ts` → pluggable (`TwilioProvider` | `OpenPhoneProvider`)
**Integration config:** `OrgIntegrationConfig` model → `GET/PATCH /api/settings/integration-stack`

---

## SITTER AVAILABILITY UI — ROVER-STYLE

### The Standard
Sitter availability setup must feel like Rover's availability calendar — visual,
intuitive, and completable in under 2 minutes by someone who has never used the
platform before. No forms with dropdowns. No "add a rule" buttons that open modals.
A visual weekly grid where you tap to toggle availability.

### How It Works (required UX)
**Weekly grid view:**
- 7 columns (days of week) × time blocks (morning / afternoon / evening / overnight)
- Tap a block to toggle available / unavailable
- Visual fill shows what's open at a glance
- No save button required per block — autosaves on tap

**Overrides (specific dates):**
- Calendar view showing the weekly pattern applied forward
- Tap any date to override that day specifically
- Override shows as a different color than the base rule
- "Clear override" to revert to weekly default

**During onboarding:**
- Step in the sitter onboard flow: "When are you available?"
- Same visual grid, presented as part of the onboard sequence
- Can be skipped and set later from sitter portal
- Completion shown in onboarding checklist

**In the sitter portal (/sitter/availability):**
- Same grid, always editable
- Changes take effect immediately
- Owner sees sitter's availability reflected in dispatch/suggest logic

### Implementation Reference
- Rules model: `SitterAvailabilityRule` (daysOfWeek, startTime, endTime, timezone)
- Overrides model: `SitterAvailabilityOverride` (date, startTime, endTime, isAvailable)
- API: `GET/POST /api/sitter/availability-rules`, `POST /api/sitter/availability-overrides`
- Bulk replace: `POST /api/sitter/availability/bulk` — replaces all rules at once (use this for grid saves)
- Engine: `src/lib/availability/engine.ts`

### What Currently Exists vs What's Needed
Currently: rules and overrides API is complete, engine is complete.
Gap: the UI is likely a form-based implementation. It needs to be replaced with
the visual grid described above. This is an Agent 21 (Sitter Portal Designer) job.

---

## ZERO DEAD ENDS — THE NON-NEGOTIABLE UI RULE

**Every button that should exist must exist. Every action a user needs to take
must be takeable from the screen they're on. No hunting. No missing buttons.**

### The Rule
If a user (owner, sitter, or client) needs to do something and cannot find the
button or the button doesn't work, that is a P0 bug. Not a P2 cosmetic issue.
A P0. It blocks the user from running their business.

### Known Pattern of Failure
During development, buttons were wired to non-existent handlers, linked to
unbuilt pages, or simply missing from the UI while the API existed. Examples:
- Confirm booking button existed but didn't call the confirm API
- Sitter "start visit" button present but check-in API not wired
- Client cancel booking shown but POST /api/client/bookings/[id]/cancel not called
- Payment link button present with no Stripe session creation behind it

### The Audit Every Agent Must Do
Before finishing any portal screen, every agent must verify:

**Owner portal — every booking must have:**
- [ ] Confirm button (when status=pending) → PATCH /api/bookings/[id] status=confirmed
- [ ] Cancel button → POST /api/bookings/[id]/cancel
- [ ] Mark paid button → POST /api/ops/bookings/[id]/mark-paid
- [ ] Assign sitter control → PATCH /api/bookings/[id] sitterId
- [ ] View client → links to /clients/[id]
- [ ] Message client → links to or opens thread

**Sitter portal — every visit must have:**
- [ ] Start visit button (when status=confirmed, time is now) → POST /api/bookings/[id]/check-in
- [ ] End visit button (when checked in) → POST /api/bookings/[id]/check-out
- [ ] File report button → POST /api/sitter/bookings/[id]/report
- [ ] View pet info → renders full pet profile inline or in drawer
- [ ] Navigate to address → opens Maps with client address

**Client portal — every booking must have:**
- [ ] View detail → links to /client/bookings/[id]
- [ ] Cancel (if cancellable) → POST /api/client/bookings/[id]/cancel
- [ ] Message business → links to /client/messages or opens thread
- [ ] View report (when available) → links to /client/reports/[id]

### The Rule for Agents
Agent 16 (Flow Tracer) traces all 8 flows end to end specifically looking for
this pattern: a step in the flow where the user needs to take an action but the
UI does not present a way to do it. Every gap found is a P0 in AUDIT.md.

Agents 20, 21, 22 (portal designers) must run this checklist on every screen
before marking it complete. If a button is present but not wired, wire it.
If a button is missing, add it. No screen ships with a dead end.

---

## SMART ZONING AND DISPATCH

### What This Is
When a new booking comes in, Snout OS should automatically surface the best
sitter — not just any available sitter. "Best" means closest to the client
AND highest SRS score for that service type.

### The Smart Assign Algorithm
Priority order for sitter suggestions:
1. **Geographic proximity** — sitters closest to client address
2. **SRS score** — among nearby sitters, highest performers rank first
3. **Tier eligibility** — sitter tier must permit the service type
4. **Availability** — no conflicts in their schedule
5. **Specialty match** — if service requires overnight/high-value/same-day capability

### Service Area / Zone System
- `OrgServiceArea` model — owner defines coverage zones (zip codes, radius, polygon)
- `src/lib/zones/point-in-polygon.ts` — polygon containment check
- `GET /api/zones/detect` — detect which zone a client address falls in
- Sitters can be assigned to zones (future: currently implicit by proximity)

### Smart Assign Routes
- `GET /api/ops/bookings/[id]/sitter-suggestions` — ranked sitter list for a booking
- `GET /api/ops/bookings/[id]/smart-assign` — auto-assign best available sitter
- `POST /api/ops/bookings/[id]/urgent-dispatch` — emergency assignment ignoring normal rules

### What Still Needs Building (vision items)
- Explicit sitter zone assignment (owner draws a zone, assigns sitters to it)
- Distance calculation using actual address geocoding (currently proximity is approximate)
- Map view of sitter locations relative to pending bookings
- Route optimization for sitters with multiple visits in a day (already has `RouteMap` component)
- Real-time sitter location during visits (GPS trail)

All API routes MUST return these shapes:

```typescript
// Success with data
return NextResponse.json({ data: result }, { status: 200 })

// Created
return NextResponse.json({ data: result }, { status: 201 })

// No content
return new NextResponse(null, { status: 204 })

// Validation error
return NextResponse.json({ error: "Specific message" }, { status: 400 })

// Unauthorized
return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

// Forbidden
return NextResponse.json({ error: "Forbidden" }, { status: 403 })

// Not found (also use for IDOR — never reveal resource existence)
return NextResponse.json({ error: "Not found" }, { status: 404 })

// Conflict
return NextResponse.json({ error: "Already exists" }, { status: 409 })

// Plan limit
return NextResponse.json({ error: "Plan limit reached", upgradeUrl: "/billing" }, { status: 402 })

// Server error
return NextResponse.json({ error: "Internal server error" }, { status: 500 })
```

---

## DATABASE PATTERNS

**Scoped DB (preferred for all routes):**
```typescript
import { getScopedDb } from "@/lib/tenancy"
const db = getScopedDb({ orgId })
// db is a Prisma client with orgId pre-scoped
```

**Raw Prisma (only when necessary):**
```typescript
import { prisma } from "@/lib/db"
// Always manually add orgId to every query
```

**Every multi-tenant model query MUST include orgId:**
```typescript
// CORRECT
const bookings = await db.booking.findMany({ where: { orgId, status: "confirmed" } })

// WRONG — never do this
const bookings = await db.booking.findMany({ where: { status: "confirmed" } })
```

**Transaction pattern for multi-table writes:**
```typescript
await prisma.$transaction([
  prisma.booking.update({ where: { id: bookingId, orgId }, data: { status: "confirmed" } }),
  prisma.bookingStatusHistory.create({ data: { bookingId, orgId, toStatus: "confirmed" } }),
])
```

**Known bug: `prisma.$transaction` proxy bug on sitter invite endpoint.**
Use array-based transactions, not callback-based, to avoid `_engineConfig` error.

---

## QUEUE SYSTEM

**Available queues and their purposes:**
```
automations          — All notification/automation triggers (BullMQ, 3 attempts, exponential backoff)
automations.high     — High-priority automations (bookingConfirmation, ownerNewBookingAlert)
messages.outbound    — SMS delivery to provider (Twilio/OpenPhone)
messages.thread-activity — Debounced thread lastMessageAt updates
calendar-sync        — Google Calendar upsert/delete/sync
pool-release         — Phone number pool rotation (runs every 5 min)
payouts              — Stripe Connect sitter payouts
finance.reconcile    — Stripe ledger reconciliation
reminder-scheduler   — Night-before reminder dispatcher (runs every 15 min)
daily-summary        — Daily summary (runs 9 PM)
reconciliation       — Pricing drift detection (runs 2 AM)
```

**Enqueue an automation:**
```typescript
import { enqueueAutomation } from "@/lib/automation-queue"

await enqueueAutomation(
  "bookingConfirmation",    // automationType
  "client",                 // recipient
  { orgId, bookingId },     // context
  `booking-confirmation-${bookingId}` // idempotencyKey (prevents duplicates)
)
```

**High-priority automation types** (go to automations.high queue):
`bookingConfirmation`, `ownerNewBookingAlert`
Configurable via `AUTOMATION_HIGH_PRIORITY_TYPES` env var.

**All jobs must be idempotent.** Running a job twice must be a safe no-op.
Use `idempotencyKey` as `jobId` in BullMQ to deduplicate.

---

## NOTIFICATION TRIGGERS

**Nine trigger events in `src/lib/notifications/triggers.ts`:**
1. New booking created → owner personal phone (SMS)
2. Booking confirmed → client (SMS → email fallback)
3. Booking cancelled → client
4. Visit reminder 24h → client + sitter
5. Visit started (sitter tapped Start) → owner
6. Visit completed → owner + client
7. Payment received → client receipt
8. New message received → recipient push notification
9. Sitter invite → sitter email

**CRITICAL BUG THAT WAS FIXED:**
`syncConversationLifecycleWithBookingWorkflow` was running before client creation,
causing `clientId` to be null and all booking confirmation messages to drop silently.
Fix: ensure `clientId` is set on booking BEFORE any notification trigger fires.

**Owner personal phone notifications:**
Uses `notifyOwnerPersonalPhone()` cross-cutting utility.
Owner's personal number is `OWNER_PERSONAL_PHONE` (not the Twilio business number).

**Booking confirmation links:**
Client SMS confirmation links are DISABLED until client portal is fully ready.

---

## MESSAGING PROVIDER SYSTEM — INDEPENDENT CONNECTIONS (NOT A PROGRESSION)

**This is NOT a tier progression. These are independent connection states.**

The platform works out of the box with zero external providers. Connecting a
provider adds capability. The owner dashboard adapts to show only what is
connected. Unconnected provider UI is completely hidden.

### No Provider Connected (default state)
- Platform works fully using owner and sitter personal phone numbers
- In-app messaging between owner, sitters, and clients
- Email notifications
- Owner's personal phone (`OWNER_PERSONAL_PHONE`) receives new booking alerts
- Sitters use their personal phones as contact info for clients
- Zero dependency on Twilio or OpenPhone
- This is a fully functional state — not a degraded state

### OpenPhone Connected
- Dashboard gains: OpenPhone inbox, OpenPhone thread management
- Owner sends/receives via OpenPhone number
- OpenPhone webhook handling active
- Sitters still use personal numbers OR get masked numbers depending on config
- Twilio sections remain hidden (not connected)

### Twilio Connected
- Dashboard gains: full masked number pool management, number assignment UI,
  pool health, number purchasing, sitter masked numbers
- Anti-poaching detection active
- Full SRS messaging scoring active
- OpenPhone sections remain hidden (not connected)

### Both Connected (advanced)
- Both dashboards visible
- Routing rules determine which provider handles which message type

### Dashboard Adaptation Rule
The settings integration stack (`OrgIntegrationConfig.messagingProvider`) controls
what appears in the messaging dashboard. When a provider is not configured:
- Its setup panels are hidden
- Its monitoring panels are hidden
- Its number management panels are hidden
- The rest of the platform works normally

**Implementation reference:**
- Config model: `OrgIntegrationConfig.messagingProvider` — `"none" | "twilio" | "openphone"`
- Availability check: `src/lib/messaging/availability.ts` → `canSendSms(orgId)`
- Dashboard sections: conditional render based on `messagingProvider` value
- Settings UI: `src/app/settings/sections/IntegrationStackSection.tsx`

---

## SITTER SCORING SYSTEM

Snout OS has a sitter scoring system designed to surpass Rover's public rating
system — but built FOR the business owner, not for consumers.

### What This Is
Not a public star rating. A multi-dimensional performance intelligence system
that tells the owner exactly how reliable, responsive, and high-quality each
sitter is — so they can make smart dispatch decisions, identify who to invest in,
and who needs coaching.

### The SRS (Sitter Rating System)
Six scoring dimensions, each 0–100:
1. **Responsiveness** — How fast do they reply to messages and availability requests
2. **Acceptance** — How often do they accept bookings they're offered
3. **Timeliness** — Do they check in and check out on time
4. **Accuracy** — Do they complete checklists, file reports, follow instructions
5. **Engagement** — Visit report quality, photo uploads, client communication
6. **Conduct** — Incidents, complaints, policy violations

Rolling windows: 30-day (current performance) and 26-week (trend).
At-risk flag when score drops below threshold.
Tier assignment based on composite score.

### Four Tiers (Foundation → Reliant → Trusted → Preferred)
Each tier unlocks capabilities:
- `canJoinPools` — can be in a sitter pool for a booking
- `canAutoAssign` — system can assign them without owner approval
- `canOvernight` — eligible for overnight/extended care
- `canSameDay` — eligible for emergency same-day bookings
- `canHighValue` — eligible for high-value clients
- `canRecurring` — eligible to take recurring clients
- `canLeadPool` — can lead a sitter pool (Preferred only)
- `canOverrideDecline` — can override certain decline rules (Preferred only)

### Implementation
- Engine: `src/lib/tiers/srs-engine.ts`
- Snapshots: `SitterTierSnapshot` model
- Service events (coaching, corrective, probation): `SitterServiceEvent` model
- Metrics windows: `SitterMetricsWindow` model
- Owner view: SRS card per sitter in sitter detail page
- Sitter view: own score + what to improve to advance tier

### What Still Needs Building (vision items)
- Tier progression UI in sitter portal (currently stubbed)
- Visual tier badge system on sitter cards in owner portal
- SRS trend chart (score over time)
- Automated coaching alerts when a sitter goes at-risk
- Benchmark comparison (how does this sitter compare to org average)

---

## DESIGN SYSTEM (NON-NEGOTIABLE)

**Icons:** Lucide React ONLY. Import: `import { Calendar } from "lucide-react"`
No Font Awesome. No inline SVG unless absolutely unavoidable.

**Colors:** Design tokens only. Never hardcode hex values.
Reference `src/lib/design-tokens.ts` for the token map.
Tailwind classes must map to tokens — no raw `text-gray-900` etc.

**Dark mode:** Every component must render correctly in both light and dark modes.
UI Constitution: `docs/internal/architecture/UI_CONSTITUTION.md`

**Every data surface must have:**
1. Loading state — skeleton loaders matching loaded content layout
2. Error state — clear message + retry action, no raw error strings
3. Empty state — helpful message + primary CTA
4. Mobile layout — fully usable at 375px width

**Component library location:** `src/components/ui/`
Key components: `AppCard`, `AppTable`, `AppDrawer`, `AppFilterBar`, `AppStatCard`,
`AppEmptyState`, `AppErrorState`, `AppSkeletonList`, `AppPageHeader`

**Copy style:** `docs/internal/architecture/COPY_STYLE.md`

---

## PORTAL STRUCTURE

### Owner Portal (authenticated, role=owner/admin)
```
/dashboard           — KPI overview, attention items, quick actions
/bookings            — Booking list with filters, bulk actions
/bookings/[id]       — Booking detail, status timeline, messaging
/bookings/new        — Create booking form
/calendar            — Calendar view (month/week/agenda)
/clients             — Client directory + waitlist
/clients/[id]        — Client detail, pets, booking history, messaging
/sitters             — Sitter roster, tiers, rankings
/sitters/[id]        — Sitter detail, performance, earnings, calendar
/messaging           — Inbox, threads, number management
/command-center      — Attention queue, staffing, dispatch
/schedule-grid       — Daily board view
/money               — Revenue, payments, payroll, finance
/reports             — Analytics, KPIs, trends
/automations         — Automation rules, ledger, templates
/settings            — Business settings, integrations, notifications
/growth              — Tiers, bundles, discounts, loyalty
/integrations        — Integration stack management
/ops/                — Operations tools (diagnostics, failures, AI, etc.)
```

### Sitter Portal (authenticated, role=sitter)
```
/sitter              — Today's schedule
/sitter/dashboard    — Full dashboard
/sitter/today        — Today's visits with check-in/check-out
/sitter/bookings     — Upcoming schedule
/sitter/bookings/[id] — Visit detail, report, checklist
/sitter/reports      — Visit reports
/sitter/calendar     — Calendar view + Google Calendar sync
/sitter/inbox        — Message threads
/sitter/earnings     — Earnings summary + payout history
/sitter/availability — Availability rules + overrides
/sitter/profile      — Profile management
/sitter/performance  — SRS score + tier progression
/sitter/training     — Training modules
/sitter/onboard      — Sitter onboarding flow (invite → password → active)
```

### Client Portal (authenticated, role=client)
```
/client/home         — Home dashboard
/client/bookings     — Booking list
/client/bookings/new — Book a service
/client/bookings/[id] — Booking detail
/client/messages     — Message thread with business
/client/pets         — Pet profiles
/client/reports      — Visit reports
/client/profile      — Account settings
/client/recurring    — Recurring schedules
/client/billing      — Billing history, payment methods
/client/setup        — Client onboarding (welcome token flow)
```

### Public
```
/login               — Login page
/forgot-password     — Password reset
/(public)/privacy    — Privacy policy
/(public)/terms      — Terms of service
/tip/[amount]/[sitter] — Tipping flow (no auth required)
/booking-form        — Embedded booking form (iframe, no X-Frame-Options)
```

---

## KNOWN FIXED BUGS (do not reintroduce)

1. **Silent notification drop:** `clientId` was null when triggers fired. Fix: set `clientId` on
   booking before ANY notification trigger. Verified in `triggers.ts` all 9 functions.

2. **OpenPhone 404:** OpenPhone was sending Twilio E.164 numbers as the `from` field.
   Fix: always use `OPENPHONE_PHONE_NUMBER` env var as the `from` field.

3. **Prisma `$transaction` proxy bug:** Callback-based `$transaction` throws `_engineConfig` error
   on sitter invite endpoint. Use array-based transactions instead.

4. **Client-side layout shell auth redirect:** Was blocking the sitter onboard page.
   Fix: `/sitter/onboard` is in `isPublicRoute()` — it bypasses auth middleware.

5. **X-Frame-Options blocking booking form:** Global `DENY` header blocked the iframe.
   Fix: booking form route has custom headers overriding the global rule.

6. **Old completed bookings receiving confirmation messages:** Bookings marked as paid
   were incorrectly getting booking confirmation messages.
   Fix: check booking `status` before firing confirmation trigger — skip `completed` and `paid`.

7. **Duplicate bookingConfirmation template:** Old automation engine's `bookingConfirmation`
   template is identified as a duplicate. Disable in old automation engine, use new queue-based
   automation instead.

---

## KNOWN INCOMPLETE AREAS

These items are explicitly stubbed or coming soon:

1. **Square payment integration** — `return { configured: false, detail: 'Square integration coming soon' }`
   Location: `src/app/api/settings/integration-stack/route.ts:112`

2. **Dark mode toggle** — Stubbed in command palette
   Location: `src/commands/commands.tsx:474`

3. **Bulk actions in AppTable** — `/** Bulk actions (Assign / Message / Export) - stubbed */`
   Location: `src/components/app/AppTable.tsx:27`

4. **Release from Twilio in NumbersPanel** — TODO comment
   Location: `src/components/messaging/NumbersPanelContent.tsx:1045`

5. **Tier progression UI** — "coming soon" in PerformanceSnapshot
   Location: `src/components/sitter/PerformanceSnapshot.tsx:101`

6. **Automation fee/discount application**
   Location: `src/lib/automation-engine.ts:155-161`

7. **Weekly plan check in client classification**
   Location: `src/lib/messaging/client-classification.ts:77,115`

8. **Sitter offboarding reassign_to_sitter strategy**
   Location: `src/lib/messaging/sitter-offboarding.ts:170`

9. **SRS processing failure alerts**
   Location: `src/lib/tiers/message-srs-bridge.ts:85`

---

## FEATURE FLAGS

Feature flags live in two places:
1. `src/lib/feature-flags.ts` — runtime flags from `FeatureFlag` DB table
2. `src/lib/flags.ts` — env-var-based flags

Key flags:
```
ENABLE_AUTH_PROTECTION       — Auth middleware enforcement (default: true)
ENABLE_SITTER_AUTH           — Sitter role enforcement (default: true)
ENABLE_MESSAGING_V1          — New messaging system
NEXT_PUBLIC_ENABLE_MESSAGING_V1
ENABLE_PROACTIVE_THREAD_CREATION
ENABLE_RESONANCE_V1          — AI suggestions layer
NEXT_PUBLIC_ENABLE_RESONANCE_V1
ENABLE_GOOGLE_BIDIRECTIONAL_SYNC — Two-way Google Calendar
NEXT_PUBLIC_ENABLE_GOOGLE_BIDIRECTIONAL_SYNC
NEXT_PUBLIC_ENABLE_CALENDAR_V1
ENABLE_FORM_MAPPER_V1        — New booking form mapper
USE_PRICING_ENGINE_V1        — Pricing engine V1
ENABLE_WEBHOOK_VALIDATION    — Twilio webhook signature verification
ENFORCE_MASKED_ONLY_MESSAGING — Force all messaging through masked numbers
ENABLE_SITTER_MESSAGES_V1    — Sitter messaging features
ENABLE_OPS_SRS               — SRS system operations
```

---

## A2P 10DLC STATUS

Twilio A2P campaign was previously rejected. Rejection reasons:
1. Consent URL pointed to staging deployment (not production)
2. Typo in Terms URL: "tearms-and-conditions"
3. Typo in opt-in keyword: "SUBSCIBE"

Fix sequence:
1. Get booking form live on production with correct consent language
2. Fix all policy URLs (terms, privacy) in the Twilio campaign config
3. Fix opt-in keyword spelling to "SUBSCRIBE"
4. Resubmit campaign

---

## STRIPE INTEGRATION

**Org billing (Snout OS subscription):**
- `OrgIntegrationConfig.paymentProvider = "stripe"`
- Stripe Customer created at org signup → `stripeCustomerId` on `Client` model
- Billing portal: `stripe.billingPortal.sessions.create()`

**Client payments (booking payments):**
- `Booking.stripePaymentLinkUrl` — Stripe Payment Link for the booking
- `Booking.stripeCheckoutSessionId` — if using Checkout
- `Booking.stripePaymentIntentId`
- `Booking.paymentStatus` — `"unpaid" | "partial" | "paid"`

**Sitter payouts (Stripe Connect):**
- `SitterStripeAccount` model — one per sitter
- `PayoutTransfer` model — tracks individual transfers
- `SitterEarning` model — earnings records
- Route: `POST /api/sitter/stripe/connect` → onboard sitter
- Payout queue: `src/lib/payout/payout-queue.ts`

**Stripe webhook events handled:**
`customer.subscription.created/updated/deleted`, `invoice.payment_succeeded/failed`,
`payment_intent.succeeded/failed`, `charge.refunded`
Route: `POST /api/webhooks/stripe`
Signature verification: `STRIPE_WEBHOOK_SECRET`

---

## TENANCY LAYER

```typescript
import { getScopedDb } from "@/lib/tenancy"

// Returns a Prisma client that enforces orgId on all queries
const db = getScopedDb({ orgId })

// Tenant model reference
// src/lib/tenancy/tenant-models.ts — which models are org-scoped
// src/lib/tenancy/scoped-db.ts — the scoped client implementation
```

**Multi-tenancy security rule:** Every model with an `orgId` field must be queried with
`where: { orgId }` AND the orgId must come from `getRequestContext()`, never from
request params or body. This is enforced by Agent 28 (Multi-Tenancy Integrity).

---

## RATE LIMITING

Rate limiting via `src/lib/rate-limit.ts` with Redis backing.

Key limits:
- Auth mutation: `AUTH_MUTATION_LIMIT_PER_MINUTE`
- Auth reads: `AUTH_READ_LIMIT_PER_MINUTE`
- Auth session check: `AUTH_SESSION_CHECK_LIMIT_PER_MINUTE`
- Message provider dispatch: `MESSAGE_PROVIDER_DISPATCH_LIMIT_PER_MINUTE` (default 2400/min)
- Message provider retry: `MESSAGE_PROVIDER_RETRY_LIMIT_PER_MINUTE` (default 1200/min)
- Tip creation: 10 per 5 min per IP
- Sitter info lookup: 30 per min per IP

---

## AI GOVERNANCE

AI features use a governed call wrapper:
```typescript
import { governedCall } from "@/lib/ai/governed-call"

const result = await governedCall({
  orgId,
  featureKey: "daily_delight", // Must match AIPromptTemplate.key
  fn: async () => { /* actual OpenAI call */ }
})
```

AI usage is tracked in `AIUsageLog` model.
Per-org AI settings in `OrgAISettings` (monthly budget, hard stop, allowed models).
Reference: `docs/internal/architecture/AI_GOVERNANCE.md`

---

## REAL-TIME / SSE

Real-time updates via Server-Sent Events:
- `GET /api/realtime/messages/threads/[id]` — thread message updates
- `GET /api/realtime/sitter/today` — sitter today schedule updates
- `GET /api/realtime/ops/failures` — ops failure feed
- `GET /api/realtime/client/bookings` — client booking updates

Event bus: `src/lib/realtime/bus.ts` → Redis pub/sub
SSE helper: `src/lib/realtime/sse.ts`

---

## OFFLINE / PWA

Snout OS is a PWA with offline support:
- Service worker: `src/app/sw.ts` (via Serwist)
- Offline page: `src/app/offline/page.tsx`
- Offline action queue: `src/lib/offline/action-queue.ts`
- Sync replay: `src/lib/offline/sync-replay.ts`
- IndexedDB: `src/lib/offline/db.ts`
- Push notifications: Web Push via VAPID keys
- Reference: `docs/internal/architecture/PWA_OFFLINE.md`

---

## TESTING INFRASTRUCTURE

**Unit tests:** Vitest 4 (`vitest.config.ts`)
**E2E tests:** Playwright 1.51 (`playwright.config.ts`)
**Smoke tests:** `playwright.smoke.config.ts` + `docker-compose.smoke.yml`
**Visual regression:** `tests/visual/visual-regression.spec.ts` + snapshots
**Contract tests:** `tests/contracts/`
**Load tests:** `scripts/load/` + results in `docs/internal/audit/artifacts/load-tests/`

Run before any PR:
```bash
pnpm vitest run        # unit tests
pnpm playwright test   # E2E tests
```

**Snapshot update policy:** `docs/internal/checklists/SNAPSHOT_UPDATE_POLICY.md`

---

## FILE ORGANIZATION RULES

```
API routes:        src/app/api/[domain]/route.ts
Owner portal:      src/app/[feature]/page.tsx
Sitter portal:     src/app/sitter/[feature]/page.tsx
Client portal:     src/app/client/[feature]/page.tsx
Shared components: src/components/ui/
Domain components: src/components/[domain]/
Lib utilities:     src/lib/[domain]/
Queue workers:     src/worker/
Notification:      src/lib/notifications/triggers.ts
Auth:              src/lib/auth.ts + src/lib/request-context.ts
Tenancy:           src/lib/tenancy/
```

---

## WHAT NEVER TO DO

1. **Never** send a message outside of `sendThreadMessage()` in `src/lib/messaging/send.ts`
2. **Never** query a multi-tenant model without `orgId` in the WHERE clause
3. **Never** get `orgId` from request params or body — always from `getRequestContext()`
4. **Never** return 403 when an ID doesn't belong to the org — return 404
5. **Never** use Font Awesome or inline SVG — use Lucide React
6. **Never** hardcode hex colors — use design tokens
7. **Never** use `$transaction` callback form — use array form (see known bugs #3)
8. **Never** fire a notification trigger before `clientId` is set on the booking
9. **Never** use `any` TypeScript type without a comment justifying it
10. **Never** call `prisma.$queryRaw` without parameterized input
11. **Never** touch the `prisma/schema.prisma` without running `prisma migrate dev` and `prisma generate`
12. **Never** deploy without running `prisma migrate deploy` before the new code starts

---

## COMPLETION STATUS (as of March 2026)

| Area | Completion | Notes |
|------|-----------|-------|
| Bookings (core flow) | 90% | Cancel preview, conflicts, check-in/out all present |
| Messaging system | 85% | Anti-poaching, pool routing, masked numbers complete |
| Sitter portal | 80% | Today, schedule, reports, earnings, calendar all present |
| Owner portal | 80% | Dashboard, bookings, clients, sitters, calendar, command center |
| Client portal | 70% | Home, bookings, pets, messages, reports present; some gaps |
| Payments (client billing) | 75% | Stripe checkout, mark-paid, invoicing present |
| Stripe Connect (sitter payouts) | 70% | Connect flow, payout queue, payroll runs present |
| Notifications (9 triggers) | 85% | All 9 triggers wired; 3-channel fallback implemented |
| Automation engine | 75% | Fee/discount application stubs remain |
| SRS / Tier system | 75% | Engine complete; tier progression UI stubbed |
| Google Calendar sync | 80% | Bidirectional sync present; behind feature flag |
| Analytics / Reporting | 70% | KPI routes, trend routes, finance summary present |
| Loyalty system | 65% | Model + engine present; frontend thin |
| AI governance | 70% | Governed call + usage tracking present |
| Multi-tenancy | 90% | Scoped DB + tenancy layer well-built |
| Auth / RBAC | 85% | Middleware, roles, rate limiting present |
| Queue system | 90% | 10 workers, observability, dead letter logging |
| PWA / Offline | 70% | Service worker, offline queue, push notifications |
| E2E test coverage | 65% | Smoke, role routing, messaging E2E present |
| **Overall** | **~78%** | Strong foundation; gaps in UI completeness + client portal |

---

## AGENT INSTRUCTION

When you are an agent working on this codebase:

1. Read this file completely. Do not start work until you have.
2. Your job scope is defined in your agent prompt. Do not exceed it.
3. Every DB query must include `orgId`. No exceptions.
4. Every API response must follow the canonical shape above.
5. Every code change must be followed by a HANDOFF NOTE.
6. If you find something outside your scope, log it in your handoff — do not fix it.
7. The Regression Watchdog (Agent 14) must clear every change before proceeding.
8. When in doubt: smaller change, more targeted, verified before moving on.
