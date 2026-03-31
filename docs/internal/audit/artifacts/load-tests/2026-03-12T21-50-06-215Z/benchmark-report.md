# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T21-50-06-215Z`
- Mode: `live`
- Suite: `messages`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T21:50:06.215Z`
- Completed: `2026-03-12T21:50:26.902Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| messages_send_2000 | FAIL | - | 2000 | 2000 | 97.19 | 17799.3 | 20126.5 | 20144.7 | 82.20 | 46.35 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 17799.3ms > 180ms; p95 20126.5ms > 700ms; p99 20144.7ms > 1400ms; errorRate 82.20% > 2.50%; throughput 97.19 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 17799.3ms > 180ms; p95 20126.5ms > 700ms; p99 20144.7ms > 1400ms; errorRate 82.20% > 2.50%; throughput 97.19 rps < 300 rps

## Recommended Fixes

1. Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.

## Failing Gates

- `messages_send_2000`