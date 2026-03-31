# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T04-51-14-139Z`
- Mode: `live`
- Suite: `messages`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T04:51:14.139Z`
- Completed: `2026-03-12T04:54:45.178Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| messages_send_2000 | FAIL | - | 2000 | 2000 | 9.48 | 4826.5 | 20274.0 | 20276.2 | 89.75 | 22.65 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 4826.5ms > 180ms; p95 20274.0ms > 700ms; p99 20276.2ms > 1400ms; errorRate 89.75% > 2.50%; throughput 9.48 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 4826.5ms > 180ms; p95 20274.0ms > 700ms; p99 20276.2ms > 1400ms; errorRate 89.75% > 2.50%; throughput 9.48 rps < 300 rps

## Recommended Fixes

1. Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.

## Failing Gates

- `messages_send_2000`