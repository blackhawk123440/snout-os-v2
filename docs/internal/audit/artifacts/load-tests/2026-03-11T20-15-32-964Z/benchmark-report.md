# Load-Test Gates Benchmark Report

- Run ID: `2026-03-11T20-15-32-964Z`
- Mode: `mock`
- Suite: `full`
- Base URL: `http://localhost:3000`
- Started: `2026-03-11T20:15:32.957Z`
- Completed: `2026-03-11T20:15:39.326Z`

## Results

| Gate | Pass | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Duplicates | Retries | Dead letters |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| bookings_create_1000 | FAIL | 1000 | 1000 | 1474.23 | 139.5 | 184.9 | 189.9 | 1.00 | 98 | 0 | 0 |
- Failures for `bookings_create_1000`: duplicateRate 9.90% > 0.00%
| messages_send_2000 | PASS | 2000 | 2000 | 2821.28 | 105.6 | 137.7 | 465.7 | 1.80 | 0 | 0 | 0 |
| bookings_reads_paginated | FAIL | 1800 | 600 | 1698.86 | 127.8 | 166.8 | 468.8 | 0.11 | 0 | 0 | 0 |
- Failures for `bookings_reads_paginated`: p50 127.8ms > 120ms
| thread_reads | FAIL | 1500 | 500 | 1508.58 | 113.8 | 147.0 | 451.0 | 1.67 | 0 | 0 | 0 |
- Failures for `thread_reads`: errorRate 1.67% > 1.00%
| queue_backlog_drain | PASS | 10000 | 120 | 13516.34 | 9.1 | 14.3 | 14.9 | 0.00 | 0 | 0 | 0 |
| queue_retry_failure_storm | FAIL | 6000 | 100 | 4316.69 | 18.2 | 52.2 | 65.1 | 8.18 | 0 | 5875 | 491 |
- Failures for `queue_retry_failure_storm`: dead letters 491 > 150; retry count 5875 > 4000
| session_validation_burst | PASS | 1200 | 1200 | 1691.43 | 91.3 | 117.8 | 461.5 | 0.50 | 0 | 0 | 0 |

## Top 5 Bottlenecks

1. `queue_retry_failure_storm` - failed gate: dead letters 491 > 150; retry count 5875 > 4000
2. `bookings_create_1000` - failed gate: duplicateRate 9.90% > 0.00%
3. `thread_reads` - failed gate: errorRate 1.67% > 1.00%
4. `messages_send_2000` - high p95 137.7ms, throughput 2821.3 rps
5. `bookings_reads_paginated` - failed gate: p50 127.8ms > 120ms

## Recommended Fixes

1. Bookings create path: add/create composite indexes for dominant search filters and review idempotency table write contention.
2. Read-heavy list endpoints: verify query plans for sort+filter indexes and enforce narrower includes to avoid row bloat.
3. Queue throughput: raise worker concurrency by queue class, tune retry backoff, and isolate storm-prone jobs into separate queues.

## Failing Gates

- `bookings_create_1000`
- `bookings_reads_paginated`
- `thread_reads`
- `queue_retry_failure_storm`