CREATE TABLE IF NOT EXISTS "ClientContact" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "e164" TEXT NOT NULL,
    "label" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClientContact_orgId_e164_idx" ON "ClientContact"("orgId", "e164");
CREATE INDEX IF NOT EXISTS "ClientContact_orgId_clientId_idx" ON "ClientContact"("orgId", "clientId");

ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_orgId_fkey" 
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" 
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
