# 06-PERFORMANCE-AUDIT.md
# Agent 06 (Performance Auditor) -- Snout OS Performance Audit
# Generated: 2026-03-29

---

## Summary

Audited 195+ API route files, 106 Prisma models (2520-line schema), 18 component directories, and all lib modules. Found **42 performance issues**: 6 P0, 11 P1, 16 P2, 9 P3.

The codebase already has solid fundamentals -- many routes use `select`, `take`, and cursor pagination. The schema has extensive indexing. The issues below are the gaps.

---

## P0 -- Critical (Will cause outage or data loss at scale)

### 01. [P0] src/app/api/ops/predictions/route.ts:54 -- N+1: Fetches ALL clients then queries bookings per client in loop
`detectMissingBookings()` runs `db.client.findMany()` (all active clients), then for EACH client runs `db.booking.findMany()` (line 56) AND `db.booking.findFirst()` (line 99). With 500 clients this is 1000+ sequential DB queries in a single API request. This will timeout or OOM.

### 02. [P0] src/app/api/ops/predictions/route.ts:144-158 -- N+1: 28 sequential DB count queries in demand forecast loop
`forecastDemand()` loops 7 days x 4 weeks = 28 sequential `db.booking.count()` calls. Should be a single aggregation query with date bucketing.

### 03. [P0] src/app/api/ops/srs/run-snapshot/route.ts:51-58 -- N+1: Queries messageThread per sitter to verify org membership
After fetching all active sitters, loops each one and queries `db.messageThread.findFirst()` to check org membership. This is both an N+1 and a logic flaw -- sitters already come from a scoped DB (`getScopedDb`), so the org check is redundant.

### 04. [P0] src/app/tip/t/[amount]/[sitter]/route.ts:18 -- Full table scan: `prisma.sitter.findMany()` with NO where clause, NO select
Loads the entire Sitter table (all columns, all orgs) into memory to find a single sitter by name. This is a public-facing route (tip links). At scale, this could expose cross-tenant data and will degrade as sitter count grows.

### 05. [P0] src/app/api/cron/collect-balances/route.ts:52-151 -- N+1: Sequential Stripe API + DB queries per booking in cron
For each due booking: queries `stripeCharge.findFirst` (line 60), `client.findFirst` (line 81), creates Stripe checkout session (external API call), updates booking, logs event -- all sequential per booking. 50 due bookings = 250+ sequential operations.

### 06. [P0] src/app/api/ops/callout-dispatch/route.ts:73-157 -- N+1: rankSittersForBooking + canSitterTakeBooking + checkAssignmentAllowed per booking per suggestion
For each affected booking, calls `rankSittersForBooking()`, then for each of the top 5 suggestions, calls `canSitterTakeBooking()` AND `checkAssignmentAllowed()` sequentially. 10 bookings x 5 suggestions = 100+ DB round-trips.

---

## P1 -- High (Performance degradation under normal load)

### 07. [P1] src/app/api/ops/daily-board/bulk-reassign/route.ts:45-117 -- N+1: Sequential booking lookup + conflict check + update per assignment
Each assignment in the loop triggers: `findFirst` (line 47), `checkAssignmentAllowed` (line 57), `update` (line 78), plus fire-and-forget notification queries. 50 assignments = 200+ queries.

### 08. [P1] src/app/api/ops/bookings/bulk-cancel/route.ts:48-79 -- N+1: Sequential update + statusHistory.create per booking
Loops bookings and runs `booking.update` then `bookingStatusHistory.create` sequentially per booking. Should use `updateMany` for the status change and batch-create history records.

### 09. [P1] src/app/api/offers/expire/route.ts:62-271 -- N+1: Sequential offer expiration with nested DB + external calls per offer
Each expired offer triggers: `offerEvent.update`, `recordOfferExpired`, potential `booking.update`, `getBookingAttemptCount`, `getSittersInCooldown`, `selectEligibleSitter`, `offerEvent.findFirst`, `offerEvent.create`, `recordOfferReassigned`, `updateMetricsWindowForExpired`. Cross-org cron with potentially dozens of offers.

### 10. [P1] src/app/api/payments/route.ts:83-89 -- Over-fetching: Previous period charges fetched without select
`db.stripeCharge.findMany()` for previous period has no `select` -- loads all columns for every charge just to sum amounts. Should use `aggregate` like the current period queries in the KPIs route.

### 11. [P1] src/app/api/ops/reports/kpis/route.ts:108-116 -- Over-fetching: Loads all bookings to count repeat clients
Fetches all bookings in period with `findMany` (line 108) just to count per-client booking frequency. Should use `groupBy` with `_count` like the analytics KPIs route already does (line 255-271 in kpis/route.ts).

### 12. [P1] src/app/api/ops/srs/run-snapshot/route.ts:66 -- Blocking sleep in API route: `await new Promise(resolve => setTimeout(resolve, 2000))`
2-second synchronous sleep in an API handler waiting for BullMQ jobs to process. This blocks the Node.js event loop thread. Should return immediately and let the caller poll for results.

### 13. [P1] src/app/api/ops/srs/run-weekly-eval/route.ts:49 -- Blocking sleep in API route: Same 2-second sleep pattern
Same issue as above. Both SRS ops routes block for 2 seconds waiting for queue jobs.

### 14. [P1] src/app/api/settings/pricing/route.ts:16-19 -- Missing pagination: PricingRule list returns ALL rules
`db.pricingRule.findMany()` with no `take` limit. Returns all pricing rules with all columns.

### 15. [P1] src/app/api/client/recurring-schedules/[id]/route.ts:187-205 -- N+1: Sequential booking updates in recurring schedule modification
When modifying a recurring schedule, loops through future bookings and updates each one sequentially. Should use `updateMany`.

### 16. [P1] prisma/schema.prisma -- Missing compound index: StripeCharge [orgId, status, createdAt]
The analytics KPIs route (analytics/kpis/route.ts) and reports KPIs route both query `stripeCharge` with `WHERE orgId AND status AND createdAt` repeatedly. Individual indexes exist for `orgId`, `status`, `createdAt`, but the compound index `[orgId, status, createdAt]` is missing. This forces index intersection instead of a single index scan.

### 17. [P1] prisma/schema.prisma -- Missing compound index: EventLog [orgId, eventType, status]
The ops/command-center/attention route queries eventLogs with `orgId + eventType + status` but only `[orgId, eventType, createdAt]` exists as a compound index. Missing status in the compound degrades the query.

---

## P2 -- Medium (Noticeable slowdowns at 500+ records)

### 18. [P2] src/app/api/ops/revenue-optimization/route.ts:91-108 -- Over-fetching: Loads all month bookings with client relation
Fetches all bookings for the month including `client` relation just to count per-client bookings. Could use `groupBy` on `clientId, service` with `_count`.

### 19. [P2] src/app/api/ops/revenue-optimization/route.ts:142-151 -- Duplicate query: Month bookings fetched twice
Lines 91 and 142 both query `db.booking.findMany` for the same month with nearly identical filters. The second query (for revenue by service) fetches `service, totalPrice` -- this could be combined with the first query.

### 20. [P2] src/app/api/settings/business/route.ts -- Missing caching: Business settings queried on every request
`BusinessSettings` is read-mostly data (changes maybe once a month) but has no cache layer. Every page load that needs business name, timezone, etc. hits the DB.

### 21. [P2] src/app/api/settings/pricing/route.ts -- Missing caching: Pricing rules queried on every booking
Pricing rules change rarely but are read on every booking creation and form submission. No Redis cache layer.

### 22. [P2] src/app/api/settings/services/route.ts -- Missing caching: Service configs have no cache
Similar to pricing rules -- service configs are queried frequently during booking flow but rarely change.

### 23. [P2] src/app/api/ops/schedule-grid/route.ts:96-128 -- In-memory grid computation in API route
Builds a full sitter x day grid in the API handler. With 20 sitters x 30 days = 600 cells computed synchronously. Not terrible now but should be aware of scaling.

### 24. [P2] src/components/messaging/InboxView.tsx:135-143 -- Missing useMemo: filteredThreads recomputes on every render
`filteredThreads = threads.filter(...)` runs on every render without `useMemo`. With 200+ threads and frequent re-renders from SSE updates, this causes unnecessary re-computation.

### 25. [P2] src/components/sitter/CompletedBookings.tsx:24-26 -- Missing useMemo: Sort runs on every render
`[...bookings].sort(...)` creates a new sorted array on every render. Should wrap in `useMemo` keyed on `bookings`.

### 26. [P2] src/components/sitter/UpcomingBookings.tsx:21-23 -- Missing useMemo: Sort runs on every render
Same pattern -- `[...bookings].sort(...)` without `useMemo`.

### 27. [P2] src/components/command/CommandList.tsx:34 -- Missing useMemo: reduce to group commands runs every render
`commands.reduce(...)` to group by category runs on every render without memoization.

### 28. [P2] src/components/messaging/SittersPanel.tsx:48-50 -- Missing useMemo: Three filter calls without memoization
`windows.filter(...)` called 3 times (active, future, past) on every render. Should compute once with `useMemo`.

### 29. [P2] src/app/api/payments/export/route.ts:33-37 -- Large unbounded export: take: 5000 with no streaming
Loads up to 5000 StripeCharge records into memory, builds full CSV in memory, then sends. Should stream CSV rows or paginate the export.

### 30. [P2] src/app/api/cron/weekly-recurring-charge/route.ts:88-198 -- N+1: Sequential client lookup + Stripe calls per recurring schedule
Each active weekly schedule triggers `client.findFirst`, Stripe customer lookup, Stripe checkout/charge, then a nested loop creating individual bookings per day of the week.

### 31. [P2] src/app/api/ops/sitters/rankings/route.ts:58-63 -- Over-fetching: Loads ALL visit events with no limit
`db.visitEvent.findMany()` for all active sitters with `excluded: false` has no `take` limit. With 50 sitters and 100+ events each, this loads thousands of records.

### 32. [P2] prisma/schema.prisma -- Missing index: OfferEvent [orgId, status, expiresAt]
The offer expiration cron (`offers/expire/route.ts`) queries across all orgs for `status = 'sent' AND expiresAt <= now`. Individual indexes exist but the compound `[status, expiresAt]` or `[orgId, status, expiresAt]` is missing.

### 33. [P2] prisma/schema.prisma -- Missing index: Booking [orgId, dispatchStatus, status]
The callout-dispatch route queries `WHERE dispatchStatus = 'manual_required' AND status IN (...)` with orgId scope. No compound index covers this query pattern.

---

## P3 -- Low (Minor inefficiency, optimize when convenient)

### 34. [P3] src/app/api/ops/predictions/route.ts:191-210 -- Aggregation via findMany+reduce instead of aggregate
Revenue projection loads all bookings in a month with `findMany({select: {totalPrice}})` then reduces. Should use `db.booking.aggregate({_sum: {totalPrice: true}})`.

### 35. [P3] src/app/api/client/billing/annual-summary/route.ts:39 -- Loop summation instead of aggregate
Loops completed bookings to sum `totalPrice` instead of using Prisma `aggregate`.

### 36. [P3] src/app/api/sitter/today/route.ts:70-97 -- Minor N+1: Sequential thread/visitEvent/report lookups
Three separate `for` loops iterating over pre-fetched results to build maps. Not true N+1 (data is pre-fetched), but the map-building could be combined.

### 37. [P3] src/app/api/analytics/kpis/route.ts -- 30+ DB queries in single request
The KPIs endpoint fires 30+ queries (14 in first Promise.all, 4 in second, 6 in third, plus response link query). While parallelized with Promise.all, this is still heavy. Consider materializing KPIs in a scheduled job.

### 38. [P3] src/app/api/form/route.ts:139 -- Unnecessary 50ms sleep in booking form handler
`await new Promise((resolve) => setTimeout(resolve, 50))` -- artificial delay in the public booking form submission path.

### 39. [P3] src/app/api/client/pets/route.ts:35 -- Minor loop processing without batching
Loops all pets to build custom field data. Minor with typical pet counts (1-5) but technically unbatched.

### 40. [P3] src/components/messaging/NumbersPanelContent.tsx:453-455 -- Redundant filter calls
Three separate `.filter()` calls on the same `numbers` array to count by class. Could be a single reduce.

### 41. [P3] src/app/api/messages/seed-srs-proof/route.ts:63-75 -- 7 seconds of blocking sleeps in API route
Three `setTimeout` calls totaling 7 seconds. This is a seed/proof route, not user-facing, but still blocks the thread.

### 42. [P3] src/app/api/sitters/route.ts -- No caching on sitter list for owner portal
Sitter list with tier info, assigned numbers, etc. is fetched on every navigation. Could benefit from short-lived cache (30s TTL).

---

## Missing Caching Summary

The following high-read, low-write data has no cache layer despite Redis being available in the stack:

| Data | Read Frequency | Write Frequency | Recommended Cache TTL |
|------|---------------|-----------------|----------------------|
| BusinessSettings | Every page load | Monthly | 5 min |
| PricingRule list | Every booking | Weekly | 2 min |
| ServiceConfig list | Every booking form | Weekly | 2 min |
| OrgNotificationSettings | Every notification | Rarely | 5 min |
| OrgIntegrationConfig | Every message send | Rarely | 5 min |
| SitterTier definitions | Every assignment | Rarely | 10 min |
| FeatureFlag state | Every request (middleware) | Rarely | 1 min |
| Sitter list (active) | Multiple dashboard views | Daily | 30 sec |

---

## Schema Index Gaps Summary

| Model | Missing Index | Query Pattern |
|-------|--------------|---------------|
| StripeCharge | `[orgId, status, createdAt]` | Analytics KPIs, Reports KPIs, Payments |
| EventLog | `[orgId, eventType, status]` | Command center attention |
| OfferEvent | `[status, expiresAt]` | Offer expiration cron |
| Booking | `[orgId, dispatchStatus, status]` | Callout dispatch, command center |
| Booking | `[orgId, status, startAt, endAt]` (composite with endAt) | Schedule grid, conflict detection |

---

## What Is Already Done Well

- **Pagination**: Owner bookings, client bookings, sitters list, clients list, message threads, automations ledger, payments, and failures routes all have proper skip/take or cursor pagination.
- **Select clauses**: Most high-traffic routes use `select` to avoid over-fetching.
- **Promise.all parallelism**: KPIs, daily board, and analytics use Promise.all for independent queries.
- **Schema indexing**: 200+ indexes defined across 106 models. Most foreign keys and common query patterns are covered.
- **Tree-shakeable imports**: date-fns imported by function name, no lodash/moment, Lucide icons imported individually.
- **Batched queries**: Sitter rankings route uses `groupBy` and Map lookups instead of N+1.
- **Cache headers**: Daily board and sitter rankings set Cache-Control headers.

---

## HANDOFF NOTE to Agent 13 (Performance Optimizer)

Agent 13: This audit identifies 42 issues across 8 categories. Recommended priority order:

1. **P0 items first** -- The predictions N+1 (#01/#02) and tip route full table scan (#04) are the most dangerous. The predictions route can generate 1000+ queries in a single request. Fix with batch queries and `groupBy`.

2. **Caching layer** -- Implement a simple Redis cache wrapper (`getOrSet(key, ttl, fetcher)`) and apply to BusinessSettings, PricingRule, ServiceConfig, and FeatureFlag. These 4 changes eliminate hundreds of DB reads per minute.

3. **Compound indexes** -- Add the 5 missing compound indexes identified above. These are zero-code-change, migration-only improvements that speed up the most-hit query patterns.

4. **Bulk operation refactoring** -- The bulk-cancel, bulk-reassign, and collect-balances routes need `$transaction` batching or `updateMany` instead of sequential loops.

5. **React memoization** -- Wrap the 5 identified sort/filter operations in `useMemo`. Quick wins that improve UI responsiveness.

6. **SRS sleep removal** -- Replace the `setTimeout` blocking in SRS routes with async job status polling or webhook-based completion.

Key architectural note: The codebase already has BullMQ + Redis infrastructure. The cron routes (collect-balances, weekly-recurring-charge, offer-expire) should be migrated from synchronous API handlers to BullMQ jobs with per-item processing. This eliminates timeout risk and enables retry/dead-letter handling.
