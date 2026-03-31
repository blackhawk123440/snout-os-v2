# Load-Test Gates Benchmark Report

- Run ID: `2026-03-11T22-13-38-768Z`
- Mode: `live`
- Suite: `live-ramp`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-11T22:13:38.768Z`
- Completed: `2026-03-11T22:24:55.389Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| bookings_create_1000 | FAIL | high | 0 | 0 | 0.00 | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 (obs:0) | 0 | 0 | config failure |
- Failures for `bookings_create_1000`: CONFIG-BLOCKED: Public booking is disabled in SaaS mode until org binding is configured
| messages_send_2000 | FAIL | high | 350 | 350 | 17.44 | 13366.0 | 20010.2 | 20011.6 | 100.00 | 15.71 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 13366.0ms > 180ms; p95 20010.2ms > 700ms; p99 20011.6ms > 1400ms; errorRate 100.00% > 2.50%; throughput 17.44 rps < 300 rps
| bookings_reads_paginated | FAIL | high | 400 | 120 | 8.37 | 11229.1 | 20002.9 | 20003.5 | 18.00 | 18.00 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `bookings_reads_paginated`: p50 11229.1ms > 120ms; p95 20002.9ms > 450ms; p99 20003.5ms > 900ms; errorRate 18.00% > 1.00%; throughput 8.37 rps < 400 rps
| thread_reads | FAIL | high | 350 | 120 | 12.60 | 6668.8 | 19393.6 | 20001.8 | 1.14 | 1.14 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `thread_reads`: p50 6668.8ms > 130ms; p95 19393.6ms > 500ms; p99 20001.8ms > 950ms; errorRate 1.14% > 1.00%; throughput 12.60 rps < 350 rps
| queue_backlog_drain | FAIL | high | 10 | 40 | 0.08 | 174.4 | 239.8 | 239.8 | 0.00 | 0.00 | 0 (obs:0) | 10 | 0 | worker/queue saturation |
- Failures for `queue_backlog_drain`: p50 174.4ms > 20ms; p95 239.8ms > 100ms; queue drain 0.08 jobs/s < 800 jobs/s
| queue_retry_failure_storm | FAIL | high | 6 | 30 | 1.35 | 176.9 | 196.0 | 196.0 | 66.67 | 0.00 | 0 (obs:0) | 8 | 1 | worker/queue saturation |
- Failures for `queue_retry_failure_storm`: p50 176.9ms > 30ms; p95 196.0ms > 180ms; errorRate 66.67% > 25.00%; queue drain 1.35 jobs/s < 500 jobs/s
| session_validation_burst | FAIL | high | 300 | 300 | 18.36 | 8806.7 | 15551.2 | 15710.0 | 90.00 | 0.00 | 0 (obs:0) | 0 | 0 | DB/read bottleneck |
- Failures for `session_validation_burst`: p50 8806.7ms > 140ms; p95 15551.2ms > 600ms; p99 15710.0ms > 1200ms; errorRate 90.00% > 3.00%; throughput 18.36 rps < 300 rps

## Stage-by-Stage Degradation

| Gate | Stage | Pass | p50 | p95 | p99 | Error % | Timeout % | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| bookings_create_1000 | low | FAIL | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 | 0 | config failure |
| messages_send_2000 | low | FAIL | 6096.0 | 9586.5 | 9697.6 | 100.00 | 0.00 | 0 | 0 | messaging/provider bottleneck |
| bookings_reads_paginated | low | FAIL | 4841.0 | 5985.8 | 6511.0 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| thread_reads | low | FAIL | 2386.5 | 4093.3 | 4261.2 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| queue_backlog_drain | low | FAIL | 204.3 | 279.9 | 279.9 | 0.00 | 0.00 | 3 | 0 | worker/queue saturation |
| queue_retry_failure_storm | low | FAIL | 133.2 | 147.6 | 147.6 | 50.00 | 0.00 | 7 | 1 | worker/queue saturation |
| session_validation_burst | low | FAIL | 3698.9 | 5492.4 | 5521.3 | 71.43 | 0.00 | 0 | 0 | DB/read bottleneck |
| bookings_create_1000 | medium | FAIL | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 | 0 | config failure |
| messages_send_2000 | medium | FAIL | 8984.2 | 16752.1 | 16879.5 | 100.00 | 0.00 | 0 | 0 | messaging/provider bottleneck |
| bookings_reads_paginated | medium | FAIL | 9604.5 | 14801.8 | 16843.9 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| thread_reads | medium | FAIL | 4795.8 | 9493.0 | 10739.2 | 0.00 | 0.00 | 0 | 0 | DB/read bottleneck |
| queue_backlog_drain | medium | FAIL | 167.8 | 196.1 | 196.1 | 0.00 | 0.00 | 6 | 0 | worker/queue saturation |
| queue_retry_failure_storm | medium | FAIL | 164.4 | 203.0 | 203.0 | 33.33 | 0.00 | 8 | 1 | worker/queue saturation |
| session_validation_burst | medium | FAIL | 6684.7 | 11778.2 | 11888.6 | 84.62 | 0.00 | 0 | 0 | DB/read bottleneck |
| bookings_create_1000 | high | FAIL | 0.0 | 0.0 | 0.0 | 0.00 | 0.00 | 0 | 0 | config failure |
| messages_send_2000 | high | FAIL | 13366.0 | 20010.2 | 20011.6 | 100.00 | 15.71 | 0 | 0 | messaging/provider bottleneck |
| bookings_reads_paginated | high | FAIL | 11229.1 | 20002.9 | 20003.5 | 18.00 | 18.00 | 0 | 0 | DB/read bottleneck |
| thread_reads | high | FAIL | 6668.8 | 19393.6 | 20001.8 | 1.14 | 1.14 | 0 | 0 | DB/read bottleneck |
| queue_backlog_drain | high | FAIL | 174.4 | 239.8 | 239.8 | 0.00 | 0.00 | 10 | 0 | worker/queue saturation |
| queue_retry_failure_storm | high | FAIL | 176.9 | 196.0 | 196.0 | 66.67 | 0.00 | 8 | 1 | worker/queue saturation |
| session_validation_burst | high | FAIL | 8806.7 | 15551.2 | 15710.0 | 90.00 | 0.00 | 0 | 0 | DB/read bottleneck |

## First Degradation Point

| Gate | First degradation | Category | Details |
|---|---|---|---|
| bookings_create_1000 | low | config failure | CONFIG-BLOCKED: Public booking is disabled in SaaS mode until org binding is configured |
| messages_send_2000 | low | messaging/provider bottleneck | p50 6096.0ms > 180ms; p95 9586.5ms > 700ms; p99 9697.6ms > 1400ms; errorRate 100.00% > 2.50%; throughput 12.56 rps < 300 rps |
| bookings_reads_paginated | low | DB/read bottleneck | p50 4841.0ms > 120ms; p95 5985.8ms > 450ms; p99 6511.0ms > 900ms; throughput 8.05 rps < 400 rps |
| thread_reads | low | DB/read bottleneck | p50 2386.5ms > 130ms; p95 4093.3ms > 500ms; p99 4261.2ms > 950ms; throughput 15.49 rps < 350 rps |
| queue_backlog_drain | low | worker/queue saturation | p50 204.3ms > 20ms; p95 279.9ms > 100ms; p99 279.9ms > 250ms; queue drain 0.02 jobs/s < 800 jobs/s |
| queue_retry_failure_storm | low | worker/queue saturation | p50 133.2ms > 30ms; errorRate 50.00% > 25.00%; queue drain 0.50 jobs/s < 500 jobs/s |
| session_validation_burst | low | DB/read bottleneck | p50 3698.9ms > 140ms; p95 5492.4ms > 600ms; p99 5521.3ms > 1200ms; errorRate 71.43% > 3.00%; throughput 18.58 rps < 300 rps |

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 13366.0ms > 180ms; p95 20010.2ms > 700ms; p99 20011.6ms > 1400ms; errorRate 100.00% > 2.50%; throughput 17.44 rps < 300 rps
2. `bookings_reads_paginated` - failed gate: p50 11229.1ms > 120ms; p95 20002.9ms > 450ms; p99 20003.5ms > 900ms; errorRate 18.00% > 1.00%; throughput 8.37 rps < 400 rps
3. `session_validation_burst` - failed gate: p50 8806.7ms > 140ms; p95 15551.2ms > 600ms; p99 15710.0ms > 1200ms; errorRate 90.00% > 3.00%; throughput 18.36 rps < 300 rps
4. `thread_reads` - failed gate: p50 6668.8ms > 130ms; p95 19393.6ms > 500ms; p99 20001.8ms > 950ms; errorRate 1.14% > 1.00%; throughput 12.60 rps < 350 rps
5. `queue_retry_failure_storm` - failed gate: p50 176.9ms > 30ms; p95 196.0ms > 180ms; errorRate 66.67% > 25.00%; queue drain 1.35 jobs/s < 500 jobs/s

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