# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T16-08-13-371Z`
- Mode: `live`
- Suite: `messages`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T16:08:13.371Z`
- Completed: `2026-03-12T16:08:34.033Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| messages_send_2000 | FAIL | - | 2000 | 2000 | 97.64 | 16837.8 | 20227.2 | 20230.2 | 84.85 | 46.40 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 16837.8ms > 180ms; p95 20227.2ms > 700ms; p99 20230.2ms > 1400ms; errorRate 84.85% > 2.50%; throughput 97.64 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 16837.8ms > 180ms; p95 20227.2ms > 700ms; p99 20230.2ms > 1400ms; errorRate 84.85% > 2.50%; throughput 97.64 rps < 300 rps

## Recommended Fixes

1. Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.

## Failing Gates

- `messages_send_2000`