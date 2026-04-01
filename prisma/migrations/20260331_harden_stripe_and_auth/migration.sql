-- Harden Stripe webhook processing metadata so events can be safely reclaimed after failures.
ALTER TABLE "StripeWebhookEvent"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'processing',
  ADD COLUMN "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastError" TEXT;

ALTER TABLE "StripeWebhookEvent"
  ALTER COLUMN "processedAt" DROP NOT NULL;

UPDATE "StripeWebhookEvent"
SET
  "status" = 'processed',
  "claimedAt" = COALESCE("processedAt", CURRENT_TIMESTAMP)
WHERE "status" = 'processing';

CREATE INDEX "StripeWebhookEvent_status_claimedAt_idx"
ON "StripeWebhookEvent"("status", "claimedAt");
