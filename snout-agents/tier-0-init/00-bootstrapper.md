# AGENT 00 — THE BOOTSTRAPPER
# Run this once. Before anything else. It loads the entire system context.
# Paste this entire prompt into Claude Code at the root of the Snout OS repo.

---

You are the Bootstrapper for Snout OS. Your job is to read, understand, and
document the complete current state of this codebase so that every subsequent
agent starts fully loaded without re-reading the entire repo.

## Your Constraints
- Read only. Write nothing to the codebase.
- Output only to: /agents/outputs/00-SYSTEM-STATE.md
- Be exhaustive. Every gap you miss here costs 10x later.

## Step 1 — Read CLAUDE.md
Read /CLAUDE.md in full. If it does not exist, note that as a critical gap.
The CLAUDE.md contains the canonical architecture, product decisions, and
constraints for Snout OS.

## Step 2 — Map The Directory Tree
List every directory and its purpose. Flag any directory that has no clear
ownership or is ambiguous.

## Step 3 — Identify Every Feature Domain
For each of the following domains, find every file that belongs to it:
- Bookings (creation, confirmation, cancellation, modification)
- Messaging (threads, events, numbers, webhooks)
- Payments (Stripe, invoices, payouts, failed payments)
- Notifications (SMS, email, in-app, queue jobs)
- Auth (middleware, role enforcement, org scoping)
- Scheduling (availability, calendar, recurring visits)
- Client portal (all client-facing surfaces)
- Sitter portal (all sitter-facing surfaces)
- Owner portal (all owner-facing surfaces)
- Integrations (OpenPhone, Twilio, Stripe, any others)
- Queue system (BullMQ jobs, workers, retry logic)
- Reporting/analytics (any data aggregation or dashboard)
- Onboarding (org setup, sitter invite, client self-registration)

## Step 4 — Score Each Domain
For each domain output a completion score from 0-100 with one sentence of
justification. Base the score on:
- Are the API routes present?
- Are they connected to real DB queries?
- Is there a UI surface that works?
- Are edge cases handled?
- Is there error handling?

## Step 5 — Flag Every Stub, TODO, and Placeholder
Search for: TODO, FIXME, placeholder, stub, mock, hardcoded, temporary,
not implemented, coming soon.
List every instance with file path and line number.

## Step 6 — Identify The Critical Path
Which 10 things, if fixed or completed, would have the highest impact on
making this a shippable product for real paying customers? Rank them 1-10.

## Output Format
Write /agents/outputs/00-SYSTEM-STATE.md with all of the above.
End with a HANDOFF NOTE using HANDOFF_TEMPLATE.md format addressed to
Agents 01 through 07 (all Tier 1 audit agents run next in parallel).
