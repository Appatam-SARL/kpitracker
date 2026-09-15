-- AlterTable
ALTER TABLE "Prospect" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProspectContact" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SalesReport" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SalesReport_companyId_archivedAt_idx" ON "SalesReport"("companyId", "archivedAt");
