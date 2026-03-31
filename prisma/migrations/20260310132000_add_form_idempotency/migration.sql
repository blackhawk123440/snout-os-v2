-- Add idempotency persistence for /api/form booking requests
CREATE TABLE IF NOT EXISTS "BookingRequestIdempotency" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "route" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "statusCode" INTEGER,
  "responseBodyJson" TEXT,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingRequestIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BookingRequestIdempotency_org_route_idempotency_key"
  ON "BookingRequestIdempotency"("orgId", "route", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "BookingRequestIdempotency_orgId_route_idx"
  ON "BookingRequestIdempotency"("orgId", "route");
CREATE INDEX IF NOT EXISTS "BookingRequestIdempotency_resourceType_resourceId_idx"
  ON "BookingRequestIdempotency"("resourceType", "resourceId");
CREATE INDEX IF NOT EXISTS "BookingRequestIdempotency_createdAt_idx"
  ON "BookingRequestIdempotency"("createdAt");
