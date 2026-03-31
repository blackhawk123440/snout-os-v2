# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T03-42-09-027Z`
- Mode: `live`
- Suite: `smoke`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T03:42:09.027Z`
- Completed: `2026-03-12T03:46:20.413Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| bookings_create_1000 | FAIL | - | 200 | 200 | 18.88 | 5101.5 | 9228.7 | 9377.6 | 100.00 | 0.00 | 0 (obs:0) | 0 | 0 | config failure |
- Failures for `bookings_create_1000`: p50 5101.5ms > 300ms; p95 9228.7ms > 1000ms; p99 9377.6ms > 2000ms; errorRate 100.00% > 2.00%; throughput 18.88 rps < 120 rps
| messages_send_2000 | FAIL | - | 350 | 350 | 17.47 | 12542.8 | 20003.6 | 20005.9 | 100.00 | 15.14 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 12542.8ms > 180ms; p95 20003.6ms > 700ms; p99 20005.9ms > 1400ms; errorRate 100.00% > 2.50%; throughput 17.47 rps < 300 rps
| bookings_reads_paginated | FAIL | - | 400 | 120 | 7.77 | 12317.5 | 20005.7 | 20011.9 | 32.00 | 32.00 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `bookings_reads_paginated`: p50 12317.5ms > 120ms; p95 20005.7ms > 450ms; p99 20011.9ms > 900ms; errorRate 32.00% > 1.00%; throughput 7.77 rps < 400 rps
| thread_reads | FAIL | - | 350 | 120 | 15.09 | 4915.4 | 15093.4 | 16032.6 | 0.00 | 0.00 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `thread_reads`: p50 4915.4ms > 130ms; p95 15093.4ms > 500ms; p99 16032.6ms > 950ms; throughput 15.09 rps < 350 rps
| queue_backlog_drain | FAIL | - | 10 | 40 | 0.08 | 160.4 | 218.3 | 218.3 | 0.00 | 0.00 | 0 (obs:0) | 10 | 0 | worker/queue saturation |
- Failures for `queue_backlog_drain`: p50 160.4ms > 20ms; p95 218.3ms > 100ms; queue drain 0.08 jobs/s < 800 jobs/s
| queue_retry_failure_storm | FAIL | - | 6 | 30 | 1.51 | 168.2 | 183.9 | 183.9 | 66.67 | 0.00 | 0 (obs:0) | 4 | 1 | worker/queue saturation |
- Failures for `queue_retry_failure_storm`: p50 168.2ms > 30ms; p95 183.9ms > 180ms; errorRate 66.67% > 25.00%; queue drain 1.51 jobs/s < 500 jobs/s
| session_validation_burst | FAIL | - | 300 | 300 | 15.53 | 10442.9 | 18917.9 | 19083.4 | 90.00 | 0.00 | 0 (obs:0) | 0 | 0 | auth/session collapse |
- Failures for `session_validation_burst`: p50 10442.9ms > 140ms; p95 18917.9ms > 600ms; p99 19083.4ms > 1200ms; errorRate 90.00% > 3.00%; throughput 15.53 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 12542.8ms > 180ms; p95 20003.6ms > 700ms; p99 20005.9ms > 1400ms; errorRate 100.00% > 2.50%; throughput 17.47 rps < 300 rps
2. `session_validation_burst` - failed gate: p50 10442.9ms > 140ms; p95 18917.9ms > 600ms; p99 19083.4ms > 1200ms; errorRate 90.00% > 3.00%; throughput 15.53 rps < 300 rps
3. `bookings_reads_paginated` - failed gate: p50 12317.5ms > 120ms; p95 20005.7ms > 450ms; p99 20011.9ms > 900ms; errorRate 32.00% > 1.00%; throughput 7.77 rps < 400 rps
4. `thread_reads` - failed gate: p50 4915.4ms > 130ms; p95 15093.4ms > 500ms; p99 16032.6ms > 950ms; throughput 15.09 rps < 350 rps
5. `bookings_create_1000` - failed gate: p50 5101.5ms > 300ms; p95 9228.7ms > 1000ms; p99 9377.6ms > 2000ms; errorRate 100.00% > 2.00%; throughput 18.88 rps < 120 rps

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