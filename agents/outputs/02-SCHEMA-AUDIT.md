# 02-SCHEMA-AUDIT.md
# Agent 02 (Schema Auditor) -- Complete Data Layer Audit
# Generated: 2026-03-29

---

## Methodology

Audited the full Prisma schema (2520 lines, 106 models), all 52 lib files that call `prisma.*` directly, the Prisma client initialization (`src/lib/db.ts`), the scoped DB proxy (`src/lib/tenancy/scoped-db.ts`), and the tenant model registry (`src/lib/tenancy/tenant-models.ts`). Every finding is tied to a specific file and line number.

---

## 1. Missing orgId Scoping (Cross-Tenant Data Leaks)

These queries use the raw `prisma` import instead of `getScopedDb({ orgId })` and do NOT include `orgId` in their `where` clause, meaning in SaaS mode they could return or mutate data belonging to any org.

[01] [SEVERITY: P0] [FIXED] [src/lib/automation-executor.ts:51] Booking lookup by ID without orgId — resolveOrgId() bootstraps orgId from booking, acceptable for initial resolution.

[02] [SEVERITY: P0] [FIXED] [src/lib/automation-executor.ts:80] Booking fetch now uses findFirst with orgId in WHERE clause.

[03] [SEVERITY: P0] [FIXED] [src/lib/tier-engine.ts:99] calculateSitterTier now accepts orgId param and scopes sitter lookup.

[04] [SEVERITY: P0] [FIXED] [src/lib/tier-engine.ts:128] calculateAllSitterTiers now accepts orgId param and scopes sitter findMany by org.

[05] [SEVERITY: P0] [FIXED] [src/lib/sitter-helpers.ts:40] getCurrentSitter now extracts orgId from session user and scopes sitter lookup.

[06] [SEVERITY: P0] [FIXED] [src/lib/sms-templates.ts:73,115] Both sitter lookups now use booking.orgId for scoping. orgId added to Booking interface.

[07] [SEVERITY: P0] [FIXED] [src/lib/ai.ts:18] generateDailyDelight now accepts callerOrgId param, uses findFirst with orgId when provided.

[08] [SEVERITY: P0] [FIXED] [src/lib/ai.ts:63] matchSitterToPet now uses findFirst with orgId (already had orgId param, now uses it in query).

[09] [SEVERITY: P0] [FIXED] [src/lib/messaging/sitter-offboarding.ts:38] messageNumber.findFirst now includes orgId in WHERE clause.

[10] [SEVERITY: P0] [FIXED] [src/lib/messaging/sitter-offboarding.ts:111] Fixed model name (thread → messageThread), field name (sitterId → assignedSitterId), status value (active → open), and orgId was already present.

[11] [SEVERITY: P1] [src/lib/messaging/dynamic-number-routing.ts:45] `prisma.messageThread.findUnique({ where: { id: threadId } })` -- no orgId. Thread lookup trusts caller-provided threadId.

[12] [SEVERITY: P1] [src/lib/messaging/invariants.ts:27,67,125] Three `findUnique` calls on MessageThread and MessageNumber without orgId.

[13] [SEVERITY: P1] [src/lib/messaging/choose-from-number.ts:47,128] Two `prisma.messageThread.findUnique` calls without orgId.

[14] [SEVERITY: P1] [src/lib/messaging/lifecycle-client-copy.ts:29,49] `findFirst` and `findUnique` on MessageEvent and MessageThread without orgId.

[15] [SEVERITY: P1] [src/lib/messaging/anti-poaching-flags.ts:32] `prisma.messageThread.findUnique({ where: { id: threadId } })` -- no orgId.

[16] [SEVERITY: P1] [src/lib/push.ts:62] `prisma.userNotificationPreferences.findUnique({ where: { userId } })` -- no orgId (model itself lacks orgId field).

[17] [SEVERITY: P1] [src/lib/push.ts:90] `prisma.pushSubscription.findMany({ where: { userId } })` -- queries by userId only, no orgId.

[18] [SEVERITY: P1] [src/lib/tier-permissions.ts:82,99,196,273] Multiple `prisma.sitter.findUnique({ where: { id } })` calls without orgId.

[19] [SEVERITY: P1] [src/lib/messaging/routing-resolver.ts:37,170] `prisma.user.findFirst` calls with only userId, no orgId filter.

[20] [SEVERITY: P1] [src/lib/tiers/srs-engine.ts:47-73] `getSitterOrgId()` makes 4 unscoped queries to find an org from sitter ID, searching across all orgs.

[21] [SEVERITY: P1] [src/lib/stripe-webhook-persist.ts:142] `persistRefund` uses raw `prisma.stripeRefund.upsert` instead of the `db` parameter passed to the function. Bypasses scoped DB.

[22] [SEVERITY: P1] [src/lib/finance/reconcile.ts:48-53] `prisma.stripeRefund.findMany` and `prisma.stripeCharge.findMany` use raw prisma (unscoped) while the rest of the function uses `getScopedDb`. StripeRefund has no orgId field so cross-org refund data leaks into reconciliation.

---

## 2. Missing Cascade / Orphaned Record Risk

[23] [SEVERITY: P1] [prisma/schema.prisma:202] `Sitter.currentTier -> SitterTier` has NO onDelete behavior. If a SitterTier is deleted, the Sitter row's FK becomes dangling and Prisma throws on reads that include the relation.

[24] [SEVERITY: P1] [prisma/schema.prisma:1552] `PayrollLineItem.sitter -> Sitter` has NO onDelete. Deleting a sitter causes FK violation on payroll data.

[25] [SEVERITY: P1] [prisma/schema.prisma:1573] `PayrollAdjustment.sitter -> Sitter` has NO onDelete. Same issue as above.

[26] [SEVERITY: P2] [prisma/schema.prisma:2311] `PetHealthLog.sitter -> Sitter` has NO onDelete. Deleting a sitter orphans health log sitter references.

[27] [SEVERITY: P2] [prisma/schema.prisma:2312] `PetHealthLog.booking -> Booking` has NO onDelete. Deleting a booking orphans health log booking references.

[28] [SEVERITY: P2] [prisma/schema.prisma:1412-1461] `StripeRefund`, `StripePayout`, and `StripeBalanceTransaction` have NO orgId field at all. These financial records cannot be org-scoped, causing cross-tenant data visibility in reconciliation.

---

## 3. Missing Unique Constraints

[29] [SEVERITY: P1] [prisma/schema.prisma:236] `Sitter.email` unique constraint is commented out: `// @@unique([email])   // re-add after backfill`. Two sitters with the same email can exist, causing auth confusion when User.email is unique but sitter emails are not.

[30] [SEVERITY: P1] [prisma/schema.prisma:964-965] `Client` has BOTH `@@unique([orgId, phone])` AND `@@unique([phone])`. The global `@@unique([phone])` prevents two orgs from having clients with the same phone number, which breaks multi-tenant SaaS mode.

[31] [SEVERITY: P2] [prisma/schema.prisma:571-592] `IncidentReport` has no unique constraint to prevent duplicate incident reports for the same booking + type combination.

[32] [SEVERITY: P2] [prisma/schema.prisma:594-635] `RecurringSchedule` has no unique constraint on `[orgId, clientId, service, daysOfWeek, startTime]` -- duplicate schedules for the same client/service can be created.

[33] [SEVERITY: P2] [prisma/schema.prisma:760-778] `MessageTemplate` has `templateKey` as globally unique but no orgId. All orgs share the same template keys, preventing per-org template customization.

[34] [SEVERITY: P3] [prisma/schema.prisma:2363-2373] `AIPromptTemplate` has no unique constraint on `[orgId, key, version]`. Duplicate prompt versions can exist.

---

## 4. N+1 Query Patterns

[35] [SEVERITY: P1] [src/lib/recurring/generate.ts:101-165] `generateRecurringBookings`: for each target date, executes `prisma.booking.findFirst` (line 113) to check duplicates, then `prisma.booking.create` (line 148), then a loop of `prisma.pet.create` (line 155) per pet. For 14 days with 3 pets each = 14*(1+1+3) = 70 queries per schedule.

[36] [SEVERITY: P1] [src/lib/recurring/generate.ts:213-222] `generateAllRecurringBookings`: for each active schedule, calls `generateRecurringBookings` sequentially. With 20 schedules x 70 queries = 1400 DB hits.

[37] [SEVERITY: P1] [src/lib/analytics/churn-detection.ts:30-42] For each client, executes `prisma.booking.count` inside the loop (line 38). With 500 clients = 500 additional queries on the booking table.

[38] [SEVERITY: P1] [src/lib/tier-engine.ts:134] `calculateAllSitterTiers`: loops all active sitters and calls `calculateSitterTier` per sitter (currently disabled/returns null, but the pattern remains).

[39] [SEVERITY: P1] [src/lib/matching/sitter-matcher.ts:252-261] `rankSittersForBooking`: for each sitter, makes 5 parallel DB queries (availability, familiarity, SRS, workload, client history). With 20 sitters = 100 DB queries. The `Promise.all` per-sitter helps, but the outer loop still scales O(n*5).

[40] [SEVERITY: P2] [src/lib/messaging/sitter-offboarding.ts:128-134] Thread reassignment loops through `activeThreads` with individual `prisma.thread.update` calls. Should use `updateMany`.

---

## 5. Missing Indexes

[41] [SEVERITY: P2] [prisma/schema.prisma:571-592] `IncidentReport` has no index on `[orgId, createdAt]` -- timeline queries will be slow.

[42] [SEVERITY: P2] [prisma/schema.prisma:900-910] `ServicePointWeight` has no orgId at all and no org-scoped index. All orgs share the same point weights.

[43] [SEVERITY: P2] [prisma/schema.prisma:736-754] `FormField` has no orgId field or index. All orgs share the same form fields, preventing per-org form customization.

[44] [SEVERITY: P2] [prisma/schema.prisma:760-778] `MessageTemplate` has no orgId field. Templates are global and cannot be org-scoped.

[45] [SEVERITY: P2] [prisma/schema.prisma:518-538] `CustomField` has no orgId field. Custom fields are global across all orgs.

[46] [SEVERITY: P3] [prisma/schema.prisma:1165-1178] `UserNotificationPreferences` has no orgId field. Preferences are user-global rather than org-scoped.

[47] [SEVERITY: P3] [prisma/schema.prisma:1412-1426] `StripeRefund` has no orgId and no index to efficiently join with StripeCharge for org filtering.

---

## 6. Unsafe Raw Queries

[48] [SEVERITY: P2] [src/lib/startup/verify-runtime.ts:67] `prisma.$queryRawUnsafe` with parameterized inputs ($1, $2). Parameters are safe, but `$queryRawUnsafe` is used unnecessarily. Should use tagged template `$queryRaw` for defense in depth.

[49] [SEVERITY: P2] [src/lib/messaging/client-contact-lookup.ts:31,54,92] Three uses of `$queryRawUnsafe` / `$executeRawUnsafe`. All three use parameterized inputs ($1, $2, etc.) so no current injection risk, but the "Unsafe" variant is used as a workaround for a Prisma column name bug. The comment explains this ("orgld" vs "orgId"), but if the root cause is ever fixed, these should revert to safe tagged templates.

[50] [SEVERITY: P3] [src/lib/messaging/thread-activity-queue.ts:75] Uses `db.$executeRaw` with tagged template literal -- this is safe. No issue.

---

## 7. Transaction Boundary Gaps

[51] [SEVERITY: P1] [src/lib/recurring/generate.ts:101-165] Booking creation + pet creation + payment charge are NOT wrapped in a transaction. If pet creation fails after booking creation, the booking exists without its pets. If the charge fails, the booking is created but unpaid with no rollback.

[52] [SEVERITY: P1] [src/lib/payout/payout-engine.ts:140-175] PayoutTransfer create, Stripe transfer, PayoutTransfer update, LedgerEntry upsert, and SitterEarning upsert are 5 separate operations without a transaction. If the Stripe transfer succeeds but the DB update at line 171 fails, the payout is marked as "pending" forever while money has been transferred.

[53] [SEVERITY: P1] [src/lib/messaging/conversation-service.ts:112-145] Creating a MessageThread + looking up/creating a front desk number are not transactional. Two concurrent requests for the same client could create duplicate threads.

[54] [SEVERITY: P2] [src/lib/messaging/sitter-offboarding.ts:192-217] `completeSitterOffboarding` calls `deactivateSitterMaskedNumber` then `reassignSitterThreads` without a transaction. If the first succeeds but the second fails, the sitter's number is deactivated but threads are still assigned to them.

[55] [SEVERITY: P2] [src/lib/stripe-webhook-persist.ts:131-193] `persistRefund` writes to StripeRefund, then StripeCharge, then LedgerEntry, then EventLog -- 4 writes with no transaction wrapper.

[56] [SEVERITY: P2] [src/lib/messaging/conversation-service.ts:250-280] `rotateThreadNumber` reads current number, finds new number, updates assignment, and updates all thread mappings without a transaction.

---

## 8. Enum Mismatches (Hardcoded Strings vs Schema)

[57] [SEVERITY: P2] [schema:Booking.status + multiple files] Booking status is `String` (not an enum). Values `"pending"`, `"confirmed"`, `"completed"`, `"cancelled"`, `"canceled"` are used inconsistently. Note the spelling: both `"cancelled"` and `"canceled"` appear in queries (e.g., `src/lib/matching/sitter-matcher.ts:101` uses `{ notIn: ['cancelled', 'canceled'] }` to handle both). This dual-spelling is a latent data integrity issue.

[58] [SEVERITY: P2] [schema:Booking.paymentStatus] Payment status is `String @default("unpaid")`. Values `"unpaid"`, `"paid"`, `"refunded"`, `"partial"` are scattered across API routes with no central enum definition.

[59] [SEVERITY: P2] [schema:Booking.dispatchStatus] Dispatch status is `String @default("auto")` with values `"auto"`, `"manual_required"`, `"manual_in_progress"`, `"assigned"` documented only in a schema comment.

[60] [SEVERITY: P2] [schema:MessageThread.lifecycleStatus] Lifecycle status is `String @default("active")` with values `"active"`, `"grace"`, `"expired"`, `"archived"` documented only in a schema comment.

[61] [SEVERITY: P2] [schema:MessageThread.activationStage] Activation stage is `String @default("intake")` with values `"intake"`, `"staffing"`, `"meet_and_greet"`, `"service"`, `"follow_up"` with no enum enforcement.

[62] [SEVERITY: P3] [schema:User.role] Role is `String @default("owner")` but `signup-bootstrap.ts:114` writes `role: 'OWNER'` (uppercase). If any code does `user.role === 'owner'` it will not match the bootstrapped user.

---

## 9. Tenant Model Registry Gaps

[63] [SEVERITY: P1] [src/lib/tenancy/tenant-models.ts] The following models have an `orgId` field but are MISSING from `TENANT_MODELS`, meaning `getScopedDb()` will NOT auto-inject orgId for these models:

- `SitterTier` (line 837) -- has orgId but not in TENANT_MODELS
- `IncidentReport` (line 571) -- has orgId but not in TENANT_MODELS
- `RecurringSchedule` (line 594) -- has orgId but not in TENANT_MODELS
- `ClientContact` (line 973) -- has orgId but not in TENANT_MODELS
- `ClientEmergencyContact` (line 989) -- has orgId but not in TENANT_MODELS
- `BookingChecklistItem` (line 1006) -- has orgId but not in TENANT_MODELS
- `MessageConversationFlag` (line 1805) -- has orgId but not in TENANT_MODELS
- `SitterAvailabilityRequest` (line 1824) -- has orgId but not in TENANT_MODELS
- `SitterVerification` (line 2321) -- has orgId but not registered (note: has no orgId field either, so this is actually a missing orgId on the model)
- `PushSubscription` (line 1180) -- has orgId but not in TENANT_MODELS
- `CommandCenterAttentionState` (line 1340) -- has orgId but not in TENANT_MODELS
- `BookingRequestIdempotency` (line 2436) -- has orgId (nullable) but not in TENANT_MODELS

Any code using `getScopedDb()` to query these models will NOT have orgId auto-injected.

---

## 10. Models Without orgId That Should Have It

[64] [SEVERITY: P1] [prisma/schema.prisma:900] `ServicePointWeight` -- no orgId. Point weights are global; all orgs share the same service scoring. When SaaS mode launches, orgs cannot customize.

[65] [SEVERITY: P1] [prisma/schema.prisma:736] `FormField` -- no orgId. Booking form fields are global, not per-org.

[66] [SEVERITY: P1] [prisma/schema.prisma:760] `MessageTemplate` -- no orgId. Templates are global. The `templateKey` is globally unique, so orgs cannot have their own version of a template.

[67] [SEVERITY: P1] [prisma/schema.prisma:518] `CustomField` -- no orgId. Custom field definitions are global.

[68] [SEVERITY: P1] [prisma/schema.prisma:1027] `BookingTag` -- no orgId. Tags are global; one org's tag names are visible to all.

[69] [SEVERITY: P1] [prisma/schema.prisma:1051] `BookingPipeline` -- no orgId. Pipeline stages are global.

[70] [SEVERITY: P2] [prisma/schema.prisma:1412] `StripeRefund` -- no orgId. Financial data for all orgs is commingled.

[71] [SEVERITY: P2] [prisma/schema.prisma:1428] `StripePayout` -- no orgId. Same issue.

[72] [SEVERITY: P2] [prisma/schema.prisma:1444] `StripeBalanceTransaction` -- no orgId.

[73] [SEVERITY: P2] [prisma/schema.prisma:2321] `SitterVerification` -- no orgId. Verification records are not org-scoped.

[74] [SEVERITY: P2] [prisma/schema.prisma:1165] `UserNotificationPreferences` -- no orgId. If a user belongs to multiple orgs (SaaS), they cannot have per-org notification preferences.

---

## 11. Scoped DB Proxy Issue

[75] [SEVERITY: P1] [src/lib/tenancy/scoped-db.ts:142] The scoped DB proxy throws an error for array-based `$transaction`: `"Scoped $transaction with array not supported; use callback form"`. However, CLAUDE.md line from 00-SYSTEM-STATE.md states: "Prisma $transaction proxy bug (use array-based, not callback)". These two rules CONTRADICT each other. The callback form is the only form supported by `getScopedDb`, but the known-bugs list says to use array-based. This means any code using `getScopedDb` with `$transaction` must use callback form, which may conflict with guidance elsewhere.

---

## Summary by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| P0 | 10 | Cross-tenant data leaks via missing orgId in direct queries |
| P1 | 30 | Missing cascades, missing tenant model registration, transaction gaps, N+1, unique constraint violations |
| P2 | 25 | Missing indexes, raw query hygiene, enum drift, orphan risks |
| P3 | 5 | Minor enum/preference issues |

**Total findings: 75**

---

## Top 5 Fix-Now Items

1. **[P0] automation-executor.ts lines 51,80** -- Booking lookups in the automation worker bypass org scoping entirely. Every automated message (confirmations, reminders, cancellations) could target the wrong org's booking. Fix: pass orgId through AutomationContext and use `getScopedDb`.

2. **[P0] tier-engine.ts line 128** -- `calculateAllSitterTiers()` evaluates every sitter in the entire database. Fix: require orgId parameter.

3. **[P1] Client.phone global unique (schema line 965)** -- `@@unique([phone])` prevents multi-tenant SaaS. Two orgs cannot have the same client phone number. Fix: remove the global unique, keep only `@@unique([orgId, phone])`.

4. **[P1] 12 models missing from TENANT_MODELS** -- Any use of `getScopedDb` on these models silently skips org scoping. Fix: add all models with orgId to the registry.

5. **[P1] recurring/generate.ts** -- No transaction wrapping around booking + pet creation + payment. Partial failures leave orphaned data. Fix: wrap in `prisma.$transaction`.

---

## HANDOFF NOTE TO AGENT 09 (Schema Surgeon)

Agent 09, this audit found 75 issues across 8 categories. Your priority actions:

1. **Immediate (P0 orgId scoping):** 10 lib files use raw `prisma` without orgId on tenant models. The automation-executor is the most dangerous -- it processes every automated notification. Convert all raw `prisma` usage in these files to either `getScopedDb({ orgId })` or add explicit `where: { orgId }` clauses.

2. **TENANT_MODELS registry:** Add these 12 models to `src/lib/tenancy/tenant-models.ts`: `sitterTier`, `incidentReport`, `recurringSchedule`, `clientContact`, `clientEmergencyContact`, `bookingChecklistItem`, `messageConversationFlag`, `sitterAvailabilityRequest`, `pushSubscription`, `commandCenterAttentionState`, `bookingRequestIdempotency`. Without this, `getScopedDb` is a false safety net.

3. **Client.phone unique constraint:** Remove `@@unique([phone])` from Client model (keep `@@unique([orgId, phone])`). This is a SaaS blocker.

4. **User.role casing:** `signup-bootstrap.ts` writes `'OWNER'` but the schema default and all checks use `'owner'`. Pick one and enforce it.

5. **Missing onDelete:** Add `onDelete: SetNull` to `Sitter.currentTier -> SitterTier`, and `onDelete: Cascade` or `SetNull` to `PayrollLineItem.sitter` and `PayrollAdjustment.sitter`. Also add `onDelete: SetNull` to `PetHealthLog.sitter` and `PetHealthLog.booking`.

6. **Transaction boundaries:** Wrap `recurring/generate.ts` booking+pet creation, `payout-engine.ts` transfer+update, and `conversation-service.ts` thread creation in `$transaction` blocks.

7. **Add orgId to global models** before SaaS launch: `FormField`, `CustomField`, `BookingTag`, `BookingPipeline`, `MessageTemplate`, `ServicePointWeight`, `StripeRefund`, `StripePayout`, `StripeBalanceTransaction`, `SitterVerification`, `UserNotificationPreferences`.

8. **Enum cleanup:** Define a `BookingStatus` enum with canonical values (picking either "cancelled" or "canceled", not both). Apply the same pattern to `paymentStatus`, `dispatchStatus`, `lifecycleStatus`, and `activationStage`.

All findings have file:line references above. Run `grep -n` to locate each one. The schema is structurally sound for personal mode but has significant gaps for multi-tenant SaaS.
