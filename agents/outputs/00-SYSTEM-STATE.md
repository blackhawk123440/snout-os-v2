# 00-SYSTEM-STATE.md
# Agent 00 (Bootstrapper) — Complete Codebase State Report
# Generated: 2026-03-29

---

## 1. CLAUDE.md Summary (Canonical Source of Truth)

### What Is Snout OS
Multi-tenant SaaS for ALL pet care businesses (sitting, walking, boarding, grooming, daycare, training). Built by Carson (owner of Snout, the actual pet care business). Leah is co-owner and beta user. Competes with Time To Pet, Gingr, PetExec.

### Tech Stack
- **Framework:** Next.js 15 (App Router) + TypeScript 5
- **Database:** Prisma 5 -> PostgreSQL (Render managed)
- **Auth:** NextAuth v5 beta (@auth/prisma-adapter)
- **Queue:** BullMQ 4 + IORedis 5 -> Redis
- **Payments:** Stripe 14 + Stripe Connect (sitter payouts)
- **Messaging:** Twilio 5 / OpenPhone (pluggable provider via `provider-factory.ts`)
- **Calendar:** Google Calendar API (bidirectional sync)
- **AI:** OpenAI via @langchain/openai + governed-call wrapper
- **UI:** React 18 + Tailwind CSS 3 + Framer Motion 12
- **Icons:** Lucide React ONLY
- **Testing:** Vitest 4 (unit) + Playwright 1.51 (E2E) + visual regression
- **PWA:** Serwist (@serwist/next) with offline support
- **Monitoring:** Sentry (server + edge + client)
- **Email:** Resend
- **Storage:** AWS S3

### Deployment
- **Platform:** Render (web service + worker service + PostgreSQL + Redis)
- **Operating Mode:** Currently Personal Mode (`NEXT_PUBLIC_PERSONAL_MODE=true`), single-org locked to `PERSONAL_ORG_ID`
- **Worker:** Separate Render service running `src/worker/index.ts`

### Key Architecture Patterns
1. **Auth:** `getRequestContext()` returns `{ orgId, role, userId, sitterId, clientId }` -- EVERY protected route must use this
2. **Tenancy:** `getScopedDb({ orgId })` for all multi-tenant queries; orgId in every WHERE clause
3. **Messaging:** All messages go through `sendThreadMessage()` in `src/lib/messaging/send.ts`
4. **Notifications:** 9 trigger events in `src/lib/notifications/triggers.ts` with 3-channel fallback (SMS -> email -> in-app)
5. **Queue:** 10 BullMQ workers initialized in `src/lib/queue.ts` via `initializeQueues()`
6. **API responses:** Standardized `{ data: result }` or `{ error: "message" }` shapes
7. **Role enforcement:** owner/admin, sitter, client roles with middleware-level enforcement

### Known Fixed Bugs (Do Not Reintroduce)
1. Silent notification drop (clientId null before triggers fired)
2. OpenPhone 404 (wrong `from` field)
3. Prisma `$transaction` proxy bug (use array-based, not callback)
4. Client-side layout shell blocking sitter onboard
5. X-Frame-Options blocking booking form iframe
6. Old completed bookings getting confirmation messages
7. Duplicate bookingConfirmation template

---

## 2. Directory Tree Map

### Top-Level
| Directory | Purpose | Notes |
|-----------|---------|-------|
| `prisma/` | Schema (2520 lines, 106 models), migrations (40+), seeds | Core data layer |
| `src/app/` | Next.js App Router pages + API routes | All portals + APIs |
| `src/lib/` | Business logic, utilities, engines | 40+ subdirectories |
| `src/components/` | React components organized by domain | 16 subdirectories |
| `src/commands/` | Command palette system (Cmd+K) | Many mocks still |
| `src/worker/` | BullMQ worker entry + processors | 3 files |
| `src/middleware.ts` | Auth, role routing, rate limiting | Single file |
| `tests/` | E2E (Playwright), contracts, visual regression | 29 test files |
| `scripts/` | Backfill, migration, proof, verification scripts | 80+ scripts |
| `docs/` | Architecture, audit artifacts, checklists | Extensive internal docs |
| `public/` | Static assets, service worker | PWA manifest |
| `snout-agents/` | Agent system prompts (this framework) | 2 tier files |
| `agents/outputs/` | Agent output artifacts | This file |
| `audit/` | Audit-related files | Exists at root |
| `proof-pack/` | Deployment proof artifacts | Exists at root |

### `src/app/api/` — API Route Directories (28 domains)
| Directory | Route Count (non-test) | Purpose |
|-----------|----------------------|---------|
| `analytics/` | 6 | KPIs, trends (bookings, revenue, payouts, messages, automation failures) |
| `assignments/` | 3 | Assignment windows, conflicts |
| `auth/` | 7 | NextAuth, signup, login, logout, password reset/change, demo-login |
| `automations/` | 7 | Automation CRUD, ledger, settings, stats, templates, test-message |
| `bookings/` | 10 | CRUD, cancel, check-in/out, conflicts, reschedule, daily-delight, events |
| `client/` | 40+ | Client portal APIs (bookings, billing, pets, reports, messages, recurring, etc.) |
| `clients/` | 4 | Owner-facing client management |
| `cron/` | 3 | Balance collection, unpaid expiry, recurring charges |
| `dispatch/` | 3 | Attention, force-assign, resume-automation |
| `form/` | 1 | Public booking form submission |
| `health/` | 1 | Health check endpoint |
| `integrations/` | 5 | Google Calendar OAuth, Stripe test, integration status |
| `messages/` | 25+ | Threads, webhooks (Twilio/OpenPhone), send, pool-health, SRS, in-app |
| `numbers/` | 10+ | Number management (buy, import, assign, release, quarantine) |
| `offers/` | 1 | Offer expiration |
| `onboarding/` | 1 | Onboarding status |
| `ops/` | 70+ | Owner operations (smart-assign, payouts, finance, SRS, command-center, etc.) |
| `payments/` | 2 | Payment list + export |
| `payroll/` | 4 | Payroll runs, approval, export |
| `pricing/` | 0 | Empty (pricing rules are in settings) |
| `push/` | 2 | Push notification subscribe + preferences |
| `realtime/` | 4 | SSE endpoints (messages, sitter today, ops failures, client bookings) |
| `routing/` | 1 | Thread routing history |
| `settings/` | 18 | Business, branding, services, pricing, discounts, notifications, integrations |
| `setup/` | 1 | Org setup |
| `sitter/` | 45+ | Sitter portal APIs (bookings, calendar, earnings, availability, stripe, etc.) |
| `sitter-tiers/` | exists | Tier management |
| `sitters/` | 18 | Owner-facing sitter management (performance, SRS, tiers, calendar, etc.) |
| `tip/` | 4 | Tip flow (create payment intent, sitter info, transfer, config) |
| `twilio/` | exists | Twilio-specific routes |
| `upload/uploads/` | exists | File upload |
| `waitlist/` | 3 | Waitlist CRUD |
| `webhooks/` | 1 | Stripe webhook handler |
| `zones/` | 1 | Zone detection |

### `src/app/` — UI Pages (All Portals)

**Owner Portal Pages (21 pages):**
- `/dashboard`, `/bookings` (list + [id] + new), `/calendar` (+ accounts), `/clients` (list + [id]), `/sitters` (list + [id] + rankings), `/messaging` (5 sub-pages: inbox, numbers, assignments, sitters, twilio-setup, openphone-setup), `/command-center`, `/schedule-grid`, `/money`, `/finance`, `/payments`, `/payroll`, `/reports`, `/analytics`, `/automations` (list + [id]), `/settings` (+ automations, recurring, tiers), `/growth`, `/integrations`, `/bundles`, `/templates` (list + [id]), `/waitlist`, `/setup`, `/assignments`, `/exceptions`, `/digest-settings`, `/review-settings`, `/pricing`, `/numbers`

**Owner Ops Pages (8 pages):**
- `/ops/ai`, `/ops/automation-failures`, `/ops/calendar-repair`, `/ops/diagnostics`, `/ops/failures`, `/ops/message-failures`, `/ops/payouts`, `/ops/proof`, `/ops/finance/reconciliation`

**Sitter Portal Pages (16 pages):**
- `/sitter` (root), `/sitter/dashboard`, `/sitter/today`, `/sitter/bookings` (list + [id]), `/sitter/calendar`, `/sitter/earnings`, `/sitter/inbox`, `/sitter/performance`, `/sitter/availability`, `/sitter/profile`, `/sitter/reports` (list + new + edit/[id]), `/sitter/training`, `/sitter/onboard`, `/sitter/callout`, `/sitter/pets` (list + [id])

**Client Portal Pages (16 pages):**
- `/client` (root), `/client/home`, `/client/bookings` (list + [id] + new), `/client/messages` (list + [id]), `/client/pets` (list + [id] + new), `/client/reports` (list + [id]), `/client/billing`, `/client/profile`, `/client/recurring`, `/client/setup`, `/client/support`, `/client/meet-greet`, `/client/settings/export`

**Public Pages:**
- `/login`, `/forgot-password`, `/reset-password`, `/tip/[amount]/[sitter]`, `/tip/payment`, `/tip/success`, `/tip/cancel`, `/tip/link-builder`, `/booking-form` (route handler for iframe), `/(public)/privacy`, `/(public)/terms`, `/offline`, `/ui-kit`

### `src/lib/` — Business Logic (40+ modules)
| Module | Files | Purpose |
|--------|-------|---------|
| `messaging/` | 50+ files | Full messaging stack (send, providers, anti-poaching, pool routing, etc.) |
| `tenancy/` | 4 files | Scoped DB, tenant models |
| `notifications/` | 2 files | 9 triggers + push dispatch |
| `availability/` | 3 files | Availability engine + booking conflicts |
| `calendar/` | 3 files | Google Calendar sync (bidirectional) |
| `tiers/` | 9 files | SRS engine, tier rules, message bridge |
| `ai/` | 3 files | AI governance, governed-call wrapper |
| `finance/` | 4 files | Ledger, reconciliation |
| `payout/` | 4 files | Payout engine, queue, sitter payout |
| `payroll/` | 1 file | Payroll service |
| `loyalty/` | 1 file | Loyalty engine |
| `offline/` | 4 files | IndexedDB action queue, sync replay |
| `realtime/` | 2 files | Redis pub/sub bus, SSE helper |
| `pricing/` | 1 file | Pricing engine |
| `recurring/` | 1 file | Recurring schedule generation |
| `zones/` | exists | Point-in-polygon zone detection |
| `booking/` | exists | Booking-related utilities |
| `bookings/` | exists | Booking confirmed handler |
| `invoicing/` | exists | Invoice logic |
| `stripe-connect/` | exists | Stripe Connect helpers |
| `matching/` | exists | Sitter matching |
| `bundles/` | exists | Service bundles |
| `validation/` | exists | Validation logic |
| `privacy/` | exists | Privacy/data export |
| `digest/` | exists | Daily digest |
| `resonance/` | exists | AI suggestions layer |
| `setup/` | exists | Org setup |
| `startup/` | exists | App startup |
| `waitlist/` | exists | Waitlist logic |

### `src/components/` — UI Components (16 directories)
| Directory | Files | Purpose |
|-----------|-------|---------|
| `app/` | 21 | Shared app-level components (AppCard, AppTable, AppDrawer, etc.) |
| `ui/` | 45 | Base UI primitives (Button, Card, Modal, Input, etc.) |
| `sitter/` | 35 | Sitter portal components (dashboard, tier, SRS, etc.) |
| `booking/` + `bookings/` | 10 | Booking forms, cards, row actions |
| `messaging/` | 16 | Inbox, conversation, numbers, setup panels |
| `client/` | 4 | Client sidebar, debug overlay |
| `calendar/` | exists | Calendar views |
| `charts/` | exists | Chart components |
| `layout/` | exists | AppShell, navigation |
| `auth/` | exists | Auth-related components |
| `command/` | exists | Command palette |
| `motion/` | exists | Animation wrappers |
| `resonance/` | exists | AI suggestion UI |
| `owner/` | 0 files | **EMPTY -- no owner-specific components** |

### `src/worker/` — Background Workers
- `index.ts` -- Entry point, initializes all 10 queue workers
- `automation-worker.ts` -- Daily summary processor
- `reconciliation-worker.ts` -- Pricing reconciliation processor

### Prisma Schema (106 Models)
Key models by domain:
- **Core:** Org, User, UserRole, Role, RolePermission, Session, Account, VerificationToken
- **Booking:** Booking, BookingStatusHistory, BookingCalendarEvent, BookingChecklistItem, BookingPipeline, BookingRequestIdempotency, BookingSitterPool, BookingTag, BookingTagAssignment, TimeSlot
- **Client:** Client, ClientContact, ClientEmergencyContact, Pet, PetHealthLog
- **Sitter:** Sitter, SitterAvailabilityRule, SitterAvailabilityOverride, SitterAvailabilityRequest, SitterCompensation, SitterEarning, SitterMaskedNumber, SitterMetricsWindow, SitterPoolOffer, SitterServiceEvent, SitterStripeAccount, SitterTier, SitterTierHistory, SitterTierSnapshot, SitterTimeOff, SitterVerification
- **Messaging:** MessageThread, MessageEvent, MessageNumber, MessageParticipant, MessageAccount, MessageConversationFlag, MessageResponseLink, MessageTemplate, Message, AntiPoachingAttempt, OptOutState, ThreadAssignmentAudit
- **Payments:** PayoutTransfer, PayrollRun, PayrollLineItem, PayrollAdjustment, StripeBalanceTransaction, StripeCharge, StripePayout, StripeRefund, LedgerEntry
- **Automation:** Automation, AutomationAction, AutomationCondition, AutomationConditionGroup, AutomationRun, AutomationRunStep, AutomationTemplate, AutomationTrigger
- **Settings:** BusinessSettings, Setting, OrgIntegrationConfig, OrgAISettings, OrgNotificationSettings, OrgServiceArea, FeatureFlag, PricingRule, ServiceConfig, Discount, DiscountUsage
- **AI:** AIPromptTemplate, AIUsageLog
- **Reports:** Report, IncidentReport, VisitEvent
- **Other:** RecurringSchedule, AssignmentWindow, OfferEvent, LoyaltyReward, ReconciliationRun, QueueJobRecord, AppErrorLog, BaselineSnapshot, CommandCenterAttentionState, CustomField, CustomFieldValue, FormField, GoogleCalendarAccount, ProviderCredential, PushSubscription, SignupIdempotency, TemplateHistory, AnalyticsInsight, BookingPipeline, EventLog, ResponseRecord, ServicePointWeight

### Migrations: 40+ migrations from 2026-02-26 through 2026-03-26

---

## 3. Feature Domain Mapping

### A. Bookings (Creation, Confirmation, Cancellation, Modification)

**API Routes:**
- `GET/POST /api/bookings` -- List and create bookings
- `GET/PATCH /api/bookings/[id]` -- Get/update booking
- `POST /api/bookings/[id]/cancel` -- Cancel booking
- `GET /api/bookings/[id]/cancel-preview` -- Cancel preview (fee calculation)
- `POST /api/bookings/[id]/check-in` -- Sitter check-in
- `POST /api/bookings/[id]/check-out` -- Sitter check-out
- `GET /api/bookings/[id]/check-conflicts` -- Scheduling conflict check
- `POST /api/bookings/[id]/reschedule` -- Reschedule booking
- `GET /api/bookings/[id]/events` -- Booking event timeline
- `GET /api/bookings/conflicts` -- Global conflict check
- `POST /api/bookings/[id]/daily-delight` -- AI daily delight report
- `POST /api/form` -- Public booking form submission (with idempotency)
- `POST /api/client/bookings` -- Client self-booking
- `POST /api/client/bookings/[id]/cancel` -- Client cancel
- `POST /api/ops/bookings/[id]/mark-paid` -- Owner mark as paid
- `POST /api/ops/bookings/[id]/refund` -- Refund
- `GET /api/ops/bookings/[id]/sitter-suggestions` -- Smart sitter suggestions
- `GET /api/ops/bookings/[id]/smart-assign` -- Auto-assign sitter
- `POST /api/ops/bookings/[id]/urgent-dispatch` -- Emergency dispatch
- `POST /api/ops/bookings/bulk-cancel` -- Bulk cancel

**Lib Files:**
- `src/lib/booking-engine.ts`, `booking-utils.ts`, `booking-status-history.ts`
- `src/lib/cancellation-engine.ts`
- `src/lib/form-to-booking-mapper.ts`, `form-mapper-helpers.ts`
- `src/lib/bookings/booking-confirmed-handler.ts`
- `src/lib/availability/booking-conflict.ts`

**UI Pages:**
- `/bookings` (list), `/bookings/[id]` (detail), `/bookings/new` (create)
- `/client/bookings`, `/client/bookings/[id]`, `/client/bookings/new`
- `/sitter/bookings`, `/sitter/bookings/[id]`

**Components:**
- `BookingForm.tsx`, `BookingForm.legacy.tsx`, `EditBookingModal.tsx`
- `BookingRowActions.tsx`, `BookingStatusInlineControl.tsx`
- `BookingCardMobileSummary.tsx`, `BookingScheduleDisplay.tsx`

### B. Messaging (Threads, Events, Numbers, Webhooks)

**API Routes:**
- `POST /api/messages/send` -- Send message
- `GET/POST /api/messages/threads` -- List/create threads
- `GET/PATCH /api/messages/threads/[id]` -- Thread detail/update
- `GET/POST /api/messages/threads/[id]/messages` -- Thread messages
- `POST /api/messages/threads/[id]/mark-read` -- Mark read
- `GET /api/messages/threads/[id]/lifecycle` -- Lifecycle state
- `GET /api/messages/threads/[id]/timeline` -- Timeline events
- `GET/POST /api/messages/threads/[id]/workflow` -- Workflow state
- `POST /api/messages/webhook/twilio` -- Twilio inbound webhook
- `POST /api/messages/webhook/openphone` -- OpenPhone inbound webhook
- `GET /api/messages/pool-health` -- Number pool health
- `POST /api/messages/process-srs` -- SRS processing
- `GET /api/messages/in-app` -- In-app messages
- `GET /api/messages/in-app/unread` -- Unread count
- `POST /api/messages/send-payment-link` -- Send payment link via SMS
- `POST /api/messages/send-tip-link` -- Send tip link via SMS
- `POST /api/messages/[id]/retry` -- Retry failed message
- `GET /api/messages/availability/requests` -- Availability requests
- `GET /api/messages/debug/state` -- Debug state

**Lib Files (50+ files):**
- `src/lib/messaging/send.ts` -- Canonical send function
- `src/lib/messaging/provider-factory.ts` -- Pluggable provider (Twilio/OpenPhone)
- `src/lib/messaging/providers/twilio.ts`, `providers/openphone.ts`
- `src/lib/messaging/anti-poaching-detection.ts`, `anti-poaching-enforcement.ts`, `anti-poaching-flags.ts`
- `src/lib/messaging/pool-routing.ts`, `dynamic-number-routing.ts`
- `src/lib/messaging/conversation-lifecycle.ts`, `conversation-service.ts`
- `src/lib/messaging/outbound-queue.ts`, `thread-activity-queue.ts`
- `src/lib/messaging/client-contact-lookup.ts`, `client-classification.ts`
- `src/lib/messaging/sitter-offboarding.ts`, `sms-commands.ts`
- `src/lib/messaging/availability.ts` -- Provider availability check
- Plus 30+ more files

**UI Pages:**
- `/messaging` (root), `/messaging/inbox`, `/messaging/numbers`, `/messaging/assignments`, `/messaging/sitters`, `/messaging/twilio-setup`, `/messaging/openphone-setup`
- `/sitter/inbox`
- `/client/messages`, `/client/messages/[id]`

### C. Payments (Stripe, Invoices, Payouts, Failed Payments)

**API Routes:**
- `GET /api/payments` -- Payment list
- `GET /api/payments/export` -- Export payments
- `GET/POST /api/payroll` -- Payroll runs
- `GET /api/payroll/[id]` -- Payroll detail
- `POST /api/payroll/[id]/approve` -- Approve payroll run
- `GET /api/payroll/export` -- Export payroll
- `POST /api/webhooks/stripe` -- Stripe webhook handler
- `POST /api/ops/bookings/[id]/mark-paid` -- Mark paid
- `POST /api/ops/bookings/[id]/refund` -- Refund
- `GET /api/ops/payouts` -- Payout list
- `POST /api/ops/payouts/approve` -- Approve payout
- `GET /api/ops/finance/summary` -- Financial summary
- `GET /api/ops/finance/annual-summary` -- Annual summary
- `POST /api/ops/finance/reconcile` -- Trigger reconciliation
- `GET /api/ops/finance/reconcile/runs` -- Reconciliation runs
- `GET /api/ops/finance/reconciliation-report` -- Reconciliation report
- `GET /api/ops/finance/ledger/export` -- Ledger export
- `GET /api/ops/payment-analytics` -- Payment analytics
- `GET /api/ops/payout-analytics` -- Payout analytics
- `POST /api/sitter/stripe/connect` -- Sitter Stripe Connect onboarding
- `GET /api/sitter/stripe/status` -- Sitter Stripe status
- `GET /api/sitter/earnings` -- Sitter earnings
- `POST /api/sitter/instant-payout` -- Sitter instant payout
- `GET /api/sitter/transfers` -- Sitter transfer history
- `GET /api/client/billing` -- Client billing history
- `GET /api/client/billing/annual-summary` -- Client annual summary
- `GET /api/client/outstanding-balance` -- Client outstanding balance
- `GET /api/client/payment-methods` -- Client payment methods
- `POST /api/tip/create-payment-intent` -- Tip payment
- `POST /api/tip/transfer-tip` -- Tip transfer to sitter
- `POST /api/cron/collect-balances` -- Auto-collect balances
- `POST /api/cron/expire-unpaid` -- Expire unpaid bookings
- `POST /api/cron/weekly-recurring-charge` -- Weekly recurring charges
- `POST /api/ops/invoicing/send-reminders` -- Invoice reminders

**Lib Files:**
- `src/lib/stripe.ts` -- Stripe client + payment link creation
- `src/lib/stripe-connect.ts` -- Connect helpers
- `src/lib/stripe-sync.ts` -- Stripe data sync
- `src/lib/stripe-analytics.ts` -- Payment analytics
- `src/lib/stripe-webhook-persist.ts` -- Webhook event persistence
- `src/lib/payout/` -- Payout engine, queue, summary, sitter payout
- `src/lib/payroll/payroll-service.ts` -- Payroll service
- `src/lib/finance/` -- Ledger, reconciliation, reconcile queue
- `src/lib/outstanding-balance.ts`, `pricing-engine.ts`, `pricing-engine-v1.ts`
- `src/lib/invoicing/` -- Invoice logic

**UI Pages:**
- `/payments`, `/payroll`, `/money`, `/finance`
- `/ops/payouts`, `/ops/finance/reconciliation`
- `/sitter/earnings`
- `/client/billing`
- `/tip/[amount]/[sitter]`, `/tip/payment`, `/tip/success`, `/tip/cancel`

### D. Notifications (SMS, Email, In-App, Queue Jobs)

**API Routes:**
- `GET/PATCH /api/settings/notifications` -- Notification settings
- `POST /api/push/subscribe` -- Push subscription
- `GET/PATCH /api/push/preferences` -- Push preferences
- Automation queue handles all notification delivery

**Lib Files:**
- `src/lib/notifications/triggers.ts` -- 9 trigger events
- `src/lib/notifications/push-dispatch.ts` -- Push notification dispatch
- `src/lib/email.ts`, `src/lib/email-templates.ts`, `src/lib/email-templates/`
- `src/lib/sms-templates.ts`, `src/lib/message-templates.ts`
- `src/lib/automation-queue.ts` -- BullMQ automation queue
- `src/lib/automation-executor.ts` -- Automation execution
- `src/lib/push.ts` -- Web Push via VAPID

### E. Auth (Middleware, Role Enforcement, Org Scoping)

**API Routes:**
- `GET/POST /api/auth/[...nextauth]` -- NextAuth handler
- `POST /api/auth/signup` -- User registration
- `POST /api/auth/forgot-password` -- Password reset request
- `POST /api/auth/reset-password` -- Password reset execution
- `POST /api/auth/change-password` -- Authenticated password change
- `POST /api/auth/logout` -- Logout
- `POST /api/auth/demo-login` -- Demo login

**Lib Files:**
- `src/lib/auth.ts` -- NextAuth configuration
- `src/lib/auth-helpers.ts` -- Session helpers
- `src/lib/auth-client.tsx` -- Client-side auth
- `src/lib/request-context.ts` -- `getRequestContext()` canonical pattern
- `src/lib/rbac.ts` -- Role-based access control
- `src/lib/roles.ts` -- Role definitions
- `src/lib/permissions.ts` -- Permission checks
- `src/lib/protected-routes.ts` -- Protected route list
- `src/lib/public-routes.ts` -- Public route list
- `src/lib/sitter-routes.ts` -- Sitter route list
- `src/lib/client-routes.ts` -- Client route list
- `src/lib/rate-limit.ts` -- Redis-backed rate limiting
- `src/middleware.ts` -- Auth + role + rate limit enforcement

### F. Scheduling (Availability, Calendar, Recurring Visits)

**API Routes:**
- `GET/POST /api/sitter/availability-rules` -- CRUD availability rules
- `GET/PATCH/DELETE /api/sitter/availability-rules/[id]`
- `GET/POST /api/sitter/availability-overrides` -- Date overrides
- `GET/PATCH/DELETE /api/sitter/availability-overrides/[id]`
- `POST /api/sitter/availability/bulk` -- Bulk replace rules
- `GET /api/sitter/availability` -- Current availability
- `POST /api/sitter/block-off` -- Block off time
- `DELETE /api/sitter/block-off/[id]`
- `GET /api/sitter/calendar` -- Sitter calendar
- `GET /api/sitter/calendar/google-events` -- Google events
- `GET /api/assignments` -- Assignment list
- `GET/POST /api/assignments/windows` -- Assignment windows
- `GET /api/assignments/conflicts` -- Assignment conflicts
- `GET /api/ops/recurring-schedules` -- Recurring schedules
- `POST /api/ops/recurring-schedules/[id]/generate` -- Generate bookings
- `POST /api/ops/recurring-schedules/generate-all` -- Generate all
- `POST /api/ops/recurring-schedules/[id]/approve` -- Approve
- `POST /api/ops/recurring-schedules/[id]/generate-invoice` -- Generate invoice
- `GET /api/client/recurring-schedules` -- Client recurring schedules
- `GET /api/integrations/google/start` -- Google OAuth start
- `GET /api/integrations/google/callback` -- Google OAuth callback

**Lib Files:**
- `src/lib/availability/engine.ts` -- Availability computation
- `src/lib/availability/booking-conflict.ts` -- Conflict detection
- `src/lib/calendar/sync.ts` -- Google Calendar sync
- `src/lib/calendar/bidirectional-adapter.ts` -- Bidirectional sync
- `src/lib/calendar-queue.ts`, `calendar-sync.ts` -- Calendar queue
- `src/lib/google-calendar.ts` -- Google Calendar API
- `src/lib/recurring/generate.ts` -- Recurring schedule generation

**UI Pages:**
- `/sitter/availability`, `/sitter/calendar`
- `/calendar`, `/calendar/accounts`
- `/client/recurring`
- `/schedule-grid`, `/assignments`
- `/settings/recurring`

### G. Client Portal (All Client-Facing Surfaces)

**UI Pages (16):**
- `/client/home`, `/client/bookings` (list + [id] + new), `/client/messages` (list + [id])
- `/client/pets` (list + [id] + new), `/client/reports` (list + [id])
- `/client/billing`, `/client/profile`, `/client/recurring`
- `/client/setup`, `/client/support`, `/client/meet-greet`
- `/client/settings/export`

**API Routes (40+):** Full CRUD for bookings, pets, messages, billing, reports, recurring schedules, emergency contacts, loyalty, referral, export, delete account, setup/validate/set-password, onboarding status, quick-rebook, outstanding balance, payment methods, bundles, meet-greet, complaint

**Components:** Only 4 client-specific components (`ClientAtAGlanceSidebar`, `ClientDeployDebugOverlay`, `ClientSwUpdateToast`). Most UI is inline in pages.

### H. Sitter Portal (All Sitter-Facing Surfaces)

**UI Pages (16):**
- `/sitter`, `/sitter/dashboard`, `/sitter/today`, `/sitter/bookings` (list + [id])
- `/sitter/calendar`, `/sitter/earnings`, `/sitter/inbox`, `/sitter/performance`
- `/sitter/availability`, `/sitter/profile`, `/sitter/reports` (list + new + edit/[id])
- `/sitter/training`, `/sitter/onboard`, `/sitter/callout`, `/sitter/pets` (list + [id])

**API Routes (45+):** Full dashboard, bookings (accept/decline, checklist, incident, report), calendar (Google events), availability (rules, overrides, bulk, block-off), earnings, today, Stripe Connect, threads/messages, training, pets (health log), running-late, callout, route/route-history, phone, delete-account, onboard (validate, set-password), SRS (me/srs), completed-jobs, instant-payout, transfers

**Components (35):** Rich component library including DailyDelightModal, SitterDashboardContent, PerformanceSnapshot, TierProgression, SitterSRSCard, OwnerSRSCard, RouteMap, VisitTimerDisplay, etc.

### I. Owner Portal (All Owner-Facing Surfaces)

**UI Pages (40+):** See full list in Section 2 above. Covers dashboard, bookings, calendar, clients, sitters, messaging, command-center, schedule-grid, money, finance, payments, payroll, reports, analytics, automations, settings, growth, integrations, bundles, templates, waitlist, setup, ops (8 sub-pages).

**API Routes:** All `/api/ops/` routes (70+), plus `/api/bookings/`, `/api/clients/`, `/api/sitters/`, `/api/settings/`, `/api/analytics/`, `/api/automations/`, `/api/dispatch/`, `/api/numbers/`, `/api/payroll/`, `/api/payments/`

**Components:** `src/components/owner/` is EMPTY. Owner-facing components are distributed across `app/`, `booking/`, `bookings/`, `messaging/`, `calendar/`, `charts/`. No consolidated owner component library.

### J. Integrations (OpenPhone, Twilio, Stripe, Others)

**OpenPhone:**
- Provider: `src/lib/messaging/providers/openphone.ts`
- Webhook: `POST /api/messages/webhook/openphone`
- Setup UI: `/messaging/openphone-setup`
- Verification: `src/lib/openphone-verify.ts`, `src/lib/openphone.ts`

**Twilio:**
- Provider: `src/lib/messaging/providers/twilio.ts`
- Webhook: `POST /api/messages/webhook/twilio`
- Setup UI: `/messaging/twilio-setup`
- Number management: 10+ `/api/numbers/` routes
- Diagnostics: `POST /api/ops/twilio-setup-diagnostics`

**Stripe:**
- Client: `src/lib/stripe.ts`
- Connect: `src/lib/stripe-connect.ts`, `POST /api/sitter/stripe/connect`
- Webhook: `POST /api/webhooks/stripe`
- Analytics: `src/lib/stripe-analytics.ts`
- Sync: `src/lib/stripe-sync.ts`

**Google Calendar:**
- OAuth: `/api/integrations/google/start`, `/api/integrations/google/callback`
- Sync: `src/lib/calendar/sync.ts`, `src/lib/calendar/bidirectional-adapter.ts`
- Queue: `src/lib/calendar-queue.ts`

**Square:** Stubbed -- `return { configured: false, detail: 'Square integration coming soon' }`

**Integration Status:** `GET /api/integrations/status`, `GET/PATCH /api/settings/integration-stack`

### K. Queue System (BullMQ Jobs, Workers, Retry Logic)

**10 Workers initialized in `src/lib/queue.ts`:**
1. `reminder-scheduler` -- Night-before reminder dispatch (every 15 min)
2. `daily-summary` -- Daily summary at 9 PM
3. `reconciliation` -- Pricing reconciliation at 2 AM
4. `automations` -- Standard priority notification/automation jobs (concurrency 12)
5. `automations.high` -- High priority (bookingConfirmation, ownerNewBookingAlert) (concurrency 8)
6. `messaging-outbound` -- SMS delivery to provider
7. `messaging-thread-activity` -- Debounced thread lastMessageAt updates
8. `calendar-sync` -- Google Calendar upsert/delete/sync
9. `pool-release` -- Phone number pool rotation (every 5 min)
10. `payouts` -- Stripe Connect sitter payouts
11. `finance-reconcile` -- Stripe ledger reconciliation

**Queue Infrastructure:**
- `src/lib/automation-queue.ts` -- Automation queue with priority routing
- `src/lib/queue-observability.ts` -- Worker instrumentation
- `src/lib/queue-registry.ts` -- Queue registry
- `QueueJobRecord` model for persistence
- Health tracking: `workerHealth` object with per-worker status

### L. Reporting/Analytics

**API Routes:**
- `GET /api/analytics/kpis` -- Key performance indicators
- `GET /api/analytics/trends/bookings` -- Booking trends
- `GET /api/analytics/trends/revenue` -- Revenue trends
- `GET /api/analytics/trends/payout-volume` -- Payout trends
- `GET /api/analytics/trends/message-volume` -- Message trends
- `GET /api/analytics/trends/automation-failures` -- Failure trends
- `GET /api/ops/reports/kpis` -- Ops KPIs
- `GET /api/ops/stats` -- Ops stats
- `GET /api/ops/metrics` -- Ops metrics
- `GET /api/ops/analytics/churn-risk` -- Churn risk analysis
- `GET /api/ops/forecast/revenue` -- Revenue forecasting
- `GET /api/ops/predictions` -- AI predictions
- `GET /api/ops/revenue-optimization` -- Revenue optimization

**UI Pages:**
- `/reports`, `/analytics`

**Lib Files:**
- `src/lib/analytics.ts`, `src/lib/analytics/`

### M. Onboarding

**Sitter Onboarding:**
- `POST /api/sitter/onboard/validate` -- Validate invite token
- `POST /api/sitter/onboard/set-password` -- Set password from invite
- `/sitter/onboard` -- Onboarding page (public route)
- `POST /api/ops/sitters/invite` -- Send sitter invite
- `POST /api/ops/sitters/bulk-import` -- Bulk import sitters

**Client Onboarding:**
- `POST /api/client/setup/validate` -- Validate welcome token
- `POST /api/client/setup/set-password` -- Set password
- `/client/setup` -- Client setup page
- `GET /api/client/onboarding-status` -- Status check
- `POST /api/client/onboarding` -- Complete onboarding

**Org Setup:**
- `/setup` -- Org setup wizard
- `POST /api/setup` -- Org setup API

---

## 4. Domain Completion Scores

| Domain | Score | Justification |
|--------|-------|---------------|
| **Bookings** | 88 | Full lifecycle (create, confirm, cancel, reschedule, check-in/out) with API routes, DB queries, UI, and conflict detection. Cancel preview with fee calculation present. Edge cases like idempotency and status history tracked. Smart assign exists. Missing: bulk edit UI, some command palette commands are mocks. |
| **Messaging** | 85 | Extremely deep implementation: 50+ lib files, pluggable providers (Twilio/OpenPhone), anti-poaching, pool routing, masked numbers, conversation lifecycle, outbound queue, rate limiting. Webhooks for both providers. UI has inbox, threads, number management. Gaps: sitter offboarding reassign_to_sitter not implemented, client classification weekly plan check stubbed. |
| **Payments** | 72 | Stripe payment links, webhook handler, mark-paid, refund, payroll runs, Stripe Connect for sitter payouts, payout queue, finance reconciliation, ledger, client billing. Gaps: Square integration stubbed, automation fee/discount application not implemented, client payment method management UI unclear. |
| **Notifications** | 82 | All 9 trigger events wired. 3-channel fallback (SMS -> email -> in-app) implemented. Push notifications via VAPID. Org notification settings. Queue-based delivery with idempotency. Gaps: SRS processing failure alerts TODO, notification preferences UI thin. |
| **Auth** | 85 | Full NextAuth v5 setup. Middleware enforces role-based routing. Rate limiting on auth endpoints. getRequestContext() canonical pattern well-implemented. Public/protected/sitter/client route lists. Password reset flow complete. Gaps: Some edge cases in role fallback logic. |
| **Scheduling** | 78 | Availability rules + overrides API complete. Availability engine works. Booking conflict detection present. Google Calendar bidirectional sync behind feature flag. Recurring schedules with generation. Gaps: availability UI is form-based not Rover-style grid (documented gap in CLAUDE.md), sitter zone assignment not yet explicit. |
| **Client Portal** | 68 | All major pages exist (home, bookings, pets, messages, reports, billing, recurring, profile). API routes comprehensive (40+). Onboarding flow present. Gaps: only 4 client-specific components (most UI inline in pages -- may lack polish), client booking confirmation links disabled, meet-greet flow may be thin, support page unclear depth. |
| **Sitter Portal** | 80 | Rich page set (16 pages). 35 dedicated components. Dashboard, today view, check-in/out, reports, earnings, calendar, performance/SRS, availability, training, onboarding all present. Gaps: tier progression UI "coming soon", availability UI not Rover-style grid. |
| **Owner Portal** | 78 | Most extensive surface (40+ pages). Command center, schedule grid, messaging inbox, analytics, settings. Ops tools (diagnostics, failures, payouts, AI). Gaps: `src/components/owner/` is EMPTY (no dedicated owner components), command palette commands are mostly mocks (8 mock implementations), bulk actions in AppTable are stubbed. |
| **Integrations** | 75 | Twilio + OpenPhone + Stripe + Google Calendar all have real implementations. Pluggable provider pattern is solid. Integration status/stack management exists. Gaps: Square "coming soon", integration testing UI exists but unclear depth. |
| **Queue System** | 90 | 10+ workers with independent initialization. Exponential backoff, retry logic, idempotency keys, dead letter logging. Queue observability instrumentation. Health tracking per worker. Solid implementation. |
| **Reporting/Analytics** | 65 | KPI and trend routes exist for bookings, revenue, payouts, messages, automation failures. Churn risk, revenue forecasting, revenue optimization routes present. Gaps: unclear how deep the data aggregation actually goes, analytics page UI may be thin. |
| **Onboarding** | 75 | Sitter invite -> validate -> set-password flow complete. Client setup flow exists. Org setup wizard present. Onboarding checklist component exists. Gaps: onboarding UX polish unclear, bulk client onboarding unclear. |

---

## 5. Stubs, TODOs, and Placeholders

### TODOs (7 instances)
| File | Line | Content |
|------|------|---------|
| `src/components/messaging/NumbersPanelContent.tsx` | 1045 | `// TODO: Implement release from Twilio` |
| `src/lib/automation-engine.ts` | 155 | `// TODO: Implement fee application` |
| `src/lib/automation-engine.ts` | 161 | `// TODO: Implement discount application` |
| `src/lib/tiers/message-srs-bridge.ts` | 85 | `// TODO: Create alert/audit event for SRS processing failures` |
| `src/lib/messaging/client-classification.ts` | 77 | `// TODO: Implement when recurrence system is added` |
| `src/lib/messaging/client-classification.ts` | 115 | `// TODO: Implement weekly plan check when weekly plan system is added` |

### Mock Implementations (11 instances)
| File | Line | Content |
|------|------|---------|
| `src/commands/commands.tsx` | 177 | `// Mock implementation - replace with actual API call` (send confirmation) |
| `src/commands/commands.tsx` | 214 | `// Mock implementation - replace with actual API call` (collect payment) |
| `src/commands/commands.tsx` | 254 | `// Mock implementation - replace with actual API call` (assign sitter) |
| `src/commands/commands.tsx` | 291 | `// Mock implementation - replace with actual API call` (cancel booking) |
| `src/commands/commands.tsx` | 364 | `// Mock implementation - replace with actual API call` (mark paid) |
| `src/commands/commands.tsx` | 432 | `// Mock implementation - replace with actual navigation` |
| `src/commands/commands.tsx` | 470 | `// Mock implementation - dark mode not yet implemented` |
| `src/commands/booking-commands.tsx` | 40 | `// Mock implementation - replace with actual API call` |
| `src/commands/calendar-commands.tsx` | 235 | `// Mock implementation - open messaging UI` |

### Coming Soon / Not Implemented (8 instances)
| File | Line | Content |
|------|------|---------|
| `src/commands/commands.tsx` | 474 | `Dark mode toggle (coming soon)` |
| `src/components/sitter/PerformanceSnapshot.tsx` | 101 | `Tier progression logic coming soon` |
| `src/components/messaging/NumbersPanelContent.tsx` | 1046 | `alert('Release from Twilio not yet implemented')` |
| `src/app/api/settings/integration-stack/route.ts` | 112 | `Square integration coming soon` |
| `src/lib/automation-engine.ts` | 156-157 | `Fee application not yet implemented` |
| `src/lib/automation-engine.ts` | 162-163 | `Discount application not yet implemented` |
| `src/lib/messaging/sitter-offboarding.ts` | 170 | `reassign_to_sitter strategy not yet implemented` |
| `src/lib/messaging/client-classification.ts` | 106 | `Weekly plan system not yet implemented in schema` |

### Stubs (3 instances)
| File | Line | Content |
|------|------|---------|
| `src/components/layout/AppShell.tsx` | 315 | `Global search stub - opens Command Palette` |
| `src/components/app/BulkActionsConfirmModal.tsx` | 65 | `This action will apply to the selected items. (Stub -- no backend.)` |
| `src/components/app/AppTable.tsx` | 27 | `Bulk actions (Assign / Message / Export) - stubbed` |

---

## 6. Critical Path — Top 10 for Shippable Product

### 1. Wire Command Palette to Real APIs (Impact: HIGH)
8 mock implementations in `src/commands/commands.tsx` and related files. The command palette shows users actions they can "take" but none actually work. Every mock `setTimeout(500)` must be replaced with real API calls. This is a P0 "dead end" per CLAUDE.md rules.

### 2. Client Portal Polish and Completeness (Impact: HIGH)
Only 4 dedicated client components. Most client pages likely have inline UI that lacks the polish of the sitter portal (35 components). Client booking confirmation links are DISABLED. The client portal is the revenue-facing surface -- paying customers use it. Must have loading states, error states, empty states, mobile layout at 375px.

### 3. Implement Fee and Discount Automation Actions (Impact: HIGH)
`executeApplyFee()` and `executeApplyDiscount()` in `src/lib/automation-engine.ts` return `{ success: false }`. This means any automation rule that applies fees (late cancellation, same-day booking surcharge) or discounts (loyalty, multi-pet) silently fails. Revenue leakage.

### 4. Owner Portal Component Consolidation (Impact: MEDIUM-HIGH)
`src/components/owner/` is EMPTY. Owner-facing UI is scattered across `app/`, `booking/`, `bookings/`, `messaging/`, `calendar/`, `charts/`. No consistent component patterns means inconsistent UX across the owner portal.

### 5. Availability UI (Rover-Style Grid) (Impact: MEDIUM-HIGH)
CLAUDE.md explicitly states the availability UI must be a visual weekly grid (Rover-style), not a form. Current implementation is form-based. This is a key competitive differentiator and first-impression UX for sitter onboarding. Documented as Agent 21 job.

### 6. Bulk Actions Implementation (Impact: MEDIUM)
AppTable bulk actions (Assign / Message / Export) are stubbed. `BulkActionsConfirmModal` says "Stub -- no backend." For an owner managing 50+ bookings, bulk operations are essential daily workflow. Must connect to real APIs.

### 7. Sitter Tier Progression UI (Impact: MEDIUM)
PerformanceSnapshot shows "Tier progression logic coming soon." The SRS engine is complete, tier rules are complete, but sitters cannot see their path to advance. This is a key retention/motivation feature.

### 8. Release Number from Twilio (Impact: MEDIUM)
NumbersPanelContent has `alert('Release from Twilio not yet implemented')`. Owners cannot release numbers they no longer need. Cost leak -- they keep paying Twilio for unused numbers.

### 9. A2P 10DLC Campaign Fix (Impact: HIGH for SMS)
Campaign was rejected by Twilio. Three specific fixes documented in CLAUDE.md: production consent URL, fix Terms URL typo ("tearms-and-conditions"), fix opt-in keyword ("SUBSCIBE" -> "SUBSCRIBE"). Without this, no production SMS messaging.

### 10. Dark Mode (Impact: LOW-MEDIUM)
Stubbed throughout. CLAUDE.md design system requires every component to work in dark mode. ThemeToggle component exists but dark mode itself is not implemented. Low priority for MVP but a design system violation.

---

## HANDOFF NOTE -- Agent 00 -> Agents 01-07
Timestamp: 2026-03-29T10:15:00Z

### What I Did
- Read CLAUDE.md in full (927 lines) -- extracted all architecture patterns, constraints, known bugs, and completion status
- Mapped complete directory tree: 28 API route domains, 40+ lib modules, 16 component directories, 106 Prisma models, 40+ migrations
- Identified and mapped all 13 feature domains with every contributing file
- Scored each domain 0-100 with justification
- Found all 29 stubs/TODOs/placeholders/mocks across the codebase
- Ranked top 10 critical path items for shippability

### Top Findings
1. **106 Prisma models** with 40+ migrations -- the schema is extensive and mature
2. **10 BullMQ workers** with independent health tracking -- queue system is the strongest domain (90/100)
3. **50+ messaging lib files** -- messaging is by far the most deeply implemented subsystem
4. **8 mock command palette actions** -- every command palette action is a fake setTimeout, making the power-user feature entirely non-functional
5. **`src/components/owner/` is EMPTY** -- no dedicated owner components despite 40+ owner pages
6. **Fee/discount automation silently fails** -- `executeApplyFee()` and `executeApplyDiscount()` return `{ success: false }` with no actual implementation
7. **Client portal has only 4 dedicated components** vs sitter portal's 35 -- significant UX depth imbalance
8. **Availability UI is form-based, not Rover-style grid** -- explicitly flagged in CLAUDE.md as a gap
9. **A2P 10DLC campaign rejected** -- production SMS blocked until 3 specific fixes are applied
10. **Personal Mode is the active deployment** -- single-org (Snout), all multi-tenant code exists but is not the primary testing surface

### Key Architecture Constraints for All Agents
- NEVER send messages outside `sendThreadMessage()` in `src/lib/messaging/send.ts`
- NEVER query without `orgId` in WHERE clause
- NEVER get `orgId` from request params -- always from `getRequestContext()`
- NEVER use `$transaction` callback form -- use array form
- NEVER fire notification triggers before `clientId` is set on booking
- Every UI surface must have: loading state, error state, empty state, mobile layout at 375px
- Use Lucide React icons ONLY
- Use design tokens ONLY (no hardcoded hex)

### Ready For
Agents 01-07 can now run in parallel. Each reads:
- `/CLAUDE.md`
- `/agents/outputs/00-SYSTEM-STATE.md` (this file)
- Their specific agent prompt from `/snout-agents/tier-1-audit/01-07-audit-agents.md`

### Agent Assignments Based on Findings
- **Agent 01 (Cartographer):** Focus on the empty `src/components/owner/` directory and scattered owner components
- **Agent 02 (Schema Auditor):** 106 models, 40+ migrations -- verify all fields have migrations, check for orphaned models
- **Agent 03 (Auth Boundary Auditor):** Verify all 28 API domains use `getRequestContext()`, check role enforcement on every route
- **Agent 04 (Type Safety Auditor):** Multiple `as any` casts in triggers.ts, check all `(prisma as any)` patterns
- **Agent 05 (Error Boundary Auditor):** Check loading/error/empty states across all 90+ pages
- **Agent 06 (Performance Auditor):** 106 models with indexes -- verify index coverage, check N+1 patterns
- **Agent 07 (Observability Auditor):** Queue health tracking, Sentry integration, correlation IDs

### Blockers
- [ ] None -- cleared to proceed
