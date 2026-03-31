# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T16-18-15-890Z`
- Mode: `live`
- Suite: `messages`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T16:18:15.890Z`
- Completed: `2026-03-12T16:18:38.971Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| messages_send_2000 | FAIL | - | 2000 | 2000 | 86.68 | 18572.6 | 20071.0 | 20318.5 | 86.60 | 49.00 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 18572.6ms > 180ms; p95 20071.0ms > 700ms; p99 20318.5ms > 1400ms; errorRate 86.60% > 2.50%; throughput 86.68 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 18572.6ms > 180ms; p95 20071.0ms > 700ms; p99 20318.5ms > 1400ms; errorRate 86.60% > 2.50%; throughput 86.68 rps < 300 rps

## Recommended Fixes

1. Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.

## Failing Gates

- `messages_send_2000`