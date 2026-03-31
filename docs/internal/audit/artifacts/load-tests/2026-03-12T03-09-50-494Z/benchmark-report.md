# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T03-09-50-494Z`
- Mode: `live`
- Suite: `smoke`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T03:09:50.494Z`
- Completed: `2026-03-12T03:13:57.207Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| bookings_create_1000 | FAIL | - | 200 | 200 | 22.68 | 4885.3 | 8613.8 | 8743.9 | 100.00 | 0.00 | 0 (obs:0) | 0 | 0 | config failure |
- Failures for `bookings_create_1000`: p50 4885.3ms > 300ms; p95 8613.8ms > 1000ms; p99 8743.9ms > 2000ms; errorRate 100.00% > 2.00%; throughput 22.68 rps < 120 rps
| messages_send_2000 | FAIL | - | 350 | 350 | 17.47 | 14191.9 | 20016.4 | 20016.7 | 100.00 | 20.00 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 14191.9ms > 180ms; p95 20016.4ms > 700ms; p99 20016.7ms > 1400ms; errorRate 100.00% > 2.50%; throughput 17.47 rps < 300 rps
| bookings_reads_paginated | FAIL | - | 400 | 120 | 7.84 | 10713.8 | 20002.8 | 20006.0 | 24.00 | 24.00 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `bookings_reads_paginated`: p50 10713.8ms > 120ms; p95 20002.8ms > 450ms; p99 20006.0ms > 900ms; errorRate 24.00% > 1.00%; throughput 7.84 rps < 400 rps
| thread_reads | FAIL | - | 350 | 120 | 15.30 | 4810.6 | 14759.1 | 15372.1 | 0.00 | 0.00 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `thread_reads`: p50 4810.6ms > 130ms; p95 14759.1ms > 500ms; p99 15372.1ms > 950ms; throughput 15.30 rps < 350 rps
| queue_backlog_drain | FAIL | - | 10 | 40 | 0.08 | 163.5 | 185.4 | 185.4 | 0.00 | 0.00 | 0 (obs:0) | 10 | 0 | worker/queue saturation |
- Failures for `queue_backlog_drain`: p50 163.5ms > 20ms; p95 185.4ms > 100ms; queue drain 0.08 jobs/s < 800 jobs/s
| queue_retry_failure_storm | FAIL | - | 6 | 30 | 1.56 | 148.1 | 184.7 | 184.7 | 66.67 | 0.00 | 0 (obs:0) | 4 | 1 | worker/queue saturation |
- Failures for `queue_retry_failure_storm`: p50 148.1ms > 30ms; p95 184.7ms > 180ms; errorRate 66.67% > 25.00%; queue drain 1.56 jobs/s < 500 jobs/s
| session_validation_burst | FAIL | - | 300 | 300 | 17.01 | 9694.6 | 17386.9 | 17522.4 | 90.00 | 0.00 | 0 (obs:0) | 0 | 0 | auth/session collapse |
- Failures for `session_validation_burst`: p50 9694.6ms > 140ms; p95 17386.9ms > 600ms; p99 17522.4ms > 1200ms; errorRate 90.00% > 3.00%; throughput 17.01 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 14191.9ms > 180ms; p95 20016.4ms > 700ms; p99 20016.7ms > 1400ms; errorRate 100.00% > 2.50%; throughput 17.47 rps < 300 rps
2. `session_validation_burst` - failed gate: p50 9694.6ms > 140ms; p95 17386.9ms > 600ms; p99 17522.4ms > 1200ms; errorRate 90.00% > 3.00%; throughput 17.01 rps < 300 rps
3. `bookings_reads_paginated` - failed gate: p50 10713.8ms > 120ms; p95 20002.8ms > 450ms; p99 20006.0ms > 900ms; errorRate 24.00% > 1.00%; throughput 7.84 rps < 400 rps
4. `thread_reads` - failed gate: p50 4810.6ms > 130ms; p95 14759.1ms > 500ms; p99 15372.1ms > 950ms; throughput 15.30 rps < 350 rps
5. `bookings_create_1000` - failed gate: p50 4885.3ms > 300ms; p95 8613.8ms > 1000ms; p99 8743.9ms > 2000ms; errorRate 100.00% > 2.00%; throughput 22.68 rps < 120 rps

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