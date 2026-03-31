# 39-COMPLIANCE-GAPS.md -- Compliance Audit Report

**Audited:** 2026-03-29
**Auditor:** Agent 39 (Compliance)
**Scope:** A2P 10DLC, TCPA, GDPR/CCPA, PCI DSS

---

## 1. A2P 10DLC Resubmission

### 1a. Booking Form Consent Language

**[OK]** Consent checkbox exists in `src/components/bookings/BookingForm.tsx` (lines 1351-1370).
Text reads: "I agree to the Terms of Service and Privacy Policy, and I consent to receive SMS text messages from Snout Pet Care regarding this booking, including confirmations, reminders, and updates. Message and data rates may apply. Reply STOP to opt out at any time."

**[OK]** Terms link points to `/terms` (relative), Privacy link points to `/privacy` (relative). Both use `target="_blank"`. These are relative URLs, so they resolve to whatever domain serves the form. In production, this is correct.

**[OK]** Checkbox is required -- form validation requires `policyAgreed === true` before submission (line 438).

**[P1]** `smsConsent` is hardcoded to `true` in the submit payload (line 636) regardless of whether the user actually checked the box. The `policyAgreed` state controls form validation (blocking submit), but the actual `smsConsent` value sent to the API is always `true`. This means the consent signal to the backend does not reflect the user's actual checkbox action. The checkbox DOES block submission so consent is effectively captured, but the hardcoded `true` is sloppy and could be challenged. Should be: `smsConsent: policyAgreed`.

**[OK]** No instances of "tearms" typo found in source code (only in CLAUDE.md docs referencing the old rejection).

**[OK]** No instances of "SUBSCIBE" typo found in source code (only in CLAUDE.md docs referencing the old rejection).

### 1b. Terms and Privacy Pages

**[OK]** `src/app/(public)/terms/page.tsx` exists with real, substantive content (9 sections covering service description, user responsibilities, booking/payment, cancellation, independent contractor relationship, liability, SMS communications, dispute resolution, modifications).

**[OK]** `src/app/(public)/privacy/page.tsx` exists with real, substantive content (sections covering data collection, usage, SMS communications, third-party services, data retention, rights, security, contact).

### 1c. Opt-in Keyword Configuration

**[OK]** `SUBSCRIBE` is correctly spelled in `src/lib/messaging/sms-commands.ts` line 44 (`isStartCommand` recognizes `START`, `SUBSCRIBE`, `UNSTOP`).

**[OK]** Zero matches for the typo "SUBSCIBE" in source code.

**[P1]** No Twilio campaign configuration file found in the codebase. The A2P 10DLC campaign is configured in the Twilio console, not in code. There is no code-side validation or documentation of the campaign parameters (consent URL, sample messages, use case description). Recommend creating a `docs/compliance/a2p-campaign-config.md` capturing the exact values submitted to Twilio so resubmission can be verified.

---

## 2. TCPA Compliance

### 2a. STOP Keyword Handling

**[OK]** `src/lib/messaging/sms-commands.ts` -- `isStopCommand()` recognizes all required keywords: `STOP`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT` (line 28).

**[OK]** `src/app/api/messages/webhook/twilio/route.ts` -- STOP handling is immediate (lines 96-111): upserts `OptOutState` with `state: 'opted_out'`, logs the event, and returns a TwiML response confirming unsubscription before any other processing.

**[OK]** `isHelpCommand` returns proper compliance response with STOP instructions (lines 114-124).

**[OK]** `isStartCommand` handles re-subscription via `START`, `SUBSCRIBE`, `UNSTOP` -- upserts `OptOutState` with `state: 'opted_in'` (lines 127-143).

**[OK]** OptOutState model is written to in both Twilio and OpenPhone webhook handlers.

### 2b. Opt-out Check Before Sending

**[OK]** `src/lib/messaging/send.ts` -- `dispatchMessageEventDelivery()` checks `OptOutState` before every send (lines 275-292). If recipient has opted out, the message is marked `failed` with code `opted_out` and never reaches the provider. This is the correct blocking path.

**[P0]** `sendDirectMessage()` in the same file (lines 815-869) does NOT check opt-out state before sending. It calls `provider.sendMessage()` directly without any OptOutState lookup. This function is used by `src/lib/messaging/anti-poaching-enforcement.ts` and `src/lib/messaging/pool-routing.ts`. Any message sent via `sendDirectMessage()` will bypass TCPA opt-out, which is a legal violation.

**[P0]** `src/lib/message-utils.ts` -- `sendMessage()` (the legacy OpenPhone send path) does NOT check opt-out state. It sends directly via OpenPhone API with zero TCPA checks. This function is called by `src/lib/sms-templates.ts` which is imported by the Stripe webhook (payment failure recovery SMS at `src/app/api/webhooks/stripe/route.ts` line 346) and at least 14 other files. Any message sent through this legacy path completely bypasses opt-out enforcement.

### 2c. Consent Capture

**[OK]** Booking form has a consent checkbox that must be checked before submission (`policyAgreed` state, validated in `canContinue` logic).

**[P1]** Consent is logged as an event via `logEvent()` in `src/app/api/form/route.ts` (lines 682-697), but NOT stored as a durable database record. There is no `ConsentRecord` or `smsConsent` column in the Prisma schema. If event logs are purged or lost, there is no proof of consent. TCPA litigation requires demonstrable proof of prior express written consent. An audit log event is better than nothing, but a dedicated consent record with timestamp, IP, and consent language version would be legally stronger.

---

## 3. GDPR / CCPA

### 3a. Data Deletion

**[P1]** `src/app/api/client/delete-account/route.ts` performs SOFT delete only -- sets `deletedAt` on the `Client` and `User` records (lines 56-63). It does NOT:
- Delete or anonymize PII (name, phone, email, address remain in the database)
- Delete or anonymize bookings
- Delete messages / message threads
- Delete pet records
- Delete payment data (StripeCharge, StripeRefund)
- Delete visit reports
- Delete OptOutState records

Under GDPR Article 17 (Right to Erasure), soft delete alone is insufficient. PII must be erased or pseudonymized within a reasonable period. Under CCPA, personal information must be deleted upon verified request. The current implementation retains all PII indefinitely.

**[OK]** Sitter delete (`src/app/api/sitter/delete-account/route.ts`) follows the same soft-delete pattern -- same gap applies but sitters are contractors, not consumers, so the regulatory risk is lower.

**[P1]** No background job or scheduled task exists to purge soft-deleted records after a retention period. The `deletedAt` flag is set but never acted upon.

### 3b. Data Export

**[OK]** `src/app/api/client/export/route.ts` exists and returns a JSON bundle via `buildClientExportBundle()` in `src/lib/export-client-data.ts`.

**[OK]** Export covers: personal info (name, phone, email, address), pets, bookings (service, dates, status, price, payment status), visit reports (content, media URLs, timestamps), messages (all thread events with body, direction, actor), payments (charges and refunds with amounts and statuses).

**[OK]** Export is comprehensive enough to satisfy GDPR Article 15 (Right of Access) and Article 20 (Right to Data Portability).

**[P1]** Export does NOT include: OptOutState records (SMS consent/opt-out history), audit log events (logEvent entries about the client), AI usage logs (if any AI features processed their data), or S3-stored media files (report photos are referenced by URL but not bundled). The opt-out history omission is the most concerning for regulatory purposes.

### 3c. Privacy Policy Completeness

**[P1]** Privacy policy at `src/app/(public)/privacy/page.tsx` lists these third-party processors:
- Twilio (SMS)
- Stripe (payments)
- Google Calendar (scheduling)
- Sentry (error monitoring)

**Missing from the privacy policy but used in the codebase:**
- **OpenPhone** -- used as an alternative SMS/messaging provider (`src/lib/openphone.ts`, `src/lib/message-utils.ts`). Processes phone numbers and message content.
- **Resend** -- used for email delivery (`RESEND_API_KEY` in env). Processes email addresses and email content.
- **AWS S3** -- used for file/photo storage (`S3_BUCKET`, `@aws-sdk/client-s3`). Stores visit report photos which may contain images of client homes and pets.
- **OpenAI** -- used via governed-call wrapper (`@langchain/openai`). May process client data for AI features.

Each missing processor is a GDPR Article 13(1)(e) violation (obligation to disclose recipients/categories of recipients of personal data).

---

## 4. PCI DSS

### 4a. Card Data Storage

**[OK]** Zero matches for `cardNumber`, `creditCard`, or `card_number` in source code.

**[OK]** All payment processing goes through Stripe. Card data never touches Snout OS servers. The privacy policy correctly states: "We do not store your full card number."

**[OK]** Payment data stored in the database consists only of Stripe IDs (`stripePaymentIntentId`, `stripeCheckoutSessionId`), amounts, and statuses -- no raw card data.

### 4b. Webhook Verification

**[OK]** `src/app/api/webhooks/stripe/route.ts` uses `stripe.webhooks.constructEvent(rawBody, signature, secret)` (line 41) for cryptographic signature verification.

**[OK]** `STRIPE_WEBHOOK_SECRET` is checked at the top of the handler (lines 27-29). If not configured, the endpoint returns 500. If the signature doesn't match, it returns 400.

**[OK]** Idempotency protection via `stripeWebhookEvent` table prevents replay attacks (lines 48-57).

### 4c. Stripe API Version

**[P1]** Stripe API version is `2023-10-16` across the entire codebase (13 instantiation sites). The current stable Stripe API version as of March 2026 is significantly newer. Using an API version over 2 years old means:
- Missing security patches applied to newer API versions
- Missing fraud prevention improvements
- Potential deprecation warnings from Stripe

This is not a blocking compliance issue (Stripe maintains backward compatibility), but it is a security hygiene concern. The version is pinned with `as any` cast in `src/lib/stripe.ts` (line 4), indicating the TypeScript types don't match the runtime version either.

---

## Summary

| ID | Area | Severity | Finding |
|----|------|----------|---------|
| 1 | TCPA | **[FIXED]** | `sendDirectMessage()` now checks OptOutState before sending |
| 2 | TCPA | **[FIXED]** | Legacy `sendMessage()` + daily-delight + test-message routes all now check OptOutState |
| 3 | GDPR | **[P1]** | Delete account is soft-delete only -- PII retained indefinitely |
| 4 | GDPR | **[P1]** | No background purge of soft-deleted records |
| 5 | GDPR | **[P1]** | Privacy policy missing 4 third-party processors (OpenPhone, Resend, AWS S3, OpenAI) |
| 6 | GDPR | **[P1]** | Data export omits opt-out history, audit logs, and S3 media files |
| 7 | TCPA | **[P1]** | Consent stored only as audit log event, not durable DB record |
| 8 | A2P | **[P1]** | `smsConsent` hardcoded to `true` instead of reflecting checkbox state |
| 9 | A2P | **[P1]** | No code-side documentation of Twilio campaign configuration for resubmission |
| 10 | PCI | **[P1]** | Stripe API version `2023-10-16` is 2+ years old |
| 11 | A2P | [OK] | No typos ("tearms", "SUBSCIBE") in source code |
| 12 | A2P | [OK] | Terms and Privacy pages exist with real content |
| 13 | A2P | [OK] | SUBSCRIBE keyword correctly spelled in sms-commands.ts |
| 14 | TCPA | [OK] | STOP/HELP/START keyword handling correct in Twilio webhook |
| 15 | TCPA | [OK] | `dispatchMessageEventDelivery()` checks opt-out before sending |
| 16 | TCPA | [OK] | Booking form consent checkbox required before submission |
| 17 | GDPR | [OK] | Data export covers personal info, pets, bookings, messages, payments |
| 18 | PCI | [OK] | No raw card data stored anywhere |
| 19 | PCI | [OK] | Stripe webhook signature verification with constructEvent |
| 20 | PCI | [OK] | Idempotency protection on webhook processing |

### Recommended Fix Priority

**Fix before launch (P0 -- legal liability NOW):**
1. Add opt-out check to `sendDirectMessage()` in `src/lib/messaging/send.ts`
2. Add opt-out check to `sendMessage()` in `src/lib/message-utils.ts` (or deprecate this function entirely in favor of the thread-based send path)

**Fix before scaling (P1):**
3. Change `smsConsent: true` to `smsConsent: policyAgreed` in BookingForm.tsx line 636
4. Create a durable `ConsentRecord` model and persist consent with timestamp, IP, language version
5. Implement actual PII deletion/anonymization for GDPR erasure requests (either immediate or via scheduled purge job)
6. Add OpenPhone, Resend, AWS S3, and OpenAI to privacy policy
7. Include opt-out history in data export bundle
8. Upgrade Stripe API version to current stable
9. Document A2P campaign configuration for resubmission audit trail
