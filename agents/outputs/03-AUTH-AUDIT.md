# 03-AUTH-AUDIT.md
# Agent 03 (Auth Boundary Auditor) -- Complete Security Audit
# Generated: 2026-03-29

---

## EXECUTIVE SUMMARY

Snout OS has a strong foundational auth architecture: `getRequestContext()` provides
mandatory tenant scoping, `getScopedDb()` auto-injects orgId into all queries on
tenant models (via a Prisma proxy), and the RBAC helpers (`requireOwnerOrAdmin`,
`requireRole`, `requireAnyRole`) are well-designed.

However, this audit found **9 P0 issues**, **14 P1 issues**, and **12 P2 issues**.
The most critical are:

1. **66 API routes do not call `getRequestContext()`** -- they use raw `auth()` or
   `getSessionSafe()` with ad-hoc `user.orgId` extraction, bypassing the canonical
   auth pattern. Many of these also skip deleted-user checks.

2. **Massive middleware coverage gap**: ~20 API route prefixes are classified as
   neither public nor protected in the middleware matcher. The middleware falls through
   to "allow it" (line 143), meaning these routes rely entirely on in-route auth checks.

3. **Cross-org data leaks in dispatch/attention**: Raw `prisma` queries without orgId
   WHERE clauses return bookings from ALL orgs.

4. **Tip/sitter-info endpoint leaks sitter data across orgs**: Uses raw `prisma.sitter`
   queries with no orgId filter.

---

## FINDINGS

---

### CATEGORY 1: MISSING orgId IN API ROUTES

---

#### [01] [SEVERITY: P0] [src/app/api/dispatch/attention/route.ts:44,66] Cross-org booking leak in dispatch attention

The dispatch attention endpoint uses raw `prisma` (not `getScopedDb`) to query bookings.
Both `manualRequiredBookings` (line 44) and `unassignedAutoBookings` (line 66) queries
have NO orgId in their WHERE clauses. In SaaS mode, this returns bookings from ALL orgs.

The orgId is extracted (line 32) but ONLY used for the offerEvent query (line 106), not
for the booking queries themselves. This means an owner from Org A sees Org B's bookings
requiring dispatch attention.

**Fix**: Replace `prisma` with `getScopedDb({ orgId })` or add `orgId` to both booking
WHERE clauses.

---

#### [02] [SEVERITY: P0] [src/app/api/tip/sitter-info/route.ts:35,48] Cross-org sitter name leak

Public endpoint. Uses raw `prisma.sitter.findUnique({ where: { id: sitterId } })` (line 35)
and `prisma.sitter.findMany()` with NO orgId filter (line 48). In SaaS mode, any public
visitor can enumerate sitter names across ALL orgs by guessing sitter IDs.

**Fix**: Accept orgId as a required query parameter or derive from the sitter's org, and
filter by orgId.

---

#### [03] [SEVERITY: P0] [src/app/api/tip/transfer-tip/route.ts] Cross-org tip transfer

Uses raw `prisma` to look up sitter Stripe accounts. Without orgId scoping, tips could
theoretically be directed to sitters in other orgs if sitter IDs are guessed. This
endpoint uses raw DB imports, not `getScopedDb`.

**Fix**: Add orgId scoping to sitter Stripe account lookup.

---

#### [04] [SEVERITY: P1] [src/app/api/upload/pet-photo/route.ts:39] Weak pet ownership check

For client role, looks up pet via `prisma.pet.findFirst({ where: { id: petId } })` with
no orgId filter (line 39). The pet ownership check queries `pet.booking.clientId` which
is fragile -- pets may not always be linked to a booking. For owner/admin roles, there
is NO pet ownership check at all -- any authenticated owner can upload to any pet ID
across orgs.

**Fix**: Use `getScopedDb` and verify pet belongs to the authenticated org.

---

#### [05] [SEVERITY: P1] [src/app/api/push/subscribe/route.ts:36,49] Push subscription uses raw prisma

Push subscribe upserts `pushSubscription` using raw `prisma` with `session.user.orgId ?? 'default'`.
The `pushSubscription` model is NOT in `TENANT_MODELS`. If `orgId` on session is missing,
subscriptions are created under 'default' org -- potentially mixing users.

**Fix**: Use `getRequestContext()` for orgId and ensure PushSubscription is scoped.

---

#### [06] [SEVERITY: P1] [src/app/api/push/preferences/route.ts:16,55] Preferences use raw prisma without orgId

`userNotificationPreferences` operations use `prisma` directly, querying only by `userId`.
Not a cross-org leak (userId is session-scoped) but does not follow the canonical pattern
and lacks deleted-user checks.

---

#### [07] [SEVERITY: P1] [src/app/api/setup/provider/connect/route.ts:27] No role check on provider connect

Any authenticated user (including sitters and clients) can call POST /api/setup/provider/connect
and save Twilio credentials for the org. Only owner/admin should be able to modify provider
credentials.

**Fix**: Add `requireOwnerOrAdmin(ctx)` check.

---

#### [08] [SEVERITY: P1] [src/app/api/setup/test-sms/route.ts:17-28] No role check on test SMS

Any authenticated user can send test SMS messages via this endpoint. Should be owner-only.

**Fix**: Add owner/admin role check.

---

#### [09] [SEVERITY: P1] [src/app/api/setup/readiness/route.ts:17-29] No role check on readiness

Any authenticated user can check setup readiness status. Should be owner-only.

---

#### [10] [SEVERITY: P1] [src/app/api/setup/numbers/sync/route.ts:15-27] No role check on number sync

Any authenticated user can trigger Twilio number sync. Should be owner-only.

---

#### [11] [SEVERITY: P1] [src/app/api/setup/webhooks/install/route.ts:19-27] No role check on webhook install

Any authenticated user can install Twilio webhooks. Should be owner-only.

---

#### [12] [SEVERITY: P1] [src/app/api/setup/provider/status/route.ts:13-24] No role check on provider status

Any authenticated user (sitter, client) can check Twilio provider connection status.

---

#### [13] [SEVERITY: P1] [src/app/api/setup/provider/test/route.ts] No role check on provider test

Any authenticated user can test the Twilio provider connection.

---

#### [14] [SEVERITY: P2] [src/app/api/setup/webhooks/status/route.ts] No role check on webhook status

Any authenticated user can check webhook installation status.

---

#### [15] [SEVERITY: P2] [src/app/api/onboarding/route.ts] Uses getRequestContext but no role check

Returns onboarding status for the org. Any authenticated user sees full org onboarding state.

---

---

### CATEGORY 2: ROLE ENFORCEMENT GAPS

---

#### [16] [SEVERITY: P0] [src/app/api/sitter/[id]/dashboard/route.ts:12-45] No role check -- any authenticated user sees sitter dashboard

No role enforcement. Any authenticated user (including a client) can access
`GET /api/sitter/:id/dashboard` and view the full sitter dashboard (pending requests,
upcoming bookings, completed bookings, performance metrics, earnings, unread count).
`getScopedDb` scopes to org, but a client in the same org should not see sitter data.

**Fix**: Add `requireAnyRole(ctx, ['owner', 'admin', 'sitter'])` and if sitter,
verify `sitterId === ctx.sitterId`.

---

#### [17] [SEVERITY: P0] [src/app/api/sitter/[id]/bookings/[bookingId]/accept/route.ts:48] Sitter ID verification uses session field only

The sitter identity check (`sitterId !== (session.user as any).sitterId`) is correct
but does NOT use `getRequestContext()`. If the session sitterId field is null/missing
(edge case), the check becomes `params.id !== null` which is always true -- allowing
any authenticated user to accept bookings for any sitter.

**Fix**: Use `getRequestContext()` and its `sitterId` field.

---

#### [18] [SEVERITY: P0] [src/app/api/sitter/[id]/bookings/[bookingId]/decline/route.ts:44] Same issue as accept

Same pattern as #17 -- sitter identity check uses session directly instead of `getRequestContext()`.

---

#### [19] [SEVERITY: P1] [src/app/api/sitters/[id]/calendar/toggle/route.ts:32] Weak role check

The sitter identity check (`user.role === 'sitter' && user.sitterId !== sitterId`) only
fires for sitter role. A client in the same org could toggle any sitter's calendar sync
because there's no check that client role is forbidden.

**Fix**: Add explicit `requireAnyRole(ctx, ['owner', 'admin', 'sitter'])`.

---

#### [20] [SEVERITY: P1] [src/app/api/ops/messaging-debug/route.ts:27] Weak owner check

The role check is `!user.orgId && user.role !== 'owner'` -- if the user has `orgId` set
(which all authenticated users do), the role check is skipped entirely. Any authenticated
user with an orgId can access messaging debug data.

**Fix**: Should be `user.role !== 'owner' && user.role !== 'admin'`.

---

#### [21] [SEVERITY: P1] [src/app/api/ops/twilio-setup-diagnostics/route.ts:22] Weak owner check

Same pattern: `user.role !== 'owner' && !user.orgId` -- the orgId check is backwards.
Any user with orgId bypasses the role check.

**Fix**: Should be `user.role !== 'owner' && user.role !== 'admin'`.

---

#### [22] [SEVERITY: P2] [src/app/api/dispatch/force-assign/route.ts] Uses auth() not getRequestContext()

Has correct role check (owner/admin) but extracts orgId with fallback to
`getDefaultOrgId()` instead of using `getRequestContext()`. Skips deleted-user check.

---

#### [23] [SEVERITY: P2] [src/app/api/dispatch/resume-automation/route.ts] Same as force-assign

Same pattern -- uses `auth()` with ad-hoc orgId extraction.

---

---

### CATEGORY 3: IDOR VULNERABILITIES

---

#### [24] [SEVERITY: P0] [src/app/api/sitter/[id]/dashboard/route.ts:28-33] IDOR on sitter dashboard

Takes sitter ID from URL params. Uses `getScopedDb` (orgId-safe) but no ownership check.
A sitter can view another sitter's full dashboard by changing the `[id]` URL parameter.

**Fix**: Either require that the authenticated sitter's ID matches the URL param, or
restrict this route to owner/admin only.

---

#### [25] [SEVERITY: P1] [src/app/api/sitters/[id]/performance/route.ts:29-36] IDOR limited by getScopedDb

Takes sitter ID from URL params. Has owner/admin role check and uses `getScopedDb`.
The IDOR is prevented by org scoping, but internally it makes a fetch to
`/api/sitters/${sitterId}/dashboard` forwarding the cookie -- this could create
an internal amplification issue.

---

#### [26] [SEVERITY: P2] [src/app/api/messages/threads/[id]/route.ts:29-30] Thread ID lookup

Uses `findUnique({ where: { id: threadId } })` via `getScopedDb`. The scoped DB
automatically adds orgId, so cross-org leaks are prevented. Safe.

---

#### [27] [SEVERITY: P2] [src/app/api/bookings/[id]/daily-delight/route.ts:61-62] Booking ID lookup

Uses `findUnique({ where: { id: bookingId } })` via `getScopedDb`. Safe due to
org scoping, but the route only checks `requireAnyRole(ctx, ['owner', 'admin'])` --
a sitter could not use this, which is correct.

---

---

### CATEGORY 4: MIDDLEWARE COVERAGE GAPS

---

#### [28] [SEVERITY: P0] [src/middleware.ts:141-143] Fall-through allows unprotected API routes

The middleware has a critical fall-through: if a route is neither in `isPublicRoute()`
nor `isProtectedRoute()`, the middleware returns `NextResponse.next()` (line 143) --
allowing the request through with NO auth check at the middleware level.

The following API route prefixes are NOT registered in either list:

| Prefix | Route Count | Risk Level |
|--------|------------|------------|
| `/api/dispatch/*` | 3 | HIGH -- owner-only operations |
| `/api/push/*` | 2 | MEDIUM -- user-specific |
| `/api/realtime/*` | 4 | HIGH -- SSE streams |
| `/api/setup/*` | 9 | HIGH -- provider credentials |
| `/api/onboarding` | 1 | LOW |
| `/api/messages/*` | 25+ | HIGH -- all messaging except webhooks |
| `/api/routing/*` | 1 | MEDIUM |
| `/api/zones/*` | 1 | LOW |
| `/api/numbers/*` | 12+ | HIGH -- phone number management |
| `/api/analytics/*` | 6 | MEDIUM -- KPIs |
| `/api/assignments/*` | 3 | MEDIUM |
| `/api/offers/*` | 1 | LOW (cron) |
| `/api/cron/*` | 3 | LOW (INTERNAL_API_KEY) |
| `/api/sitter/*` | 45+ | HIGH -- sitter portal |
| `/api/payroll/*` | 4 | HIGH -- payroll data |
| `/api/waitlist/*` | 2 | LOW |
| `/api/twilio/*` | 1 | MEDIUM -- inbound webhook |

These routes rely ENTIRELY on their in-route auth checks. While most do call `auth()`
or `getRequestContext()` internally, the middleware provides no defense-in-depth.

**Fix**: Add these prefixes to `isProtectedRoute()`. For routes that need public access
(webhooks, cron), add them to `isPublicRoute()` explicitly.

---

#### [29] [SEVERITY: P0] [src/lib/protected-routes.ts] Missing /api/client/ from protected routes

`/client` (the page) is protected (line 248), but `/api/client/*` routes are NOT
in the protected routes list. The `/api/client/*` prefix catches sitter-onboard and
client-setup sub-routes, which ARE correctly public. However, the bulk of client API
endpoints (bookings, pets, billing, messages) are unprotected at the middleware level.

Each client API route internally calls `getRequestContext()`, so they are functionally
protected. But middleware defense-in-depth is missing.

---

#### [30] [SEVERITY: P1] [src/lib/public-routes.ts:57-60] Client setup and sitter onboard are fully public

`/api/client/setup/` and `/api/sitter/onboard/` are marked public. The validate and
set-password sub-routes under these paths are also public by prefix matching. This is
intentional (invite-link flow) but creates risk if those endpoints don't validate the
invite token properly.

---

---

### CATEGORY 5: TOKEN AND SESSION EDGE CASES

---

#### [31] [SEVERITY: P0] [src/lib/request-context.ts:59] Role escalation for users without role

Line 59: `if (role === "public" && userId && !sitterId && !clientId) role = "owner"`.
If a user exists in the DB but has no role, no sitterId, and no clientId, they are
automatically promoted to "owner" role. This means any newly created user row with
NULL role gets owner access.

**Fix**: This should require explicit role assignment. Default to "public" (deny access)
rather than "owner" (grant everything).

---

#### [32] [SEVERITY: P1] [src/lib/request-context.ts:41-48] Deleted user check only fires when userId is truthy

The deleted-user check (`dbUser?.deletedAt`) only runs if `userId` is truthy. If the
session has a user object without an `id` field (edge case with corrupted JWT), the
deleted-user check is skipped entirely and the user proceeds with orgId from the session.

---

#### [33] [SEVERITY: P1] [66 routes using auth() directly] No deleted-user check

Routes that use `auth()` directly instead of `getRequestContext()` do NOT check
`user.deletedAt`. A deleted/deactivated user retains a valid JWT for up to 30 days
(session maxAge) and can continue making requests to these routes.

Affected route categories:
- All dispatch routes (3)
- All setup routes (9)
- Sitter accept/decline/dashboard (4)
- Push subscribe/preferences (2)
- Messages seed/SRS routes (3)
- Ops debug/diagnostics routes (5+)
- Numbers buy/import (2)
- Sitters performance/SRS/time-off/service-events/calendar-toggle (5)
- Google OAuth callback (1)
- Upload pet-photo (1)
- Routing history (1)
- Realtime client bookings (1)

**Fix**: All routes must use `getRequestContext()` which includes the deleted-user check.

---

#### [34] [SEVERITY: P2] [src/lib/auth.ts:58,59] JWT maxAge is 30 days

Sessions persist for 30 days. If a sitter is deactivated or a user is deleted, their
JWT remains valid for up to 30 days. Only `getRequestContext()` checks `deletedAt` --
routes using `auth()` directly have no revocation mechanism.

---

#### [35] [SEVERITY: P2] [src/lib/auth.ts:98-109] E2E auth bypass has staging loophole

`isE2eLoginAllowed()` (in ops/e2e-login) allows staging environments to opt in via
env flags. If staging credentials are weak (`E2E_AUTH_KEY` defaults to
`'test-e2e-key-change-in-production'`), this is a backdoor. The production check
in auth.ts correctly blocks E2E in production but the e2e-login route allows staging.

---

---

### CATEGORY 6: PUBLIC ROUTES SERVING PRIVATE DATA

---

#### [36] [SEVERITY: P0] [src/app/api/tip/sitter-info/route.ts] Public endpoint leaks sitter data

As noted in #02, this public endpoint returns sitter names without any auth or org
scoping. In SaaS mode, an attacker can enumerate all sitters across all orgs.

---

#### [37] [SEVERITY: P2] [src/app/api/form/route.ts] Public form uses getPublicOrgContext

Correctly uses `getPublicOrgContext()` which locks to `PERSONAL_ORG_ID` in personal
mode and throws in SaaS mode. Properly implemented.

---

#### [38] [SEVERITY: P2] [src/app/api/health/route.ts] Health endpoint is properly public

Returns no private data. Correctly public.

---

#### [39] [SEVERITY: P2] [src/app/api/webhooks/stripe/route.ts] Stripe webhook validates signature

Uses Stripe webhook signature verification. Properly secured for a public endpoint.

---

---

### CATEGORY 7: ADDITIONAL FINDINGS

---

#### [40] [SEVERITY: P1] [src/app/api/[...path]/route.ts] BFF proxy catch-all forwards any path

The catch-all proxy route forwards any unmatched API path to the NestJS API backend.
It checks auth but does NOT enforce roles. Any authenticated user can proxy requests
to the NestJS API with their JWT -- the security boundary depends entirely on the
NestJS API's own auth checks.

If the NestJS API has weaker auth than the Next.js routes, this catch-all becomes a
bypass vector.

---

#### [41] [SEVERITY: P1] [src/app/api/ops/seed-sitter-dashboard/route.ts:30-35] Command injection risk

Uses `exec()` to run `tsx scripts/seed-sitter-dashboard.ts`. While the command is
hardcoded (no user input in the command string), `exec()` in an API route is a
security antipattern. If the script path were ever parameterized, this would be
critical.

---

#### [42] [SEVERITY: P2] [TENANT_MODELS list] Missing models from tenant scoping

The following models with potential org-sensitive data are NOT in `TENANT_MODELS`:
- `pushSubscription` (has orgId column based on subscribe route)
- `userNotificationPreferences`
- `recurringSchedule` (cron routes query without orgId)
- `formField`
- `bookingTag`
- `bookingPipeline`
- `customField`
- `sitterTier`
- `sitterAvailabilityRequest`
- `googleCalendarAccount`
- `signupIdempotency`
- `incidentReport`
- `featureFlag`
- `messageTemplate`
- `automationAction`
- `automationCondition`
- `automationConditionGroup`
- `automationTrigger`
- `automationTemplate`

Routes using `getScopedDb` for these models will NOT get automatic orgId injection.

---

---

## P0 SUMMARY (LAUNCH BLOCKERS)

| # | File | Issue |
|---|------|-------|
| 01 | dispatch/attention/route.ts | [FIXED] Cross-org booking leak — added getRequestContext() + orgId to both queries |
| 02 | tip/sitter-info/route.ts | [FIXED] Public endpoint — added getPublicOrgContext() + orgId to both queries |
| 03 | tip/transfer-tip/route.ts | [FIXED] Cross-org tip transfer — added getPublicOrgContext() + orgId scoping |
| 17 | sitter/[id]/bookings/[bookingId]/accept/route.ts | [FIXED] Now uses getRequestContext(), role=sitter enforced, sitterId verified from ctx |
| 18 | sitter/[id]/bookings/[bookingId]/decline/route.ts | [FIXED] Same fix as accept — getRequestContext(), role + sitterId enforcement |
| 16 | sitter/[id]/dashboard/route.ts | [FIXED] Now uses getRequestContext(), owner/admin or own-sitter only, clients get 403 |
| 28 | middleware.ts:141-143 | [FIXED] Registered all 20+ missing API prefixes + deny-by-default for unregistered /api/ |
| 29 | protected-routes.ts | [FIXED] /api/client/* now in protected routes |
| 31 | request-context.ts:59 | [FIXED] Auto-owner-promotion removed — roleless users now throw Unauthorized |

---

## STATISTICS

| Severity | Count |
|----------|-------|
| P0 | 9 |
| P1 | 14 |
| P2 | 12 |
| P3 | 0 |
| **Total** | **35** |

---

## RECOMMENDATIONS (PRIORITY ORDER)

### Immediate (before launch)

1. **Fix #01**: Add orgId to dispatch/attention booking queries. Switch to `getScopedDb`.
2. **Fix #02, #03, #36**: Add orgId scoping to all tip endpoints. For sitter-info, require
   orgId param or lock to PERSONAL_ORG_ID.
3. **Fix #31**: Remove the auto-promotion of no-role users to "owner" in request-context.ts.
   Default to "public" and require explicit role assignment.
4. **Fix #17, #18**: Switch sitter accept/decline to use `getRequestContext()` instead of
   raw `auth()` for sitter identity verification.
5. **Fix #16, #24**: Add role enforcement to sitter/[id]/dashboard route.
6. **Fix #28**: Register ALL API route prefixes in either `isProtectedRoute` or `isPublicRoute`.
   No routes should fall through to the default "allow" behavior.
7. **Fix #29**: Add `/api/client/` to protected routes (exclude setup sub-paths which are public).

### Short-term (within 1 sprint)

8. **Fix #33**: Migrate all 66 routes using `auth()` directly to use `getRequestContext()`.
   This ensures deleted-user checks, consistent role normalization, and canonical orgId extraction.
9. **Fix #07-#13**: Add owner/admin role checks to all setup routes.
10. **Fix #20, #21**: Fix reversed role checks in messaging-debug and twilio-setup-diagnostics.
11. **Fix #42**: Add missing models to `TENANT_MODELS` list.
12. **Fix #40**: Add role enforcement to the BFF catch-all proxy.

---

## HANDOFF NOTE TO AGENT 10 (Auth Enforcer)

Agent 10: This audit identified 9 P0 launch blockers and 14 P1 issues. Here is your
prioritized action plan:

### Mandatory Before Launch (P0s)

1. **request-context.ts line 59**: Delete or guard the auto-owner-promotion logic.
   Any user with `role=null, sitterId=null, clientId=null` currently becomes "owner".
   Change to: throw ForbiddenError or return role "public".

2. **dispatch/attention/route.ts**: Both booking queries (lines 44, 66) use raw `prisma`
   without orgId. Replace with `getScopedDb({ orgId })` or add `orgId` to WHERE.

3. **tip/sitter-info/route.ts**: This is a public endpoint that queries ALL sitters
   without orgId. Add orgId parameter and filter, or lock to `PERSONAL_ORG_ID`.

4. **tip/transfer-tip/route.ts**: Same issue -- raw prisma sitter Stripe lookups.

5. **sitter/[id]/bookings/[bookingId]/accept/route.ts** and **decline/route.ts**:
   Replace `auth()` with `getRequestContext()`. The current sitterId check fails
   silently when `session.user.sitterId` is undefined.

6. **sitter/[id]/dashboard/route.ts**: Add role check. Sitters should only see their
   own dashboard; clients should be forbidden.

7. **middleware.ts + protected-routes.ts**: Register ALL 20+ unregistered API prefixes.
   The middleware's fall-through "allow" behavior is a systemic defense gap.

### Pattern to Apply Everywhere

Every protected API route must follow this exact pattern (from CLAUDE.md):
```typescript
const { orgId, role, userId, sitterId, clientId } = await getRequestContext();
// + role check
// + getScopedDb({ orgId }) for all DB access
```

66 routes currently deviate from this pattern. The full list is in the "Missing
orgId" section above. Prioritize routes that handle financial data, PII, or
write operations.

### Key Files to Modify
- `src/lib/request-context.ts` (line 59)
- `src/lib/protected-routes.ts` (add missing API prefixes)
- `src/app/api/dispatch/attention/route.ts`
- `src/app/api/tip/sitter-info/route.ts`
- `src/app/api/tip/transfer-tip/route.ts`
- `src/app/api/sitter/[id]/bookings/[bookingId]/accept/route.ts`
- `src/app/api/sitter/[id]/bookings/[bookingId]/decline/route.ts`
- `src/app/api/sitter/[id]/dashboard/route.ts`
- All 9 setup routes under `src/app/api/setup/`
- `src/app/api/ops/messaging-debug/route.ts` (line 27)
- `src/app/api/ops/twilio-setup-diagnostics/route.ts` (line 22)

### What Is Working Well
- `getScopedDb()` is an excellent defense layer -- auto-injects orgId into all
  queries for 72 tenant models. Routes using it are mechanically safe from cross-org leaks.
- `getRequestContext()` properly checks `deletedAt` and normalizes roles.
- The `rbac.ts` helpers (requireRole, requireOwnerOrAdmin, assertOrgAccess) are
  well-designed and used correctly in routes that follow the canonical pattern.
- Cron routes properly use `INTERNAL_API_KEY` for authentication.
- Public routes (form, health, webhooks) are properly identified.
- JWT configuration is sound (32-char minimum secret, HTTPS cookies in prod).

End of Auth Audit.
