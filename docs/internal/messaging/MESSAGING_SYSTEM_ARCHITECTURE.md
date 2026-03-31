# Snout OS Messaging System Architecture

## Goals

Snout messaging is designed as an enterprise-grade, owner-observable communications backbone that feels simple to clients and sitters:

- Clients text Snout as one professional business identity.
- Sitters operate from a clean work inbox with masked numbers.
- Owners run a control-tower workflow with full auditability.

This foundation keeps the current acceptance-first, queue-driven architecture and extends the existing Twilio + Prisma + BullMQ stack.

## Lane Model

### Company Lane

Used for intake and management workflow:

- Booking intake follow-up from website form/client portal
- Front desk/owner coordination with clients
- Sitter staffing and availability outreach
- Meet-and-greet coordination
- Post-service follow-up (tip/review/rebook)

Characteristics:

- Routed to front desk/owner roles
- Uses front desk/company pool identity
- Long-lived, reusable per client

### Service Lane

Used only for approved service relationships:

- Client <-> assigned sitter messaging during service window
- Masked via Twilio number pool
- Owner visibility retained
- Expires after service window + grace period

Characteristics:

- Deterministic lifecycle (`service` -> `grace` -> `expired`)
- Automatically reroutes to company lane after grace
- Never exposes sitter or client personal phone numbers

## Conversation Domain Model

Snout normalizes messaging around `MessageThread` as the conversation aggregate.

- Lane and lifecycle fields:
  - `laneType` (`company` | `service`)
  - `activationStage` (`intake` | `staffing` | `meet_and_greet` | `service` | `follow_up`)
  - `lifecycleStatus` (`active` | `grace` | `expired` | `archived`)
  - `assignedRole` (`front_desk` | `sitter` | `owner` | `automation`)
  - `serviceWindowStart`, `serviceWindowEnd`, `graceEndsAt`
  - `lastClientMessageAt`, `lastSitterMessageAt`

Events remain in `MessageEvent` with delivery state and idempotency tracking, plus `routingDisposition` (`normal` | `blocked` | `rerouted`).

Numbers remain in `MessageNumber`, extended with logical pool assignment state:

- `poolType` (`company` | `service`)
- `assignedThreadId`, `assignedAt`, `releasedAt`

Flags and moderation/audit trail:

- `MessageConversationFlag` for `anti_poaching`, `escalation`, `delivery_issue`, `policy`
- `SitterAvailabilityRequest` for staffing outreach and response-latency tracking

## Conversation Lifecycle

1. Intake
   - Booking submission creates/reuses a company-lane conversation.
   - Front desk owns the thread.
2. Staffing
   - Owner/front desk sends sitter availability requests.
   - `YES` / `NO` responses are tracked with latency.
3. Meet & Greet
   - Still company lane, owner-mediated.
4. Service Activation
   - After approval, thread activates service lane.
   - System assigns service masked number from pool.
5. Active Service Window
   - Messaging routes to assigned sitter (owner still observable).
6. Grace Window
   - Thread remains service-lane temporarily.
7. Expiration
   - Service lane expires, number assignment released, thread reroutes to company lane/front desk.

## Twilio Flow

Outbound:

1. API accepts request quickly (auth, validation, minimal persist).
2. Message intent is persisted (`MessageEvent`), queued to BullMQ.
3. Worker dispatches Twilio send with deterministic chosen from-number.
4. Status callbacks update final delivery state (`sent`/`delivered`/`failed`).

Inbound:

1. Webhook verifies signature.
2. Number-to-org resolution occurs.
3. Conversation lifecycle is reconciled (including expired service reroute).
4. Inbound event is persisted and owner unread counters updated.
5. Soft anti-poaching flags are recorded asynchronously.

## Deterministic Routing Rules

Routing is intentionally simple and auditable:

- `intake|staffing|meet_and_greet` -> company lane/front desk
- `service` stage + active window -> service lane/assigned sitter
- post-service within grace -> service lane (role policy driven)
- after grace expiry -> reroute to company lane/front desk
- ambiguous/escalation conditions -> owner-visible flags

## Anti-Poaching Strategy

### Hard Protections

- Personal sitter/client numbers are never exposed.
- Service assignments are temporary and expire.
- Communication always stays within Snout/Twilio-masked lanes.

### Soft Detection (Default)

Content patterns are detected and flagged (not aggressively blocked by default):

- phone numbers
- emails
- "text me directly", "pay me directly", similar bypass language

Detected events create `MessageConversationFlag` entries for owner visibility and moderation/audit workflows.

## Number Pool Management

Foundation behavior:

- Distinct logical pools via `poolType` (`company`, `service`)
- Assignment on lane activation (`assignedThreadId`, `assignedAt`)
- Release on expiration (`releasedAt`, pool reset to reusable state)
- Health snapshot support:
  - available company numbers
  - available service numbers
  - assigned count
  - low-watermark trigger for provisioning workflows

Provisioning is intentionally guarded: low pool availability emits actionable operational signal rather than unbounded auto-buy behavior.

## Queue-Driven Processing

Snout preserves acceptance-first principles:

- Request path stays minimal (auth, validation, lookup, persist, enqueue)
- Provider dispatch and retries happen in workers
- Thread activity updates are coalesced async
- Non-critical side-effects (soft moderation, analytics-like updates) are fire-and-forget

This keeps latency predictable while supporting enterprise-grade observability and control.

