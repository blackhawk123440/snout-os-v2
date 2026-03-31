# Integrations — Final Sign-off

Integrations staging sanity completed on current staging deployment.

---

## Staging /api/health JSON

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "version": "04a23a51e76bc910b26e94616e46143db8065fa0",
  "commitSha": "04a23a5",
  "buildTime": "2026-03-07T15:48:53.995Z",
  "envName": "staging",
  "timestamp": "2026-03-07T15:48:53.995Z"
}
```

---

## Sanity checks run

### Route/access checks

- Owner:
  - `/integrations` -> `200`
  - `GET /api/integrations/status` -> `200`
- Admin:
  - Verified by temporarily promoting owner role to `admin` in staging DB and re-authenticating.
  - `/integrations` -> `200`
  - `GET /api/integrations/status` -> `200`

### Stripe

- `POST /api/integrations/stripe/test` -> `200`
- Response: connectivity/account reachable/transfers enabled all true.

### Twilio readiness + test/sync/webhook

- `GET /api/integrations/status` -> `twilio.ready: true`, `numbersConfigured: true`, `webhooksInstalled: true`
- `POST /api/setup/provider/test` -> `200` (connection successful)
- `POST /api/setup/numbers/sync` -> `200` (numbers synced)
- `POST /api/setup/webhooks/install` -> `200` (webhooks installed + verified)

### Calendar readiness

- `GET /api/integrations/status` -> `calendar.ready: false`, `connectedSitters: 0`, `lastSyncAt: null`
- This is consistent with current staging data (no connected sitters with valid calendar tokens).

### AI readiness

- `GET /api/integrations/status` -> `ai.ready: true`, `ai.enabled: true`
- Consistent with staging having AI enabled + API key configured.

---

## Sign-off

- [x] `/integrations` loads in staging.
- [x] Stripe status/test works.
- [x] Twilio readiness/test/sync/webhook state works.
- [x] Calendar readiness state is correct.
- [x] AI readiness state is correct.

**Integrations status:** **COMPLETE**.

---

*Automations remain untouched.*
