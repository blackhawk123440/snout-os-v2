# SNOUT OS — AGENT EXECUTION PLAYBOOK
# This is how you run the system. Start here every session.

---

## THE IRON RULE
One agent. One job. One session. Never mix agents in a single Claude Code session.
Every agent reads its input, does its job, writes its output, stops.
The next agent starts fresh with that output as its input.

---

## PHASE 1: FOUNDATION (Day 1)
Run these once. They never run again unless you do a full reset.

```
SESSION 1: Open Claude Code at repo root
Paste: tier-0-init/00-bootstrapper.md
Wait for: /agents/outputs/00-SYSTEM-STATE.md
```

**That file is your ground truth. Read it. It will tell you things you don't know.**

---

## PHASE 2: FULL AUDIT (Day 2 — run all 7 in parallel, different sessions)

```
SESSION 2A: Paste tier-1-audit/01-07-audit-agents.md → AGENT 01 section
            Wait for: /agents/outputs/01-AUDIT.md

SESSION 2B: Paste tier-1-audit/01-07-audit-agents.md → AGENT 02 section
            Wait for: /agents/outputs/02-SCHEMA-AUDIT.md

SESSION 2C: Paste tier-1-audit/01-07-audit-agents.md → AGENT 03 section
            Wait for: /agents/outputs/03-AUTH-AUDIT.md

SESSION 2D: Paste tier-1-audit/01-07-audit-agents.md → AGENT 04 section
            Wait for: /agents/outputs/04-TYPE-AUDIT.md

SESSION 2E: Paste tier-1-audit/01-07-audit-agents.md → AGENT 05 section
            Wait for: /agents/outputs/05-ERROR-AUDIT.md

SESSION 2F: Paste tier-1-audit/01-07-audit-agents.md → AGENT 06 section
            Wait for: /agents/outputs/06-PERFORMANCE-AUDIT.md

SESSION 2G: Paste tier-1-audit/01-07-audit-agents.md → AGENT 07 section
            Wait for: /agents/outputs/07-OBSERVABILITY-AUDIT.md
```

**After Phase 2: You have a complete picture of every problem in the system.**
**Read all 7 outputs. Understand what you're dealing with before fixing anything.**

---

## PHASE 3: EXECUTION LOOP (Day 3 onwards — this is where the Honda becomes a Pagani)

The execution loop runs until every P0 and P1 item in all audit files is [FIXED].

```
FOR EACH P0 ITEM in 01-AUDIT.md:
  SESSION A: AGENT 08 (Exterminator) — fixes one item
  SESSION B: AGENT 14 (Regression Watchdog) — verifies the fix
  IF WATCHDOG RETURNS BLOCKED:
    SESSION C: AGENT 08 again — re-fixes
    SESSION D: AGENT 14 again — re-verifies
  REPEAT until SAFE
  ADVANCE to next P0 item

EVERY 5 FIXES:
  Run AGENT 15 (Contract Verifier) on changed API routes
  Run AGENT 16 (Flow Tracer) on any affected user flows

AFTER ALL P0 ITEMS:
  Run AGENT 09 (Schema Surgeon) on 02-SCHEMA-AUDIT.md
  Run AGENT 10 (Auth Enforcer) on 03-AUTH-AUDIT.md
  Run AGENT 11 (Type Enforcer) on 04-TYPE-AUDIT.md
  Run AGENT 12 (Error Handler) on 05-ERROR-AUDIT.md
  Each followed by AGENT 14 verification

AFTER ALL P0+P1 ITEMS:
  Run AGENT 13 (Performance Optimizer)
  Run AGENT 17 (State Consistency Auditor)
  Run AGENT 18 (Integration Integrity Agent)
  Run AGENT 19 (Cross-Portal Coherence Agent)
```

---

## PHASE 4: UI PASS (After Phase 3 — separate sessions)

```
SESSION: AGENT 20 (Owner Portal Designer)
SESSION: AGENT 21 (Sitter Portal Designer)
SESSION: AGENT 22 (Client Portal Designer)
SESSION: AGENT 23 (Mobile Responsiveness)
SESSION: AGENT 24 (Accessibility)
```

Run AGENT 19 (Cross-Portal Coherence) again after all UI agents complete.

---

## PHASE 5: ARCHITECTURE PASS (Can run parallel to Phase 4)

```
SESSION: AGENT 25 (Architecture Pattern Enforcer)
SESSION: AGENT 26 (API Design Agent)
SESSION: AGENT 27 (Queue Architecture Agent)
SESSION: AGENT 28 (Multi-Tenancy Integrity) ← RUN THIS LAST, it's the security cert
```

**AGENT 28 output is a launch gate. Do not beta without clearing it.**

---

## PHASE 6: PRODUCT COMPLETENESS

```
SESSION: AGENT 29 (Feature Coverage) — biggest session, may take multiple runs
SESSION: AGENT 30 (Revenue Engineer) — second most important
SESSION: AGENT 31 (Onboarding Flow)
SESSION: AGENT 32 (Notification Coverage)
```

Run full AGENT 16 (Flow Tracer) after Phase 6 to verify all 8 flows.

---

## PHASE 7: INTELLIGENCE (Runs entire time, parallel to everything)

```
START EARLY: AGENT 33 (Competitor Autopsy) — start Day 1, runs in background
START EARLY: AGENT 34 (Pet Owner Voice) — start Day 1, runs in background
START EARLY: AGENT 35 (Sitter Community) — start Day 1, runs in background
AFTER PHASES 4+5: AGENT 36 (Feature Proposals) — synthesizes all research
AFTER CARSON REVIEWS 36: AGENT 37 (Visionary Architect) — designs what's next
```

---

## PHASE 8: ENTERPRISE GRADE (After Phase 6 — before public launch)

```
SESSION: AGENT 38 (Documentation)
SESSION: AGENT 39 (Compliance) ← proposals only, review with human
SESSION: AGENT 40 (DevOps/Infrastructure)
SESSION: AGENT 41 (Analytics and Reporting)
```

---

## LAUNCH GATES — DO NOT SHIP WITHOUT THESE

```
[ ] AGENT 28 output: /agents/outputs/28-MULTITENANCY-FINAL.md — zero unresolved items
[ ] AGENT 03 output: /agents/outputs/03-AUTH-AUDIT.md — zero P0 items remaining
[ ] AGENT 16 output: /agents/outputs/16-FLOW-TRACE.md — all 8 flows = COMPLETE
[ ] AGENT 31 completion: all three onboarding flows manually verified
[ ] AGENT 32 completion: all 9 notification triggers verified
[ ] AGENT 39 output: /agents/outputs/39-COMPLIANCE-GAPS.md — all P0 items addressed
```

---

## HOW TO TALK TO EACH AGENT

When you open Claude Code for each agent, start with this:

```
You are [AGENT NAME] for Snout OS.
Read: /CLAUDE.md (system architecture and context)
Read: /agents/outputs/00-SYSTEM-STATE.md (current system state)
Read: [the specific input file for this agent]
Your job: [paste the agent prompt from the corresponding .md file]
Begin.
```

---

## OUTPUT DIRECTORY
All agent outputs go to: /agents/outputs/
Create this directory now: mkdir -p agents/outputs

## TRACKING
After each agent run, update this file marking the agent as complete:
[ ] 00 Bootstrapper
[ ] 01 Cartographer
[ ] 02 Schema Auditor
[ ] 03 Auth Boundary Auditor
[ ] 04 Type Safety Auditor
[ ] 05 Error Boundary Auditor
[ ] 06 Performance Auditor
[ ] 07 Observability Auditor
[ ] 08 Exterminator (ongoing)
[ ] 09 Schema Surgeon
[ ] 10 Auth Enforcer
[ ] 11 Type Enforcer
[ ] 12 Error Handler
[ ] 13 Performance Optimizer
[ ] 14 Regression Watchdog (ongoing gate)
[ ] 15 Contract Verifier (ongoing gate)
[ ] 16 Flow Tracer (ongoing gate)
[ ] 17 State Consistency Auditor
[ ] 18 Integration Integrity Agent
[ ] 19 Cross-Portal Coherence Agent
[ ] 20 Owner Portal Designer
[ ] 21 Sitter Portal Designer
[ ] 22 Client Portal Designer
[ ] 23 Mobile Responsiveness Agent
[ ] 24 Accessibility Agent
[ ] 25 Architecture Pattern Enforcer
[ ] 26 API Design Agent
[ ] 27 Queue Architecture Agent
[ ] 28 Multi-Tenancy Integrity Agent ← LAUNCH GATE
[ ] 29 Feature Coverage Agent
[ ] 30 Revenue Engineer
[ ] 31 Onboarding Flow Agent
[ ] 32 Notification Coverage Agent
[ ] 33 Competitor Autopsy (parallel)
[ ] 34 Pet Owner Voice Agent (parallel)
[ ] 35 Sitter Community Agent (parallel)
[ ] 36 Feature Proposal Agent
[ ] 37 Visionary Architect
[ ] 38 Documentation Agent
[ ] 39 Compliance Agent ← LAUNCH GATE
[ ] 40 DevOps/Infrastructure Agent
[ ] 41 Analytics and Reporting Agent
