# Load-Test Gates Benchmark Report

- Run ID: `2026-03-11T21-30-03-122Z`
- Mode: `mock`
- Suite: `full`
- Base URL: `http://localhost:3000`
- Started: `2026-03-11T21:30:03.122Z`
- Completed: `2026-03-11T21:30:08.610Z`

## Results

| Gate | Pass | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Duplicates | Retries | Dead letters |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| bookings_create_1000 | PASS | 1000 | 1000 | 1506.25 | 132.8 | 171.4 | 175.7 | 1.00 | 0 (obs:98) | 0 | 0 |
| messages_send_2000 | PASS | 2000 | 2000 | 2865.66 | 96.7 | 120.8 | 454.4 | 1.80 | 0 (obs:0) | 0 | 0 |
| bookings_reads_paginated | PASS | 1800 | 600 | 2080.33 | 79.2 | 94.8 | 437.6 | 0.11 | 0 (obs:0) | 0 | 0 |
| thread_reads | PASS | 1500 | 500 | 1633.89 | 98.2 | 115.4 | 434.4 | 0.87 | 0 (obs:0) | 0 | 0 |
| queue_backlog_drain | PASS | 10000 | 120 | 13589.85 | 9.1 | 14.3 | 14.9 | 0.00 | 0 (obs:0) | 0 | 0 |
| queue_retry_failure_storm | PASS | 6000 | 100 | 7318.17 | 12.4 | 28.5 | 38.9 | 1.60 | 0 (obs:0) | 1325 | 96 |
| session_validation_burst | PASS | 1200 | 1200 | 1712.96 | 85.1 | 106.2 | 455.6 | 0.50 | 0 (obs:0) | 0 | 0 |

## Top 5 Bottlenecks

1. `queue_retry_failure_storm` - high p95 28.5ms, throughput 7318.2 rps
2. `bookings_create_1000` - high p95 171.4ms, throughput 1506.3 rps
3. `messages_send_2000` - high p95 120.8ms, throughput 2865.7 rps
4. `thread_reads` - high p95 115.4ms, throughput 1633.9 rps
5. `session_validation_burst` - high p95 106.2ms, throughput 1713.0 rps

## Recommended Fixes

1. No gate failures in this pass. Next step: run same suite in live staging with production-like auth+data volume.

## Failing Gates

- None