# Load-Test Gates Benchmark Report

- Run ID: `2026-03-13T02-14-52-381Z`
- Mode: `live`
- Suite: `messages`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-13T02:14:52.381Z`
- Completed: `2026-03-13T02:15:13.872Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| messages_send_2000 | FAIL | - | 2000 | 2000 | 93.09 | 20001.6 | 20173.9 | 20178.1 | 91.05 | 51.10 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 20001.6ms > 180ms; p95 20173.9ms > 700ms; p99 20178.1ms > 1400ms; errorRate 91.05% > 2.50%; throughput 93.09 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 20001.6ms > 180ms; p95 20173.9ms > 700ms; p99 20178.1ms > 1400ms; errorRate 91.05% > 2.50%; throughput 93.09 rps < 300 rps

## Recommended Fixes

1. Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.

## Failing Gates

- `messages_send_2000`