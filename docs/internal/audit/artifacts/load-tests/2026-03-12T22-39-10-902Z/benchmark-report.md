# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T22-39-10-902Z`
- Mode: `live`
- Suite: `messages`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T22:39:10.902Z`
- Completed: `2026-03-12T22:39:38.063Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| messages_send_2000 | FAIL | - | 2000 | 2000 | 73.67 | 19938.2 | 20261.5 | 20263.9 | 87.50 | 49.90 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 19938.2ms > 180ms; p95 20261.5ms > 700ms; p99 20263.9ms > 1400ms; errorRate 87.50% > 2.50%; throughput 73.67 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 19938.2ms > 180ms; p95 20261.5ms > 700ms; p99 20263.9ms > 1400ms; errorRate 87.50% > 2.50%; throughput 73.67 rps < 300 rps

## Recommended Fixes

1. Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.

## Failing Gates

- `messages_send_2000`