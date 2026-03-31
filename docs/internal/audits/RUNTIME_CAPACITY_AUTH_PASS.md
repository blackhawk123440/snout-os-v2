# Runtime Capacity and Auth Pass

## Why this pass

After acceptance-first messaging went live, the dominant failures moved from message-route `429/500` to:

- platform/runtime `502` responses under very high concurrency
- request timeouts (client aborts)
- `/api/auth/session` burst collapse with high `429` rates

## App-side diagnostics added

`/api/health` and `/api/ops/build` now expose non-secret runtime diagnostics:

- node version and process uptime
- process memory snapshot (`rss`, `heapUsed`, `heapTotal`)
- active handle/request counts
- capacity-related env config snapshot (`WEB_CONCURRENCY`, auth limiter budgets, worker concurrency)
- staging-only infra recommendation list from app code

## Recommended staging infra changes

1. Run at least 2 web instances (or larger Render plan) to reduce runtime `502` under burst.
2. Keep outbound provider dispatch on dedicated worker service; do not share with web request path.
3. Set `WEB_CONCURRENCY` and `UV_THREADPOOL_SIZE` explicitly for predictable saturation behavior.
4. Ensure DB pool sizing supports combined web + worker concurrency without connection starvation.
5. Keep auth limiter segmentation:
   - high budget for session checks
   - strict budget for auth mutations
   - moderate budget for generic auth reads

## Auth/session changes in this pass

- session-token limiter key now uses hashed token value (avoids collisions from shared token prefix)
- session cache is checked before limiter for hot-token repeat traffic
- stale cached session is served briefly when limiter is exceeded (burst smoothing)
- in-flight dedupe prevents thundering herd duplicate session computations for same token
