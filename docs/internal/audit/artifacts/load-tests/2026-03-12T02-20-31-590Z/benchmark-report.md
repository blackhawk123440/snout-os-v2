# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T02-20-31-590Z`
- Mode: `live`
- Suite: `live-ramp`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T02:20:31.590Z`
- Completed: `2026-03-12T02:31:43.212Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| bookings_create_1000 | FAIL | high | 0 | 0 | 0.00 | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 (obs:0) | 0 | 0 | config failure |
- Failures for `bookings_create_1000`: CONFIG-BLOCKED: Public booking is disabled in SaaS mode until org binding is configured
| messages_send_2000 | FAIL | high | 350 | 350 | 17.47 | 13399.9 | 20007.7 | 20007.9 | 100.00 | 20.29 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 13399.9ms > 180ms; p95 20007.7ms > 700ms; p99 20007.9ms > 1400ms; errorRate 100.00% > 2.50%; throughput 17.47 rps < 300 rps
| bookings_reads_paginated | FAIL | high | 400 | 120 | 8.31 | 10509.0 | 20002.7 | 20004.1 | 20.75 | 20.75 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `bookings_reads_paginated`: p50 10509.0ms > 120ms; p95 20002.7ms > 450ms; p99 20004.1ms > 900ms; errorRate 20.75% > 1.00%; throughput 8.31 rps < 400 rps
| thread_reads | FAIL | high | 350 | 120 | 13.19 | 5498.5 | 15784.6 | 16898.4 | 0.00 | 0.00 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `thread_reads`: p50 5498.5ms > 130ms; p95 15784.6ms > 500ms; p99 16898.4ms > 950ms; throughput 13.19 rps < 350 rps
| queue_backlog_drain | FAIL | high | 10 | 40 | 0.08 | 160.0 | 209.9 | 209.9 | 0.00 | 0.00 | 0 (obs:0) | 10 | 0 | worker/queue saturation |
- Failures for `queue_backlog_drain`: p50 160.0ms > 20ms; p95 209.9ms > 100ms; queue drain 0.08 jobs/s < 800 jobs/s
| queue_retry_failure_storm | FAIL | high | 6 | 30 | 1.57 | 126.6 | 199.7 | 199.7 | 66.67 | 0.00 | 0 (obs:0) | 4 | 1 | worker/queue saturation |
- Failures for `queue_retry_failure_storm`: p50 126.6ms > 30ms; p95 199.7ms > 180ms; errorRate 66.67% > 25.00%; queue drain 1.57 jobs/s < 500 jobs/s
| session_validation_burst | FAIL | high | 300 | 300 | 17.72 | 8994.4 | 16427.4 | 16623.8 | 90.00 | 0.00 | 0 (obs:0) | 0 | 0 | auth/session collapse |
- Failures for `session_validation_burst`: p50 8994.4ms > 140ms; p95 16427.4ms > 600ms; p99 16623.8ms > 1200ms; errorRate 90.00% > 3.00%; throughput 17.72 rps < 300 rps

## Stage-by-Stage Degradation

| Gate | Stage | Pass | p50 | p95 | p99 | Error % | Timeout % | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| bookings_create_1000 | low | FAIL | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 | 0 | config failure |
| messages_send_2000 | low | FAIL | 6381.2 | 10423.0 | 10521.0 | 100.00 | 0.00 | 0 | 0 | messaging/provider bottleneck |
| bookings_reads_paginated | low | FAIL | 4959.1 | 5689.2 | 6640.1 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| thread_reads | low | FAIL | 2512.3 | 3788.1 | 4076.6 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| queue_backlog_drain | low | FAIL | 182.1 | 187.6 | 187.6 | 0.00 | 0.00 | 3 | 0 | worker/queue saturation |
| queue_retry_failure_storm | low | FAIL | 124.0 | 184.4 | 184.4 | 50.00 | 0.00 | 7 | 1 | worker/queue saturation |
| session_validation_burst | low | FAIL | 4128.8 | 6400.1 | 6494.8 | 71.43 | 0.00 | 0 | 0 | auth/session collapse |
| bookings_create_1000 | medium | FAIL | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 | 0 | config failure |
| messages_send_2000 | medium | FAIL | 9085.0 | 14836.1 | 14956.1 | 100.00 | 0.00 | 0 | 0 | messaging/provider bottleneck |
| bookings_reads_paginated | medium | FAIL | 9183.4 | 14130.6 | 15213.2 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| thread_reads | medium | FAIL | 4917.7 | 9026.2 | 10159.6 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| queue_backlog_drain | medium | FAIL | 157.3 | 313.0 | 313.0 | 0.00 | 0.00 | 6 | 0 | worker/queue saturation |
| queue_retry_failure_storm | medium | FAIL | 168.0 | 169.6 | 169.6 | 33.33 | 0.00 | 6 | 1 | worker/queue saturation |
| session_validation_burst | medium | FAIL | 6555.9 | 11278.7 | 11362.3 | 84.62 | 0.00 | 0 | 0 | auth/session collapse |
| bookings_create_1000 | high | FAIL | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 | 0 | config failure |
| messages_send_2000 | high | FAIL | 13399.9 | 20007.7 | 20007.9 | 100.00 | 20.29 | 0 | 0 | messaging/provider bottleneck |
| bookings_reads_paginated | high | FAIL | 10509.0 | 20002.7 | 20004.1 | 20.75 | 20.75 | 0 | 0 | DB/read bottleneck |
| thread_reads | high | FAIL | 5498.5 | 15784.6 | 16898.4 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| queue_backlog_drain | high | FAIL | 160.0 | 209.9 | 209.9 | 0.00 | 0.00 | 10 | 0 | worker/queue saturation |
| queue_retry_failure_storm | high | FAIL | 126.6 | 199.7 | 199.7 | 66.67 | 0.00 | 4 | 1 | worker/queue saturation |
| session_validation_burst | high | FAIL | 8994.4 | 16427.4 | 16623.8 | 90.00 | 0.00 | 0 | 0 | auth/session collapse |

## First Degradation Point

| Gate | First degradation | Category | Details |
|---|---|---|---|
| bookings_create_1000 | low | config failure | CONFIG-BLOCKED: Public booking is disabled in SaaS mode until org binding is configured |
| messages_send_2000 | low | messaging/provider bottleneck | p50 6381.2ms > 180ms; p95 10423.0ms > 700ms; p99 10521.0ms > 1400ms; errorRate 100.00% > 2.50%; throughput 11.57 rps < 300 rps |
| bookings_reads_paginated | low | DB/read bottleneck | p50 4959.1ms > 120ms; p95 5689.2ms > 450ms; p99 6640.1ms > 900ms; throughput 8.14 rps < 400 rps |
| thread_reads | low | DB/read bottleneck | p50 2512.3ms > 130ms; p95 3788.1ms > 500ms; p99 4076.6ms > 950ms; throughput 14.56 rps < 350 rps |
| queue_backlog_drain | low | worker/queue saturation | p50 182.1ms > 20ms; p95 187.6ms > 100ms; queue drain 0.02 jobs/s < 800 jobs/s |
| queue_retry_failure_storm | low | worker/queue saturation | p50 124.0ms > 30ms; p95 184.4ms > 180ms; errorRate 50.00% > 25.00%; queue drain 0.57 jobs/s < 500 jobs/s |
| session_validation_burst | low | auth/session collapse | p50 4128.8ms > 140ms; p95 6400.1ms > 600ms; p99 6494.8ms > 1200ms; errorRate 71.43% > 3.00%; throughput 15.97 rps < 300 rps |

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 13399.9ms > 180ms; p95 20007.7ms > 700ms; p99 20007.9ms > 1400ms; errorRate 100.00% > 2.50%; throughput 17.47 rps < 300 rps
2. `bookings_reads_paginated` - failed gate: p50 10509.0ms > 120ms; p95 20002.7ms > 450ms; p99 20004.1ms > 900ms; errorRate 20.75% > 1.00%; throughput 8.31 rps < 400 rps
3. `session_validation_burst` - failed gate: p50 8994.4ms > 140ms; p95 16427.4ms > 600ms; p99 16623.8ms > 1200ms; errorRate 90.00% > 3.00%; throughput 17.72 rps < 300 rps
4. `thread_reads` - failed gate: p50 5498.5ms > 130ms; p95 15784.6ms > 500ms; p99 16898.4ms > 950ms; throughput 13.19 rps < 350 rps
5. `queue_retry_failure_storm` - failed gate: p50 126.6ms > 30ms; p95 199.7ms > 180ms; errorRate 66.67% > 25.00%; queue drain 1.57 jobs/s < 500 jobs/s

## Recommended Fixes

1. Bookings create path: add/create composite indexes for dominant search filters and review idempotency table write contention.
2. Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.
3. Read-heavy list endpoints: verify query plans for sort+filter indexes and enforce narrower includes to avoid row bloat.
4. Queue throughput: raise worker concurrency by queue class, tune retry backoff, and isolate storm-prone jobs into separate queues.
5. Session validation burst: add short-lived cache for session decode/DB lookups and pre-warm auth dependencies.

## Failing Gates

- `bookings_create_1000`
- `messages_send_2000`
- `bookings_reads_paginated`
- `thread_reads`
- `queue_backlog_drain`
- `queue_retry_failure_storm`
- `session_validation_burst`