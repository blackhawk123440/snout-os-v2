-- Add indexed idempotency columns for outbound message intake replay checks.
ALTER TABLE "MessageEvent"
ADD COLUMN "idempotencyKey" VARCHAR(128),
ADD COLUMN "idempotencyFingerprint" VARCHAR(64);

CREATE INDEX "MessageEvent_orgId_threadId_direction_actorType_idempotencyKey_createdAt_idx"
ON "MessageEvent"("orgId", "threadId", "direction", "actorType", "idempotencyKey", "createdAt" DESC);
