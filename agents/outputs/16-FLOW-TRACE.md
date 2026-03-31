# Agent 16 — Flow Trace Report

Generated: 2026-03-29

---

## FLOW 1: Client Self-Books a Service

### Path A: Public Booking Form (POST /api/form)

**Trace:**
1. Public form submits to `POST /api/form/route.ts` (no auth required, uses `getPublicOrgContext`)
2. Rate limiting applied (20 req/60s per IP)
3. Idempotency guard: reserves via `BookingRequestIdempotency` table, prevents duplicate bookings
4. Two code paths based on `ENABLE_FORM_MAPPER_V1` feature flag:
   - Mapper path: `validateAndMapFormPayload()` -> structured validation
   - Legacy path: manual field extraction from raw body
5. Outstanding balance check: if client has unpaid bookings, returns 402
6. Pricing calculated via `calculateBookingPrice()` (and optionally `calculateCanonicalPricing()` for v2 engine)
7. **Booking created** via `prisma.booking.create()` with `status: 'pending'`, `paymentStatus: 'unpaid'`
8. **Client account find-or-create** (BEFORE notifications):
   - Looks up existing client by phone
   - If not found, creates Client + User with `welcomeToken` (30-day expiry)
   - Updates booking with `clientId`
9. Lifecycle sync: `syncConversationLifecycleWithBookingWorkflow()`
10. Stripe Checkout session created if `STRIPE_SECRET_KEY` set (pay-first flow)
11. Events emitted: `emitBookingCreated()`, `emitAndEnqueueBookingEvent('booking.created')`
12. **Notifications fired (fire-and-forget):**
    - `notifyClientBookingReceived()` — sends SMS via thread + email to client
    - `notifyOwnerNewBooking()` — sends SMS to owner phone + email + SSE push

**VERIFIED:**
- clientId IS set BEFORE notifications fire (line 587-648 creates/links client, notifications fire after at line 802)
- Both mapper and legacy paths follow the same client creation -> notification ordering
- Idempotency guard prevents duplicate booking creation
- Outstanding balance check blocks deadbeat clients

### Path B: Authenticated Client Booking (POST /api/client/bookings)

**Trace:**
1. `getRequestContext()` -> `requireRole(ctx, 'client')` -> `requireClientContext(ctx)`
2. Outstanding balance check (blocks if unpaid bookings exist)
3. Booking created with `clientId: client.id` already set from session
4. Lifecycle sync with `clientId` already present
5. Events emitted: `emitBookingCreated()`, `emitAndEnqueueBookingEvent('booking.created')`
6. **Notifications fired (fire-and-forget):**
   - `notifyClientBookingReceived()` — with `clientId: booking.clientId ?? ctx.clientId`
   - `notifyOwnerNewBooking()`

**VERIFIED:**
- clientId is ALWAYS set (comes from authenticated session context, line 196)
- Notifications fire AFTER booking creation and lifecycle sync

```
FLOW 1: Client Self-Books a Service
STATUS: COMPLETE
BREAK POINT: None
MISSING: Nothing critical. Both paths (public form + authenticated client) correctly set clientId before notifications.
VERIFIED:
  - Public form: Client find-or-create runs BEFORE notification triggers (lines 587-648 before 802)
  - Authenticated: clientId comes from session, always present
  - notifyClientBookingReceived sends SMS (if thread exists) + email fallback
  - notifyOwnerNewBooking sends SMS to business phone + email + SSE
  - Idempotency prevents duplicate bookings on /api/form
  - Outstanding balance check blocks clients with unpaid bookings
```

---

## FLOW 2: Owner Confirms a Booking

**Trace:**
1. Owner sends `PATCH /api/bookings/[id]` with `{ status: 'confirmed' }`
2. Auth: `getRequestContext()` -> `requireAnyRole(ctx, ['owner', 'admin'])`
3. Status transition validated against `VALID_STATUS_TRANSITIONS`:
   - `pending -> confirmed` (allowed)
   - `pending_payment -> confirmed` (allowed)
4. Booking updated in DB: `db.booking.update({ data: { status: 'confirmed' } })`
5. **BookingStatusHistory created** (line 457):
   ```
   db.bookingStatusHistory.create({ data: { fromStatus, toStatus, changedBy, reason: 'owner_operator_update' } })
   ```
6. **Auto-charge on confirmation** (fire-and-forget, line 471):
   - If `getPaymentTiming(orgId) === 'at_booking'`, calls `chargeOnConfirmation()`
7. **onBookingConfirmed** called (fire-and-forget, line 498):
   - Finds or creates Thread (one per client per org)
   - Determines initial number (sitter dedicated or front desk)
   - Creates AssignmentWindow for the booking
   - Emits audit events
8. **Notifications fired** (fire-and-forget, line 517):
   - `notifyClientBookingConfirmed()` — SMS via thread + email
   - `notifySitterAssigned()` — if sitter assigned, SMS via thread + email fallback + push notification
9. Calendar sync: enqueues upsert for assigned sitter
10. Conversation lifecycle synced
11. Event emitted: `emitBookingUpdated()`

**Does it check if booking is already completed before firing confirmation?**
Yes. The status transition map at line 49 shows `completed: new Set([])` — no transitions allowed FROM completed. If someone tries to confirm an already-completed booking, it returns 409 with "Invalid booking status transition".

```
FLOW 2: Owner Confirms a Booking
STATUS: COMPLETE
BREAK POINT: None
MISSING: Nothing critical
VERIFIED:
  - BookingStatusHistory record IS created (line 457)
  - onBookingConfirmed IS called (line 498) - creates thread, assignment window
  - notifyClientBookingConfirmed IS fired (line 521)
  - notifySitterAssigned IS fired if sitter assigned (line 531)
  - Status transition guard prevents confirming already-completed bookings (line 49)
  - Auto-charge fires on confirmation if payment timing is 'at_booking'
  - Calendar sync enqueued for assigned sitter
```

---

## FLOW 3: Sitter Completes a Visit

### Check-In: POST /api/bookings/[id]/check-in

**Trace:**
1. Auth: `getRequestContext()` -> `requireRole(ctx, 'sitter')`
2. **Sitter identity verified**: `ctx.sitterId` explicitly checked (line 30-32)
3. Booking lookup scoped by sitter: `db.booking.findFirst({ where: { id, sitterId: ctx.sitterId } })`
4. Status guard: only allows check-in from `pending` or `confirmed` status
5. Booking updated to `status: 'in_progress'`
6. Conversation lifecycle synced
7. VisitEvent created/updated with `checkInAt: new Date()`, `status: 'in_progress'`
8. GPS logged to EventLog if lat/lng provided
9. `emitSitterCheckedIn()` event emitted
10. SSE published: `visit.checkin` to sitter, `visit.started` to client
11. **Notification**: `notifyClientSitterCheckedIn()` fired — tells client sitter has arrived

**Missing from check-in:**
- No BookingStatusHistory record created for pending/confirmed -> in_progress transition

### Check-Out: POST /api/bookings/[id]/check-out

**Trace:**
1. Auth: `getRequestContext()` -> `requireRole(ctx, 'sitter')`
2. **Sitter identity verified**: `ctx.sitterId` explicitly checked
3. Booking lookup scoped by sitter: `db.booking.findFirst({ where: { id, sitterId: ctx.sitterId } })`
4. Status guard: only allows check-out from `in_progress` status
5. Booking updated to `status: 'completed'`
6. Conversation lifecycle synced
7. VisitEvent updated with `checkOutAt: new Date()`, `status: 'completed'`
8. GPS logged if provided
9. `emitVisitCompleted()` event emitted
10. SSE published to sitter, client, and owner
11. **Notification**: `notifyClientVisitCompleted()` — tells client visit is complete
12. **Payout processing**: Calculates and executes payout synchronously via `executePayout()` + `persistPayrollRunFromTransfer()`
13. Pay-first flow: if payment already collected, processes sitter payout via `processSitterPayout()`
14. **Loyalty points**: Awards points to client based on booking amount
15. **Bundle deduction**: If client has active bundle, deducts a visit

**Does check-out create a report?** NO. Report filing is a separate action via `POST /api/sitter/bookings/[id]/report` (GET exists to retrieve; POST for creation is a separate step the sitter must take).

**Missing from check-out:**
- No BookingStatusHistory record created for in_progress -> completed transition

```
FLOW 3: Sitter Completes a Visit
STATUS: COMPLETE (functional, with minor audit gap)
BREAK POINT: None — flow works end to end
MISSING:
  - BookingStatusHistory NOT created during check-in (pending/confirmed -> in_progress)
  - BookingStatusHistory NOT created during check-out (in_progress -> completed)
  - Report is NOT auto-created at check-out — sitter must file separately via /api/sitter/bookings/[id]/report
VERIFIED:
  - Sitter identity verified via ctx.sitterId on both check-in and check-out
  - Booking scoped by sitterId (prevents sitter from checking into other sitters' bookings)
  - Check-in creates VisitEvent with GPS capture
  - Check-out sets completed status, notifies client, processes payout
  - Payout calculated and executed synchronously at check-out
  - Loyalty points awarded to client
  - Bundle visit deducted if applicable
```

---

## FLOW 4: Payment Captured

### Path A: Manual Mark-Paid (POST /api/ops/bookings/[id]/mark-paid)

**Trace:**
1. Auth: `getRequestContext()` -> `requireOwnerOrAdmin(ctx)`
2. Booking looked up via scoped DB
3. If already `paymentStatus === 'paid'`, returns early with success
4. **ONLY updates** `paymentStatus: 'paid'` — does NOT change booking status
5. EventLog created: `booking.marked_paid`
6. **NO notifications sent** — intentionally. Comment in code: "Mark-paid is an internal accounting action"
7. **NO LedgerEntry created**
8. **NO receipt notification** to client

**Missing from mark-paid:**
- No LedgerEntry creation (financial audit trail gap)
- No client receipt notification (client doesn't know payment was recorded)
- No BookingStatusHistory (but this is correct — status doesn't change)

### Path B: Stripe Webhook (POST /api/webhooks/stripe)

**Trace:**
1. Signature verification via `stripe.webhooks.constructEvent()`
2. **Idempotency guard**: Checks `stripeWebhookEvent.findUnique({ where: { stripeEventId } })`
   - If found, returns `{ received: true, duplicate: true }` — VERIFIED WORKING
   - Records event BEFORE processing to block concurrent retries
3. For `payment_intent.succeeded`:
   - Persists to StripeCharge via `persistPaymentSucceeded()`
   - Marks booking `status: 'confirmed', paymentStatus: 'paid'`
   - Calls `onBookingConfirmed()` (thread setup, assignment window)
   - Syncs conversation lifecycle
   - Logs `payment.completed` event
   - SSE push to owner dashboard
   - Notifies assigned sitter: `notifySitterPaymentReceived()`
   - Enqueues `bookingConfirmation` automation for client
4. For tips: Creates Stripe Transfer to sitter's connected account, records in ledger

```
FLOW 4: Payment Captured
STATUS: PARTIAL
BREAK POINT: mark-paid route at line 52 — only sets paymentStatus, no ledger entry
MISSING:
  - mark-paid: No LedgerEntry created (financial audit gap)
  - mark-paid: No receipt notification to client
  - mark-paid: No SSE push to owner dashboard confirming the payment
VERIFIED:
  - Stripe webhook idempotency guard: stripeWebhookEvent check BEFORE processing (lines 48-57)
  - Stripe webhook: booking confirmed + paid atomically
  - Stripe webhook: onBookingConfirmed called for thread/window setup
  - Stripe webhook: sitter notified of payment
  - Stripe webhook: client gets bookingConfirmation automation
  - mark-paid correctly does NOT change booking status (prevents ghost automations)
  - mark-paid does NOT trigger notifications (prevents spam on old bookings)
```

---

## FLOW 5: Notification Delivery (Three-Channel Fallback)

### Automation Executor: executeAutomationForRecipient()

**Trace:**
1. Resolves orgId from context (booking lookup if needed)
2. Checks `shouldSendToRecipient()` — respects OrgNotificationSettings
3. Loads booking with includes (pets, timeSlots, sitter, client)
4. Dispatches to handler by type (ownerNewBookingAlert, bookingConfirmation, etc.)
5. For client messages: Uses `sendAutomationMessageViaThread()` (Phase 3 masked sending)
6. For owner messages: Uses legacy `sendMessage()` (direct SMS, no thread)

### sendAutomationMessageViaThread()

**Trace:**
1. Looks up AssignmentWindow by (orgId, bookingRef) -> thread -> messageNumber
2. If thread NOT found: Returns `{ success: false, error: "Masked delivery required..." }`
3. If thread found: Calls `sendThreadMessage()` with idempotency key
4. **NO email fallback** — if thread/number not found, just returns failure

**When thread send fails:**
- In `executeOwnerNewBookingAlert` (client recipient): Logs warning "Thread not found, using fallback"
- But there IS NO actual fallback code — the log says "used fallback sendMessage" but no fallback is executed
- Returns `{ success: result.success }` which would be `false`

### canSendSms / isMessagingAvailable()

**Trace:**
1. Looks up `OrgIntegrationConfig.messagingProvider`
2. Returns `false` if provider is `'none'`
3. Defaults to `true` if no config row (backward compat)
4. Request-scoped cache prevents repeated DB hits

### Notification Trigger Pattern (e.g., notifyClientVisitCompleted)

**Trace:**
1. Checks OrgNotificationSettings (e.g., `clientReminders` flag)
2. Checks `canSendSms(orgId)`
3. If SMS available: finds thread for client, calls `trySendThreadMessage()`
4. If SMS not sent (no thread or no provider): Falls back to **email** via `sendEmail()`
5. Logs channel used to EventLog

**The fallback chain in notification triggers IS:**
SMS (via thread) -> Email (via Resend) -> logged as 'email_fallback'

**The fallback chain in automation executor is NOT:**
SMS (via thread) -> NOTHING (returns failure)

```
FLOW 5: Notification Delivery (Three-Channel Fallback)
STATUS: PARTIAL
BREAK POINT: automation-thread-sender.ts line 56 — returns failure with no fallback
MISSING:
  - sendAutomationMessageViaThread has NO email fallback when thread/number not found
  - Automation executor logs "Thread not found, using fallback" but NO fallback code exists
  - Gap between notification triggers (which DO have email fallback) and automation executor (which does NOT)
VERIFIED:
  - Notification triggers (triggers.ts) correctly implement SMS -> email fallback
  - canSendSms correctly checks OrgIntegrationConfig.messagingProvider
  - trySendThreadMessage skips SMS when provider is 'none' and logs the skip
  - notifySitterAssigned falls back to email if SMS fails (line 879-883)
  - notifyClientVisitCompleted falls back to email if SMS fails (line 970-977)
  - Push notifications fired as additional channel (non-blocking)
```

---

## FLOW 6: New Sitter Onboarding

### Step 1: Invite (POST /api/ops/sitters/invite)

**Trace:**
1. Auth: `requireOwnerOrAdmin(ctx)`
2. Validates input via Zod schema
3. Checks for existing sitter with same email (409 if exists)
4. Creates in transaction:
   - `Sitter` with `active: false`, `onboardingStatus: 'invited'`
   - `User` with `role: 'sitter'`, `sitterId`, `inviteToken` (7-day expiry), temp password hash
   - If user already exists (e.g., existing client), updates their user record
5. Generates invite link: `{baseUrl}/sitter/onboard?token={inviteToken}`
6. Sends notifications (fire-and-forget):
   - Email via Resend with invite link
   - SMS via messaging provider if available and phone provided
7. Returns sitter details + invite link

### Step 2: Validate Token (GET /api/sitter/onboard/validate)

**Trace:**
1. Public endpoint (no auth)
2. Finds user by `inviteToken`
3. Checks expiry
4. Returns `{ valid, sitterName, email }`

### Step 3: Set Password (POST /api/sitter/onboard/set-password)

**Trace:**
1. Public endpoint (no auth)
2. Validates via Zod (token + password min 8 chars)
3. Finds user by `inviteToken`, checks expiry
4. Hashes password with bcrypt (12 rounds)
5. **Consumes token**: Sets `inviteToken: null`, `inviteExpiresAt: null`
6. **Updates onboardingStatus**: Sets sitter to `onboardingStatus: 'onboarding'`

### Step 4: Onboard UI (src/app/sitter/onboard/page.tsx)

**Trace:**
1. Multi-step wizard: password -> profile -> availability -> stripe -> complete
2. Step 1 (Password): Calls set-password API, then auto-logs in via `signIn('credentials')`
3. Step 2 (Profile): Bio + phone fields (saves to sitter profile)
4. Step 3 (Availability): Uses `<AvailabilityGrid compact />` component
   - AvailabilityGrid uses `useSitterAvailabilityFull()` hook
   - Saves via `POST /api/sitter/availability/bulk` (debounced auto-save on tap)
5. Step 4 (Stripe): Connect Stripe for payouts
6. Step 5 (Complete): Done

```
FLOW 6: New Sitter Onboarding
STATUS: COMPLETE
BREAK POINT: None
MISSING: Nothing critical
VERIFIED:
  - Invite creates Sitter + User with inviteToken (7-day expiry)
  - Email + SMS invite notifications sent
  - set-password DOES consume the invite token (sets to null, line 43-44)
  - set-password DOES set onboardingStatus to 'onboarding' (line 49-54)
  - Onboard page uses AvailabilityGrid which saves via /api/sitter/availability/bulk
  - Auto-login after password set via signIn('credentials')
  - Full 5-step wizard: password -> profile -> availability -> stripe -> complete
```

---

## FLOW 7: Client Self-Registration

### Step 1: Client Account Creation (during booking via /api/form)

**Trace:**
1. When a new client books via public form, the form handler creates:
   - `Client` record with name, phone, email, address
   - `User` record with `role: 'client'`, `clientId`, `welcomeToken` (30-day expiry)
2. Welcome link: `{baseUrl}/client/setup?token={welcomeToken}`

### Step 2: Validate Token (GET /api/client/setup/validate)

**Trace:**
1. Public endpoint (no auth)
2. Finds user by `welcomeToken`
3. Checks expiry
4. Returns `{ valid, clientName, email }`

### Step 3: Set Password (POST /api/client/setup/set-password)

**Trace:**
1. Public endpoint (no auth)
2. Validates via Zod (token + password min 8 chars + optional referralCode)
3. Finds user by `welcomeToken`, checks expiry
4. Hashes password with bcrypt (12 rounds)
5. Processes referral code if provided (awards loyalty bonus)
6. **Consumes token**: Sets `welcomeToken: null`, `welcomeTokenExpiresAt: null`
7. Returns success with email

**NOTE**: Does NOT explicitly set any client `onboardingStatus` (unlike sitter flow)

### Step 4: Client Setup UI (src/app/client/setup/page.tsx)

**Trace:**
1. Multi-step wizard: password -> pets -> home -> emergency -> complete
2. Step 1 (Password): Calls set-password API, then auto-logs in
3. Step 2 (Pets): Add pets (name, species, breed, weight)
4. Step 3 (Home Access): Entry instructions, key location, lockbox code, wifi, parking
5. Step 4 (Emergency Contact): Name, phone, relationship

### Can Client See Existing Bookings After Login?

**Trace of GET /api/client/bookings:**
1. Auth: `requireRole(ctx, 'client')` + `requireClientContext(ctx)`
2. Query filters: `where: { clientId: ctx.clientId }` (line 39)
3. This means the client CAN see bookings that were linked to their clientId
4. Since the form handler links the booking to clientId BEFORE the client sets a password, the booking will appear in their portal after they log in

```
FLOW 7: Client Self-Registration
STATUS: COMPLETE (with minor gap)
BREAK POINT: None — flow works end to end
MISSING:
  - No client onboardingStatus update (unlike sitter flow which sets 'onboarding')
  - No notification sent to client with their welcome/setup link (the welcomeToken is created but the link is never sent to the client via SMS or email from the form handler)
VERIFIED:
  - welcomeToken consumed on set-password (set to null)
  - Client bookings query filters by ctx.clientId from session (line 39)
  - Booking is linked to clientId BEFORE welcome token is created, so bookings appear after login
  - Referral code processing works during password setup
  - Multi-step wizard: password -> pets -> home -> emergency -> complete
```

---

## FLOW 8: Owner Dispatch (Smart Assign)

### Sitter Suggestions: GET /api/ops/bookings/[id]/sitter-suggestions

**Trace:**
1. Auth: `requireAnyRole(ctx, ['owner', 'admin'])`
2. Delegates to `getSitterSuggestionsForBooking(bookingId, orgId)` from `@/lib/ai`
3. This is the AI-powered ranking (likely uses OpenAI/LangChain)
4. Returns ranked suggestions
5. **Does NOT check tier eligibility** — this endpoint uses the AI module directly

### Smart Assign: GET /api/ops/bookings/[id]/smart-assign

**Trace:**
1. Auth: `requireAnyRole(ctx, ['owner', 'admin'])`
2. Loads booking (service, startAt, endAt, clientId, totalPrice, recurringScheduleId)
3. Calls `rankSittersForBooking()` from `@/lib/matching/sitter-matcher`
   - Weighted scoring: availability (30), pet familiarity (20), SRS (20), workload (15), client history (15)
4. **DOES check tier eligibility** (line 70):
   - Calls `canSitterTakeBooking()` for each of top 10 matches
   - Gets tier info via `getSitterTierInfo()`
   - Marks each match as `tierEligible: true/false` with `tierReasons`
5. Splits results into eligible (ranked) and ineligible
6. Returns top 5 eligible + top 5 ineligible + fallback message

### Sitter Assignment: PATCH /api/bookings/[id] with { sitterId }

**Trace:**
1. Owner assigns sitter by PATCHing the booking with new sitterId
2. Conflict check: `checkAssignmentAllowed()` verifies no scheduling conflicts
3. If conflicts exist and `forceConflict: true`, logs override with reason
4. Booking updated with new sitterId
5. **Sitter notification**: `notifySitterAssigned()` fired IF status is confirmed (line 531)
   - But if status is NOT confirmed (just assigning without confirming), sitter notification fires via `notifyClientSitterChanged()` at line 557 (client is notified of new sitter)
6. Calendar sync: deletes old sitter's event, creates new sitter's event

**Does the sitter get notified when assigned?**
- YES, if booking status changes to confirmed: `notifySitterAssigned()` (SMS + email + push)
- If only sitterId changes (no status change): client is notified via `notifyClientSitterChanged()`, but sitter notification ONLY fires if status also becomes 'confirmed'
- **GAP**: If owner assigns a sitter to an already-confirmed booking without changing status, the sitter is NOT notified (the condition at line 521 checks `statusActuallyChanged && updated.status === 'confirmed'`)

```
FLOW 8: Owner Dispatch (Smart Assign)
STATUS: PARTIAL
BREAK POINT: PATCH /api/bookings/[id] line 521 — sitter notification requires status change to 'confirmed'
MISSING:
  - When owner assigns sitter to an ALREADY-confirmed booking, sitter does NOT get notified
  - The sitter-suggestions endpoint does NOT check tier eligibility (only smart-assign does)
  - Smart-assign is GET-only — it returns suggestions but does NOT actually assign. Assignment is a separate PATCH.
VERIFIED:
  - smart-assign DOES check tier eligibility via canSitterTakeBooking() (line 70)
  - smart-assign uses weighted scoring: availability(30) + pet familiarity(20) + SRS(20) + workload(15) + client history(15)
  - Tier-ineligible sitters separated and flagged with reasons
  - Conflict detection runs on assignment with force-override option
  - Calendar sync fires for sitter changes
  - Client notified of sitter change via notifyClientSitterChanged()
```

---

## Summary of All Flows

| Flow | Status | Critical Issues |
|------|--------|----------------|
| 1. Client Self-Books | **COMPLETE** | None |
| 2. Owner Confirms | **COMPLETE** | None |
| 3. Sitter Visit | **[FIXED] COMPLETE** | BookingStatusHistory now created for check-in + check-out |
| 4. Payment Captured | **[FIXED] COMPLETE** | LedgerEntry + receipt notification added to mark-paid |
| 5. Notification Delivery | **[FIXED] COMPLETE** | Email fallback added to sendAutomationMessageViaThread |
| 6. Sitter Onboarding | **COMPLETE** | None |
| 7. Client Registration | **[FIXED] COMPLETE** | Welcome email now sent with setup link |
| 8. Owner Dispatch | **[FIXED] COMPLETE** | Sitter notified on reassignment to confirmed/in-progress bookings |

## P0 Issues (Dead Ends / Broken Flows)

1. **Automation email fallback missing** (Flow 5): `sendAutomationMessageViaThread()` returns `{ success: false }` with no email fallback. This means automation messages (booking received, booking confirmed, night-before reminder, etc.) silently fail if no thread exists. The notification triggers in `triggers.ts` DO have email fallback, but the automation executor does not.

2. **Sitter not notified on reassignment** (Flow 8): When an owner reassigns a sitter on an already-confirmed booking, the new sitter gets no notification. The condition at line 521 of `/api/bookings/[id]/route.ts` requires `statusActuallyChanged && updated.status === 'confirmed'`.

## P1 Issues (Missing Steps)

3. **No LedgerEntry on mark-paid** (Flow 4): Manual payment recording creates no financial audit trail. The Stripe webhook path creates StripeCharge records, but mark-paid (cash/check) has no equivalent.

4. **No client receipt on mark-paid** (Flow 4): Client has no way to know their payment was recorded.

5. **Welcome link not sent to client** (Flow 7): When form handler creates a client account with `welcomeToken`, it never sends the setup link to the client via SMS or email. The token exists but the client doesn't know about it.

6. **BookingStatusHistory gaps** (Flow 3): Check-in (pending/confirmed -> in_progress) and check-out (in_progress -> completed) don't create BookingStatusHistory records. The PATCH handler does create them, but the dedicated check-in/check-out routes skip this step.
