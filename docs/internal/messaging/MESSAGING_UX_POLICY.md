# Messaging UX and Policy Polish

This document captures the premium UX behavior layered on top of the existing messaging foundation.

## Client Experience Principles

- Client always experiences one professional company thread.
- Lane transitions are invisible to clients.
- Post-visit follow-up and rebooking happen in the same thread.

## Sitter Experience Principles

- Sitters only message during active visit windows.
- Sitter copy is visit-focused and professional.
- Outside active windows, office support takes over.

## Deterministic Policy Rules

| Scenario | User-facing behavior | System rule |
|---|---|---|
| Lane expiry | Client keeps texting same thread and gets office handoff acknowledgement | After grace expiry, reroute to company lane and release service number assignment |
| Rebook (same sitter) | Conversation remains continuous | Stay in company lane until approvals and service window activate service lane |
| Rebook (different sitter) | Office coordinates reassignment in same thread | Sitter swap resets lane state and clears prior service assignment metadata |
| Sitter reassignment | Smooth office-led transition | Release old service mapping and return to company/staffing until re-activation conditions are met |
| Client texts expired service lane | Immediate office response and rebooking option | Mark inbound as rerouted and send one-time automated reroute acknowledgment |
| Meet-and-greet confirmed but one approval pending | Office continues coordination | Keep thread in company/meet_and_greet until deterministic approval policy is satisfied |

