# Client Portal QA Checklist

## Auth & Role

- [ ] **Role string casing**: Session and API use lowercase `client` (not `CLIENT`)
- [ ] **Login redirect**: CLIENT role redirects to `/client/home` after login
- [ ] **Session includes**: `role`, `orgId`, `clientId` (similar to `sitterId`)
- [ ] **Client without clientId**: Returns 403 "Client profile missing on session" from client APIs

## Endpoint Scoping

All client APIs must use `getRequestContext()`, `requireRole('client')`, `whereOrg(ctx.orgId, ...)`, and scope by `ctx.clientId`. No `orgId` from client requests.

| Endpoint | 401 Unauthorized | 403 Forbidden | 404 Not Found | Scoping |
|----------|------------------|---------------|---------------|---------|
| GET /api/client/me | No session | Wrong role / no clientId | Client not found | orgId + clientId |
| GET /api/client/home | No session | Wrong role / no clientId | - | orgId + clientId |
| GET /api/client/bookings | No session | Wrong role / no clientId | - | orgId + clientId |
| GET /api/client/bookings/[id] | No session | Wrong role / no clientId | Booking not found | orgId + clientId |
| GET /api/client/pets | No session | Wrong role / no clientId | - | orgId + clientId |
| GET /api/client/pets/[id] | No session | Wrong role / no clientId | Pet not found | orgId + clientId |
| GET /api/client/messages | No session | Wrong role / no clientId | - | orgId + clientId |
| GET /api/client/messages/[id] | No session | Wrong role / no clientId | Thread not found | orgId + clientId |
| POST /api/client/messages/[id] | No session | Wrong role / no clientId | Thread not found | orgId + clientId |
| GET /api/client/reports | No session | Wrong role / no clientId | - | orgId + clientId |
| GET /api/client/reports/[id] | No session | Wrong role / no clientId | Report not found | orgId + clientId |

- [ ] No 500s on valid requests
- [ ] Cross-client access blocked (client A cannot see client B data)

## Personal Mode

- [ ] Org lock from request-context; `orgId` never accepted from client request body/query

## UI Surfaces

- [ ] **/client** redirects to `/client/home`
- [ ] **/client/home**: Welcome card, Book a visit CTA, Latest update 💛 card (if report exists), Upcoming & recent bookings
- [ ] **/client/bookings**: List with loading/empty/error states
- [ ] **/client/bookings/[id]**: Booking detail
- [ ] **/client/pets**: List with loading/empty/error states
- [ ] **/client/pets/[id]**: Pet detail
- [ ] **/client/messages**: Inbox list (threads)
- [ ] **/client/messages/[id]**: Thread view + composer
- [ ] **/client/reports**: Report cards list
- [ ] **/client/reports/[id]**: Report detail
- [ ] **/client/profile**: Client info + sign out

## Book a Visit

- [ ] "Book a visit" CTA on `/client/home` links to `/bookings/new`
- [ ] Clients can access `/bookings/new` (middleware allows)

## Playwright Snapshots

Run client snapshots (requires client auth in global setup):

```bash
npx playwright test tests/e2e/client-snapshots.spec.ts --project=client-mobile
```

To update snapshots:

```bash
npx playwright test tests/e2e/client-snapshots.spec.ts --project=client-mobile --update-snapshots
```

**Note**: Client auth requires `api/ops/e2e-login` to support `role: 'client'` and `CLIENT_EMAIL` env. Add client to `tests/e2e/global-setup.ts` if not present.
