# Messaging Completion Audit (P0)

Date: 2026-03-03  
Scope: Owner + sitter + client messaging, Twilio inbound/outbound, masking numbers, assignment windows, realtime delivery path.

## 1) Current Messaging Surface Inventory

### Owner pages
- `/messages` (legacy all-in-one messaging workspace with tabs for inbox, sitters, numbers, assignments, setup).
- `/messaging` (new hub page that links out to messaging modules).
- `/messaging/inbox` (placeholder page -> links back to `/messages?tab=inbox`).
- `/messaging/sitters` (placeholder page -> links back to `/messages?tab=sitters`).
- `/messaging/numbers` (placeholder page -> links to `/numbers`).
- `/messaging/assignments` (placeholder page -> links to `/assignments`).
- `/twilio-setup` (real owner page embedding `TwilioSetupPanel`).
- `/numbers` (real numbers inventory UI).
- `/assignments` (real assignment windows UI).

### Sitter pages
- `/sitter/inbox` (real sitter inbox UX with thread list, conversation, quick templates, offline queue behavior).

### Client pages
- `/client/messages` (real thread list UI).
- `/client/messages/[id]` (real thread detail UI).

### Messaging APIs (BFF/Next routes)
- Thread/list/detail/send:
  - `GET/POST /api/messages/threads`
  - `GET /api/messages/threads/[id]`
  - `GET/POST /api/messages/threads/[id]/messages`
  - `PATCH /api/messages/threads/[id]/mark-read`
  - `POST /api/messages/[id]/retry`
  - `POST /api/messages/send` (duplicate send entrypoint; pure proxy)
- Role-specific routes:
  - `GET /api/sitter/threads`
  - `GET/POST /api/sitter/threads/[id]/messages`
  - `GET /api/sitters/[id]/messages`
  - `GET /api/client/messages`
  - `GET/POST /api/client/messages/[id]`
- Twilio inbound:
  - `POST /api/messages/webhook/twilio`
  - `POST /api/twilio/inbound`
- Realtime:
  - `GET /api/realtime/messages/threads/[id]` (SSE)
- Numbers/assignments/setup:
  - `GET /api/numbers`, `POST /api/numbers/buy`, `POST /api/numbers/import`, `POST /api/numbers/[id]/assign`, etc.
  - `GET/POST /api/assignments/windows`, `DELETE /api/assignments/windows/[id]`
  - `POST /api/setup/provider/connect`, `GET /api/setup/provider/status`, `POST /api/setup/provider/test`
  - `POST /api/setup/webhooks/install`, `GET /api/setup/webhooks/status`
  - `GET /api/setup/readiness`, `POST /api/setup/numbers/sync`, `POST /api/setup/test-sms`
  - `GET /api/ops/twilio-setup-diagnostics`

### Webhook + provider path
- Setup code (`webhook-url.ts`) declares canonical setup target as `/api/messages/webhook/twilio`.
- Twilio provider abstraction (`TwilioProvider`) is used by some send paths, but not all.

## 2) Data Model Inventory (As Implemented)

### Canonical-intent messaging models present in Prisma
- `MessageThread`
- `MessageEvent`
- `MessageParticipant`
- `MessageNumber`
- `SitterMaskedNumber`
- `AssignmentWindow`
- `ThreadAssignmentAudit`
- `ProviderCredential`

### Legacy/parallel models still present
- `Message` (older booking-oriented message model)

### Additional table dependency outside Prisma model usage
- `ClientContact` is accessed by raw SQL helper due generated-client column bug (`orgld` vs `orgId`).

## 3) Duplicate and Inconsistent Paths

### Inbound webhook duplication (critical)
- Two active inbound Twilio endpoints exist:
  - `/api/messages/webhook/twilio`
  - `/api/twilio/inbound`
- They do not share one resolver/service and write to different data contracts.

### Outbound send duplication (critical)
- Outbound logic currently exists in multiple places:
  - `/api/messages/threads/[id]/messages` (MessageEvent-based direct send fallback)
  - `/api/sitter/threads/[id]/messages` (legacy Message + MessageDelivery path)
  - `/api/client/messages/[id]` (DB write only, no provider send)
  - `/api/messages/send` (proxy-only path)
  - `/api/setup/test-sms` (separate send path with legacy thread/message usage)
- No single canonical `src/lib/messaging/send.ts` service currently owns all sends.

### Owner IA divergence
- New owner IA routes under `/messaging/*` are placeholders that deep-link to older `/messages` or separate pages.
- Owner "messaging hub is real" requirement is not met yet for `/messaging/inbox`, `/messaging/sitters`, `/messaging/numbers`, `/messaging/assignments`.

## 4) Exact Schema / Model Mismatch Locations

1. `src/app/api/messages/webhook/twilio/route.ts`
- Uses `(prisma as any).thread` and `(prisma as any).message` with fields like `numberId`, `threadType`, `participantType`.
- Current Prisma canonical model is `messageThread` / `messageEvent` with fields like `messageNumberId`, `scope`, `actorType`.

2. `src/app/api/sitter/threads/[id]/messages/route.ts`
- Uses `(prisma as any).thread`, `(prisma as any).message`, `(prisma as any).messageDelivery`, and `startsAt`/`endsAt`.
- Canonical model names/fields are `messageThread`, `messageEvent`, and `startAt`/`endAt`.

3. `src/app/api/sitters/[id]/messages/route.ts`
- Uses `(prisma as any).thread` and nested `messages` shape not aligned to canonical `MessageEvent`.

4. `src/app/api/setup/test-sms/route.ts`
- Uses `(prisma as any).thread`, `(prisma as any).message`, `(prisma as any).messageDelivery`.
- Creates/uses fields `class` and `providerType` on `messageNumber`, while Prisma schema defines `numberClass` and `provider`.

5. `src/app/api/setup/numbers/sync/route.ts`
- Upserts `messageNumber` using `class` and `providerType` fields, not canonical schema field names (`numberClass`, `provider`).

6. `src/app/api/setup/webhooks/install/route.ts`
- Same `messageNumber` field mismatch (`class`, `providerType`) in upsert path.

7. `src/lib/messaging/client-contact-lookup.ts`
- Raw SQL workaround indicates unresolved Prisma client/schema generation mismatch around `ClientContact.orgId`.

## 5) Access Control and Tenancy Weak Points (Exact)

1. `src/app/api/messages/threads/route.ts` (GET)
- Any authenticated session can list org threads; no strict role/participant filter.
- Query supports `sitterId`, `clientId`, `inbox`, but caller authorization vs target thread membership is not enforced.

2. `src/app/api/messages/threads/[id]/route.ts` (GET)
- Only checks thread existence in org-scoped DB; no participant/role ownership gate.

3. `src/app/api/messages/threads/[id]/messages/route.ts` (GET)
- Only checks thread exists; no participant membership check per caller.

4. `src/app/api/messages/threads/[id]/messages/route.ts` (POST)
- Sender role mapping is weak (`owner` else `sitter`) and does not explicitly reject client role.
- Owner path is broad; sitter path enforces window, but thread access gate is not uniformly participant-based.

5. `src/app/api/messages/threads/[id]/mark-read/route.ts`
- Marks read with no thread participant check.

6. `src/app/api/realtime/messages/threads/[id]/route.ts`
- SSE checks org-scoped thread existence only; does not verify thread membership for sitter/client.

7. Rate limiting coverage is partial
- Present on send and SSE connect.
- Missing/uneven for thread reads, client/sitter thread reads, and other messaging APIs.

## 6) Twilio Inbound/Outbound Routing Divergence

### Inbound divergence
- `/api/messages/webhook/twilio`:
  - JSON response contract (`{ received: ... }`), writes legacy `thread/message`.
  - Guest client creation path.
- `/api/twilio/inbound`:
  - TwiML response contract.
  - Handles YES/NO sitter commands + offer handling.
  - Writes canonical `messageThread/messageEvent`.
- Both verify signatures but with different URL assumptions and handling behavior.

### Outbound divergence
- Owner send path (`/api/messages/threads/[id]/messages`) uses canonical `messageEvent` in Prisma fallback.
- Sitter send path (`/api/sitter/threads/[id]/messages`) writes legacy `message` + `messageDelivery`.
- Client send path (`/api/client/messages/[id]`) only writes DB event (no provider dispatch/delivery tracking).
- Test SMS path uses legacy thread/message models.

### Routing/masking determinism is not universally enforced
- `chooseFromNumber` and `dynamic-number-routing` exist and are used in some paths.
- Not all inbound/outbound routes go through one shared resolver + persistence contract.

## 7) Current State Against P0 Definition of Done

- One canonical inbound Twilio path: **Not done**
- One canonical thread/message model: **Not done**
- Strict ownership + org access enforcement: **Not done**
- Owner messaging hub real (no placeholders): **Not done**
- Numbers + assignments + masking routing fully wired: **Partial**
- Deterministic verifier exists for messaging: **Not done**
- Staging proof exists for messaging verifier: **Not done**

## 8) Canonical Contract (Target for Implementation)

### Canonical inbound webhook path (single source)
- **Chosen path:** `POST /api/messages/webhook/twilio`
- Rationale:
  - Already used by setup single source (`src/lib/setup/webhook-url.ts`).
  - Referenced by webhook install/status/readiness diagnostics.
  - Best fit to keep setup + runtime in one contract.

`/api/twilio/inbound` should be deprecated/removed after migration and all behavior folded into the canonical handler/service.

### Canonical messaging data model

#### `MessageThread`
- `id`
- `orgId`
- `bookingId` (nullable only if truly needed)
- `clientId`
- `sitterId`
- `maskedNumberId`
- `status`
- `lastMessageAt`

#### `MessageEvent` (or `Message`)
- `id`
- `orgId`
- `threadId`
- `senderRole`
- `body`
- `direction` (`inbound` | `outbound`)
- `deliveryStatus`
- `providerMessageSid`
- `createdAt`

#### `MaskedNumber` (number inventory)
- Twilio number identity, org ownership, class/state, assignment-safe lifecycle.

#### `Assignment / routing windows`
- Deterministic active window resolution for thread routing.
- Conflict prevention and explicit active route visibility.

### Canonical processing requirements
- Inbound: webhook -> resolve org + masked number + active assignment/thread -> persist canonical event -> publish realtime -> role-scoped visibility.
- Outbound: all owner/sitter/client sends through one canonical service (`src/lib/messaging/send.ts` target) with org/thread ownership checks, deterministic from-number selection, provider send, delivery update, realtime publish, and EventLog write.

