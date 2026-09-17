-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "createdById" TEXT;

-- Backfill : premier contact créé sur l'entreprise
UPDATE "Prospect" p
SET "createdById" = sub."createdById"
FROM (
  SELECT DISTINCT ON ("prospectId")
    "prospectId",
    "createdById"
  FROM "ProspectContact"
  WHERE "deletedAt" IS NULL
  ORDER BY "prospectId", "createdAt" ASC
) AS sub
WHERE p."id" = sub."prospectId"
  AND p."createdById" IS NULL;

-- CreateIndex
CREATE INDEX "Prospect_createdById_idx" ON "Prospect"("createdById");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
