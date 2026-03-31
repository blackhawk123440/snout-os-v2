# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T03-15-59-296Z`
- Mode: `live`
- Suite: `smoke`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T03:15:59.296Z`
- Completed: `2026-03-12T03:20:07.092Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| bookings_create_1000 | FAIL | - | 200 | 200 | 20.90 | 5504.1 | 9292.3 | 9514.7 | 100.00 | 0.00 | 0 (obs:0) | 0 | 0 | config failure |
- Failures for `bookings_create_1000`: p50 5504.1ms > 300ms; p95 9292.3ms > 1000ms; p99 9514.7ms > 2000ms; errorRate 100.00% > 2.00%; throughput 20.90 rps < 120 rps
| messages_send_2000 | FAIL | - | 350 | 350 | 17.42 | 12409.9 | 20004.2 | 20021.2 | 100.00 | 12.57 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 12409.9ms > 180ms; p95 20004.2ms > 700ms; p99 20021.2ms > 1400ms; errorRate 100.00% > 2.50%; throughput 17.42 rps < 300 rps
| bookings_reads_paginated | FAIL | - | 400 | 120 | 7.90 | 10771.3 | 20003.3 | 20004.6 | 27.75 | 27.75 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `bookings_reads_paginated`: p50 10771.3ms > 120ms; p95 20003.3ms > 450ms; p99 20004.6ms > 900ms; errorRate 27.75% > 1.00%; throughput 7.90 rps < 400 rps
| thread_reads | FAIL | - | 350 | 120 | 15.48 | 5211.2 | 14410.2 | 15973.1 | 0.00 | 0.00 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `thread_reads`: p50 5211.2ms > 130ms; p95 14410.2ms > 500ms; p99 15973.1ms > 950ms; throughput 15.48 rps < 350 rps
| queue_backlog_drain | FAIL | - | 10 | 40 | 0.08 | 168.2 | 195.6 | 195.6 | 0.00 | 0.00 | 0 (obs:0) | 10 | 0 | worker/queue saturation |
- Failures for `queue_backlog_drain`: p50 168.2ms > 20ms; p95 195.6ms > 100ms; queue drain 0.08 jobs/s < 800 jobs/s
| queue_retry_failure_storm | FAIL | - | 6 | 30 | 1.52 | 165.7 | 196.1 | 196.1 | 66.67 | 0.00 | 0 (obs:0) | 4 | 1 | worker/queue saturation |
- Failures for `queue_retry_failure_storm`: p50 165.7ms > 30ms; p95 196.1ms > 180ms; errorRate 66.67% > 25.00%; queue drain 1.52 jobs/s < 500 jobs/s
| session_validation_burst | FAIL | - | 300 | 300 | 16.62 | 9724.2 | 17609.0 | 17912.2 | 80.00 | 0.00 | 0 (obs:0) | 0 | 0 | auth/session collapse |
- Failures for `session_validation_burst`: p50 9724.2ms > 140ms; p95 17609.0ms > 600ms; p99 17912.2ms > 1200ms; errorRate 80.00% > 3.00%; throughput 16.62 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 12409.9ms > 180ms; p95 20004.2ms > 700ms; p99 20021.2ms > 1400ms; errorRate 100.00% > 2.50%; throughput 17.42 rps < 300 rps
2. `session_validation_burst` - failed gate: p50 9724.2ms > 140ms; p95 17609.0ms > 600ms; p99 17912.2ms > 1200ms; errorRate 80.00% > 3.00%; throughput 16.62 rps < 300 rps
3. `bookings_reads_paginated` - failed gate: p50 10771.3ms > 120ms; p95 20003.3ms > 450ms; p99 20004.6ms > 900ms; errorRate 27.75% > 1.00%; throughput 7.90 rps < 400 rps
4. `thread_reads` - failed gate: p50 5211.2ms > 130ms; p95 14410.2ms > 500ms; p99 15973.1ms > 950ms; throughput 15.48 rps < 350 rps
5. `bookings_create_1000` - failed gate: p50 5504.1ms > 300ms; p95 9292.3ms > 1000ms; p99 9514.7ms > 2000ms; errorRate 100.00% > 2.00%; throughput 20.90 rps < 120 rps

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