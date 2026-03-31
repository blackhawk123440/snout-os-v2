-- Safety-net migration: adds all columns confirmed missing from the staging DB.
-- All statements use IF NOT EXISTS so this is idempotent and safe to run on any DB state.
-- Root cause: prior migrations (20260325000000, 20260325100000) may not have applied
-- correctly on Render staging; this migration consolidates all known gaps.

-- Sitter: onboardingStatus (was never in any prior migration; schema default 'active')
ALTER TABLE "Sitter" ADD COLUMN IF NOT EXISTS "onboardingStatus" TEXT NOT NULL DEFAULT 'active';

-- Client: stripeCustomerId (should have been added by 20260325100000; guard in case it didn't apply)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

-- Booking: stripeCheckoutSessionId (should have been added by 20260325000000; guard in case it didn't apply)
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "stripeCheckoutSessionId" TEXT;

-- Sitter: respectGoogleBusy (should have been added by 20260325100000; guard in case it didn't apply)
ALTER TABLE "Sitter" ADD COLUMN IF NOT EXISTS "respectGoogleBusy" BOOLEAN NOT NULL DEFAULT false;
