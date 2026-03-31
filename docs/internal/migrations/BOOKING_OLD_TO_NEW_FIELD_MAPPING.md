# Booking Migration Mapping (OLD -> NEW)

Source system: `https://backend-291r.onrender.com`  
Target system: `https://snout-os-staging.onrender.com` (DB-backed import)

## Core booking table mapping

| New field | Required? | Old source field/path | Transformation logic | Default/fallback strategy | Risk/ambiguity | Validation notes |
|---|---|---|---|---|---|---|
| `booking.id` | yes | `booking.id` | direct copy | none (fail if missing) | low | must be UUID-like string |
| `booking.orgId` | yes | n/a (not exposed) | set target org | `default` | medium | controlled by migration arg/env |
| `booking.firstName` | yes | `booking.firstName` | trim | `"Unknown"` | low | non-empty string required |
| `booking.lastName` | yes | `booking.lastName` | trim | `"Unknown"` | low | non-empty string required |
| `booking.phone` | yes | `booking.phone` | trim | `""` (fail-safe) | medium | source should always provide |
| `booking.email` | no | `booking.email` | trim/null | `null` | low | optional in schema |
| `booking.address` | no | `booking.address` | trim/null | `null` | low | optional in schema |
| `booking.pickupAddress` | no | `booking.pickupAddress` | trim/null | `null` | low | optional in schema |
| `booking.dropoffAddress` | no | `booking.dropoffAddress` | trim/null | `null` | low | optional in schema |
| `booking.service` | yes | `booking.service` | direct copy + trim | `"Drop-ins"` | medium | source contains canonical names |
| `booking.startAt` | yes | `booking.startAt` | parse ISO date | fail record if invalid | low | must be valid Date, `< endAt` |
| `booking.endAt` | yes | `booking.endAt` | parse ISO date | fail record if invalid | low | must be valid Date, `> startAt` |
| `booking.totalPrice` | yes | `booking.totalPrice` | numeric cast | `0` | medium | preserves historical amount |
| `booking.status` | yes | `booking.status` | direct copy | `"pending"` | low | source values observed: confirmed/pending/cancelled/completed |
| `booking.assignmentType` | no | `booking.assignmentType` | direct copy | `null` | low | observed: `direct` or `null` |
| `booking.notes` | no | `booking.notes` | direct copy | `null` | low | optional |
| `booking.stripePaymentLinkUrl` | no | `booking.stripePaymentLinkUrl` | direct copy | `null` | low | optional |
| `booking.tipLinkUrl` | no | `booking.tipLinkUrl` | direct copy | `null` | low | optional |
| `booking.paymentStatus` | yes | `booking.paymentStatus` | direct copy | `"unpaid"` | low | observed: paid/unpaid |
| `booking.createdAt` | yes (DB default) | `booking.createdAt` | parse ISO date | `now()` if invalid | medium | use source timestamp where valid |
| `booking.updatedAt` | yes (DB default/@updatedAt) | `booking.updatedAt` | parse ISO date | `now()` if invalid | medium | prisma may update on writes |
| `booking.afterHours` | yes | `booking.afterHours` | boolean cast | `false` | low | optional source |
| `booking.holiday` | yes | `booking.holiday` | boolean cast | `false` | low | optional source |
| `booking.quantity` | yes | `booking.quantity` | numeric cast | `1` | low | optional source |
| `booking.sitterId` | no | `booking.sitterId` | direct copy | `null` | medium | requires sitter row to exist for FK |
| `booking.clientId` | no | `booking.clientId` | direct copy | `null` | high | source often null; no clients endpoint data |

## Related tables mapping

| New field | Required? | Old source field/path | Transformation logic | Default/fallback strategy | Risk/ambiguity | Validation notes |
|---|---|---|---|---|---|---|
| `pet.id` | yes | `booking.pets[].id` | direct copy | generated deterministic fallback if missing | medium | preserve legacy IDs when provided |
| `pet.orgId` | yes | n/a | set target org | `default` | medium | must match booking org |
| `pet.bookingId` | no (relation optional) | parent `booking.id` | set to migrated booking id | none | low | links pet to booking |
| `pet.name` | yes | `booking.pets[].name` | trim | `"Pet"` | low | non-empty required |
| `pet.species` | yes | `booking.pets[].species` | trim | `"Dog"` | low | non-empty required |
| `pet.breed` | no | `booking.pets[].breed` | direct copy | `null` | low | optional |
| `pet.age` | no | `booking.pets[].age` | numeric pass-through | `null` | low | optional |
| `pet.notes` | no | `booking.pets[].notes` | direct copy | `null` | low | optional |
| `timeSlot.id` | yes | `booking.timeSlots[].id` | direct copy | skip row if missing | medium | preserves slot identity |
| `timeSlot.orgId` | yes | n/a | set target org | `default` | medium | must match booking org |
| `timeSlot.bookingId` | yes | parent `booking.id` | direct copy | none | low | FK to booking |
| `timeSlot.startAt` | yes | `booking.timeSlots[].startAt` | parse ISO date | skip row if invalid | medium | must be valid Date |
| `timeSlot.endAt` | yes | `booking.timeSlots[].endAt` | parse ISO date | skip row if invalid | medium | must be valid Date |
| `timeSlot.duration` | yes | `booking.timeSlots[].duration` | numeric cast | `0` | low | required int |
| `timeSlot.createdAt` | yes (DB default) | `booking.timeSlots[].createdAt` | parse ISO date | `now()` | low | preserves source when valid |

## Unmapped/partially-mapped fields

- `dispatchStatus`, `manualDispatchReason`, `conflictOverride*`, `pricingSnapshot`, `depositAmount`, `balanceDueDate`, `paymentDeadline`, and other NEW-only internal fields are **not present** in OLD public booking payloads.
- Strategy: rely on target schema defaults for NEW-only fields; do not invent values.
- `legacyId`/`sourceId` field does not exist in target Booking schema. Legacy identity is preserved by writing source `booking.id` directly into target `booking.id`.

