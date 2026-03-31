# Messaging Real-Number Exposure Audit

Audit date: 2026-03-14  
Scope: messaging, automations, sitter/client UX, and helper utilities that can expose or depend on direct phone numbers.

## High-risk direct-send paths (bypass masked thread routing)

1. `src/lib/bookings/automation-thread-sender.ts`
   - `sendAutomationMessageViaThread()` falls back to raw `sendMessage(recipientPhone, ...)` when thread path fails.
   - Risk: direct client number delivery path remains active under fallback conditions.

2. `src/lib/sms-templates.ts`
   - Multiple helpers call `sendMessage()` directly to `booking.phone`, `sitterPhone`, and `ownerPhone`.
   - Risk: template usage can bypass thread-masked routing entirely.

3. `src/lib/automation-executor.ts`
   - Several branches still call `sendMessage()` directly (owner/sitter reminders and fallback paths).
   - Some metadata fields persist raw phone values (`metadata: { phone: ... }`).
   - Risk: mixed sending model allows masked + unmasked behavior in production.

## Medium-risk data exposure / implied exchange

1. `src/lib/masked-numbers.ts`
   - `getPhoneForViewer()` can return `openphonePhone`, `personalPhone`, or `sitter.phone` depending on role and flow.
   - Risk: accidental role leakage can expose real sitter numbers.

2. `src/components/sitter/SitterProfileTab.tsx`
   - Renders tappable `tel:` links for sitter phone.
   - Risk: if reused in broader contexts, encourages direct off-platform contact.

3. `src/lib/event-emitter.ts` and automation metadata
   - Event payloads include client phone and raw phone metadata.
   - Risk: logs/analytics surfaces can leak direct contact info outside need-to-know contexts.

## Low-risk / expected operational usage

1. Intake and CRM management APIs (`bookings`, `clients`, `sitters`) store phone as core business data.
2. Twilio setup and number inventory screens require real E.164 values by design.

## Recommended rollout hardening actions

1. **Block direct fallback sends in production**
   - Gate direct `sendMessage(recipientPhone)` fallback behind a temporary env flag.
   - Default production behavior: fail closed + alert owner if thread routing unavailable.

2. **Unify automations onto thread-first delivery**
   - Migrate remaining `sendMessage()` paths in `automation-executor.ts` and `sms-templates.ts` to thread-based sender.
   - Keep owner-only operational alerts separate and explicitly non-client-facing.

3. **Redact phone metadata in events/logs**
   - Replace raw `phone` metadata with redacted format (last 2-4 digits) for non-sensitive logs.

4. **Constrain viewer phone helpers**
   - Restrict `getPhoneForViewer()` to return masked values for all messaging UI contexts.
   - Move real-number access behind explicit admin/support permission checks and audit logging.

5. **Add test guardrails**
   - Add tests that assert client/sitter messaging flows never call direct raw-number send in normal operation.

