-- AlterTable: soft delete (corbeille) sur Lead, User, SalesGoal, LeadAttachment
ALTER TABLE "Lead" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT;

ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT;

ALTER TABLE "SalesGoal" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT;

ALTER TABLE "LeadAttachment" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT;

-- Foreign keys
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesGoal" ADD CONSTRAINT "SalesGoal_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadAttachment" ADD CONSTRAINT "LeadAttachment_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "Lead_companyId_deletedAt_idx" ON "Lead"("companyId", "deletedAt");
CREATE INDEX "User_companyId_deletedAt_idx" ON "User"("companyId", "deletedAt");
CREATE INDEX "SalesGoal_companyId_deletedAt_idx" ON "SalesGoal"("companyId", "deletedAt");
CREATE INDEX "LeadAttachment_leadId_deletedAt_idx" ON "LeadAttachment"("leadId", "deletedAt");
