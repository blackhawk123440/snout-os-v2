# Claude Handoff Context

## Project Snapshot
- **Repo path:** `/Users/leahhudson/Desktop/final form/worktrees/feat-p1-pagination-filtering`
- **Active branch:** `perf/p2-runtime-capacity-and-auth-pass`
- **Local HEAD:** `27f95b4a8f574ea1e83205048c7c930e81816ccb`
- **Staging live commit:** `43ffd1c097db3a4b17a68693a61e5c91ab78428f`

## Current Environment / Constraints
- Keep topology stable:
  - web: standard plan, 2 instances
  - PM2 `-i 2`
  - separate worker service (`pnpm run worker`)
- Keep flags OFF:
  - `REQUEST_CONTEXT_FAST_PATH=false`
  - `MESSAGE_INTAKE_OPTIMIZED_THREAD_LOOKUP=false`
- Twilio and worker tuning are already configured.

## What Was Implemented (Recent Performance Work)
1. **Pre-handoff instrumentation and path shaping** (`df04040`)
2. **DB write-path tuning** (`5a809b4`)
   - Indexed idempotency lookup columns on `MessageEvent`
   - Tuned sync write behavior
3. **Async/coalesced thread-activity updater** (`43ffd1c`)
   - Added `messages.thread-activity` queue + worker
   - Moved `MessageThread` recency updates off synchronous intake hot path
   - Added sync fallback + observability event

## Async/Coalesced Updater Design
- New queue module: `src/lib/messaging/thread-activity-queue.ts`
- Worker initialized from `src/lib/queue.ts`
- Intake path (`sendThreadMessage`) now:
  - enqueue thread activity update (coalesced per thread/debounce window)
  - only do sync fallback when queue unavailable/enqueue fails
- Worker applies monotonic updates so timestamps only move forward.

## Key Measurement Results

### Baseline (interval 1000, before async updater)
- Reference run label: `thread_hotrow_before`
- Pre-handoff total: **p50 3613ms / p95 5894ms**
- High band:
  - accepted: **79.43%** (556/700)
  - shed 503: **143**
  - p95: **11748ms**
  - throughput: **18.79 rps**

### Env-only suppression experiment (interval 300000)
- Better pre-handoff latency, but high-band acceptance did **not** improve materially.
- High accepted around **78.86%** in recheck run.

### Async/coalesced updater (live commit `43ffd1c`)
- Reference run label: `async_coalesced_after_v2`
- Pre-handoff total: **p50 1607ms / p95 2212ms**
- High band:
  - accepted: **86.71%** (607/700)
  - shed 503: **93**
  - p95: **6968ms**
  - throughput: **25.32 rps**

### Baseline -> Async delta (high signal)
- total pre-handoff: **-2006ms p50**, **-3682ms p95**
- high-band accepted: **+7.28pp**
- high-band 503 shed: **-50**
- high-band p95: **-4780ms**

## Known Risks / Follow-ups
- Outbound queue backlog still rises under sustained load; many accepted events remain `queued` during short windows.
- Next bottleneck appears downstream (pickup/drain/provider pacing), not front-door intake.
- Redis warning observed repeatedly: eviction policy is `allkeys-lru`; ideal is `noeviction`.

## Recommended Next Task
- Focus on **outbound dispatch drain**:
  - improve pickup/completion latency under burst
  - tune worker concurrency + per-org provider pacing
  - keep intake path unchanged for now

## Useful References
- Latest commits:
  - `27f95b4` (broad checkpoint commit)
  - `43ffd1c` (async/coalesced thread activity updater)
  - `5a809b4` (write-path tuning)
- Prior full transcript:
  - [Pre-handoff performance transcript](cb311996-5798-495e-bc15-b988b60a3be9)
