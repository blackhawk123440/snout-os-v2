# Snout OS — Master Audit (Complete Raw Data)

**Generated:** Feb 25, 2026 | **Commit:** `b37f0cdb1209c1ecf4aa05852dae9d0c7dc03347` | **Build:** PASSING (exit 0)

---

## Section 1: Git State

- **Commit:** `b37f0cdb1209c1ecf4aa05852dae9d0c7dc03347`
- **`git status --porcelain`:** (empty — clean working tree)
- **Remaining .md files:** 1 (`./MASTER_AUDIT.md` only)

---

## Section 2: package.json (Full Contents)

```json
{
  "name": "snout-os",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "build:with-db": "prisma generate && prisma db push --skip-generate && next build",
    "start": "next start",
    "lint": "eslint . --fix",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:integration": "RUN_INTEGRATION_TESTS=true vitest run --config vitest.config.ts",
    "test:ui": "playwright test",
    "test:ui:smoke": "playwright test --config=playwright.smoke.config.ts",
    "test:ui:visual": "playwright test",
    "test:ui:full": "playwright test",
    "lighthouse:ci": "lhci autorun",
    "db:push": "prisma db push",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@auth/prisma-adapter": "^2.11.1",
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.3.0",
    "@panva/hkdf": "^1.2.1",
    "@prisma/client": "^5.0.0",
    "@tanstack/react-query": "^5.90.20",
    "@types/bcryptjs": "^2.4.6",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "autoprefixer": "^10.0.0",
    "bcryptjs": "^3.0.3",
    "bullmq": "^4.0.0",
    "date-fns": "^4.1.0",
    "dotenv": "^16.0.0",
    "googleapis": "^128.0.0",
    "ioredis": "^5.0.0",
    "jose": "^6.1.3",
    "next": "^15.5.12",
    "next-auth": "^5.0.0-beta.30",
    "openai": "^6.24.0",
    "postcss": "^8.0.0",
    "prisma": "^5.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "stripe": "^14.0.0",
    "tailwindcss": "^3.0.0",
    "twilio": "^5.11.2",
    "typescript": "^5.0.0",
    "zod": "^4.2.1"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@lhci/cli": "^0.12.0",
    "@next/eslint-plugin-next": "^16.1.6",
    "@playwright/test": "^1.51.1",
    "@types/node": "^20.0.0",
    "@vitest/ui": "^4.0.16",
    "eslint": "^8.0.0",
    "eslint-config-next": "^15.5.12",
    "fast-check": "^4.5.3",
    "tsx": "^4.20.6",
    "vitest": "^4.0.16"
  },
  "prisma": {
    "schema": "prisma/schema.prisma",
    "seed": "tsx prisma/seed.ts"
  }
}
```

---

## Section 3: ls -la src/app/api/ (Full Output)

```
total 16
drwxr-xr-x  46 leahhudson  staff  1472 Feb 18 09:47 .
drwxr-xr-x  37 leahhudson  staff  1184 Feb 24 13:54 ..
drwxr-xr-x   3 leahhudson  staff    96 Feb 10 18:48 [...path]
drwxr-xr-x   3 leahhudson  staff    96 Jan  3 01:19 __tests__
drwxr-xr-x   4 leahhudson  staff   128 Feb  1 00:19 assignments
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 audit
drwxr-xr-x   6 leahhudson  staff   192 Jan 31 09:29 auth
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 automation
drwxr-xr-x   4 leahhudson  staff   128 Feb  5 00:26 automations
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 booking-pipeline
drwxr-xr-x   3 leahhudson  staff    96 Feb  5 00:26 bookings
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 calendar
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 clients
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 conversations
drwxr-xr-x   3 leahhudson  staff    96 Feb  5 00:26 custom-fields
drwxr-xr-x   3 leahhudson  staff    96 Feb  8 08:55 debug-auth
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 discounts
drwxr-xr-x   5 leahhudson  staff   160 Feb 18 09:22 dispatch
drwxr-xr-x   3 leahhudson  staff    96 Feb 13 23:46 form
drwxr-xr-x   3 leahhudson  staff    96 Feb 10 22:16 health
drwxr-xr-x   5 leahhudson  staff   160 Feb 18 10:12 integrations
drwxr-xr-x   3 leahhudson  staff    96 Feb 12 18:01 message-templates
drwxr-xr-x  12 leahhudson  staff   384 Feb 16 08:50 messages
drwxr-xr-x   7 leahhudson  staff   224 Feb 12 22:43 numbers
drwxr-xr-x   3 leahhudson  staff    96 Feb 17 10:27 offers
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 openphone
drwxr-xr-x   9 leahhudson  staff   288 Feb 20 09:50 ops
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 payments
drwxr-xr-x   4 leahhudson  staff   128 Feb  5 00:26 payroll
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 pricing-rules
drwxr-xr-x   3 leahhudson  staff    96 Jan 31 12:00 routing
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 service-configs
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 sessions
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 settings
drwxr-xr-x   7 leahhudson  staff   224 Feb 20 00:11 setup
drwxr-xr-x   5 leahhudson  staff   160 Feb 15 23:54 sitter
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 sitter-pool
drwxr-xr-x   3 leahhudson  staff    96 Feb 13 22:11 sitter-tiers
drwxr-xr-x   5 leahhudson  staff   160 Feb 15 23:53 sitters
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 stripe
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 templates
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 tip
drwxr-xr-x   3 leahhudson  staff    96 Feb 18 09:47 twilio
drwxr-xr-x   2 leahhudson  staff    64 Feb  5 00:26 upload
drwxr-xr-x   3 leahhudson  staff    96 Feb 14 00:25 webhooks
```

---

## Section 4: ls -la src/lib/ (Full Output)

```
total 960
drwxr-xr-x  83 leahhudson  staff   2656 Feb 23 18:38 .
drwxr-xr-x  10 leahhudson  staff    320 Jan 14 22:00 ..
drwxr-xr-x   3 leahhudson  staff     96 Jan 25 14:08 __mocks__
drwxr-xr-x   7 leahhudson  staff    224 Jan 24 21:17 __tests__
-rw-r--r--   1 leahhudson  staff   2205 Feb 24 19:55 ai.ts
drwxr-xr-x  12 leahhudson  staff    384 Feb 15 17:13 api
-rw-r--r--   1 leahhudson  staff   6564 Feb 20 00:41 audit-events.ts
-rw-r--r--   1 leahhudson  staff   1430 Feb 12 23:06 auth-client.tsx
-rw-r--r--   1 leahhudson  staff   1970 Jan  3 01:19 auth-helpers.ts
-rw-r--r--   1 leahhudson  staff   8241 Feb 24 21:06 auth.ts
-rw-r--r--   1 leahhudson  staff   8206 Feb 10 21:52 automation-engine.ts
-rw-r--r--   1 leahhudson  staff  33874 Feb 16 17:47 automation-executor.ts
-rw-r--r--   1 leahhudson  staff   1060 Jan 24 21:17 automation-init.ts
-rw-r--r--   1 leahhudson  staff   4846 Jan  3 01:19 automation-queue.ts
-rw-r--r--   1 leahhudson  staff   1745 Jan  3 01:19 automation-settings-helpers.ts
-rw-r--r--   1 leahhudson  staff   6128 Jan  3 01:19 automation-templates.ts
-rw-r--r--   1 leahhudson  staff   5940 Feb 10 18:40 automation-utils.ts
drwxr-xr-x   6 leahhudson  staff    192 Jan 12 09:00 automations
-rw-r--r--   1 leahhudson  staff   3794 Feb 20 00:41 baseline-snapshots.test.ts
-rw-r--r--   1 leahhudson  staff   3103 Feb 10 18:41 baseline-snapshots.ts
-rw-r--r--   1 leahhudson  staff   4911 Feb 10 18:41 booking-engine.ts
-rw-r--r--   1 leahhudson  staff   2141 Jan  3 01:19 booking-status-history.ts
-rw-r--r--   1 leahhudson  staff  19143 Dec  4 20:52 booking-utils.ts
drwxr-xr-x   6 leahhudson  staff    192 Feb 14 00:26 bookings
-rw-r--r--   1 leahhudson  staff   4163 Feb 24 19:55 calendar-sync.ts
-rw-r--r--   1 leahhudson  staff   2105 Feb 10 18:41 chaos-mode.ts
-rw-r--r--   1 leahhudson  staff   1526 Feb 10 18:40 db.ts
-rw-r--r--   1 leahhudson  staff  16660 Jan 17 09:14 design-tokens.ts
-rw-r--r--   1 leahhudson  staff   1752 Feb 10 18:41 discount-engine.ts
-rw-r--r--   1 leahhudson  staff   6391 Feb 20 00:41 dispatch-control.ts
-rw-r--r--   1 leahhudson  staff   4705 Feb 24 21:05 env.ts
-rw-r--r--   1 leahhudson  staff   6281 Jan  3 01:19 event-emitter.ts
-rw-r--r--   1 leahhudson  staff   2626 Feb 10 18:41 event-logger.ts
-rw-r--r--   1 leahhudson  staff   4381 Feb 20 00:41 feature-flags.test.ts
-rw-r--r--   1 leahhudson  staff   4925 Jan  3 01:19 feature-flags.ts
-rw-r--r--   1 leahhudson  staff   1185 Feb  1 08:43 flags.ts
-rw-r--r--   1 leahhudson  staff   3799 Jan  3 01:19 form-mapper-helpers.ts
-rw-r--r--   1 leahhudson  staff  15047 Feb 10 18:41 form-to-booking-mapper.ts
-rw-r--r--   1 leahhudson  staff   2668 Nov  8 11:45 google-calendar.ts
-rw-r--r--   1 leahhudson  staff   5042 Jan  3 01:19 health-checks.ts
-rw-r--r--   1 leahhudson  staff   3627 Feb 10 18:41 masked-numbers.ts
-rw-r--r--   1 leahhudson  staff   3136 Feb 10 18:41 message-templates.ts
-rw-r--r--   1 leahhudson  staff   2550 Feb 10 18:42 message-utils.ts
drwxr-xr-x  36 leahhudson  staff   1152 Feb 21 18:08 messaging
-rw-r--r--   1 leahhudson  staff   1132 Feb 24 19:55 navigation.ts
-rw-r--r--   1 leahhudson  staff   4799 Feb 20 00:41 offer-reassignment.ts
-rw-r--r--   1 leahhudson  staff   1592 Nov  8 11:45 openphone-verify.ts
-rw-r--r--   1 leahhudson  staff   4756 Nov  9 21:42 openphone.ts
-rw-r--r--   1 leahhudson  staff   1399 Feb  2 22:35 owner-helpers.ts
drwxr-xr-x   3 leahhudson  staff     96 Jan 10 07:59 payroll
-rw-r--r--   1 leahhudson  staff   4013 Feb 10 18:41 payroll-engine.ts
-rw-r--r--   1 leahhudson  staff   3081 Feb 13 23:49 permissions.ts
-rw-r--r--   1 leahhudson  staff   2402 Nov  8 11:45 phone-format.ts
-rw-r--r--   1 leahhudson  staff   2836 Feb 10 18:40 phone-utils.ts
-rw-r--r--   1 leahhudson  staff   2402 Feb 10 18:36 pool-release-queue.ts
-rw-r--r--   1 leahhudson  staff   3297 Jan  3 01:19 pricing-display-helpers.ts
-rw-r--r--   1 leahhudson  staff   9857 Jan  3 01:19 pricing-engine-v1.ts
-rw-r--r--   1 leahhudson  staff   9557 Feb 13 23:49 pricing-engine.ts
-rw-r--r--   1 leahhudson  staff   5080 Jan  3 01:19 pricing-parity-harness.ts
-rw-r--r--   1 leahhudson  staff   2542 Feb 10 18:41 pricing-reconciliation.ts
-rw-r--r--   1 leahhudson  staff   1670 Jan  3 01:19 pricing-snapshot-helpers.ts
-rw-r--r--   1 leahhudson  staff   2626 Jan  3 01:19 pricing-types.ts
-rw-r--r--   1 leahhudson  staff   4413 Feb 10 18:38 protected-routes.ts
-rw-r--r--   1 leahhudson  staff   1612 Feb  1 08:44 public-routes.ts
-rw-r--r--   1 leahhudson  staff   3014 Feb 16 17:34 queue.ts
-rw-r--r--   1 leahhudson  staff   8412 Feb 13 23:49 rates.ts
drwxr-xr-x   8 leahhudson  staff    256 Jan 17 09:14 resonance
drwxr-xr-x   4 leahhudson  staff    128 Feb 20 17:52 setup
-rw-r--r--   1 leahhudson  staff   5194 Feb 20 00:41 sitter-eligibility.ts
-rw-r--r--   1 leahhudson  staff   3442 Feb 10 18:41 sitter-helpers.ts
-rw-r--r--   1 leahhudson  staff   3059 Feb  1 10:11 sitter-routes.ts
-rw-r--r--   1 leahhudson  staff   7004 Feb 13 23:49 sms-templates.ts
-rw-r--r--   1 leahhudson  staff   6078 Nov  8 11:45 stripe-analytics.ts
-rw-r--r--   1 leahhudson  staff  11985 Feb 13 23:49 stripe-sync.ts
-rw-r--r--   1 leahhudson  staff   3250 Nov  8 11:45 stripe.ts
-rw-r--r--   1 leahhudson  staff      0 Nov 14 12:07 template-service.ts
-rw-r--r--   1 leahhudson  staff   4030 Feb 10 18:41 tier-engine.ts
-rw-r--r--   1 leahhudson  staff   6427 Feb 10 18:41 tier-permissions.ts
-rw-r--r--   1 leahhudson  staff   2806 Feb 13 23:49 tier-rules.ts
drwxr-xr-x  12 leahhudson  staff    384 Feb 18 17:38 tiers
-rw-r--r--   1 leahhudson  staff   3745 Jan  3 01:19 today-board-helpers.ts
-rw-r--r--   1 leahhudson  staff    535 Jan 11 09:22 use-mobile.ts
drwxr-xr-x   3 leahhudson  staff     96 Jan  3 01:19 validation
```

---

## Section 5: pnpm build (Full Output)

```
> snout-os@1.0.0 build /Users/leahhudson/Desktop/final form/snout-os
> prisma generate && next build

Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (v5.22.0) to ./node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client in 365ms

   ▲ Next.js 15.5.12
   - Environments: .env.local, .env

   Creating an optimized production build ...
 ✓ Compiled successfully in 9.3s
   Skipping linting
   Checking validity of types ...
   Collecting page data ...
   Generating static pages (0/97) ...
   Generating static pages (24/97) 
   Generating static pages (48/97) 
   Generating static pages (72/97) 
 ✓ Generating static pages (97/97)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                           Size  First Load JS
┌ ○ /                                              4.04 kB         133 kB
├ ○ /_not-found                                      996 B         103 kB
├ ƒ /api/[...path]                                   354 B         102 kB
├ ƒ /api/assignments/windows                         354 B         102 kB
├ ƒ /api/assignments/windows/[id]                    354 B         102 kB
├ ƒ /api/auth/[...nextauth]                          354 B         102 kB
├ ƒ /api/auth/config-check                           354 B         102 kB
├ ƒ /api/auth/health                                 354 B         102 kB
├ ƒ /api/auth/logout                                 354 B         102 kB
├ ƒ /api/bookings/[id]/daily-delight                 354 B         102 kB
├ ƒ /api/debug-auth                                  354 B         102 kB
├ ƒ /api/dispatch/attention                          354 B         102 kB
├ ƒ /api/dispatch/force-assign                       354 B         102 kB
├ ƒ /api/dispatch/resume-automation                  354 B         102 kB
├ ƒ /api/form                                        354 B         102 kB
├ ƒ /api/health                                      354 B         102 kB
├ ƒ /api/integrations/google/callback                354 B         102 kB
├ ƒ /api/integrations/google/start                   354 B         102 kB
├ ƒ /api/message-templates                           354 B         102 kB
├ ƒ /api/messages/[id]/retry                         354 B         102 kB
├ ƒ /api/messages/debug/state                        354 B         102 kB
├ ƒ /api/messages/process-srs                        354 B         102 kB
├ ƒ /api/messages/seed-proof                         354 B         102 kB
├ ƒ /api/messages/seed-srs-proof                     354 B         102 kB
├ ƒ /api/messages/send                               354 B         102 kB
├ ƒ /api/messages/threads                            354 B         102 kB
├ ƒ /api/messages/threads/[id]                       354 B         102 kB
├ ƒ /api/messages/threads/[id]/mark-read             354 B         102 kB
├ ƒ /api/messages/threads/[id]/messages              354 B         102 kB
├ ƒ /api/messages/webhook/twilio                     354 B         102 kB
├ ƒ /api/numbers                                     354 B         102 kB
├ ƒ /api/numbers/[id]                                354 B         102 kB
├ ƒ /api/numbers/[id]/assign                         354 B         102 kB
├ ƒ /api/numbers/[id]/class                          354 B         102 kB
├ ƒ /api/numbers/[id]/quarantine                     354 B         102 kB
├ ƒ /api/numbers/[id]/release                        354 B         102 kB
├ ƒ /api/numbers/[id]/release-to-pool                354 B         102 kB
├ ƒ /api/numbers/buy                                 354 B         102 kB
├ ƒ /api/numbers/import                              354 B         102 kB
├ ƒ /api/numbers/sitters/[sitterId]/deactivate       354 B         102 kB
├ ƒ /api/offers/expire                               354 B         102 kB
├ ƒ /api/ops/build                                   354 B         102 kB
├ ƒ /api/ops/messaging-debug                         354 B         102 kB
├ ƒ /api/ops/runtime-proof                           354 B         102 kB
├ ƒ /api/ops/seed-sitter-dashboard                   354 B         102 kB
├ ƒ /api/ops/srs/run-snapshot                        354 B         102 kB
├ ƒ /api/ops/srs/run-weekly-eval                     354 B         102 kB
├ ƒ /api/ops/twilio-setup-diagnostics                354 B         102 kB
├ ƒ /api/ops/visits/capture                          354 B         102 kB
├ ƒ /api/routing/threads/[id]/history                354 B         102 kB
├ ƒ /api/setup/numbers/sync                          354 B         102 kB
├ ƒ /api/setup/provider/connect                      354 B         102 kB
├ ƒ /api/setup/provider/status                       354 B         102 kB
├ ƒ /api/setup/provider/test                         354 B         102 kB
├ ƒ /api/setup/readiness                             354 B         102 kB
├ ƒ /api/setup/test-sms                              354 B         102 kB
├ ƒ /api/setup/webhooks/install                      354 B         102 kB
├ ƒ /api/setup/webhooks/status                       354 B         102 kB
├ ƒ /api/sitter-tiers                                354 B         102 kB
├ ƒ /api/sitter/[id]/bookings/[bookingId]/accept     354 B         102 kB
├ ƒ /api/sitter/[id]/bookings/[bookingId]/decline    354 B         102 kB
├ ƒ /api/sitter/[id]/dashboard                       354 B         102 kB
├ ƒ /api/sitter/me/dashboard                         354 B         102 kB
├ ƒ /api/sitter/me/srs                               354 B         102 kB
├ ƒ /api/sitter/threads                              354 B         102 kB
├ ƒ /api/sitter/threads/[id]/messages                354 B         102 kB
├ ƒ /api/sitters                                     354 B         102 kB
├ ƒ /api/sitters/[id]                                354 B         102 kB
├ ƒ /api/sitters/[id]/activity                       354 B         102 kB
├ ƒ /api/sitters/[id]/calendar                       354 B         102 kB
├ ƒ /api/sitters/[id]/calendar/toggle                354 B         102 kB
├ ƒ /api/sitters/[id]/dashboard                      354 B         102 kB
├ ƒ /api/sitters/[id]/messages                       354 B         102 kB
├ ƒ /api/sitters/[id]/performance                    354 B         102 kB
├ ƒ /api/sitters/[id]/service-events                 354 B         102 kB
├ ƒ /api/sitters/[id]/srs                            354 B         102 kB
├ ƒ /api/sitters/[id]/tier/details                   354 B         102 kB
├ ƒ /api/sitters/[id]/tier/summary                   354 B         102 kB
├ ƒ /api/sitters/[id]/time-off                       354 B         102 kB
├ ƒ /api/sitters/srs                                 354 B         102 kB
├ ƒ /api/twilio/inbound                              354 B         102 kB
├ ƒ /api/webhooks/stripe                             354 B         102 kB
├ ƒ /assignments                                   3.87 kB         170 kB
├ ○ /automation                                    6.22 kB         136 kB
├ ○ /automation-center                             4.97 kB         134 kB
├ ƒ /automation-center/[id]                        5.45 kB         135 kB
├ ○ /automation-center/new                         5.25 kB         135 kB
├ ○ /automations                                   2.14 kB         162 kB
├ ƒ /automations/[id]                              7.03 kB         167 kB
├ ƒ /booking-form                                    354 B         102 kB
├ ○ /bookings                                      5.18 kB         147 kB
├ ƒ /bookings/[id]                                 9.73 kB         205 kB
├ ○ /bookings/new                                  4.25 kB         139 kB
├ ○ /bookings/sitters                              4.13 kB         192 kB
├ ○ /calendar                                      4.91 kB         146 kB
├ ○ /calendar/accounts                             4.44 kB         134 kB
├ ○ /clients                                       4.23 kB         134 kB
├ ƒ /clients/[id]                                  2.26 kB         190 kB
├ ○ /dashboard                                       354 B         102 kB
├ ○ /exceptions                                    4.69 kB         134 kB
├ ○ /inbox                                           476 B         102 kB
├ ○ /integrations                                  7.16 kB         137 kB
├ ○ /login                                         5.51 kB         132 kB
├ ○ /messages                                      20.6 kB         191 kB
├ ƒ /numbers                                        7.2 kB         174 kB
├ ○ /ops/proof                                     3.52 kB         134 kB
├ ○ /payments                                      5.79 kB         135 kB
├ ○ /payroll                                        5.3 kB         135 kB
├ ○ /pricing                                         938 B         103 kB
├ ○ /settings                                      5.08 kB         135 kB
├ ○ /settings/automations/ledger                    4.9 kB         134 kB
├ ○ /settings/business                             4.03 kB         133 kB
├ ○ /settings/custom-fields                         4.1 kB         134 kB
├ ○ /settings/discounts                            4.12 kB         134 kB
├ ○ /settings/form-builder                         3.95 kB         133 kB
├ ○ /settings/pricing                              4.03 kB         133 kB
├ ○ /settings/rotation                             4.47 kB         134 kB
├ ○ /settings/services                             3.99 kB         133 kB
├ ○ /settings/tiers                                4.22 kB         134 kB
├ ƒ /setup                                         3.71 kB         170 kB
├ ○ /sitter                                          546 B         105 kB
├ ○ /sitter-dashboard                              7.86 kB         196 kB
├ ○ /sitter-payroll                                 4.3 kB         134 kB
├ ○ /sitter/dashboard                              2.93 kB         181 kB
├ ○ /sitter/inbox                                  3.97 kB         174 kB
├ ƒ /sitters/[id]                                  3.71 kB         190 kB
├ ○ /templates                                     4.29 kB         134 kB
├ ƒ /templates/[id]                                4.33 kB         134 kB
├ ƒ /tip/[amount]/[sitter]                         1.58 kB         105 kB
├ ○ /tip/cancel                                      501 B         105 kB
├ ○ /tip/link-builder                              1.28 kB         103 kB
├ ○ /tip/payment                                   4.11 kB         106 kB
├ ○ /tip/success                                     988 B         103 kB
├ ƒ /tip/t/[amount]/[sitter]                         354 B         102 kB
└ ○ /ui-kit                                        4.96 kB         128 kB
+ First Load JS shared by all                       102 kB
  ├ chunks/212e062c-7a8af8f64def3300.js            54.2 kB
  ├ chunks/3857-20e03e943285ec6c.js                45.4 kB
  └ other shared chunks (total)                    1.93 kB

ƒ Middleware                                        119 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

Exit code: 0
```

---

## Section 6: Config Files (Full Contents)

### render.yaml

```yaml
services:
  # PostgreSQL Database
  - type: pg
    name: snout-os-db
    plan: starter
    databaseName: snout_os
    user: snoutos

  # Web Service (Next.js — handles UI + API routes)
  - type: web
    name: snout-os-web
    env: node
    plan: starter
    region: oregon
    rootDir: .
    buildCommand: npm install && npm run build
    startCommand: npx prisma db push --accept-data-loss && npm run start
    envVars:
      - key: NODE_ENV
        value: production
      - key: NEXTAUTH_URL
        fromService:
          name: snout-os-web
          type: web
          property: host
      - key: NEXTAUTH_SECRET
        generateValue: true
      - key: NEXT_PUBLIC_ENABLE_MESSAGING_V1
        value: "true"
      - key: OPENAI_API_KEY
        sync: false
      - key: DATABASE_URL
        fromDatabase:
          name: snout-os-db
          property: connectionString
    healthCheckPath: /api/health
```

### .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/snout_ci
  NEXTAUTH_SECRET: test_secret
  NEXTAUTH_URL: http://localhost:3000
  JWT_SECRET: test_jwt_secret_for_ci
  NEXT_PUBLIC_API_URL: http://localhost:3000
  OPENAI_API_KEY: sk-dummy
  ENABLE_MESSAGING_V1: "true"
  NEXT_PUBLIC_ENABLE_MESSAGING_V1: "true"

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: snout_ci
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run TypeScript type check
        run: pnpm run typecheck

      - name: Check UI Constitution violations
        run: pnpm exec tsx scripts/check-ui-constitution.ts
        continue-on-error: true

      - name: Build application
        run: pnpm run build

  proof-pack:
    runs-on: ubuntu-latest
    needs: [build-and-test]
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: snout_ci
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Build application
        run: pnpm run build

      - name: Apply database schema
        run: pnpm prisma db push --accept-data-loss

      - name: Start application
        run: |
          pnpm start > /tmp/nextjs.log 2>&1 &
          echo $! > /tmp/nextjs.pid
        env:
          PORT: "3000"

      - name: Wait for application
        run: |
          npx wait-on http://localhost:3000 --timeout 60000 || (cat /tmp/nextjs.log && exit 1)

      - name: Run proof-pack tests
        run: |
          mkdir -p proof-pack
          pnpm run test:ui:smoke || true
          pnpm run test -- src/lib/messaging/__tests__/pool-capacity.test.ts src/lib/messaging/__tests__/pool-release.test.ts src/lib/messaging/__tests__/invariants.test.ts --reporter=json --outputFile=proof-pack/test-output.json || true
        env:
          CI: true
          BASE_URL: "http://localhost:3000"
          OWNER_EMAIL: "owner@example.com"
          OWNER_PASSWORD: "password"
        continue-on-error: true

      - name: Capture screenshots
        run: |
          pnpm run test:ui -- tests/e2e/rotation-settings-persistence.spec.ts --screenshot=only-on-failure || true
          mkdir -p proof-pack/screenshots
          cp -r test-results/*/screenshots/* proof-pack/screenshots/ 2>/dev/null || true
        env:
          BASE_URL: "http://localhost:3000"
        continue-on-error: true

      - name: Stop application
        if: always()
        run: |
          if [ -f /tmp/nextjs.pid ]; then
            kill $(cat /tmp/nextjs.pid) 2>/dev/null || true
          fi
          pkill -f "next start" || true

      - name: Upload proof-pack artifact
        uses: actions/upload-artifact@v4
        with:
          name: proof-pack
          path: proof-pack/
          retention-days: 90
```

### next.config.js

```js
const path = require("path");

const parseOrigins = (value) => {
  if (!value) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const allowedEmbedOrigins = [
  "https://snout-form.onrender.com",
  "https://backend-291r.onrender.com",
  "https://www.snoutservices.com",
  "https://snoutservices.com",
  "https://leahs-supercool-site-c731e5.webflow.io",
  ...parseOrigins(process.env.NEXT_PUBLIC_WEBFLOW_ORIGIN),
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXT_PUBLIC_BASE_URL,
  process.env.RENDER_EXTERNAL_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
].filter(Boolean);

const nextConfig = {
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ["@prisma/client", "twilio"],
  images: {
    domains: ["localhost"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: "/booking-form",
        destination: "/booking-form.html",
      },
    ];
  },
  async headers() {
    const frameAncestors = allowedEmbedOrigins.length
      ? ["'self'", ...allowedEmbedOrigins]
      : ["'self'"];
    const cspFrameAncestors = frameAncestors.join(" ");

    return [
      {
        source: "/booking-form",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: `frame-ancestors ${cspFrameAncestors}` },
        ],
      },
      {
        source: "/booking-form.html",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: `frame-ancestors ${cspFrameAncestors}` },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias["@"] = path.resolve(__dirname, "src");
    config.module.rules.push({
      test: /\.ts$/,
      exclude: [
        /node_modules/,
        /enterprise-messaging-dashboard/,
        /scripts/,
        /prisma\/seed.*\.ts$/,
      ],
    });
    // Suppress "Critical dependency" warning from dynamic imports in runtime-proof
    config.module.exprContextCritical = false;
    return config;
  },
  // Exclude enterprise-messaging-dashboard from TypeScript checking
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "es2015",
    "lib": ["dom", "dom.iterable", "es2015"],
    "downlevelIteration": true,
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": [
    "node_modules",
    "tests",
    "**/*.spec.ts",
    "**/*.test.ts",
    "**/__tests__/**",
    "playwright.config.ts",
    "playwright.smoke.config.ts",
    "vitest.config.ts",
    "enterprise-messaging-dashboard",
    "scripts",
    "prisma/seed*.ts"
  ]
}
```

### .env.example

```
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/snout_os_db"

# OpenPhone
OPENPHONE_API_KEY="your_openphone_api_key"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Redis (optional, for background jobs)
REDIS_URL="redis://localhost:6379"

# Owner Phone Numbers
OWNER_PHONE="+1234567890"
OWNER_PERSONAL_PHONE="+1234567890"
OWNER_OPENPHONE_PHONE="+1234567890"

# App URLs
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Gate B Phase 2: Authentication Feature Flags (all default to false)
ENABLE_AUTH_PROTECTION=false
ENABLE_SITTER_AUTH=false
ENABLE_PERMISSION_CHECKS=false
ENABLE_WEBHOOK_VALIDATION=false

# Gate B Phase 2: NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""

# Messaging Feature Flag
NEXT_PUBLIC_ENABLE_MESSAGING_V1=true

# API URL
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Section 7: prisma/schema.prisma (Full — 1,683 lines)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Rate {
  id        String    @id @default(uuid())
  service   String
  duration  Int
  baseRate  Float
  createdAt DateTime? @default(now())
  updatedAt DateTime? @default(now()) @updatedAt

  @@unique([service, duration], name: "service_duration")
}

model Booking {
  id                   String                 @id @default(uuid())
  firstName            String
  lastName             String
  phone                String
  email                String?
  address              String?
  pickupAddress        String?
  dropoffAddress       String?
  service              String
  startAt              DateTime
  endAt                DateTime
  totalPrice           Float
  pricingSnapshot      String?                @db.Text
  status               String                 @default("pending")
  assignmentType       String? // "direct" or "pool" - null means not yet assigned
  dispatchStatus       String                 @default("auto") // auto | manual_required | manual_in_progress | assigned
  manualDispatchReason String?                @db.Text
  manualDispatchAt     DateTime?
  notes                String?
  stripePaymentLinkUrl String?
  tipLinkUrl           String?
  paymentStatus        String                 @default("unpaid")
  createdAt            DateTime               @default(now())
  updatedAt            DateTime               @updatedAt
  afterHours           Boolean                @default(false)
  holiday              Boolean                @default(false)
  quantity             Int                    @default(1)
  pets                 Pet[]
  sitter               Sitter?                @relation(fields: [sitterId], references: [id], onDelete: SetNull)
  sitterId             String?
  timeSlots            TimeSlot[]
  messages             Message[]
  reports              Report[]
  offerEvents          OfferEvent[]
  visitEvents          VisitEvent[]
  assignmentWindows    AssignmentWindow[]
  sitterPoolOffers     SitterPoolOffer[]
  sitterPool           BookingSitterPool[]    @relation("BookingSitterPool")
  client               Client?                @relation(fields: [clientId], references: [id], onDelete: SetNull)
  clientId             String?
  tags                 BookingTagAssignment[]
  discountUsage        DiscountUsage?
  customFields         CustomFieldValue[]
  eventLogs            EventLog[]
  statusHistory        BookingStatusHistory[]
  calendarEvents       BookingCalendarEvent[] // Google Calendar event mappings
  petHealthLogs        PetHealthLog[]

  @@index([sitterId])
  @@index([status])
  @@index([createdAt])
  @@index([clientId])
}

model Pet {
  id           String             @id @default(uuid())
  name         String
  species      String
  breed        String?
  age          Int?
  notes        String?
  booking      Booking            @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  bookingId    String
  customFields CustomFieldValue[]
  healthLogs   PetHealthLog[]

  @@index([bookingId])
}

model TimeSlot {
  id        String   @id @default(uuid())
  startAt   DateTime
  endAt     DateTime
  duration  Int
  booking   Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  bookingId String
  createdAt DateTime @default(now())

  @@index([bookingId])
}

model Sitter {
  id                   String              @id @default(uuid())
  firstName            String              @default("")
  lastName             String              @default("")
  phone                String              @default("")
  email                String              @default("")
  active               Boolean             @default(true)
  commissionPercentage Float               @default(80.0) // Percentage of booking totalPrice (70-80%)
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt
  bookings             Booking[]
  personalPhone        String?
  openphonePhone       String?
  phoneType            String?
  stripeAccountId      String?
  sitterPoolOffers     SitterPoolOffer[]
  bookingSitterPool    BookingSitterPool[] @relation("SitterPoolMembers")
  tierHistory          SitterTierHistory[]
  currentTierId        String?
  currentTier          SitterTier?         @relation(fields: [currentTierId], references: [id])
  customFields         CustomFieldValue[]
  user                 User?
  PayrollLineItem      PayrollLineItem[]
  PayrollAdjustment    PayrollAdjustment[]
  maskedNumber         SitterMaskedNumber?
  assignmentWindows    AssignmentWindow[]
  googleAccessToken    String?   @db.Text // Encrypted access token
  googleRefreshToken   String?   @db.Text // Encrypted refresh token
  googleTokenExpiry    DateTime?
  googleCalendarId     String?   @default("primary")
  calendarSyncEnabled  Boolean   @default(false)
  // SRS System relations
  tierSnapshots        SitterTierSnapshot[]
  serviceEvents        SitterServiceEvent[]
  timeOffs             SitterTimeOff[]
  offerEvents          OfferEvent[]
  visitEvents          VisitEvent[]
  compensation         SitterCompensation?
  metricsWindows       SitterMetricsWindow[]
  calendarEvents       BookingCalendarEvent[]
  messageThreads       MessageThread[]
  petHealthLogs        PetHealthLog[]
  verifications        SitterVerification[]

  // @@unique([email])   // re-add after backfill
  @@index([active])
  @@index([currentTierId])
}

model SitterPoolOffer {
  id               String   @id @default(uuid())
  bookingId        String
  sitterId         String?
  sitterIds        String?
  message          String?
  expiresAt        DateTime
  status           String   @default("active")
  responses        String   @default("[]")
  acceptedSitterId String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  booking          Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  sitter           Sitter?  @relation(fields: [sitterId], references: [id], onDelete: Cascade)

  @@index([bookingId])
  @@index([sitterId])
  @@index([status])
}

model BookingSitterPool {
  id              String   @id @default(uuid())
  bookingId       String
  sitterId        String
  createdAt       DateTime @default(now())
  createdByUserId String?
  booking         Booking  @relation("BookingSitterPool", fields: [bookingId], references: [id], onDelete: Cascade)
  sitter          Sitter   @relation("SitterPoolMembers", fields: [sitterId], references: [id], onDelete: Cascade)

  @@unique([bookingId, sitterId])
  @@index([bookingId])
  @@index([sitterId])
}

model Message {
  id        String   @id @default(uuid())
  direction String   @default("outbound")
  from      String   @default("")
  to        String   @default("")
  body      String   @default("")
  status    String   @default("sent")
  booking   Booking? @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  bookingId String?
  createdAt DateTime @default(now())

  @@index([bookingId])
  @@index([direction])
}

model Setting {
  id        String   @id @default(uuid())
  updatedAt DateTime @updatedAt
  key       String   @unique
  value     String
  category  String?
  label     String?
  createdAt DateTime @default(now())

  @@index([category])
}

model Report {
  id             String    @id @default(uuid())
  bookingId      String?
  booking        Booking?  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  content        String
  mediaUrls      String?
  visitStarted   DateTime?
  visitCompleted DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([bookingId])
}

model GoogleCalendarAccount {
  id           String    @id @default(uuid())
  email        String    @unique
  provider     String    @default("google")
  accessToken  String
  refreshToken String?
  expiresAt    DateTime?
  calendarId   String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([email])
}

// ============================================
// AUTOMATION CENTER MODELS (Enterprise Rebuild)
// ============================================

model Automation {
  id          String   @id @default(uuid())
  name        String
  description String?
  isEnabled   Boolean  @default(true)
  scope       String   @default("global") // global, org, sitter, client
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String? // User ID or system
  updatedBy   String? // User ID or system
  version     Int      @default(1)
  status      String   @default("draft") // draft, active, paused, archived

  // Relations
  trigger         AutomationTrigger?
  conditionGroups AutomationConditionGroup[]
  actions         AutomationAction[]
  templates       AutomationTemplate[]
  runs            AutomationRun[]

  @@index([isEnabled])
  @@index([status])
  @@index([scope])
  @@index([createdAt])
}

model AutomationTrigger {
  id            String     @id @default(uuid())
  automationId  String     @unique
  automation    Automation @relation(fields: [automationId], references: [id], onDelete: Cascade)
  triggerType   String // e.g., "booking.created", "booking.statusChanged", "time.scheduled"
  triggerConfig String     @db.Text // JSON string with trigger-specific configuration

  @@index([triggerType])
}

model AutomationConditionGroup {
  id           String                @id @default(uuid())
  automationId String
  automation   Automation            @relation(fields: [automationId], references: [id], onDelete: Cascade)
  operator     String                @default("all") // "all" or "any"
  order        Int                   @default(0)
  conditions   AutomationCondition[]

  @@index([automationId])
  @@index([order])
}

model AutomationCondition {
  id              String                   @id @default(uuid())
  groupId         String
  group           AutomationConditionGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  conditionType   String // e.g., "booking.service", "booking.status", "client.isNew"
  conditionConfig String                   @db.Text // JSON string with condition-specific configuration
  order           Int                      @default(0)

  @@index([groupId])
  @@index([order])
}

model AutomationAction {
  id           String     @id @default(uuid())
  automationId String
  automation   Automation @relation(fields: [automationId], references: [id], onDelete: Cascade)
  actionType   String // e.g., "sendSMS", "sendEmail", "updateBookingStatus", "assignSitter"
  actionConfig String     @db.Text // JSON string with action-specific configuration
  order        Int        @default(0)

  @@index([automationId])
  @@index([order])
}

model AutomationTemplate {
  id            String     @id @default(uuid())
  automationId  String
  automation    Automation @relation(fields: [automationId], references: [id], onDelete: Cascade)
  templateType  String // "sms", "email", "internalMessage"
  subject       String? // For emails
  body          String     @db.Text
  variablesUsed String?    @db.Text // JSON array of variable names
  previewText   String?    @db.Text
  updatedAt     DateTime   @updatedAt
  updatedBy     String? // User ID

  @@index([automationId])
  @@index([templateType])
}

model AutomationRun {
  id               String     @id @default(uuid())
  automationId     String
  automation       Automation @relation(fields: [automationId], references: [id], onDelete: Cascade)
  triggeredAt      DateTime   @default(now())
  status           String     @default("queued") // queued, running, success, failed, skipped, test
  reason           String?    @db.Text // If skipped
  targetEntityType String? // booking, client, sitter, payrollRun, payment, messageThread
  targetEntityId   String?
  idempotencyKey   String?    @unique
  metadata         String?    @db.Text // JSON string
  correlationId    String? // For EventLog correlation

  // Relations
  steps AutomationRunStep[]

  @@index([automationId])
  @@index([status])
  @@index([triggeredAt])
  @@index([targetEntityType, targetEntityId])
  @@index([correlationId])
  @@index([idempotencyKey])
}

model AutomationRunStep {
  id              String        @id @default(uuid())
  automationRunId String
  automationRun   AutomationRun @relation(fields: [automationRunId], references: [id], onDelete: Cascade)
  stepType        String // "conditionCheck", "actionExecute"
  status          String // "success", "failed", "skipped"
  input           String?       @db.Text // JSON string
  output          String?       @db.Text // JSON string
  error           String?       @db.Text // JSON string
  createdAt       DateTime      @default(now())

  @@index([automationRunId])
  @@index([stepType])
  @@index([status])
}

// ============================================
// CUSTOM FIELD SYSTEM
// ============================================

model CustomField {
  id               String             @id @default(uuid())
  entityType       String // "client", "pet", "sitter", "booking"
  label            String
  fieldType        String // "string", "number", "boolean", "date", "list"
  required         Boolean            @default(false)
  visibleToOwner   Boolean            @default(true)
  visibleToSitter  Boolean            @default(false)
  visibleToClient  Boolean            @default(false)
  editableBySitter Boolean            @default(false)
  editableByClient Boolean            @default(false)
  showInTemplates  Boolean            @default(false)
  options          String? // JSON array for list type fields
  defaultValue     String?
  order            Int                @default(0)
  values           CustomFieldValue[]
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  @@index([entityType])
}

model CustomFieldValue {
  id            String      @id @default(uuid())
  customFieldId String
  customField   CustomField @relation(fields: [customFieldId], references: [id], onDelete: Cascade)
  entityId      String // ID of the client, pet, sitter, or booking
  value         String
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  Pet           Pet?        @relation(fields: [petId], references: [id], onDelete: SetNull)
  petId         String?
  Sitter        Sitter?     @relation(fields: [sitterId], references: [id], onDelete: SetNull)
  sitterId      String?
  Client        Client?     @relation(fields: [clientId], references: [id], onDelete: SetNull)
  clientId      String?
  Booking       Booking?    @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  bookingId     String?

  @@unique([customFieldId, entityId])
  @@index([entityId])
  @@index([petId])
  @@index([sitterId])
  @@index([clientId])
  @@index([bookingId])
}

// ============================================
// SERVICE CONFIGURATION
// ============================================

model ServiceConfig {
  id                 String   @id @default(uuid())
  serviceName        String   @unique
  basePrice          Float?
  defaultDuration    Int? // minutes
  category           String? // e.g., "walking", "sitting", "care"
  minBookingNotice   Int? // hours
  gpsCheckInRequired Boolean  @default(false)
  photosRequired     Boolean  @default(false)
  allowedSitterTiers String? // JSON array of tier IDs
  allowedSitterTypes String? // JSON array
  weekendMultiplier  Float?   @default(1.0)
  holidayMultiplier  Float?   @default(1.0)
  timeOfDayRules     String? // JSON object with rules
  holidayBehavior    String? // JSON object
  enabled            Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([serviceName])
  @@index([category])
}

// ============================================
// PRICING ENGINE
// ============================================

model PricingRule {
  id          String   @id @default(uuid())
  name        String
  description String?
  type        String // "fee", "discount", "multiplier"
  conditions  String // JSON object with conditions
  calculation String // JSON object with calculation logic
  priority    Int      @default(0)
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([enabled])
  @@index([type])
}

// ============================================
// DISCOUNT ENGINE
// ============================================

model Discount {
  id              String          @id @default(uuid())
  code            String?         @unique // For discount codes
  name            String
  type            String // "code", "firstTime", "loyalty", "referral", "automatic"
  value           Float // Percentage or fixed amount
  valueType       String // "percentage" or "fixed"
  minBookingTotal Float?
  maxDiscount     Float?
  validFrom       DateTime?
  validUntil      DateTime?
  usageLimit      Int?
  usageCount      Int             @default(0)
  conditions      String? // JSON object with conditions
  enabled         Boolean         @default(true)
  bookings        DiscountUsage[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([code])
  @@index([type])
  @@index([enabled])
}

model DiscountUsage {
  id         String   @id @default(uuid())
  discountId String
  discount   Discount @relation(fields: [discountId], references: [id], onDelete: Cascade)
  bookingId  String
  booking    Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  amount     Float
  usedAt     DateTime @default(now())

  @@unique([bookingId]) // One discount per booking
  @@index([discountId])
  @@index([bookingId])
}

// ============================================
// BOOKING FORM BUILDER
// ============================================

model FormField {
  id              String   @id @default(uuid())
  serviceType     String? // null = applies to all services
  label           String
  fieldType       String // "text", "email", "phone", "date", "select", "textarea", "checkbox"
  required        Boolean  @default(false)
  order           Int      @default(0)
  options         String? // JSON array for select fields
  placeholder     String?
  helpText        String?
  visibleToSitter Boolean  @default(false)
  visibleToClient Boolean  @default(true)
  includeInReport Boolean  @default(false)
  enabled         Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([serviceType])
}

// ============================================
// TEMPLATE ENGINE
// ============================================

model MessageTemplate {
  id          String            @id @default(uuid())
  name        String
  type        String // "sms", "email"
  category    String // "client", "sitter", "owner", "report", "invoice", "onboarding"
  templateKey String            @unique // e.g., "booking.confirmed.client.sms"
  subject     String? // For emails
  body        String
  variables   String? // JSON array of available variables
  version     Int               @default(1)
  isActive    Boolean           @default(true)
  history     TemplateHistory[]
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@index([category])
  @@index([type])
  @@index([templateKey])
}

model TemplateHistory {
  id         String          @id @default(uuid())
  templateId String
  template   MessageTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  subject    String?
  body       String
  version    Int
  changedBy  String? // User ID or system
  changedAt  DateTime        @default(now())

  @@index([templateId])
}

// ============================================
// PERMISSION & ROLE SYSTEM
// ============================================

model Role {
  id          String           @id @default(uuid())
  name        String           @unique // "owner", "admin", "manager", "leadSitter", "sitter", "accountant"
  displayName String
  permissions RolePermission[]
  users       UserRole[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}

model RolePermission {
  id       String  @id @default(uuid())
  roleId   String
  role     Role    @relation(fields: [roleId], references: [id], onDelete: Cascade)
  resource String // e.g., "client.phone", "booking.edit", "sitter.payout"
  action   String // "read", "write", "delete", "manage"
  granted  Boolean @default(true)

  @@unique([roleId, resource, action])
  @@index([roleId])
}

model UserRole {
  id        String   @id @default(uuid())
  userId    String // References Sitter.id or a future User model
  userType  String // "sitter" or "admin"
  roleId    String
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, userType, roleId])
  @@index([userId, userType])
}

// ============================================
// SITTER TIER & PERFORMANCE ENGINE
// ============================================

model SitterTier {
  id                        String              @id @default(uuid())
  name                      String              @unique
  pointTarget               Int
  minCompletionRate         Float? // 0-100
  minResponseRate           Float? // 0-100
  benefits                  String? // JSON object
  priorityLevel             Int                 @default(0) // Higher = more priority in routing
  canTakeHouseSits          Boolean             @default(false)
  canTakeTwentyFourHourCare Boolean             @default(false)
  isDefault                 Boolean             @default(false)
  // Canonical tier permissions (Enterprise Tier System)
  canJoinPools              Boolean             @default(false) // Can join sitter pools
  canAutoAssign             Boolean             @default(false) // Can be auto-assigned without owner approval
  canOvernight              Boolean             @default(false) // Can handle overnight/extended care
  canSameDay                Boolean             @default(false) // Can handle same-day emergency bookings
  canHighValue              Boolean             @default(false) // Can handle high-value clients
  canRecurring              Boolean             @default(false) // Can accept recurring clients
  canLeadPool               Boolean             @default(false) // Can lead sitter pools (Elite only)
  canOverrideDecline        Boolean             @default(false) // Can override certain decline rules (Elite only)
  // Commission split (percentage sitter receives, e.g., 70 = 70% to sitter, 30% to owner)
  commissionSplit           Float               @default(70.0) // Default commission percentage
  // Visual properties
  badgeColor                String? // Hex color for badge
  badgeStyle                String? // "outline" | "filled" | "accent" - for visual differentiation
  // Description and progression info
  description               String? // What this tier means
  progressionRequirements   String? // JSON object with requirements to advance
  sitters                   SitterTierHistory[]
  createdAt                 DateTime            @default(now())
  updatedAt                 DateTime            @updatedAt
  Sitter                    Sitter[]

  @@index([priorityLevel])
}

model SitterTierHistory {
  id             String     @id @default(uuid())
  sitterId       String
  sitter         Sitter     @relation(fields: [sitterId], references: [id], onDelete: Cascade)
  tierId         String
  tier           SitterTier @relation(fields: [tierId], references: [id], onDelete: Cascade)
  points         Int
  completionRate Float?
  responseRate   Float?
  periodStart    DateTime
  periodEnd      DateTime?
  // Audit fields for tier changes
  changedBy      String? // User ID who made the change (null if system/automation)
  reason         String? // Reason for tier change (promotion/demotion)
  metadata       String? // JSON string for additional context
  createdAt      DateTime   @default(now())

  @@index([sitterId])
  @@index([tierId])
  @@index([periodStart])
  @@index([createdAt])
}

model ServicePointWeight {
  id        String   @id @default(uuid())
  service   String
  duration  Int? // null = applies to all durations
  points    Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([service, duration])
  @@index([service])
}

// ============================================
// CLIENT MANAGEMENT
// ============================================

model Client {
  id            String             @id @default(uuid())
  orgId         String             @default("default")
  firstName     String             @default("")
  lastName      String             @default("")
  phone         String             @default("")
  email         String?
  address       String?
  tags          String? // JSON array
  lifetimeValue Float              @default(0)
  lastBookingAt DateTime?
  notes         String?
  customFields  CustomFieldValue[]
  bookings      Booking[]
  threads       MessageThread[]
  loyaltyRewards LoyaltyReward[]
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

  @@unique([orgId, phone])
  @@unique([phone])
  @@index([phone])
  @@index([email])
  @@index([orgId])
}

// ============================================
// BOOKING EXTENSIONS
// ============================================

model BookingTag {
  id        String                 @id @default(uuid())
  name      String                 @unique
  color     String? // Hex color
  bookings  BookingTagAssignment[]
  createdAt DateTime               @default(now())
  updatedAt DateTime               @updatedAt
}

model BookingTagAssignment {
  id        String     @id @default(uuid())
  bookingId String
  tagId     String
  tag       BookingTag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  booking   Booking    @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  createdAt DateTime   @default(now())

  @@unique([bookingId, tagId])
  @@index([bookingId])
  @@index([tagId])
}

model BookingPipeline {
  id          String   @id @default(uuid())
  name        String   @unique
  order       Int      @default(0)
  isDefault   Boolean  @default(false)
  transitions String? // JSON array of allowed next statuses
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([order])
}

// ============================================
// BUSINESS SETTINGS
// ============================================

model BusinessSettings {
  id              String   @id @default(uuid())
  businessName    String
  businessPhone   String?
  businessEmail   String?
  businessAddress String?
  timeZone        String   @default("America/New_York")
  operatingHours  String? // JSON object
  holidays        String? // JSON array
  taxSettings     String? // JSON object
  contentBlocks   String? // JSON object with policies, terms, etc.
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// ============================================
// AUTHENTICATION MODELS
// ============================================

model User {
  id            String    @id @default(uuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  passwordHash  String? // For credentials provider
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  accounts      Account[]
  sessions      Session[]
  // Link to Sitter if this user is a sitter (one-to-one relation)
  sitterId      String?   @unique
  sitter        Sitter?   @relation(fields: [sitterId], references: [id], onDelete: SetNull)

  @@index([email])
  @@index([sitterId])
}

model Account {
  id                String  @id @default(uuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([sessionToken])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ============================================
// EXISTING UTILITY MODELS (referenced by code)
// ============================================

model BaselineSnapshot {
  id                   String   @id @default(uuid())
  bookingId            String
  timestamp            DateTime @default(now())
  bookingFormTotal     Float?
  calendarViewTotal    Float?
  sitterDashboardTotal Float?
  ownerDashboardTotal  Float?
  stripePaymentTotal   Float?
  storedTotalPrice     Float?
  calculatedBreakdown  String?  @db.Text // JSON string
  notes                String?  @db.Text

  @@index([bookingId])
  @@index([timestamp])
}

model FeatureFlag {
  id          String   @id @default(uuid())
  key         String   @unique
  enabled     Boolean  @default(false)
  description String?
  metadata    String?  @db.Text // JSON string
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([key])
  @@index([enabled])
}

// ============================================
// EVENT LOG
// ============================================

model EventLog {
  id             String   @id @default(uuid())
  eventType      String // e.g., "automation.run", "booking.created", "payment.success"
  automationType String? // Automation type if eventType is "automation.run" (e.g., "bookingConfirmation", "nightBeforeReminder")
  status         String // "success", "failed", "skipped", "pending"
  error          String?  @db.Text // Error message if status is "failed"
  metadata       String?  @db.Text // JSON string for additional context (inputs, outputs, etc.)
  bookingId      String?
  booking        Booking? @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  createdAt      DateTime @default(now())

  @@index([eventType])
  @@index([automationType])
  @@index([status])
  @@index([bookingId])
  @@index([createdAt])
}

// ============================================
// BOOKING STATUS HISTORY
// ============================================

model BookingStatusHistory {
  id         String   @id @default(uuid())
  bookingId  String
  booking    Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  fromStatus String? // Previous status (null for initial status)
  toStatus   String // New status
  changedBy  String? // User ID who made the change (null if system/automation)
  reason     String?  @db.Text // Optional reason for status change
  metadata   String?  @db.Text // JSON string for additional context
  createdAt  DateTime @default(now())

  @@index([bookingId])
  @@index([toStatus])
  @@index([createdAt])
  @@index([changedBy])
}

// Stripe Payment Read Models
model StripeCharge {
  id              String    @id // Stripe charge ID
  amount          Int // Amount in cents
  amountRefunded  Int       @default(0)
  currency        String    @default("usd")
  status          String // succeeded, pending, failed
  description     String?   @db.Text
  customerId      String? // Stripe customer ID
  customerEmail   String?
  customerName    String?
  paymentMethod   String? // card, bank_account, etc.
  paymentIntentId String? // Stripe payment intent ID
  invoiceId       String? // Stripe invoice ID
  bookingId       String? // Linked booking ID
  refunded        Boolean   @default(false)
  refundedAt      DateTime?
  createdAt       DateTime // Stripe created timestamp
  syncedAt        DateTime  @default(now()) @updatedAt

  @@index([customerId])
  @@index([bookingId])
  @@index([status])
  @@index([createdAt])
  @@index([syncedAt])
}

model StripeRefund {
  id              String   @id // Stripe refund ID
  chargeId        String // Stripe charge ID
  amount          Int // Amount in cents
  currency        String   @default("usd")
  reason          String? // duplicate, fraudulent, requested_by_customer
  status          String // succeeded, pending, failed, canceled
  paymentIntentId String? // Stripe payment intent ID
  createdAt       DateTime // Stripe created timestamp
  syncedAt        DateTime @default(now()) @updatedAt

  @@index([chargeId])
  @@index([status])
  @@index([createdAt])
}

model StripePayout {
  id                  String    @id // Stripe payout ID
  amount              Int // Amount in cents
  currency            String    @default("usd")
  status              String // paid, pending, in_transit, canceled, failed
  arrivalDate         DateTime? // When payout arrives
  description         String?   @db.Text
  statementDescriptor String?
  createdAt           DateTime // Stripe created timestamp
  syncedAt            DateTime  @default(now()) @updatedAt

  @@index([status])
  @@index([arrivalDate])
  @@index([createdAt])
}

model StripeBalanceTransaction {
  id          String   @id // Stripe balance transaction ID
  amount      Int // Amount in cents (can be negative for fees)
  currency    String   @default("usd")
  type        String // charge, payment, refund, payout, etc.
  description String?  @db.Text
  fee         Int      @default(0) // Fee amount in cents
  net         Int // Net amount after fees
  chargeId    String? // Related charge ID
  payoutId    String? // Related payout ID
  createdAt   DateTime // Stripe created timestamp
  syncedAt    DateTime @default(now()) @updatedAt

  @@index([type])
  @@index([chargeId])
  @@index([payoutId])
  @@index([createdAt])
}

// Payroll Models
model PayrollRun {
  id             String              @id @default(uuid())
  payPeriodStart DateTime
  payPeriodEnd   DateTime
  status         String              @default("draft") // draft, pending, approved, paid, canceled
  totalAmount    Float
  totalSitters   Int
  approvedBy     String? // User ID
  approvedAt     DateTime?
  paidAt         DateTime?
  notes          String?             @db.Text
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt
  lineItems      PayrollLineItem[]
  adjustments    PayrollAdjustment[]

  @@index([payPeriodStart])
  @@index([payPeriodEnd])
  @@index([status])
}

model PayrollLineItem {
  id               String     @id @default(uuid())
  payrollRunId     String
  payrollRun       PayrollRun @relation(fields: [payrollRunId], references: [id], onDelete: Cascade)
  sitterId         String
  sitter           Sitter     @relation(fields: [sitterId], references: [id])
  bookingCount     Int
  totalEarnings    Float
  commissionRate   Float
  commissionAmount Float
  adjustments      Float      @default(0) // Sum of bonuses - deductions
  netAmount        Float
  notes            String?    @db.Text
  createdAt        DateTime   @default(now())

  @@index([payrollRunId])
  @@index([sitterId])
}

model PayrollAdjustment {
  id           String     @id @default(uuid())
  payrollRunId String
  payrollRun   PayrollRun @relation(fields: [payrollRunId], references: [id], onDelete: Cascade)
  sitterId     String
  sitter       Sitter     @relation(fields: [sitterId], references: [id])
  type         String // bonus, deduction
  amount       Float
  reason       String     @db.Text
  createdBy    String? // User ID
  createdAt    DateTime   @default(now())

  @@index([payrollRunId])
  @@index([sitterId])
}

// ============================================
// MESSAGING SYSTEM (Messaging Master Spec V1)
// ============================================

model MessageAccount {
  id                 String   @id @default(uuid())
  orgId              String
  provider           String // e.g., "twilio"
  providerConfigJson String?  @db.Text // JSON string with provider-specific config
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([orgId])
  @@index([provider])
}

model MessageNumber {
  id                 String              @id @default(uuid())
  orgId              String              @default("default")
  provider           String              @default("twilio") // e.g., "twilio"
  providerNumberSid  String              @default("") // Provider's number identifier
  e164               String              @default("") // E.164 format phone number
  market             String? // e.g., "US"
  status             String              @default("active") // active, disabled
  numberClass        String              @default("pool") // front_desk | sitter | pool
  assignedSitterId   String? // For sitter numbers
  ownerId            String? // For front desk numbers
  isRotating         Boolean             @default(false) // For pool numbers
  rotationPriority   Int? // For pool number rotation
  lastAssignedAt     DateTime? // For pool rotation tracking
  // Relations
  sitterMaskedNumber SitterMaskedNumber?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  MessageThread      MessageThread[]

  @@index([orgId])
  @@index([provider])
  @@index([e164])
  @@index([status])
  @@index([numberClass])
  @@index([assignedSitterId])
}

// Provider Credentials (encrypted at rest)
model ProviderCredential {
  id            String   @id @default(uuid())
  orgId         String   @unique
  providerType  String   @default("twilio") // 'twilio', 'openphone', etc.
  encryptedConfig String @db.Text // Encrypted JSON: { accountSid, authToken }
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([orgId])
}

model MessageThread {
  id                     String    @id @default(uuid())
  orgId                  String
  scope                  String // client_booking, client_general, owner_sitter, internal
  bookingId              String?
  clientId               String?
  assignedSitterId       String?
  status                 String    @default("open") // open, closed, archived
  providerSessionSid     String?
  maskedNumberE164       String?
  numberClass            String? // front_desk | sitter | pool
  messageNumberId        String?
  isOneTimeClient        Boolean   @default(false)
  isMeetAndGreet         Boolean   @default(false)
  meetAndGreetApprovedAt DateTime?
  assignmentWindowId     String?
  lastMessageAt          DateTime?
  lastInboundAt          DateTime?
  lastOutboundAt         DateTime?
  ownerUnreadCount       Int       @default(0)
  threadType             String? // use scope for semantics
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  // Relations
  client               Client?                @relation(fields: [clientId], references: [id], onDelete: SetNull)
  sitter               Sitter?                @relation(fields: [assignedSitterId], references: [id], onDelete: SetNull)
  participants        MessageParticipant[]
  events              MessageEvent[]
  assignmentAudits    ThreadAssignmentAudit[]
  responseRecords     ResponseRecord[]
  messageNumber       MessageNumber?          @relation(fields: [messageNumberId], references: [id], onDelete: SetNull)
  assignmentWindows   AssignmentWindow[]
  AntiPoachingAttempt AntiPoachingAttempt[]
  offerEvents         OfferEvent[]
  visitEvents         VisitEvent[]
  responseLinks       MessageResponseLink[]

  @@index([orgId])
  @@index([bookingId])
  @@index([clientId])
  @@index([assignedSitterId])
  @@index([status])
  @@index([lastMessageAt])
  @@index([numberClass])
  @@index([messageNumberId])
  @@index([assignmentWindowId])
}

model MessageParticipant {
  id                     String   @id @default(uuid())
  threadId               String
  orgId                  String
  role                   String // client, sitter, owner, system
  userId                 String? // User ID if role is sitter/owner
  clientId               String? // Client ID if role is client
  displayName            String
  realE164               String // Real phone number (stored securely)
  providerParticipantSid String? // Provider's participant identifier
  // Legacy fields for backward compatibility
  entityType             String? // use role + userId/clientId
  entityId               String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  // Relations
  thread MessageThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([threadId])
  @@index([orgId])
  @@index([role])
  @@index([userId])
  @@index([clientId])
}

model MessageEvent {
  id                          String   @id @default(uuid())
  threadId                    String
  orgId                       String
  direction                   String // inbound, outbound
  actorType                   String // client, sitter, owner, system
  actorUserId                 String?
  actorClientId               String?
  providerMessageSid          String? // Provider's message identifier
  body                        String   @db.Text
  mediaJson                   String?  @db.Text // JSON array of media URLs
  createdAt                   DateTime @default(now())
  deliveryStatus              String   @default("queued") // queued, sent, delivered, failed, received
  failureCode                 String?
  failureDetail               String?  @db.Text
  requiresResponse            Boolean  @default(false)
  responseToMessageId         String?  // FK to MessageEvent (the message this responds to)
  responseSlaSeconds          Int?
  responsibleSitterIdSnapshot String?
  promptId                    String?
  metadataJson                String?  @db.Text // JSON object
  correlationIds              String?  @db.Text // JSON array for audit trail
  answeredAt                  DateTime? // When this message was answered (if requiresResponse=true)
  // Legacy fields for backward compatibility (delivery retry)
  attemptCount                Int?
  lastAttemptAt               DateTime?
  providerErrorCode           String?
  providerErrorMessage        String?

  // Relations
  thread              MessageThread        @relation(fields: [threadId], references: [id], onDelete: Cascade)
  AntiPoachingAttempt AntiPoachingAttempt?
  responseTo          MessageEvent?        @relation("ResponseTo", fields: [responseToMessageId], references: [id], onDelete: SetNull)
  responses           MessageEvent[]       @relation("ResponseTo")
  requiresResponseLinks MessageResponseLink[] @relation("RequiresResponse")
  responseLinks       MessageResponseLink[] @relation("Response")

  @@index([threadId])
  @@index([orgId])
  @@index([direction])
  @@index([actorType])
  @@index([deliveryStatus])
  @@index([createdAt])
  @@index([providerMessageSid])
  @@index([requiresResponse])
  @@index([responseToMessageId])
  @@index([answeredAt])
}

model ThreadAssignmentAudit {
  id           String   @id @default(uuid())
  orgId        String
  threadId     String
  fromSitterId String?
  toSitterId   String?
  actorUserId  String // User ID who made the change
  reason       String?  @db.Text
  createdAt    DateTime @default(now())

  // Relations
  thread MessageThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([orgId])
  @@index([threadId])
  @@index([actorUserId])
  @@index([createdAt])
}

model OptOutState {
  id        String   @id @default(uuid())
  orgId     String
  clientId  String?
  phoneE164 String
  state     String // opted_in, opted_out
  source    String // inbound_keyword, admin_override, import
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([orgId, phoneE164])
  @@index([orgId])
  @@index([phoneE164])
  @@index([state])
}

model ResponseRecord {
  id                       String    @id @default(uuid())
  orgId                    String
  threadId                 String
  bookingId                String?
  inboundMessageEventId    String // ID of the inbound MessageEvent that triggered this
  responsibleSitterId      String?
  slaSeconds               Int?
  inboundAt                DateTime
  resolutionStatus         String    @default("pending") // pending, replied, escalated, expired, ignored
  resolvedAt               DateTime?
  resolvedByMessageEventId String?
  responseSeconds          Int?
  escalationReason         String?   @db.Text
  ignoreReason             String?   @db.Text
  createdAt                DateTime  @default(now())
  updatedAt                DateTime  @updatedAt

  // Relations
  thread MessageThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([orgId])
  @@index([threadId])
  @@index([bookingId])
  @@index([responsibleSitterId])
  @@index([resolutionStatus])
  @@index([inboundAt])
}

// ============================================
// NUMBER INFRASTRUCTURE
// ============================================

model SitterMaskedNumber {
  id                     String    @id @default(uuid())
  orgId                  String
  sitterId               String    @unique
  messageNumberId        String    @unique // FK to MessageNumber (unique for one-to-one relation)
  providerParticipantSid String? // Provider's participant ID
  status                 String    @default("active") // active, deactivated, reassigned
  assignedAt             DateTime  @default(now())
  deactivatedAt          DateTime?
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  // Relations
  sitter        Sitter        @relation(fields: [sitterId], references: [id], onDelete: Cascade)
  messageNumber MessageNumber @relation(fields: [messageNumberId], references: [id], onDelete: Restrict)

  @@index([orgId])
  @@index([sitterId])
  @@index([status])
}

// ============================================
// ASSIGNMENT WINDOW
// ============================================

model AssignmentWindow {
  id        String   @id @default(uuid())
  orgId     String
  threadId  String
  bookingId String
  sitterId  String
  startAt   DateTime
  endAt     DateTime
  status    String   @default("active") // active, expired, closed
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  thread  MessageThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  booking Booking       @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  sitter  Sitter        @relation(fields: [sitterId], references: [id], onDelete: Cascade)

  @@index([orgId])
  @@index([threadId])
  @@index([bookingId])
  @@index([sitterId])
  @@index([status])
  @@index([startAt, endAt])
}

// ============================================
// ANTI-POACHING
// ============================================

model AntiPoachingAttempt {
  id               String    @id @default(uuid())
  orgId            String
  threadId         String
  eventId          String    @unique // FK to MessageEvent
  actorType        String // client | sitter
  actorId          String?
  violationType    String // phone_number | email | url | social_media
  detectedContent  String    @db.Text // The flagged content
  action           String    @default("blocked") // blocked | warned | flagged
  ownerNotifiedAt  DateTime?
  resolvedAt       DateTime?
  resolvedByUserId String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  // Relations
  thread MessageThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  event  MessageEvent  @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@index([orgId])
  @@index([threadId])
  @@index([eventId])
  @@index([action])
}

// ============================================
// SITTER GROWTH LEVELS SYSTEM (SRS)
// ============================================

model SitterTierSnapshot {
  id                    String   @id @default(uuid())
  orgId                 String
  sitterId              String
  asOfDate              DateTime @db.Date
  rolling30dScore       Float    // 0-100
  rolling30dBreakdownJson String  @db.Text // JSON: { responsiveness, acceptance, timeliness, accuracy, engagement, conduct }
  rolling26wScore       Float?   // 0-100, nullable for new sitters
  rolling26wBreakdownJson String? @db.Text // JSON: same structure
  tier                  String   @default("foundation") // foundation, reliant, trusted, preferred
  provisional           Boolean  @default(false)
  visits30d             Int      @default(0)
  offers30d             Int      @default(0)
  lastPromotionAt       DateTime?
  lastDemotionAt        DateTime?
  atRisk                Boolean  @default(false)
  atRiskReason          String?  @db.Text
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // Relations
  sitter                Sitter   @relation(fields: [sitterId], references: [id], onDelete: Cascade)

  @@unique([orgId, sitterId, asOfDate])
  @@index([orgId, sitterId, asOfDate(sort: Desc)])
  @@index([orgId, asOfDate])
  @@index([sitterId, asOfDate(sort: Desc)])
  @@index([tier])
  @@index([atRisk])
}

model SitterServiceEvent {
  id            String    @id @default(uuid())
  orgId         String
  sitterId      String
  level         String    // coaching, corrective, probation
  reasonCode    String
  notes         String?   @db.Text
  effectiveFrom DateTime
  effectiveTo   DateTime?
  createdByUserId String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  sitter        Sitter    @relation(fields: [sitterId], references: [id], onDelete: Cascade)

  @@index([orgId, sitterId, createdAt(sort: Desc)])
  @@index([orgId, sitterId, effectiveFrom, effectiveTo])
  @@index([level])
  @@index([effectiveFrom, effectiveTo])
}

model SitterTimeOff {
  id              String    @id @default(uuid())
  orgId           String
  sitterId        String
  type            String    // pto, medical
  startsAt        DateTime
  endsAt          DateTime
  approvedByUserId String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  sitter          Sitter    @relation(fields: [sitterId], references: [id], onDelete: Cascade)

  @@index([orgId, sitterId, startsAt, endsAt])
  @@index([orgId, sitterId, startsAt(sort: Desc)])
  @@index([type])
  @@index([startsAt, endsAt])
}

model OfferEvent {
  id                String    @id @default(uuid())
  orgId             String
  sitterId          String
  threadId          String?
  bookingId         String?
  offeredAt         DateTime
  expiresAt         DateTime? // When offer expires (for timeout tracking)
  acceptedAt        DateTime?
  declinedAt        DateTime?
  declineReason     String?    // enum + free text
  source            String     @default("dashboard") // dashboard | sms
  status            String     @default("sent") // sent | accepted | declined | expired
  withinAvailability Boolean   @default(true)
  leadTimeValid     Boolean    @default(true)
  routingValid      Boolean    @default(true)
  excluded          Boolean    @default(false)
  excludedReason    String?    @db.Text
  correlationIds    String?    @db.Text // JSON array
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  // Relations
  sitter            Sitter     @relation(fields: [sitterId], references: [id], onDelete: Cascade)
  booking           Booking?   @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  thread            MessageThread? @relation(fields: [threadId], references: [id], onDelete: SetNull)

  @@index([orgId, sitterId, offeredAt(sort: Desc)])
  @@index([orgId, sitterId, excluded])
  @@index([orgId, sitterId, status])
  @@index([bookingId])
  @@index([threadId])
  @@index([offeredAt])
  @@index([expiresAt])
}

model VisitEvent {
  id                  String    @id @default(uuid())
  orgId               String
  sitterId            String
  clientId            String?
  bookingId           String
  threadId            String?
  scheduledStart      DateTime
  scheduledEnd        DateTime
  checkInAt           DateTime?
  checkOutAt          DateTime?
  status              String    // completed, late, missed, canceled
  lateMinutes         Int?      @default(0)
  checklistMissedCount Int      @default(0)
  mediaMissingCount   Int       @default(0)
  complaintVerified    Boolean   @default(false)
  safetyFlag          Boolean   @default(false)
  excluded            Boolean   @default(false)
  excludedReason      String?   @db.Text
  correlationIds      String?   @db.Text // JSON array
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Relations
  sitter              Sitter     @relation(fields: [sitterId], references: [id], onDelete: Cascade)
  booking             Booking    @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  thread              MessageThread? @relation(fields: [threadId], references: [id], onDelete: SetNull)

  @@index([orgId, sitterId, scheduledStart(sort: Desc)])
  @@index([orgId, sitterId, excluded])
  @@index([bookingId])
  @@index([threadId])
  @@index([scheduledStart])
  @@index([status])
}

model SitterCompensation {
  id                  String    @id @default(uuid())
  orgId               String
  sitterId            String    @unique
  basePay             Float     @default(12.50)
  lastRaiseAt         DateTime?
  lastRaiseAmount     Float?
  nextReviewDate      DateTime?
  perkFlags           String?   @db.Text // JSON: { priority, multipliers, mentorship, reducedOversight }
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Relations
  sitter              Sitter    @relation(fields: [sitterId], references: [id], onDelete: Cascade)

  @@index([orgId, sitterId])
  @@index([nextReviewDate])
}

model SitterMetricsWindow {
  id                  String    @id @default(uuid())
  orgId               String
  sitterId            String
  windowStart         DateTime
  windowEnd           DateTime
  windowType          String     // daily | weekly_7d | monthly_30d
  avgResponseSeconds  Float?
  medianResponseSeconds Float?
  responseRate        Float?     // responded threads / total requiring response
  offerAcceptRate     Float?     // accepted / total offers
  offerDeclineRate    Float?     // declined / total offers
  offerExpireRate     Float?     // expired / total offers
  lastOfferRespondedAt DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Relations
  sitter              Sitter     @relation(fields: [sitterId], references: [id], onDelete: Cascade)

  @@unique([orgId, sitterId, windowStart, windowType])
  @@index([orgId, sitterId, windowStart])
  @@index([orgId, sitterId, windowEnd])
  @@index([windowType])
}

model MessageResponseLink {
  id                    String    @id @default(uuid())
  orgId                 String
  threadId              String
  requiresResponseEventId String  // FK to MessageEvent (the message requiring response)
  responseEventId       String    // FK to MessageEvent (the response)
  responseMinutes       Int       // Calculated response time in minutes
  responseSeconds       Int?      // More precise response time in seconds
  withinAssignmentWindow Boolean  @default(false)
  excluded              Boolean   @default(false)
  excludedReason        String?   @db.Text
  createdAt             DateTime  @default(now())

  // Relations
  requiresResponseEvent MessageEvent @relation("RequiresResponse", fields: [requiresResponseEventId], references: [id], onDelete: Cascade)
  responseEvent         MessageEvent @relation("Response", fields: [responseEventId], references: [id], onDelete: Cascade)
  thread                MessageThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@unique([requiresResponseEventId]) // One response per requiring message
  @@index([orgId, threadId, createdAt(sort: Desc)])
  @@index([orgId, requiresResponseEventId])
  @@index([responseEventId])
  @@index([withinAssignmentWindow, excluded])
}

// ============================================
// GOOGLE CALENDAR INTEGRATION
// ============================================

model BookingCalendarEvent {
  id                  String    @id @default(uuid())
  bookingId           String
  sitterId            String
  googleCalendarEventId String // Google Calendar event ID
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Relations
  booking             Booking   @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  sitter              Sitter    @relation(fields: [sitterId], references: [id], onDelete: Cascade)

  @@unique([bookingId, sitterId]) // One event per booking-sitter pair
  @@index([bookingId])
  @@index([sitterId])
  @@index([googleCalendarEventId])
}

// ============================================
// AI DOMINATION LAYER (Loyalty, Health, Verification, Analytics)
// ============================================

model LoyaltyReward {
  id          String    @id @default(cuid())
  orgId       String
  clientId    String
  points      Int      @default(0)
  tier        String   @default("bronze") // bronze, silver, gold, platinum
  lastEarned  DateTime @default(now())
  expiresAt   DateTime?

  client      Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@unique([orgId, clientId])
  @@index([orgId])
  @@index([clientId])
}

model PetHealthLog {
  id          String   @id @default(cuid())
  orgId       String
  petId       String
  sitterId    String?
  bookingId   String?
  note        String   @db.Text
  type        String   // "daily", "alert", "vet", "allergy"
  createdAt   DateTime @default(now())

  pet         Pet      @relation(fields: [petId], references: [id], onDelete: Cascade)
  sitter      Sitter?  @relation(fields: [sitterId], references: [id])
  booking     Booking? @relation(fields: [bookingId], references: [id])

  @@index([petId])
  @@index([sitterId])
  @@index([bookingId])
  @@index([orgId])
}

model SitterVerification {
  id              String    @id @default(cuid())
  sitterId        String
  status          String   @default("pending") // pending, approved, rejected
  backgroundCheck DateTime?
  insuranceProof  String?  @db.Text
  reviewedBy      String?
  notes           String?  @db.Text

  sitter          Sitter   @relation(fields: [sitterId], references: [id], onDelete: Cascade)

  @@index([sitterId])
  @@index([status])
}

model AnalyticsInsight {
  id            String   @id @default(cuid())
  orgId         String
  type          String   // "revenue", "retention", "pet_health", "sitter_performance"
  value         Json
  generatedAt   DateTime @default(now())
  period        String   // "daily", "weekly", "monthly"

  @@index([orgId])
  @@index([type])
  @@index([generatedAt])
}
```

---

## Section 8: All 80 API route.ts Files (Paths Only)

```
src/app/api/[...path]/route.ts
src/app/api/assignments/windows/[id]/route.ts
src/app/api/assignments/windows/route.ts
src/app/api/auth/[...nextauth]/route.ts
src/app/api/auth/config-check/route.ts
src/app/api/auth/health/route.ts
src/app/api/auth/logout/route.ts
src/app/api/bookings/[id]/daily-delight/route.ts
src/app/api/debug-auth/route.ts
src/app/api/dispatch/attention/route.ts
src/app/api/dispatch/force-assign/route.ts
src/app/api/dispatch/resume-automation/route.ts
src/app/api/form/route.ts
src/app/api/health/route.ts
src/app/api/integrations/google/callback/route.ts
src/app/api/integrations/google/start/route.ts
src/app/api/message-templates/route.ts
src/app/api/messages/[id]/retry/route.ts
src/app/api/messages/debug/state/route.ts
src/app/api/messages/process-srs/route.ts
src/app/api/messages/seed-proof/route.ts
src/app/api/messages/seed-srs-proof/route.ts
src/app/api/messages/send/route.ts
src/app/api/messages/threads/[id]/mark-read/route.ts
src/app/api/messages/threads/[id]/messages/route.ts
src/app/api/messages/threads/[id]/route.ts
src/app/api/messages/threads/route.ts
src/app/api/messages/webhook/twilio/route.ts
src/app/api/numbers/[id]/assign/route.ts
src/app/api/numbers/[id]/class/route.ts
src/app/api/numbers/[id]/quarantine/route.ts
src/app/api/numbers/[id]/release-to-pool/route.ts
src/app/api/numbers/[id]/release/route.ts
src/app/api/numbers/[id]/route.ts
src/app/api/numbers/buy/route.ts
src/app/api/numbers/import/route.ts
src/app/api/numbers/route.ts
src/app/api/numbers/sitters/[sitterId]/deactivate/route.ts
src/app/api/offers/expire/route.ts
src/app/api/ops/build/route.ts
src/app/api/ops/messaging-debug/route.ts
src/app/api/ops/runtime-proof/route.ts
src/app/api/ops/seed-sitter-dashboard/route.ts
src/app/api/ops/srs/run-snapshot/route.ts
src/app/api/ops/srs/run-weekly-eval/route.ts
src/app/api/ops/twilio-setup-diagnostics/route.ts
src/app/api/ops/visits/capture/route.ts
src/app/api/routing/threads/[id]/history/route.ts
src/app/api/setup/numbers/sync/route.ts
src/app/api/setup/provider/connect/route.ts
src/app/api/setup/provider/status/route.ts
src/app/api/setup/provider/test/route.ts
src/app/api/setup/readiness/route.ts
src/app/api/setup/test-sms/route.ts
src/app/api/setup/webhooks/install/route.ts
src/app/api/setup/webhooks/status/route.ts
src/app/api/sitter-tiers/route.ts
src/app/api/sitter/[id]/bookings/[bookingId]/accept/route.ts
src/app/api/sitter/[id]/bookings/[bookingId]/decline/route.ts
src/app/api/sitter/[id]/dashboard/route.ts
src/app/api/sitter/me/dashboard/route.ts
src/app/api/sitter/me/srs/route.ts
src/app/api/sitter/threads/[id]/messages/route.ts
src/app/api/sitter/threads/route.ts
src/app/api/sitters/[id]/activity/route.ts
src/app/api/sitters/[id]/calendar/route.ts
src/app/api/sitters/[id]/calendar/toggle/route.ts
src/app/api/sitters/[id]/dashboard/route.ts
src/app/api/sitters/[id]/messages/route.ts
src/app/api/sitters/[id]/performance/route.ts
src/app/api/sitters/[id]/route.ts
src/app/api/sitters/[id]/service-events/route.ts
src/app/api/sitters/[id]/srs/route.ts
src/app/api/sitters/[id]/tier/details/route.ts
src/app/api/sitters/[id]/tier/summary/route.ts
src/app/api/sitters/[id]/time-off/route.ts
src/app/api/sitters/route.ts
src/app/api/sitters/srs/route.ts
src/app/api/twilio/inbound/route.ts
src/app/api/webhooks/stripe/route.ts
```

---

## Section 9: All UI page.tsx Files (Paths Only)

```
src/app/assignments/page.tsx
src/app/automation-center/[id]/page.tsx
src/app/automation-center/new/page.tsx
src/app/automation-center/page.tsx
src/app/automation/page.tsx
src/app/automations/[id]/page.tsx
src/app/automations/page.tsx
src/app/bookings/[id]/page.tsx
src/app/bookings/new/page.tsx
src/app/bookings/page.tsx
src/app/bookings/sitters/page.tsx
src/app/calendar/accounts/page.tsx
src/app/calendar/page.tsx
src/app/clients/[id]/page.tsx
src/app/clients/page.tsx
src/app/dashboard/page.tsx
src/app/exceptions/page.tsx
src/app/inbox/page.tsx
src/app/integrations/page.tsx
src/app/login/page.tsx
src/app/messages/page.tsx
src/app/numbers/page.tsx
src/app/ops/proof/page.tsx
src/app/page.tsx
src/app/payments/page.tsx
src/app/payroll/page.tsx
src/app/pricing/page.tsx
src/app/settings/business/page.tsx
src/app/settings/custom-fields/page.tsx
src/app/settings/discounts/page.tsx
src/app/settings/form-builder/page.tsx
src/app/settings/page.tsx
src/app/settings/pricing/page.tsx
src/app/settings/rotation/page.tsx
src/app/settings/services/page.tsx
src/app/settings/tiers/page.tsx
src/app/setup/page.tsx
src/app/sitter-dashboard/page.tsx
src/app/sitter-payroll/page.tsx
src/app/sitter/dashboard/page.tsx
src/app/sitter/inbox/page.tsx
src/app/sitter/page.tsx
src/app/sitters/[id]/page.tsx
src/app/templates/[id]/page.tsx
src/app/templates/page.tsx
src/app/tip/cancel/page.tsx
src/app/tip/link-builder/page.tsx
src/app/tip/payment/page.tsx
src/app/tip/success/page.tsx
src/app/ui-kit/page.tsx
```

---

## Section 10: All 79 Model Names

```
model Rate
model Booking
model Pet
model TimeSlot
model Sitter
model SitterPoolOffer
model BookingSitterPool
model Message
model Setting
model Report
model GoogleCalendarAccount
model Automation
model AutomationTrigger
model AutomationConditionGroup
model AutomationCondition
model AutomationAction
model AutomationTemplate
model AutomationRun
model AutomationRunStep
model CustomField
model CustomFieldValue
model ServiceConfig
model PricingRule
model Discount
model DiscountUsage
model FormField
model MessageTemplate
model TemplateHistory
model Role
model RolePermission
model UserRole
model SitterTier
model SitterTierHistory
model ServicePointWeight
model Client
model BookingTag
model BookingTagAssignment
model BookingPipeline
model BusinessSettings
model User
model Account
model Session
model VerificationToken
model BaselineSnapshot
model FeatureFlag
model EventLog
model BookingStatusHistory
model StripeCharge
model StripeRefund
model StripePayout
model StripeBalanceTransaction
model PayrollRun
model PayrollLineItem
model PayrollAdjustment
model MessageAccount
model MessageNumber
model ProviderCredential
model MessageThread
model MessageParticipant
model MessageEvent
model ThreadAssignmentAudit
model OptOutState
model ResponseRecord
model SitterMaskedNumber
model AssignmentWindow
model AntiPoachingAttempt
model SitterTierSnapshot
model SitterServiceEvent
model SitterTimeOff
model OfferEvent
model VisitEvent
model SitterCompensation
model SitterMetricsWindow
model MessageResponseLink
model BookingCalendarEvent
model LoyaltyReward
model PetHealthLog
model SitterVerification
model AnalyticsInsight
```
