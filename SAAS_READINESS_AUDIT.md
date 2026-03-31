# SaaS Readiness Audit

Date: 2026-03-31
Auditor: Codex
Scope: Source code, deployment manifests, CI workflow, and operational/compliance docs in this repository

## Executive Score

- Overall readiness: 5.9 / 10
- Current posture: advanced vertical SaaS build with real production intent, but not yet "elite SaaS ready"
- Launch posture: viable for controlled rollout, not yet ideal for high-trust or enterprise-scale launch

## Scorecard

| Domain | Score | Notes |
| --- | --- | --- |
| Product architecture | 8/10 | Strong domain depth, clear portals, worker model, queueing, messaging, payments |
| Multi-tenancy & data model | 7/10 | Good org-scoping pattern and broad schema, but still depends on disciplined usage |
| Security & auth | 4/10 | Several trust-boundary issues remain in auth, reset flows, and webhook bypass logic |
| Payments & financial integrity | 5/10 | Stripe is integrated, but webhook durability handling is not elite-safe yet |
| Reliability & operations | 6/10 | Health checks, worker topology, docs, and CI exist; backups and infra tier still lag |
| Observability | 7/10 | Sentry, health endpoint, and runtime verification are present |
| QA & release engineering | 6/10 | CI is substantial, but some checks are advisory and local execution evidence is missing here |
| Compliance & privacy | 4/10 | Privacy posture exists, but erase/compliance maturity is not enterprise-ready |

## Highest-Priority Findings

1. Stripe webhook events are marked processed before business side effects complete. If processing crashes after the idempotency row is inserted, Stripe retries will be treated as duplicates and the payment can remain partially applied. See `src/app/api/webhooks/stripe/route.ts`.
2. Twilio webhook signature checks can be bypassed in any environment where `ENABLE_E2E_AUTH` or `ENABLE_E2E_LOGIN` is enabled and the caller knows `E2E_AUTH_KEY`. The bypass helper does not restrict itself to non-production. See `src/app/api/messages/webhook/twilio/route.ts`.
3. Password reset tokens are stored in plaintext and looked up directly from the database. A database read exposure would immediately expose usable reset tokens. See `src/app/api/auth/forgot-password/route.ts` and `src/app/api/auth/reset-password/route.ts`.
4. Authentication code logs too much sensitive detail around sign-in outcomes and database failures, including account existence, password validity state, and stack traces. This is useful during debugging but too noisy for a hardened SaaS auth boundary. See `src/lib/auth.ts`.
5. JWT invalidation fails open when the database cannot be reached, so deleted users or users with changed passwords may keep a valid session during an outage window. See `src/lib/auth.ts`.
6. The declared production database is still on Render `starter`, while the ops checklist explicitly says elite launch requires Standard or an explicit backup cron. The checked-in deployment manifest does not include a backup cron. See `render.yaml` and `docs/OPS_CHECKLIST.md`.
7. The privacy posture explicitly says there is no hard deletion or GDPR erase workflow yet. That blocks "elite" privacy/compliance readiness for many markets. See `docs/PRIVACY.md`.

## Strong Signals

- Real multi-tenant product architecture with dedicated owner, sitter, and client surfaces
- Prisma schema appears broad and operationally serious
- Scoped DB wrapper for tenant models is a strong architectural choice
- Worker process, cron jobs, and Redis-backed queues show good operational separation
- Health endpoint includes DB, Redis, and worker backlog indicators
- CI covers build, typecheck, tests, and deterministic verification flows
- Deployment and operations docs are materially better than typical early-stage repos

## Recommended Hardening Order

1. Fix Stripe webhook durability with transactional or recoverable event processing semantics.
2. Remove or strictly non-production gate all E2E authentication and webhook bypass paths.
3. Hash password reset tokens at rest and reduce auth/reset logging to audit-safe events only.
4. Change auth revocation behavior from fail-open to a safer degraded mode for privileged access.
5. Upgrade production database backup posture and prove restore drills.
6. Close privacy/compliance gaps: erase workflow, retention policy details, DPA/security artifacts.
7. Tighten CI gates so critical audit checks are required rather than advisory where practical.

## Verification Notes

- This audit was static and evidence-based from repository contents.
- Dependencies were not installed in this workspace, so tests/builds were not executed here.
