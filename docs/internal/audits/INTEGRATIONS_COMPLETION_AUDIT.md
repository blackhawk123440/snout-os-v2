# Integrations Completion Audit

Status: **Partial / mixed**. Twilio setup flow and Stripe Connect sitter flow exist with real persistence. Owner `/integrations` surface is misleading and wired to missing endpoints. Google Calendar OAuth exists but has token-storage and redirect-surface gaps. AI/OpenAI has real runtime usage and governance APIs but limited owner-facing controls.

Automations are frozen (not part of this audit).

## Locked preconditions

1. **Reports / Analytics is still pending staging proof** and is not complete until `verify-reports-analytics` passes on staging with the real `E2E_AUTH_KEY`.
2. **Growth / Tiers requires post-migration staging sanity** after `20260312000000_org_scope_sitter_tiers`:
   - verify `/growth`
   - verify `/settings/tiers`
   - verify `/sitter/performance`

---

## 1) Stripe

### Implemented
- `POST /api/sitter/stripe/connect` creates/reuses Connect account and onboarding link (sitter role only; scoped DB).
- `GET /api/sitter/stripe/status` returns current sitter Connect state from `sitterStripeAccount`.
- `POST /api/webhooks/stripe` handles signature-verified Stripe events and persists payment/refund state.
- Persistence is real (`sitterStripeAccount`, `stripeCharge`, `stripeRefund`, ledger/payment side effects).

### Gaps / risks
- Owner-facing integrations page does not provide a canonical Stripe control surface for setup/health/webhook status.
- Stripe status UX is split across sitter and finance/payroll flows instead of one owner integrations control plane.

### Completion verdict
- **Core integration runtime: implemented**
- **Owner integration control surface: partial**

---

## 2) Twilio

### Implemented
- Real setup APIs:
  - `POST /api/setup/provider/connect`
  - `POST /api/setup/provider/test`
  - `GET /api/setup/provider/status`
  - `GET /api/setup/webhooks/status`
  - `POST /api/setup/webhooks/install`
  - `GET /api/setup/readiness`
  - `POST /api/setup/numbers/sync`
  - `POST /api/setup/test-sms`
- Real inbound handlers:
  - `POST /api/messages/webhook/twilio`
  - `POST /api/twilio/inbound`
- Real UI workflow via `TwilioSetupPanel` used on:
  - `/twilio-setup`
  - `/messaging/twilio-setup`
- Credentials persist in DB (`providerCredential`, encrypted config).

### Gaps / risks
- Two inbound webhook paths still exist (`/api/messages/webhook/twilio` and `/api/twilio/inbound`) and can cause contract drift if not fully unified operationally.
- Twilio setup is in messaging/setup surfaces, not in a single canonical owner integrations page.

### Completion verdict
- **Setup/install/test/check flow: mostly complete**
- **Canonical owner integrations surface: partial**

---

## 3) Google Calendar

### Implemented
- OAuth start/callback:
  - `GET /api/integrations/google/start`
  - `GET /api/integrations/google/callback`
- Stores per-sitter tokens/flags on sitter record (`googleAccessToken`, `googleRefreshToken`, `googleTokenExpiry`, `googleCalendarId`, `calendarSyncEnabled`).
- Calendar sync APIs/surfaces exist elsewhere (`/api/sitter/calendar`, `/api/sitters/[id]/calendar`, toggle endpoints).

### Gaps / risks
- OAuth callback uses direct `prisma.sitter.update({ where: { id: sitterId } })` without org-scoped guard in the update query.
- Redirect target from callback is tied to `/sitters/[id]?tab=calendar`, not a dedicated integrations control center.
- Owner-facing integrations page does not provide an authoritative Google install/test/check panel.

### Completion verdict
- **OAuth + token persistence: implemented**
- **Hardening + owner control surface: partial**

---

## 4) AI / OpenAI

### Implemented
- Runtime OpenAI usage in `src/lib/ai.ts` with fallback behavior when `OPENAI_API_KEY` missing.
- Governance and settings APIs:
  - `GET/PATCH /api/ops/ai/settings`
  - `GET /api/ops/ai/usage`
  - templates endpoints under `/api/ops/ai/templates`
- Org-scoped governance model and budget checks in AI governance libs.

### Gaps / risks
- No canonical owner integrations page section that clearly shows AI provider readiness/test status/install checks.
- AI settings are in ops/settings routes, not surfaced as a unified integration install/check flow.

### Completion verdict
- **AI runtime + governance backend: implemented**
- **Integrations-style readiness/install UX: partial**

---

## 5) Readiness/setup pages and install/test/check flows

### What is real
- Twilio has the strongest complete setup path (connect → test → install webhooks → readiness checks → test SMS).
- Setup page and Twilio setup panel provide actionable, persisted operations.

### What is shell/misleading
- `/integrations` page calls missing endpoints (`/api/integrations/test/stripe`, `/api/integrations/test/database`, `/api/integrations/test/google-calendar`) and therefore is not a reliable operational surface.
- `/integrations` is currently a mixed shell and should not be treated as source-of-truth for integration health.

---

## 6) Where configuration persists

- **Twilio provider credentials:** DB `providerCredential` (encrypted).
- **Twilio number/webhook state:** Twilio upstream + synced local `messageNumber` records.
- **Stripe Connect (sitter):** `sitterStripeAccount`.
- **Stripe payment events:** `stripeCharge`/`stripeRefund` and related ledger/event paths.
- **Google Calendar:** sitter token fields (`googleAccessToken`, `googleRefreshToken`, etc.).
- **AI governance/settings:** org AI settings + prompt/governance tables (via AI governance libs).

---

## 7) Owner-facing canonical integrations control surface (current vs target)

Current state:
- Twilio: operational in setup/messaging pages.
- Stripe: operational runtime + sitter flow, fragmented owner controls.
- Google: OAuth flow exists, fragmented controls.
- AI: operational backend, fragmented controls.
- `/integrations`: currently non-canonical and partially broken.

Target direction:
- One owner integrations surface that shows each provider with:
  - readiness status
  - required config presence
  - test action
  - install/check action
  - last verified timestamp
  - source-of-truth persistence location

---

## 8) Complete vs shell summary

- **Twilio:** real (mostly complete), but needs canonical consolidation.
- **Stripe:** runtime complete, owner integrations UX incomplete.
- **Google Calendar:** functional OAuth/token storage, needs hardening and canonical control UX.
- **AI/OpenAI:** backend complete enough, integrations-style setup/readiness UX incomplete.
- **`/integrations` page:** **shell/misleading** in current form due missing test endpoints.

