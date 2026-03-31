# Load-Test Gates Benchmark Report

- Run ID: `2026-03-12T03-46-53-526Z`
- Mode: `mock`
- Suite: `messages`
- Base URL: `http://localhost:3000`
- Started: `2026-03-12T03:46:53.525Z`
- Completed: `2026-03-12T03:46:54.236Z`

## Results

| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| messages_send_2000 | PASS | - | 2000 | 2000 | 2867.23 | 96.7 | 120.8 | 454.4 | 1.80 | 0.00 | 0 (obs:0) | 0 | 0 | none |

## Top 5 Bottlenecks

1. `messages_send_2000` - high p95 120.8ms, throughput 2867.2 rps

## Recommended Fixes

1. No gate failures in this pass. Next step: run same suite in live staging with production-like auth+data volume.

## Failing Gates

- None