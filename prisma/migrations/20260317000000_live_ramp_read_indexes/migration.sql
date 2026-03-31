-- Live ramp remediation: add composite indexes for hot read paths.
CREATE INDEX IF NOT EXISTS "Booking_orgId_status_startAt_id_idx"
ON "Booking"("orgId", "status", "startAt", "id");

CREATE INDEX IF NOT EXISTS "Booking_orgId_paymentStatus_startAt_id_idx"
ON "Booking"("orgId", "paymentStatus", "startAt", "id");

CREATE INDEX IF NOT EXISTS "MessageEvent_orgId_threadId_createdAt_idx"
ON "MessageEvent"("orgId", "threadId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "MessageEvent_threadId_direction_createdAt_idx"
ON "MessageEvent"("threadId", "direction", "createdAt" DESC);
