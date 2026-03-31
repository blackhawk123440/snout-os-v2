# Load-Test Gates Benchmark Report

- Run ID: `2026-03-11T21-47-38-379Z`
- Mode: `live`
- Suite: `smoke`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-11T21:47:38.379Z`
- Completed: `2026-03-11T21:51:42.877Z`

## Results

| Gate | Pass | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Duplicates | Retries | Dead letters |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| bookings_create_1000 | FAIL | 200 | 200 | 20.54 | 5571.5 | 9482.0 | 9571.1 | 100.00 | 0 (obs:0) | 0 | 0 |
- Failures for `bookings_create_1000`: p50 5571.5ms > 300ms; p95 9482.0ms > 1000ms; p99 9571.1ms > 2000ms; errorRate 100.00% > 2.00%; throughput 20.54 rps < 120 rps
| messages_send_2000 | FAIL | 350 | 350 | 14.78 | 11451.1 | 23245.7 | 23548.2 | 100.00 | 0 (obs:0) | 0 | 0 |
- Failures for `messages_send_2000`: p50 11451.1ms > 180ms; p95 23245.7ms > 700ms; p99 23548.2ms > 1400ms; errorRate 100.00% > 2.50%; throughput 14.78 rps < 300 rps
| bookings_reads_paginated | FAIL | 400 | 120 | 8.68 | 11924.8 | 23649.3 | 26419.2 | 0.00 | 0 (obs:0) | 0 | 0 |
- Failures for `bookings_reads_paginated`: p50 11924.8ms > 120ms; p95 23649.3ms > 450ms; p99 26419.2ms > 900ms; throughput 8.68 rps < 400 rps
| thread_reads | FAIL | 350 | 120 | 15.75 | 5043.0 | 15109.4 | 15885.9 | 0.00 | 0 (obs:0) | 0 | 0 |
- Failures for `thread_reads`: p50 5043.0ms > 130ms; p95 15109.4ms > 500ms; p99 15885.9ms > 950ms; throughput 15.75 rps < 350 rps
| queue_backlog_drain | FAIL | 10 | 40 | 0.08 | 165.8 | 186.5 | 186.5 | 0.00 | 0 (obs:0) | 10 | 0 |
- Failures for `queue_backlog_drain`: p50 165.8ms > 20ms; p95 186.5ms > 100ms; queue drain 0.08 jobs/s < 800 jobs/s
| queue_retry_failure_storm | FAIL | 6 | 30 | 1.71 | 151.9 | 1099.7 | 1099.7 | 66.67 | 0 (obs:0) | 7 | 1 |
- Failures for `queue_retry_failure_storm`: p50 151.9ms > 30ms; p95 1099.7ms > 180ms; p99 1099.7ms > 350ms; errorRate 66.67% > 25.00%; queue drain 1.71 jobs/s < 500 jobs/s
| session_validation_burst | FAIL | 300 | 300 | 18.55 | 9025.2 | 15670.8 | 15872.9 | 90.00 | 0 (obs:0) | 0 | 0 |
- Failures for `session_validation_burst`: p50 9025.2ms > 140ms; p95 15670.8ms > 600ms; p99 15872.9ms > 1200ms; errorRate 90.00% > 3.00%; throughput 18.55 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 11451.1ms > 180ms; p95 23245.7ms > 700ms; p99 23548.2ms > 1400ms; errorRate 100.00% > 2.50%; throughput 14.78 rps < 300 rps
2. `bookings_reads_paginated` - failed gate: p50 11924.8ms > 120ms; p95 23649.3ms > 450ms; p99 26419.2ms > 900ms; throughput 8.68 rps < 400 rps
3. `session_validation_burst` - failed gate: p50 9025.2ms > 140ms; p95 15670.8ms > 600ms; p99 15872.9ms > 1200ms; errorRate 90.00% > 3.00%; throughput 18.55 rps < 300 rps
4. `thread_reads` - failed gate: p50 5043.0ms > 130ms; p95 15109.4ms > 500ms; p99 15885.9ms > 950ms; throughput 15.75 rps < 350 rps
5. `bookings_create_1000` - failed gate: p50 5571.5ms > 300ms; p95 9482.0ms > 1000ms; p99 9571.1ms > 2000ms; errorRate 100.00% > 2.00%; throughput 20.54 rps < 120 rps

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