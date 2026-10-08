ALTER TABLE "Pharmacy"
ADD COLUMN "email" TEXT,
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Pharmacy_email_key" ON "Pharmacy"("email");

CREATE TABLE "PharmacyPasswordReset" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyPasswordReset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PharmacyPasswordReset_pharmacyId_createdAt_idx" ON "PharmacyPasswordReset"("pharmacyId", "createdAt");
CREATE INDEX "PharmacyPasswordReset_expiresAt_idx" ON "PharmacyPasswordReset"("expiresAt");

ALTER TABLE "PharmacyPasswordReset"
ADD CONSTRAINT "PharmacyPasswordReset_pharmacyId_fkey"
FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
