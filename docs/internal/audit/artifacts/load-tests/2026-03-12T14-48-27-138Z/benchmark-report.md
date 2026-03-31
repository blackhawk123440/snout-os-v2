# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T14-48-27-138Z`
- Mode: `live`
- Suite: `messages`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T14:48:27.138Z`
- Completed: `2026-03-12T14:48:48.676Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| messages_send_2000 | FAIL | - | 2000 | 2000 | 98.21 | 20042.9 | 20231.7 | 20233.5 | 98.40 | 72.75 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 20042.9ms > 180ms; p95 20231.7ms > 700ms; p99 20233.5ms > 1400ms; errorRate 98.40% > 2.50%; throughput 98.21 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 20042.9ms > 180ms; p95 20231.7ms > 700ms; p99 20233.5ms > 1400ms; errorRate 98.40% > 2.50%; throughput 98.21 rps < 300 rps

## Recommended Fixes

1. Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.

## Failing Gates

- `messages_send_2000`