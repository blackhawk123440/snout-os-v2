-- Messaging conversation foundation (company/service lanes, lifecycle, flags, availability)

ALTER TABLE "MessageNumber"
ADD COLUMN "poolType" TEXT NOT NULL DEFAULT 'company',
ADD COLUMN "assignedThreadId" TEXT,
ADD COLUMN "assignedAt" TIMESTAMP(3),
ADD COLUMN "releasedAt" TIMESTAMP(3),
ADD COLUMN "poolAlertedAt" TIMESTAMP(3);

ALTER TABLE "MessageThread"
ADD COLUMN "assignedRole" TEXT NOT NULL DEFAULT 'front_desk',
ADD COLUMN "laneType" TEXT NOT NULL DEFAULT 'company',
ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN "activationStage" TEXT NOT NULL DEFAULT 'intake',
ADD COLUMN "meetAndGreetConfirmedAt" TIMESTAMP(3),
ADD COLUMN "clientApprovedAt" TIMESTAMP(3),
ADD COLUMN "sitterApprovedAt" TIMESTAMP(3),
ADD COLUMN "serviceApprovedAt" TIMESTAMP(3),
ADD COLUMN "serviceWindowStart" TIMESTAMP(3),
ADD COLUMN "serviceWindowEnd" TIMESTAMP(3),
ADD COLUMN "graceEndsAt" TIMESTAMP(3),
ADD COLUMN "lastClientMessageAt" TIMESTAMP(3),
ADD COLUMN "lastSitterMessageAt" TIMESTAMP(3);

ALTER TABLE "MessageEvent"
ADD COLUMN "routingDisposition" TEXT NOT NULL DEFAULT 'normal';

CREATE TABLE "MessageConversationFlag" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "messageEventId" TEXT,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "MessageConversationFlag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SitterAvailabilityRequest" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "bookingId" TEXT,
  "sitterId" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requestMessageEventId" TEXT,
  "responseMessageEventId" TEXT,
  "responseText" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "responseLatencySec" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SitterAvailabilityRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MessageNumber_poolType_idx" ON "MessageNumber"("poolType");
CREATE INDEX "MessageNumber_assignedThreadId_idx" ON "MessageNumber"("assignedThreadId");

CREATE INDEX "MessageThread_lifecycleStatus_idx" ON "MessageThread"("lifecycleStatus");
CREATE INDEX "MessageThread_activationStage_idx" ON "MessageThread"("activationStage");
CREATE INDEX "MessageThread_laneType_idx" ON "MessageThread"("laneType");
CREATE INDEX "MessageThread_graceEndsAt_idx" ON "MessageThread"("graceEndsAt");
CREATE INDEX "MessageThread_orgId_laneType_activationStage_lifecycleStatus_lastMessageAt_id_idx"
ON "MessageThread"("orgId", "laneType", "activationStage", "lifecycleStatus", "lastMessageAt" DESC, "id" DESC);

CREATE INDEX "MessageEvent_routingDisposition_idx" ON "MessageEvent"("routingDisposition");

CREATE INDEX "MessageConversationFlag_orgId_threadId_createdAt_idx"
ON "MessageConversationFlag"("orgId", "threadId", "createdAt" DESC);
CREATE INDEX "MessageConversationFlag_orgId_type_severity_createdAt_idx"
ON "MessageConversationFlag"("orgId", "type", "severity", "createdAt" DESC);
CREATE INDEX "MessageConversationFlag_resolvedAt_idx" ON "MessageConversationFlag"("resolvedAt");

CREATE INDEX "SitterAvailabilityRequest_orgId_threadId_status_requestedAt_idx"
ON "SitterAvailabilityRequest"("orgId", "threadId", "status", "requestedAt" DESC);
CREATE INDEX "SitterAvailabilityRequest_orgId_sitterId_status_requestedAt_idx"
ON "SitterAvailabilityRequest"("orgId", "sitterId", "status", "requestedAt" DESC);
CREATE INDEX "SitterAvailabilityRequest_orgId_bookingId_idx" ON "SitterAvailabilityRequest"("orgId", "bookingId");

ALTER TABLE "MessageConversationFlag"
ADD CONSTRAINT "MessageConversationFlag_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageConversationFlag"
ADD CONSTRAINT "MessageConversationFlag_messageEventId_fkey"
FOREIGN KEY ("messageEventId") REFERENCES "MessageEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SitterAvailabilityRequest"
ADD CONSTRAINT "SitterAvailabilityRequest_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SitterAvailabilityRequest"
ADD CONSTRAINT "SitterAvailabilityRequest_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SitterAvailabilityRequest"
ADD CONSTRAINT "SitterAvailabilityRequest_sitterId_fkey"
FOREIGN KEY ("sitterId") REFERENCES "Sitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SitterAvailabilityRequest"
ADD CONSTRAINT "SitterAvailabilityRequest_requestMessageEventId_fkey"
FOREIGN KEY ("requestMessageEventId") REFERENCES "MessageEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SitterAvailabilityRequest"
ADD CONSTRAINT "SitterAvailabilityRequest_responseMessageEventId_fkey"
FOREIGN KEY ("responseMessageEventId") REFERENCES "MessageEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
