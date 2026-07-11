-- CreateTable
CREATE TABLE "LeadActivityDomain" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,

    CONSTRAINT "LeadActivityDomain_pkey" PRIMARY KEY ("id")
);

-- Backfill depuis l'ancien champ scalaire
INSERT INTO "LeadActivityDomain" ("id", "leadId", "domain")
SELECT
    'lad_' || "id",
    "id",
    TRIM("activityDomain")
FROM "Lead"
WHERE "activityDomain" IS NOT NULL AND TRIM("activityDomain") <> '';

-- DropColumn
ALTER TABLE "Lead" DROP COLUMN "activityDomain";

-- CreateIndex
CREATE INDEX "LeadActivityDomain_domain_idx" ON "LeadActivityDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "LeadActivityDomain_leadId_domain_key" ON "LeadActivityDomain"("leadId", "domain");

-- AddForeignKey
ALTER TABLE "LeadActivityDomain" ADD CONSTRAINT "LeadActivityDomain_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
