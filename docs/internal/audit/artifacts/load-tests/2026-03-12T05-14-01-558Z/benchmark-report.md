# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T05-14-01-558Z`
- Mode: `live`
- Suite: `messages`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-12T05:14:01.558Z`
- Completed: `2026-03-12T05:15:55.505Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| messages_send_2000 | FAIL | - | 2000 | 2000 | 17.55 | 3976.5 | 20531.8 | 20533.3 | 90.00 | 21.85 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 3976.5ms > 180ms; p95 20531.8ms > 700ms; p99 20533.3ms > 1400ms; errorRate 90.00% > 2.50%; throughput 17.55 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 3976.5ms > 180ms; p95 20531.8ms > 700ms; p99 20533.3ms > 1400ms; errorRate 90.00% > 2.50%; throughput 17.55 rps < 300 rps

## Recommended Fixes

1. Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.

## Failing Gates

- `messages_send_2000`