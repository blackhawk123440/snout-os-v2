-- Fix: add schema fields that were never migrated and are causing runtime 500s
-- These columns exist in schema.prisma but were missed by 20260325000000_add_missing_enterprise_fields.
-- Prisma fetches ALL columns on findMany without a select, so missing columns throw:
--   "column Client.stripeCustomerId does not exist"
--   "column Sitter.respectGoogleBusy does not exist"

-- Client: Stripe customer ID (used by pay-first booking flow and payment method lookups)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

-- Sitter: Google Calendar busy-blocking flag (used by availability engine and calendar sync)
ALTER TABLE "Sitter" ADD COLUMN IF NOT EXISTS "respectGoogleBusy" BOOLEAN NOT NULL DEFAULT false;
