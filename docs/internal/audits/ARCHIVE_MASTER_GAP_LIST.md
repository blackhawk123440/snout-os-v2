# MASTER_GAP_LIST.md — Snout OS Spec vs Repo Reality (In-Home Only)

This document audits the "Complete In-Home Pet Care Platform Specification" against the current repo and lists:
- Status: Present / Partial / Missing
- Effort: EASY (hours) / MED (1–3 days) / HARD (multi-day+)
- What's required to finish
- Exact file(s) to modify (or create)

Legend:
- Present = implemented and reasonably wired end-to-end
- Partial = exists, but stubbed, placeholder UI, missing automation, missing security, or missing integration depth
- Missing = not implemented or not evidenced in repo

**Correction note:** BullMQ, ioredis, automation queue worker, and OpenAI AI code ARE present in the repo. Do not claim otherwise.

---

## Quick wins — "Easy stuff first" batch

Do these to make the app feel less "half-real" immediately:

| # | Item | Effort |
|---|------|--------|
| 13 | Decide OpenPhone vs Twilio; make docs + dependencies match reality | EASY |
| 33 | Add rate limiting middleware for public endpoints (booking form, login, messaging) | EASY–MED |
| 3 | Standardize TanStack Query provider wiring (one consistent root setup) | EASY |
| 2 | Enforce design system usage (lint rule / component policy / refactor offenders) | EASY–MED |
| 35 | Ensure critical actions write audit/event logs consistently (mostly wiring) | EASY |

---

## 0) Ground truth: What the repo is actually running

### 0.1 Runtime architecture: Next.js App Router + API routes
Status: Present  
Notes: The system is Next.js (not Express).  
Files:
- src/app/** (UI routes)
- src/app/api/** (API routes)

---

## 1) Architecture & Tech Stack

### 1.1 Next.js + TypeScript + Tailwind
Status: Present  
Files:
- src/** (TypeScript app)
- tailwind.config.js (styling)

### 1.2 "Shadcn/UI for components"
Status: Partial | Effort: EASY–MED  
Reason: UI system exists, but "shadcn" usage isn't guaranteed from the spec alone. Design system (App* primitives) not enforced.
Finish:
- Standardize on one component source of truth (App* primitives already created)
Files:
- src/components/app/* (AppCard/AppPageHeader/etc)

### 1.3 TanStack Query
Status: Present (dependency) / Partial (wiring depends per page) | Effort: EASY  
Evidence: @tanstack/react-query is in dependencies. Provider/query client usage may vary by page.  
Files:
- package.json
Finish:
- Ensure consistent query client/provider usage in root layout if not already.
Potential files:
- src/app/layout.tsx (provider wiring)
- src/lib/query-client.ts (if you create one)

### 1.4 Real-time with Socket.io
Status: Missing | Effort: HARD  
Evidence: No socket.io dependency in package.json. Inbox/ops feels stale; users must refresh.  
Finish options:
A) Add socket.io (server + client)  
B) Use SSE / polling (simpler in Next.js)  
Files to create/modify (if Socket.io):
- package.json (add socket.io + socket.io-client)
- src/app/api/realtime/* (or a custom server entry)  
- src/lib/realtime/* (client abstraction)

### 1.5 Prisma ORM + PostgreSQL
Status: Present  
Evidence: prisma + @prisma/client dependencies; prisma schema exists in repo.  
Files:
- prisma/schema.prisma
- prisma/migrations/**

### 1.6 Multi-tenant orgId scoping + Personal mode org lock
Status: Present  
Evidence: getRequestContext() locks org in personal mode and requires org in SaaS mode; getPublicOrgContext blocks public booking for SaaS until org binding exists.  
Files:
- src/lib/request-context.ts
- src/lib/rbac.ts
- src/middleware.ts
Finish:
- Ensure all API routes use ctx.orgId + whereOrg() consistently (audit & tests).

### 1.7 Auth: NextAuth sessions + roles (owner/sitter/client)
Status: Present  
Evidence: request-context normalizes roles; middleware enforces auth gates.  
Files:
- src/lib/request-context.ts
- src/lib/rbac.ts
- src/middleware.ts
Finish:
- Confirm DB role values normalize to lowercase consistently (or normalize in NextAuth callback).

### 1.8 Redis + BullMQ automations / queues
Status: Partial | Effort: MED  
Evidence: BullMQ + ioredis deps, queue setup + scheduling exists. Worker execution in production not guaranteed (Render/Vercel don't run background workers by default).  
Files:
- src/lib/queue.ts
- src/worker/automation-worker.ts

### 1.9 AI layer: OpenAI (gpt-4o-mini) for Daily Delight & matching
Status: Partial | Effort: HARD  
Evidence: ai.generateDailyDelight + matchSitterToPet exist and use gpt-4o-mini. Dynamic pricing / sentiment / alerts noted but not implemented. Prompt templates + auditability missing. No AI endpoints for pricing/sentiment/marketing. No cost controls / per-org limits.  
Files:
- src/lib/ai.ts
Finish:
- Add: sentiment analysis, dynamic pricing, predictive alerts, marketing email generator endpoints + storage models.

### 1.10 Deployment: Docker + CI/CD
Status: Partial  
Notes: repo has render.yaml + CI workflow; actual "production-ready" depends on env/DB/worker setup.  
Files:
- render.yaml
- .github/workflows/ci.yml
Finish:
- Ensure worker/queue starts in production environment (Render/Vercel don't run background workers by default).

---

## 2) Core Product Modules — In-Home Only

### 2.1 Booking Form (client intake)
Status: Partial  
Reality: Booking form routes exist in repo; spec claims automation hooks on submit.
Gap:
- Booking submit should trigger: confirmation + reminders + review request jobs  
Finish:
- Emit domain events on booking creation → enqueue jobs
Files to modify/create:
- src/app/api/form/route.ts (enqueue booking-created automation job)
- src/worker/automation-worker.ts (implement reminder + review flows)
- src/lib/queue.ts (job types + schedules)

### 2.2 Owner/Admin Dashboard (ops command center)
Status: Partial | Effort: MED  
Reason: UI routes exist (dashboard/ops), but analytics, "needs attention", ops signals not wired. Not proven operational.
Finish:
- Add real analytics queries (revenue, retention, sitter performance)
- Add "Needs attention" queue that's actually wired to events/automations
Files (likely):
- src/app/dashboard/**
- src/app/ops/**
- src/app/api/ops/**

### 2.3 Sitter Dashboard (jobs, calendar, inbox, earnings, pets, reports, availability)
Status: Present (UI surface) / Partial (real data depth) | Effort: MED  
Reality: UI polished; data correctness + edge cases unclear. Today + core sitter data depth not guaranteed.
Finish:
- Ensure Today actually returns bookings for sitter consistently
- Route optimization (Google Maps)
- Daily Delight media upload + persistence
Files:
- src/app/sitter/** (pages)
- src/app/api/sitter/** (endpoints)
- src/app/api/bookings/[id]/check-in, check-out, daily-delight

### 2.4 Client Portal (home, bookings, pets, messages, reports)
Status: Present (UI + basic APIs) / Partial (billing + realtime + full messaging depth) | Effort: MED–HARD  
Gap: Billing + realtime + full messaging depth missing.
Finish:
- Payments (invoices/receipts) pages + endpoints
- Realtime updates (polling/SSE/socket)
Files:
- src/app/client/**
- src/app/api/client/**

### 2.5 Scheduling / Calendar (availability + bookings calendar)
Status: Partial | Effort: HARD  
Evidence: googleapis dependency exists; calendar UI exists. Bidirectional Google sync not evidenced complete. Conflict policy not documented/implemented. Route optimization / maps integration not finished.
Finish:
- Implement and document bidirectional sync + conflict policy
- Persist external event IDs per sitter/calendar
Files (existing folder per repo structure):
- src/app/api/integrations/google/** (OAuth, callbacks, sync endpoints)  [audit this folder]
- src/app/api/calendar/** (calendar APIs)
- src/app/calendar/** (UI)
- prisma/schema.prisma (BookingCalendarEvent etc.)

### 2.6 Messaging (in-app + SMS provider)
Status: Partial | Effort: HARD  
Reality: UI + APIs exist; realtime isn't there; full provider + delivery guarantees not proven. OpenPhone implemented; Twilio dependency exists; spec/docs must match reality. Retries, statuses, delivery logs, admin "why didn't it send?" tooling incomplete.
Evidence: automation-worker imports sendSMS from openphone; openphone implementation exists; twilio dependency exists but is not proven as the active provider.  
Files:
- src/worker/automation-worker.ts (uses OpenPhone)
- src/lib/openphone.ts
- src/app/api/messages/**

Finish decision:
- Decide provider: OpenPhone OR Twilio
If OpenPhone:
- Update spec/docs to stop claiming Twilio masking
If Twilio:
- Implement src/lib/twilio.ts + route handlers, update worker + message routing

### 2.7 Payments (owner billing + client invoices + payouts later)
Status: Partial | Effort: HARD  
Evidence: Stripe exists but persistence of payment state incomplete (needs webhook receiver + DB persistence). Invoices/receipts UX incomplete in client portal. No ledger/correctness layer proven. Connect payouts not shown.
Files:
- src/lib/stripe.ts
Finish:
- Add webhook handlers for invoice/payment state
- Add ledger model for payouts/earnings correctness
Potential files:
- src/app/api/stripe/** (webhooks)
- prisma/schema.prisma (ledger tables if not present)
- src/lib/stripe.ts (Connect + payout logic)

### 2.8 Pet Profiles (medical notes, allergies, meds, home instructions)
Status: Partial | Effort: MED  
Evidence: Pet model exists; client/sitter pet pages exist. Structured meds/vaccines/instructions completeness unclear. Emergency Vet "action" missing (compose summary + location + notify owner/client).
Files:
- prisma/schema.prisma (Pet + related models)
- src/app/sitter/pets/**
- src/app/client/pets/**
Finish:
- Add structured fields for meds/vaccines (if not already)
- Add "Emergency Vet" action that composes summary + location and notifies owner/client

### 2.9 Report Cards / Daily Delight history
Status: Partial | Effort: MED  
Evidence: ai.ts generates text and stores PetHealthLog; client reports routes exist. Media upload persistence + attachments incomplete. "Send to client" pipeline not fully automated (SMS + in-app).
Files:
- src/lib/ai.ts
- src/app/api/bookings/[id]/daily-delight/route.ts
- src/app/api/client/reports/**
Finish:
- Add media upload persistence + attach to report records
- Ensure "send to client" pipeline is automated (SMS + in-app)

### 2.10 Availability (toggle, block-off dates, recurring blocks)
Status: Partial | Effort: HARD  
Evidence: sitter availability endpoints/pages exist. Recurring blocks + merge logic into availability search are placeholder.
Files:
- src/app/sitter/availability/**
- src/app/api/sitter/availability/**
- prisma/migrations/...add_sitter_availability_enabled (already present in your local status)
Finish:
- Add recurring rules model + conflict merge into calendar availability search

---

## 3) Automations (The backbone)

### 3.1 Booking-created automations (confirmation + reminders + review request)
Status: Missing (behavior) / Partial (infrastructure) | Effort: MED  
Evidence: queue exists; automation worker returns empty. Booking submit does not reliably trigger automation cascade. Domain event standardization incomplete (BookingCreated/VisitStarted/VisitCompleted/DelightSent not unified).  
Files:
- src/lib/queue.ts (job scheduling exists)
- src/worker/automation-worker.ts (currently stubbed)
Finish:
- Implement:
  - Confirmation on booking created
  - 24h reminder
  - Post-service review request
  - Failure retries + audit logs
Where to wire:
- src/app/api/form/route.ts (enqueue booking created job)
- src/worker/automation-worker.ts (implement processors)
- prisma/schema.prisma (automation run logs / event logs if needed)

### 3.2 "System" actor background jobs
Status: Partial  
Finish:
- Standardize event types: BookingCreated, VisitStarted, VisitCompleted, DelightSent
Files:
- src/app/api/** (emit events)
- src/worker/** (consume events)

---

## 4) Integrations

### 4.1 OpenAI
Status: Partial  
Evidence: ai.ts exists and uses gpt-4o-mini.  
Files:
- src/lib/ai.ts
Finish:
- Add proper prompt templates + store prompts/outputs for audit
- Add endpoints for sentiment/pricing/matching

### 4.2 SMS provider: OpenPhone vs Twilio
Status: Partial | Effort: EASY  
Evidence: OpenPhone is implemented; Twilio is installed but not confirmed as used. Decide provider; make docs + dependencies match reality.  
Files:
- src/lib/openphone.ts
- package.json (twilio dependency exists)
Finish:
- Either remove Twilio dependency or implement twilio layer and switch worker/messaging.

### 4.3 Google Calendar
Status: Partial  
Evidence: googleapis installed; google integration folder exists (path present in repo tree) but specific route files not audited here.  
Files:
- src/app/api/integrations/google/** (audit)
- src/app/api/calendar/** (audit)
Finish:
- Implement OAuth + token storage per org/sitter
- Implement push/pull sync + conflict resolution rules

### 4.4 Stripe
Status: Partial  
Evidence: stripe.ts supports payment links + invoices + analytics.  
Files:
- src/lib/stripe.ts
Finish:
- Add webhook receiver and DB persistence of payment state
- Add Connect payouts later (if desired)

---

## 5) Security / Compliance

### 5.1 Route protection (auth gates)
Status: Present  
Evidence: middleware enforces auth (feature flag defaults to enabled).  
Files:
- src/middleware.ts

### 5.2 Org isolation (tenant isolation)
Status: Present (foundation) / Partial (coverage) | Effort: HARD  
Evidence: request-context + RBAC exist. Must audit every API route for ctx.orgId + whereOrg() usage and test it. Tenant isolation tests missing for highest-risk endpoints.
Files:
- src/lib/request-context.ts
- src/lib/rbac.ts
Finish:
- Ensure every API route uses ctx.orgId and whereOrg()  
- Add tenant isolation tests for the highest-risk endpoints

### 5.3 Rate limiting / abuse prevention
Status: Missing | Effort: EASY–MED  
Finish:
- Add rate limit middleware for public endpoints (booking form, login)
Files to create:
- src/lib/rate-limit.ts
- apply in: src/app/api/form/route.ts, auth routes, messaging routes

### 5.4 GDPR export / client data export
Status: Missing | Effort: MED  
Finish:
- Implement export endpoint returning client's data bundle
Files:
- src/app/api/client/export/route.ts (new)
- prisma queries

---

## 6) Testing

### 6.1 Unit/integration tests (Vitest)
Status: Present / Partial  
Evidence: vitest script exists; new tests added earlier.
Files:
- vitest.config.ts
- src/**/__tests__/**

### 6.2 E2E tests (Playwright)
Status: Present / Partial | Effort: MED–HARD  
Evidence: Playwright config exists; snapshot suites exist. Snapshot/E2E stabilization gaps (freeze time, fixtures/mocks). Missing critical E2E booking flow: client books → sitter sees → check-in/out → delight → client sees report.
Files:
- playwright.config.ts
- tests/e2e/*

Finish:
- Stabilize snapshots (freeze time, use fixtures/mocks)
- Add booking flow E2E (client books → sitter sees → check-in/out → delight → client sees report)

---

## 7) Business "Completeness" Features (not UI polish)

### 7.1 Revenue/retention analytics
Status: Missing/Partial | Effort: HARD  
Finish:
- Define analytics tables or computed views
- Build owner dashboards based on them
Files:
- prisma/schema.prisma (analytics models)
- src/app/dashboard/**

### 7.2 Audit logs
Status: Partial | Effort: EASY (mostly wiring)  
Finish:
- Ensure all critical actions log events (booking create/update, message send, payout)
Files:
- src/app/api/audit/** (if present) + add event writes across routes

---

## 8) Hard "Production Readiness" Gates (do these before calling it deployable)

| # | Gate | Effort |
|---|------|--------|
| 1 | Worker actually processes reminders/reviews (not stubbed) | MED |
| 2 | Decide SMS provider and finish it (OpenPhone vs Twilio; docs + code match) | EASY |
| 3 | Calendar sync rules documented + implemented | HARD |
| 4 | Payments state persisted via webhooks | HARD |
| 5 | Rate limiting on public routes | EASY–MED |
| 6 | Tenant isolation tests for all client/sitter endpoints | MED |

Files:
- src/worker/automation-worker.ts
- src/lib/openphone.ts OR src/lib/twilio.ts
- src/app/api/integrations/google/**
- src/app/api/webhooks/stripe/route.ts (or equivalent)
- src/lib/rate-limit.ts

---

## 9) PWA / Offline (mobile sitters in bad-signal homes)

### 9.1 PWA + offline support
Status: Missing | Effort: HARD  
Finish: Manifest + service worker + offline caching/sync.

---

## Evidence anchors (for this audit)
- Dependencies: Next.js, Prisma, TanStack Query, BullMQ, ioredis, OpenAI, Stripe, Twilio, googleapis: package.json
- AI implementation: src/lib/ai.ts
- Stripe helper implementation: src/lib/stripe.ts
- Queue scheduling + workers: src/lib/queue.ts
- Automation worker: src/worker/automation-worker.ts (processReminders, processDailySummary exist; production worker execution depends on Render/Vercel worker setup)
- Personal mode + org lock + public booking restriction: src/lib/request-context.ts
- RBAC helper: src/lib/rbac.ts
- Auth gating middleware: src/middleware.ts
