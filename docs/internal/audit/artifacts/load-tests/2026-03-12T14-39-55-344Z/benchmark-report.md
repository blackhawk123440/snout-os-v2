# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T14-39-55-344Z`
- Mode: `live`
- Suite: `messages`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T14:39:55.344Z`
- Completed: `2026-03-12T14:40:45.863Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| messages_send_2000 | FAIL | - | 2000 | 2000 | 39.60 | 14510.8 | 20077.5 | 20360.3 | 89.30 | 47.25 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 14510.8ms > 180ms; p95 20077.5ms > 700ms; p99 20360.3ms > 1400ms; errorRate 89.30% > 2.50%; throughput 39.60 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 14510.8ms > 180ms; p95 20077.5ms > 700ms; p99 20360.3ms > 1400ms; errorRate 89.30% > 2.50%; throughput 39.60 rps < 300 rps

## Recommended Fixes

1. Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.

## Failing Gates

- `messages_send_2000`