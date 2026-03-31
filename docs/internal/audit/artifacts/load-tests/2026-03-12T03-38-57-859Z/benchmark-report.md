# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T03-38-57-859Z`
- Mode: `live`
- Suite: `messages`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T03:38:57.859Z`
- Completed: `2026-03-12T03:42:03.011Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| messages_send_2000 | FAIL | - | 2000 | 2000 | 10.80 | 4389.4 | 20043.1 | 20055.6 | 100.00 | 21.10 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 4389.4ms > 180ms; p95 20043.1ms > 700ms; p99 20055.6ms > 1400ms; errorRate 100.00% > 2.50%; throughput 10.80 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 4389.4ms > 180ms; p95 20043.1ms > 700ms; p99 20055.6ms > 1400ms; errorRate 100.00% > 2.50%; throughput 10.80 rps < 300 rps

## Recommended Fixes

1. Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.

## Failing Gates

- `messages_send_2000`