# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T01-40-57-449Z`
- Mode: `live`
- Suite: `live-ramp`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T01:40:57.449Z`
- Completed: `2026-03-12T01:52:13.723Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| bookings_create_1000 | FAIL | high | 0 | 0 | 0.00 | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 (obs:0) | 0 | 0 | config failure |
- Failures for `bookings_create_1000`: CONFIG-BLOCKED: Public booking is disabled in SaaS mode until org binding is configured
| messages_send_2000 | FAIL | high | 350 | 350 | 17.46 | 14317.2 | 20007.2 | 20008.3 | 100.00 | 22.57 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 14317.2ms > 180ms; p95 20007.2ms > 700ms; p99 20008.3ms > 1400ms; errorRate 100.00% > 2.50%; throughput 17.46 rps < 300 rps
| bookings_reads_paginated | FAIL | high | 400 | 120 | 8.12 | 10706.9 | 20001.9 | 20002.9 | 22.25 | 22.25 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `bookings_reads_paginated`: p50 10706.9ms > 120ms; p95 20001.9ms > 450ms; p99 20002.9ms > 900ms; errorRate 22.25% > 1.00%; throughput 8.12 rps < 400 rps
| thread_reads | FAIL | high | 350 | 120 | 12.28 | 5925.7 | 16907.2 | 17142.4 | 0.00 | 0.00 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `thread_reads`: p50 5925.7ms > 130ms; p95 16907.2ms > 500ms; p99 17142.4ms > 950ms; throughput 12.28 rps < 350 rps
| queue_backlog_drain | FAIL | high | 10 | 40 | 0.08 | 184.3 | 235.9 | 235.9 | 0.00 | 0.00 | 0 (obs:0) | 10 | 0 | worker/queue saturation |
- Failures for `queue_backlog_drain`: p50 184.3ms > 20ms; p95 235.9ms > 100ms; queue drain 0.08 jobs/s < 800 jobs/s
| queue_retry_failure_storm | FAIL | high | 6 | 30 | 1.28 | 168.5 | 309.5 | 309.5 | 66.67 | 0.00 | 0 (obs:0) | 8 | 1 | worker/queue saturation |
- Failures for `queue_retry_failure_storm`: p50 168.5ms > 30ms; p95 309.5ms > 180ms; errorRate 66.67% > 25.00%; queue drain 1.28 jobs/s < 500 jobs/s
| session_validation_burst | FAIL | high | 300 | 300 | 17.97 | 9889.7 | 16309.8 | 16513.9 | 80.00 | 0.00 | 0 (obs:0) | 0 | 0 | auth/session collapse |
- Failures for `session_validation_burst`: p50 9889.7ms > 140ms; p95 16309.8ms > 600ms; p99 16513.9ms > 1200ms; errorRate 80.00% > 3.00%; throughput 17.97 rps < 300 rps

## Stage-by-Stage Degradation

| Gate | Stage | Pass | p50 | p95 | p99 | Error % | Timeout % | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| bookings_create_1000 | low | FAIL | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 | 0 | config failure |
| messages_send_2000 | low | FAIL | 6653.9 | 8788.3 | 8796.8 | 100.00 | 0.00 | 0 | 0 | messaging/provider bottleneck |
| bookings_reads_paginated | low | FAIL | 4883.0 | 6238.0 | 6668.1 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| thread_reads | low | FAIL | 2615.4 | 3495.8 | 3857.3 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| queue_backlog_drain | low | FAIL | 186.6 | 218.7 | 218.7 | 0.00 | 0.00 | 3 | 0 | worker/queue saturation |
| queue_retry_failure_storm | low | FAIL | 137.8 | 301.2 | 301.2 | 50.00 | 0.00 | 7 | 1 | worker/queue saturation |
| session_validation_burst | low | FAIL | 4193.3 | 6199.9 | 6226.0 | 42.86 | 0.00 | 0 | 0 | auth/session collapse |
| bookings_create_1000 | medium | FAIL | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 | 0 | config failure |
| messages_send_2000 | medium | FAIL | 9607.5 | 15316.1 | 15436.1 | 100.00 | 0.00 | 0 | 0 | messaging/provider bottleneck |
| bookings_reads_paginated | medium | FAIL | 9589.1 | 13819.5 | 15420.2 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| thread_reads | medium | FAIL | 5083.8 | 9304.9 | 9710.9 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| queue_backlog_drain | medium | FAIL | 183.3 | 457.1 | 457.1 | 0.00 | 0.00 | 6 | 0 | worker/queue saturation |
| queue_retry_failure_storm | medium | FAIL | 169.4 | 170.7 | 170.7 | 33.33 | 0.00 | 8 | 1 | worker/queue saturation |
| session_validation_burst | medium | FAIL | 6102.7 | 11069.1 | 11105.5 | 84.62 | 0.00 | 0 | 0 | auth/session collapse |
| bookings_create_1000 | high | FAIL | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 | 0 | config failure |
| messages_send_2000 | high | FAIL | 14317.2 | 20007.2 | 20008.3 | 100.00 | 22.57 | 0 | 0 | messaging/provider bottleneck |
| bookings_reads_paginated | high | FAIL | 10706.9 | 20001.9 | 20002.9 | 22.25 | 22.25 | 0 | 0 | DB/read bottleneck |
| thread_reads | high | FAIL | 5925.7 | 16907.2 | 17142.4 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| queue_backlog_drain | high | FAIL | 184.3 | 235.9 | 235.9 | 0.00 | 0.00 | 10 | 0 | worker/queue saturation |
| queue_retry_failure_storm | high | FAIL | 168.5 | 309.5 | 309.5 | 66.67 | 0.00 | 8 | 1 | worker/queue saturation |
| session_validation_burst | high | FAIL | 9889.7 | 16309.8 | 16513.9 | 80.00 | 0.00 | 0 | 0 | auth/session collapse |

## First Degradation Point

| Gate | First degradation | Category | Details |
|---|---|---|---|
| bookings_create_1000 | low | config failure | CONFIG-BLOCKED: Public booking is disabled in SaaS mode until org binding is configured |
| messages_send_2000 | low | messaging/provider bottleneck | p50 6653.9ms > 180ms; p95 8788.3ms > 700ms; p99 8796.8ms > 1400ms; errorRate 100.00% > 2.50%; throughput 13.74 rps < 300 rps |
| bookings_reads_paginated | low | DB/read bottleneck | p50 4883.0ms > 120ms; p95 6238.0ms > 450ms; p99 6668.1ms > 900ms; throughput 7.47 rps < 400 rps |
| thread_reads | low | DB/read bottleneck | p50 2615.4ms > 130ms; p95 3495.8ms > 500ms; p99 3857.3ms > 950ms; throughput 15.59 rps < 350 rps |
| queue_backlog_drain | low | worker/queue saturation | p50 186.6ms > 20ms; p95 218.7ms > 100ms; queue drain 0.02 jobs/s < 800 jobs/s |
| queue_retry_failure_storm | low | worker/queue saturation | p50 137.8ms > 30ms; p95 301.2ms > 180ms; errorRate 50.00% > 25.00%; queue drain 0.53 jobs/s < 500 jobs/s |
| session_validation_burst | low | auth/session collapse | p50 4193.3ms > 140ms; p95 6199.9ms > 600ms; p99 6226.0ms > 1200ms; errorRate 42.86% > 3.00%; throughput 16.74 rps < 300 rps |

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 14317.2ms > 180ms; p95 20007.2ms > 700ms; p99 20008.3ms > 1400ms; errorRate 100.00% > 2.50%; throughput 17.46 rps < 300 rps
2. `bookings_reads_paginated` - failed gate: p50 10706.9ms > 120ms; p95 20001.9ms > 450ms; p99 20002.9ms > 900ms; errorRate 22.25% > 1.00%; throughput 8.12 rps < 400 rps
3. `session_validation_burst` - failed gate: p50 9889.7ms > 140ms; p95 16309.8ms > 600ms; p99 16513.9ms > 1200ms; errorRate 80.00% > 3.00%; throughput 17.97 rps < 300 rps
4. `thread_reads` - failed gate: p50 5925.7ms > 130ms; p95 16907.2ms > 500ms; p99 17142.4ms > 950ms; throughput 12.28 rps < 350 rps
5. `queue_retry_failure_storm` - failed gate: p50 168.5ms > 30ms; p95 309.5ms > 180ms; errorRate 66.67% > 25.00%; queue drain 1.28 jobs/s < 500 jobs/s

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