CREATE INDEX IF NOT EXISTS "Booking_orgId_createdAt_id_idx"
  ON "Booking" ("orgId", "createdAt" DESC, "id");

CREATE INDEX IF NOT EXISTS "MessageThread_orgId_status_lastMessageAt_id_idx"
  ON "MessageThread" ("orgId", "status", "lastMessageAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "MessageThread_orgId_assignedSitterId_status_lastMessageAt_id_idx"
  ON "MessageThread" ("orgId", "assignedSitterId", "status", "lastMessageAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "MessageThread_orgId_clientId_status_lastMessageAt_id_idx"
  ON "MessageThread" ("orgId", "clientId", "status", "lastMessageAt" DESC, "id" DESC);
