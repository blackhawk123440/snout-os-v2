# Load-Test Gates Benchmark Report

- Run ID: `2026-03-11T22-01-29-089Z`
- Mode: `live`
- Suite: `live-ramp`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-11T22:01:29.089Z`
- Completed: `2026-03-11T22:12:29.230Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| bookings_create_1000 | FAIL | high | 0 | 0 | 0.00 | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 (obs:0) | 0 | 0 | config failure |
- Failures for `bookings_create_1000`: CONFIG-BLOCKED: Public booking is disabled in SaaS mode until org binding is configured
| messages_send_2000 | FAIL | high | 350 | 350 | 17.46 | 12591.4 | 20010.5 | 20012.5 | 100.00 | 13.71 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 12591.4ms > 180ms; p95 20010.5ms > 700ms; p99 20012.5ms > 1400ms; errorRate 100.00% > 2.50%; throughput 17.46 rps < 300 rps
| bookings_reads_paginated | FAIL | high | 400 | 120 | 8.49 | 10823.7 | 20003.1 | 20007.7 | 15.00 | 15.00 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `bookings_reads_paginated`: p50 10823.7ms > 120ms; p95 20003.1ms > 450ms; p99 20007.7ms > 900ms; errorRate 15.00% > 1.00%; throughput 8.49 rps < 400 rps
| thread_reads | FAIL | high | 350 | 120 | 14.11 | 5589.9 | 16799.5 | 18421.9 | 0.00 | 0.00 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `thread_reads`: p50 5589.9ms > 130ms; p95 16799.5ms > 500ms; p99 18421.9ms > 950ms; throughput 14.11 rps < 350 rps
| queue_backlog_drain | FAIL | high | 10 | 40 | 0.08 | 176.1 | 217.1 | 217.1 | 0.00 | 0.00 | 0 (obs:0) | 10 | 0 | worker/queue saturation |
- Failures for `queue_backlog_drain`: p50 176.1ms > 20ms; p95 217.1ms > 100ms; queue drain 0.08 jobs/s < 800 jobs/s
| queue_retry_failure_storm | FAIL | high | 6 | 30 | 1.22 | 142.5 | 1547.6 | 1547.6 | 33.33 | 0.00 | 0 (obs:0) | 8 | 1 | worker/queue saturation |
- Failures for `queue_retry_failure_storm`: p50 142.5ms > 30ms; p95 1547.6ms > 180ms; p99 1547.6ms > 350ms; errorRate 33.33% > 25.00%; queue drain 1.22 jobs/s < 500 jobs/s
| session_validation_burst | FAIL | high | 300 | 300 | 19.54 | 8342.6 | 15059.2 | 15184.0 | 90.00 | 0.00 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `session_validation_burst`: p50 8342.6ms > 140ms; p95 15059.2ms > 600ms; p99 15184.0ms > 1200ms; errorRate 90.00% > 3.00%; throughput 19.54 rps < 300 rps

## Stage-by-Stage Degradation

| Gate | Stage | Pass | p50 | p95 | p99 | Error % | Timeout % | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| bookings_create_1000 | low | FAIL | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 | 0 | config failure |
| messages_send_2000 | low | FAIL | 6427.8 | 9197.5 | 9277.3 | 100.00 | 0.00 | 0 | 0 | messaging/provider bottleneck |
| bookings_reads_paginated | low | FAIL | 4516.5 | 5456.7 | 5854.8 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| thread_reads | low | FAIL | 2507.7 | 3602.6 | 4049.1 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| queue_backlog_drain | low | FAIL | 181.5 | 208.2 | 208.2 | 0.00 | 0.00 | 3 | 0 | worker/queue saturation |
| queue_retry_failure_storm | low | FAIL | 178.6 | 1251.9 | 1251.9 | -50.00 | 0.00 | 7 | 1 | worker/queue saturation |
| session_validation_burst | low | FAIL | 3514.4 | 5106.8 | 5132.4 | 71.43 | 0.00 | 0 | 0 | DB/read bottleneck |
| bookings_create_1000 | medium | FAIL | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 | 0 | config failure |
| messages_send_2000 | medium | FAIL | 9175.2 | 14720.0 | 14807.9 | 100.00 | 0.00 | 0 | 0 | messaging/provider bottleneck |
| bookings_reads_paginated | medium | FAIL | 8728.5 | 13307.1 | 14988.1 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| thread_reads | medium | FAIL | 4099.3 | 8322.5 | 8910.7 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| queue_backlog_drain | medium | FAIL | 170.2 | 177.9 | 177.9 | 0.00 | 0.00 | 6 | 0 | worker/queue saturation |
| queue_retry_failure_storm | medium | FAIL | 187.8 | 1084.5 | 1084.5 | -33.33 | 0.00 | 8 | 1 | worker/queue saturation |
| session_validation_burst | medium | FAIL | 5689.7 | 10134.7 | 10208.9 | 82.56 | 0.00 | 0 | 0 | DB/read bottleneck |
| bookings_create_1000 | high | FAIL | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 | 0 | config failure |
| messages_send_2000 | high | FAIL | 12591.4 | 20010.5 | 20012.5 | 100.00 | 13.71 | 0 | 0 | messaging/provider bottleneck |
| bookings_reads_paginated | high | FAIL | 10823.7 | 20003.1 | 20007.7 | 15.00 | 15.00 | 0 | 0 | DB/read bottleneck |
| thread_reads | high | FAIL | 5589.9 | 16799.5 | 18421.9 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| queue_backlog_drain | high | FAIL | 176.1 | 217.1 | 217.1 | 0.00 | 0.00 | 10 | 0 | worker/queue saturation |
| queue_retry_failure_storm | high | FAIL | 142.5 | 1547.6 | 1547.6 | 33.33 | 0.00 | 8 | 1 | worker/queue saturation |
| session_validation_burst | high | FAIL | 8342.6 | 15059.2 | 15184.0 | 90.00 | 0.00 | 0 | 0 | DB/read bottleneck |

## First Degradation Point

| Gate | First degradation | Category | Details |
|---|---|---|---|
| bookings_create_1000 | low | config failure | CONFIG-BLOCKED: Public booking is disabled in SaaS mode until org binding is configured |
| messages_send_2000 | low | messaging/provider bottleneck | p50 6427.8ms > 180ms; p95 9197.5ms > 700ms; p99 9277.3ms > 1400ms; errorRate 100.00% > 2.50%; throughput 13.10 rps < 300 rps |
| bookings_reads_paginated | low | DB/read bottleneck | p50 4516.5ms > 120ms; p95 5456.7ms > 450ms; p99 5854.8ms > 900ms; throughput 8.47 rps < 400 rps |
| thread_reads | low | DB/read bottleneck | p50 2507.7ms > 130ms; p95 3602.6ms > 500ms; p99 4049.1ms > 950ms; throughput 15.54 rps < 350 rps |
| queue_backlog_drain | low | worker/queue saturation | p50 181.5ms > 20ms; p95 208.2ms > 100ms; queue drain 0.02 jobs/s < 800 jobs/s |
| queue_retry_failure_storm | low | worker/queue saturation | p50 178.6ms > 30ms; p95 1251.9ms > 180ms; p99 1251.9ms > 350ms; queue drain 0.45 jobs/s < 500 jobs/s |
| session_validation_burst | low | DB/read bottleneck | p50 3514.4ms > 140ms; p95 5106.8ms > 600ms; p99 5132.4ms > 1200ms; errorRate 71.43% > 3.00%; throughput 20.03 rps < 300 rps |

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 12591.4ms > 180ms; p95 20010.5ms > 700ms; p99 20012.5ms > 1400ms; errorRate 100.00% > 2.50%; throughput 17.46 rps < 300 rps
2. `bookings_reads_paginated` - failed gate: p50 10823.7ms > 120ms; p95 20003.1ms > 450ms; p99 20007.7ms > 900ms; errorRate 15.00% > 1.00%; throughput 8.49 rps < 400 rps
3. `session_validation_burst` - failed gate: p50 8342.6ms > 140ms; p95 15059.2ms > 600ms; p99 15184.0ms > 1200ms; errorRate 90.00% > 3.00%; throughput 19.54 rps < 300 rps
4. `thread_reads` - failed gate: p50 5589.9ms > 130ms; p95 16799.5ms > 500ms; p99 18421.9ms > 950ms; throughput 14.11 rps < 350 rps
5. `queue_retry_failure_storm` - failed gate: p50 142.5ms > 30ms; p95 1547.6ms > 180ms; p99 1547.6ms > 350ms; errorRate 33.33% > 25.00%; queue drain 1.22 jobs/s < 500 jobs/s

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