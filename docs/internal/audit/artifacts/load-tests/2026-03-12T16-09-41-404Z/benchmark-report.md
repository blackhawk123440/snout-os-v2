# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T16-09-41-404Z`
- Mode: `live`
- Suite: `messages`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T16:09:41.404Z`
- Completed: `2026-03-12T16:10:01.954Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| messages_send_2000 | FAIL | - | 2000 | 2000 | 97.74 | 15296.1 | 20099.7 | 20100.5 | 74.25 | 43.45 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 15296.1ms > 180ms; p95 20099.7ms > 700ms; p99 20100.5ms > 1400ms; errorRate 74.25% > 2.50%; throughput 97.74 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 15296.1ms > 180ms; p95 20099.7ms > 700ms; p99 20100.5ms > 1400ms; errorRate 74.25% > 2.50%; throughput 97.74 rps < 300 rps

## Recommended Fixes

1. Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.

## Failing Gates

- `messages_send_2000`