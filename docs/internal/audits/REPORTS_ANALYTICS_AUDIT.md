# Reports / Analytics Completion Audit

**Date:** 2026-03-03  
**Scope:** Owner reporting and analytics across bookings, revenue, sitter utilization, cancellations, and operational performance.  
**Goal:** Make `/reports` and `/analytics` real owner-facing surfaces with metrics from real system data, working filters and date ranges, drill-down links to real entities, mobile-safe and desktop-dense UX, and staging proof.

**Status rubric:**
- **Complete:** Route/API/data/filters/drill-down all present and correct.
- **Partial:** Materially functional but missing pieces or non-trivial gaps.
- **Missing:** Feature or data source not implemented.
- **Broken:** Implemented surface exists but core behavior fails.
- **Present but not wired end-to-end:** UI or API exists but does not complete the loop (e.g. placeholder, no real data).

---

## 1) Audit by area

| # | Area | Status | What exists | What is missing / broken |
|---|------|--------|-------------|---------------------------|
| 1 | **/reports** | **Present but not wired end-to-end** | Owner route; `OwnerModulePlaceholderPage` with title "Reports", subtitle, CTA to `/finance`, checklist (revenue narrative, booking conversion, client retention) linking to `/finance`, `/bookings`, `/clients`. | No reports content; no metrics, no tables, no charts. Pure placeholder. |
| 2 | **/analytics** | **Present but not wired end-to-end** | Owner route; `AppShell`, `AppPageHeader`, `AppFilterBar` (metric: revenue/visits; no date range wired), two `AppChartCard` (Revenue Trend, Visit Volume) with timeframe dropdown. | Charts render "Chart placeholder" only; no API fetch for revenue or visit series; filter values not sent to any API; Export Report button has no handler. |
| 3 | **Owner KPI / dashboard metric APIs** | **Partial** | `GET /api/ops/metrics`: activeVisitsCount, openBookingsCount, revenueYTD, retentionRate (real DB). `GET /api/ops/stats?range=7d\|30d`: bookingsCreated, visitsCompleted, revenue, messagesSent + trends vs prior period (real DB). Dashboard page uses both. | No today/week/month breakdown in a single contract; no active clients count, no active sitters count, no utilization, no cancellation rate, no failed payment count, no automation failure count, no payout volume, no average booking value. |
| 4 | **Bookings trend data** | **Partial** | ops/stats gives bookings created and visits completed for 7d/30d with trend %. No daily/time-series for charts. `getRevenueForecast` in lib/ai builds daily revenue from completed+paid bookings. | No dedicated bookings trend API (e.g. daily bookings count for chart). Analytics page does not fetch any trend API. |
| 5 | **Revenue trend data** | **Partial** | `GET /api/ops/forecast/revenue?range=90d` returns `daily: { date, amount }[]` and `aiCommentary` (lib/ai getRevenueForecast from Booking + Stripe). RevenueChart component exists and accepts `daily` + optional `aiCommentary`. | Analytics page does not call forecast/revenue or render RevenueChart; chart is unused. No revenue today/week/month in a single KPI API. |
| 6 | **Sitter utilization / performance data** | **Partial** | `GET /api/sitters/[id]/performance`: acceptanceRate, completionRate, onTimeRate, clientRating, cancellations (30d), SLA breaches (0), trends (stub). Uses sitter dashboard + prisma booking count for cancelled. `GET /api/sitters/[id]/dashboard` feeds it. | No org-level utilization metric (e.g. % of sitter capacity used). No aggregation across sitters for reports. Performance is per-sitter only. |
| 7 | **Cancellations / refunds / failed payments** | **Partial** | Command-center attention includes payout failures; automation failures. `GET /api/payments` returns charges with status (succeeded/failed/refunded), totalCollected, failedAmount, refundedAmount; filters by status. Bookings: status `cancelled` in schema; sitter performance counts cancelled. | No dedicated cancellation-rate or refund-rate KPI for dashboard/reports. No single "failed payment count" or "cancellation rate" in ops/metrics or ops/stats. |
| 8 | **Automation performance / failure trends** | **Partial** | `GET /api/ops/automation-failures?tab=fail|dead|success`: returns EventLog items (automation.failed, automation.dead, or success). Command-center attention aggregates failed events (calendar, automation, etc.). | No aggregate "automation failure count" or trend in ops/metrics or ops/stats. No chart or report surface for automation performance over time. |
| 9 | **Messaging volume / response-time analytics** | **Partial** | ops/stats includes `messagesSent` (outbound MessageEvent count) for 7d/30d with trend. Sitter accept/decline routes update "response time" in metrics; SitterMe SRS suggests "Improve response time". | No dedicated messaging volume API for reports. No message response lag or reply-time metric exposed to owner analytics. No chart for message volume. |
| 10 | **Retention / repeat booking / loyalty analytics** | **Partial** | ops/metrics: retentionRate (clients with 2+ bookings in 90d / clients with 1+ in 90d). Client billing API returns loyalty points/tier (LoyaltyReward). | No repeat booking rate in stats; no loyalty analytics on reports/analytics. Retention is only on dashboard metrics, not in a report or trend. |

---

## 2) Summary table (quick reference)

| Area | Status |
|------|--------|
| 1) /reports | Present but not wired end-to-end |
| 2) /analytics | Present but not wired end-to-end |
| 3) Owner KPI/dashboard metric APIs | Partial |
| 4) Bookings trend data | Partial |
| 5) Revenue trend data | Partial |
| 6) Sitter utilization/performance | Partial |
| 7) Cancellations/refunds/failed payments | Partial |
| 8) Automation performance/failure trends | Partial |
| 9) Messaging volume/response-time | Partial |
| 10) Retention/repeat/loyalty | Partial |

---

## 3) Canonical analytics surface (metrics contract)

Core owner metrics that the system should expose in one place (KPI layer + reports/analytics):

| Metric | Definition | Source (current or needed) |
|--------|------------|----------------------------|
| **Revenue today** | Sum of successful charge amount (or completed+paid booking totalPrice) for today. | StripeCharge or Booking; need today filter. |
| **Revenue week** | Same for last 7 days. | ops/stats revenue for 7d exists; could alias. |
| **Revenue month** | Same for last 30 days. | ops/stats revenue for 30d; or MTD. |
| **Bookings today** | Count of bookings (created or completed) today. | New or extend ops/stats. |
| **Bookings week** | Count for last 7 days. | ops/stats bookingsCreated. |
| **Bookings month** | Count for last 30 days. | ops/stats. |
| **Active clients** | Distinct clients with at least one booking in chosen window (e.g. 30d). | New aggregate. |
| **Active sitters** | Distinct sitters with at least one completed or in-progress booking in chosen window. | New aggregate. |
| **Utilization** | (Completed visits or booked slots) / (sitter capacity in period). Definition depends on capacity model. | New; may need availability/slots. |
| **Cancellation rate** | Cancelled bookings / (completed + cancelled) in period, or vs total created. | Bookings status=cancelled count vs completed; new KPI. |
| **Failed payment count** | Count of StripeCharge with status failed in period. | payments API has failed; need count in metrics. |
| **Automation failure count** | Count of EventLog automation.failed/dead in period. | automation-failures API; need count in metrics. |
| **Payout volume** | Sum of PayoutTransfer amount (paid) in period. | PayoutTransfer; new for metrics. |
| **Average booking value** | Revenue in period / completed bookings in period. | Derived from existing revenue + visitsCompleted. |
| **Repeat booking rate** | Clients with 2+ bookings in period / clients with 1+ in period. | retentionRate in ops/metrics is this (90d). |
| **Message response lag** | (If data available) e.g. median time to first reply per thread. | Sitter metrics/response time exist in accept/decline; no owner-facing aggregate yet. |

**Canonical metrics contract (API shape):**

- **Single KPI endpoint** (e.g. `GET /api/ops/metrics` or `GET /api/ops/analytics/kpi?range=today|7d|30d`) returning:
  - revenueToday, revenueWeek, revenueMonth (or range-based)
  - bookingsToday, bookingsWeek, bookingsMonth
  - activeClients, activeSitters
  - utilization (optional, if definable)
  - cancellationRate
  - failedPaymentCount
  - automationFailureCount
  - payoutVolume
  - averageBookingValue
  - repeatBookingRate (retentionRate)
  - messageResponseLag (optional)
- **Trend/ time-series endpoints** for charts:
  - Revenue trend: daily (or weekly) revenue; already available from `GET /api/ops/forecast/revenue`.
  - Bookings trend: daily (or weekly) booking counts; new or extend forecast.
- **Filters:** date range (today, 7d, 30d, 90d, custom), optionally service or location.
- **Drill-down:** every metric that is entity-based (bookings, clients, sitters, payments, automation events) should link to the real list or detail (e.g. `/bookings`, `/bookings?status=completed`, `/clients`, `/sitters`, `/payments`, `/ops/automation-failures`).

---

## 4) Implementation plan (grouped)

### A. KPI layer

1. **Extend or add analytics KPI API**  
   - Option A: Extend `GET /api/ops/metrics` with: revenue today/week/month (or range), bookings today/week/month, activeClients (30d), activeSitters (30d), cancellationRate (e.g. 30d), failedPaymentCount (30d), automationFailureCount (30d), payoutVolume (30d), averageBookingValue, repeatBookingRate (already as retentionRate).  
   - Option B: New `GET /api/ops/analytics/kpi?range=7d|30d` that returns the canonical set above so dashboard and reports share one contract.  
2. **Ensure data sources**  
   - Revenue: StripeCharge status=succeeded or Booking completed+paymentStatus=paid.  
   - Bookings: Booking count by status and date.  
   - Active clients/sitters: distinct clientId/sitterId from Booking in range.  
   - Cancellation rate: count cancelled / (completed + cancelled).  
   - Failed payments: StripeCharge status=failed count.  
   - Automation failures: EventLog eventType automation.failed/dead count.  
   - Payout volume: PayoutTransfer status=paid sum(amount).  
   - Average booking value: revenue / completed count.  
   - Repeat rate: already in ops/metrics as retentionRate (90d); can expose for 7d/30d.

### B. Reports pages

1. **/reports**  
   - Replace placeholder with real page: KPI summary cards (using canonical KPI API), optional date range filter, sections for revenue summary, bookings summary, cancellations, payouts, automation health.  
   - Each section can link to existing surfaces (e.g. "View all bookings" → `/bookings`, "Failed payments" → `/payments?status=failed`).  
2. **/analytics**  
   - Wire to real data: Revenue trend from `GET /api/ops/forecast/revenue?range=...` and render `RevenueChart` with returned `daily` (and optional `aiCommentary`).  
   - Visit volume: add or use bookings trend API (daily counts) and render a second chart.  
   - Wire filter bar (metric, date range) to these APIs and state.  
   - Export Report: implement (e.g. CSV of KPI + trend summary, or link to existing exports).

### C. Chart / data APIs

1. **Revenue trend**  
   - Already: `GET /api/ops/forecast/revenue?range=7d|30d|90d`. Use it from /analytics and optionally from /reports.  
2. **Bookings trend**  
   - Add `GET /api/ops/analytics/bookings-trend?range=7d|30d|90d` returning daily (or weekly) counts (e.g. `{ date, count }[]`) for chart.  
3. **Optional: automation failure trend, messaging volume trend**  
   - If needed for reports: aggregate EventLog by day for automation failures; MessageEvent by day for message volume.

### D. Drill-down links

1. **From KPIs and reports**  
   - Revenue → `/payments` or `/finance`.  
   - Bookings → `/bookings`, with optional `?status=completed` or date filter.  
   - Active clients → `/clients`.  
   - Active sitters → `/sitters`.  
   - Cancellations → `/bookings?status=cancelled` or filter.  
   - Failed payments → `/payments?status=failed`.  
   - Automation failures → `/ops/automation-failures`.  
   - Payout volume → `/payroll` or `/ops/payouts`.  
2. **From charts**  
   - Clicking a point (e.g. a day) could deep-link to bookings or payments for that date (e.g. `/bookings?date=YYYY-MM-DD` if supported).

### E. Verification

1. **Staging proof**  
   - After implementation: confirm /reports and /analytics load with real data (no placeholders).  
   - Confirm date range and filters change the numbers and charts.  
   - Confirm at least one drill-down per section (e.g. "Failed payments" → payments page with failed filter).  
   - Optional: add a small verifier script (e.g. `scripts/verify-reports-analytics.ts`) that hits KPI API and trend API and asserts non-placeholder response shape and optional sanity bounds.

---

## 5) Deliverables before coding (this document)

1. **docs/REPORTS_ANALYTICS_AUDIT.md** — This file (audit, canonical surface, implementation plan).  
2. **Canonical metrics contract** — Section 3 above: list of core owner metrics, single KPI endpoint shape, trend endpoints, filters, drill-down.  
3. **Implementation plan** — Section 4 grouped by: KPI layer, reports pages, chart/data APIs, drill-down links, verification.

**Stop here and wait for approval before implementing.**
