# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T14-31-20-326Z`
- Mode: `live`
- Suite: `messages`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T14:31:20.326Z`
- Completed: `2026-03-12T14:31:40.823Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| messages_send_2000 | FAIL | - | 2000 | 2000 | 98.05 | 12638.0 | 20070.8 | 20223.3 | 81.10 | 38.75 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 12638.0ms > 180ms; p95 20070.8ms > 700ms; p99 20223.3ms > 1400ms; errorRate 81.10% > 2.50%; throughput 98.05 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 12638.0ms > 180ms; p95 20070.8ms > 700ms; p99 20223.3ms > 1400ms; errorRate 81.10% > 2.50%; throughput 98.05 rps < 300 rps

## Recommended Fixes

1. Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.

## Failing Gates

- `messages_send_2000`