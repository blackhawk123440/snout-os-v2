# Snout OS — Complete Agent System
# 42 Agents. Every level. No Honda.

## How This Works
1. Every agent prompt is a file in this directory.
2. Open Claude Code. Paste the agent prompt. Let it run.
3. Every agent outputs a named artifact (e.g., AUDIT.md, AUTH_AUDIT.md).
4. Every agent ends with a HANDOFF NOTE — the exact input for the next agent.
5. Nothing moves forward until the verification agent clears it.

## Execution Order
```
TIER 0  → Run once, sets everything up
TIER 1  → Run all 7 in parallel (audit only, no writes)
TIER 2  → Execution agents work from Tier 1 outputs
TIER 3  → Verification agents gate every Tier 2 output
TIER 4  → UI agents run after Tier 3 clears
TIER 5  → Architecture agents run in parallel with Tier 4
TIER 6  → Product completeness after Tiers 4+5
TIER 7  → Intelligence agents run the entire time in parallel (never block engineering)
TIER 8  → Enterprise layer runs last
```

## Agent Roster

### TIER 0 — INITIALIZATION
- 00: Bootstrapper

### TIER 1 — FULL SPECTRUM AUDIT
- 01: Cartographer
- 02: Schema Auditor
- 03: Auth Boundary Auditor
- 04: Type Safety Auditor
- 05: Error Boundary Auditor
- 06: Performance Auditor
- 07: Observability Auditor

### TIER 2 — EXECUTION
- 08: Exterminator
- 09: Schema Surgeon
- 10: Auth Enforcer
- 11: Type Enforcer
- 12: Error Handler
- 13: Performance Optimizer

### TIER 3 — VERIFICATION
- 14: Regression Watchdog
- 15: Contract Verifier
- 16: Flow Tracer
- 17: State Consistency Auditor
- 18: Integration Integrity Agent
- 19: Cross-Portal Coherence Agent

### TIER 4 — UI/UX
- 20: Owner Portal Designer
- 21: Sitter Portal Designer
- 22: Client Portal Designer
- 23: Mobile Responsiveness Agent
- 24: Accessibility Agent

### TIER 5 — ARCHITECTURE
- 25: Architecture Pattern Enforcer
- 26: API Design Agent
- 27: Queue/Job Architecture Agent
- 28: Multi-Tenancy Integrity Agent

### TIER 6 — PRODUCT COMPLETENESS
- 29: Feature Coverage Agent
- 30: Revenue Engineer
- 31: Onboarding Flow Agent
- 32: Notification Coverage Agent

### TIER 7 — MARKET INTELLIGENCE (proposals only, never implements)
- 33: Competitor Autopsy
- 34: Pet Owner Voice Agent
- 35: Sitter Community Agent
- 36: Feature Proposal Agent
- 37: Visionary Architect

### TIER 8 — ENTERPRISE GRADE
- 38: Documentation Agent
- 39: Compliance Agent
- 40: DevOps/Infrastructure Agent
- 41: Analytics & Reporting Agent
