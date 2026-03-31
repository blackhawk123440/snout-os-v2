# Load-Test Gates Benchmark Report

- Run ID: `2026-03-13T02-28-31-533Z`
- Mode: `live`
- Suite: `messages`
- Base URL: `https://snout-os-staging.onrender.com`
- Started: `2026-03-13T02:28:31.533Z`
- Completed: `2026-03-13T02:28:57.173Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| messages_send_2000 | FAIL | - | 2000 | 2000 | 78.04 | 11126.0 | 20059.5 | 20060.8 | 77.00 | 38.55 | 0 (obs:0) | 0 | 0 | messaging/provider bottleneck |
- Failures for `messages_send_2000`: p50 11126.0ms > 180ms; p95 20059.5ms > 700ms; p99 20060.8ms > 1400ms; errorRate 77.00% > 2.50%; throughput 78.04 rps < 300 rps

## Top 5 Bottlenecks

1. `messages_send_2000` - failed gate: p50 11126.0ms > 180ms; p95 20059.5ms > 700ms; p99 20060.8ms > 1400ms; errorRate 77.00% > 2.50%; throughput 78.04 rps < 300 rps

## Recommended Fixes

1. Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.

## Failing Gates

- `messages_send_2000`