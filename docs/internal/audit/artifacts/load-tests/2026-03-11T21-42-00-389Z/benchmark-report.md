# Load-Test Gates Benchmark Report

- Run ID: `2026-03-11T21-42-00-389Z`
- Mode: `live`
- Suite: `full`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-11T21:42:00.389Z`
- Completed: `2026-03-11T21:52:13.847Z`

## Results

| Gate | Pass | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Duplicates | Retries | Dead letters |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| bookings_create_1000 | FAIL | 1000 | 1000 | 46.45 | 3579.6 | 19623.0 | 21329.8 | 100.00 | 0 (obs:0) | 0 | 0 |
- Failures for `bookings_create_1000`: p50 3579.6ms > 300ms; p95 19623.0ms > 1000ms; p99 21329.8ms > 2000ms; errorRate 100.00% > 2.00%; throughput 46.45 rps < 120 rps
| messages_send_2000 | FAIL | 2000 | 2000 | 35.41 | 3916.3 | 31212.1 | 35289.1 | 100.00 | 0 (obs:0) | 0 | 0 |
- Failures for `messages_send_2000`: p50 3916.3ms > 180ms; p95 31212.1ms > 700ms; p99 35289.1ms > 1400ms; errorRate 100.00% > 2.50%; throughput 35.41 rps < 300 rps
| bookings_reads_paginated | FAIL | 1800 | 600 | 10.28 | 13176.8 | 131819.7 | 134688.0 | 13.44 | 0 (obs:0) | 0 | 0 |
- Failures for `bookings_reads_paginated`: p50 13176.8ms > 120ms; p95 131819.7ms > 450ms; p99 134688.0ms > 900ms; errorRate 13.44% > 1.00%; throughput 10.28 rps < 400 rps
| thread_reads | FAIL | 1500 | 500 | 17.73 | 6497.0 | 66715.6 | 69389.9 | 0.00 | 0 (obs:0) | 0 | 0 |
- Failures for `thread_reads`: p50 6497.0ms > 130ms; p95 66715.6ms > 500ms; p99 69389.9ms > 950ms; throughput 17.73 rps < 350 rps
| queue_backlog_drain | FAIL | 40 | 120 | 0.18 | 196.9 | 12697.5 | 27332.7 | 0.00 | 0 (obs:0) | 40 | 0 |
- Failures for `queue_backlog_drain`: p50 196.9ms > 20ms; p95 12697.5ms > 100ms; p99 27332.7ms > 250ms; queue drain 0.18 jobs/s < 800 jobs/s
| queue_retry_failure_storm | FAIL | 18 | 100 | 0.98 | 141.8 | 16093.7 | 16093.7 | 88.89 | 0 (obs:0) | 4 | 1 |
- Failures for `queue_retry_failure_storm`: p50 141.8ms > 30ms; p95 16093.7ms > 180ms; p99 16093.7ms > 350ms; errorRate 88.89% > 25.00%; queue drain 0.98 jobs/s < 500 jobs/s
| session_validation_burst | FAIL | 1200 | 1200 | 39.59 | 3511.2 | 27730.7 | 29990.2 | 97.50 | 0 (obs:0) | 0 | 0 |
- Failures for `session_validation_burst`: p50 3511.2ms > 140ms; p95 27730.7ms > 600ms; p99 29990.2ms > 1200ms; errorRate 97.50% > 3.00%; throughput 39.59 rps < 300 rps

## Top 5 Bottlenecks

1. `bookings_reads_paginated` - failed gate: p50 13176.8ms > 120ms; p95 131819.7ms > 450ms; p99 134688.0ms > 900ms; errorRate 13.44% > 1.00%; throughput 10.28 rps < 400 rps
2. `thread_reads` - failed gate: p50 6497.0ms > 130ms; p95 66715.6ms > 500ms; p99 69389.9ms > 950ms; throughput 17.73 rps < 350 rps
3. `messages_send_2000` - failed gate: p50 3916.3ms > 180ms; p95 31212.1ms > 700ms; p99 35289.1ms > 1400ms; errorRate 100.00% > 2.50%; throughput 35.41 rps < 300 rps
4. `session_validation_burst` - failed gate: p50 3511.2ms > 140ms; p95 27730.7ms > 600ms; p99 29990.2ms > 1200ms; errorRate 97.50% > 3.00%; throughput 39.59 rps < 300 rps
5. `bookings_create_1000` - failed gate: p50 3579.6ms > 300ms; p95 19623.0ms > 1000ms; p99 21329.8ms > 2000ms; errorRate 100.00% > 2.00%; throughput 46.45 rps < 120 rps

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