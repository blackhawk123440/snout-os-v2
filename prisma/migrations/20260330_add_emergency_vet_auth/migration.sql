-- CreateTable
CREATE TABLE "EmergencyVetAuth" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorizedUpToCents" INTEGER NOT NULL,
    "vetName" TEXT,
    "vetPhone" TEXT,
    "vetAddress" TEXT,
    "additionalInstructions" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "signatureName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyVetAuth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyVetAuth_petId_key" ON "EmergencyVetAuth"("petId");

-- CreateIndex
CREATE INDEX "EmergencyVetAuth_orgId_clientId_idx" ON "EmergencyVetAuth"("orgId", "clientId");

-- CreateIndex
CREATE INDEX "EmergencyVetAuth_petId_idx" ON "EmergencyVetAuth"("petId");

-- AddForeignKey
ALTER TABLE "EmergencyVetAuth" ADD CONSTRAINT "EmergencyVetAuth_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyVetAuth" ADD CONSTRAINT "EmergencyVetAuth_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
